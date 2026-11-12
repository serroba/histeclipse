"""Where the land has grown drier or wetter: the SPEI drought index since 1901 (#530).

SPEIbase v2.10 (Beguería, Vicente-Serrano, Reig-Gracia & Latorre Garcés 2024, Digital.CSIC,
doi:10.20350/digitalCSIC/16497; the index from Vicente-Serrano, Beguería & López-Moreno 2010,
*A Multiscalar Drought Index Sensitive to Global Warming: The Standardized Precipitation
Evapotranspiration Index*, Journal of Climate 23, 1696, doi:10.1175/2009JCLI2909.1): the
Standardized Precipitation-Evapotranspiration Index over land on a 0.5° grid, monthly from
1901 to 2023, from CRU TS 4.08 precipitation less FAO-56 Penman-Monteith potential
evapotranspiration. Licensed under the Open Database License (ODbL 1.0): derived data must be
attributed and offered under the same licence, which this site's are.

The index is a standardised score: 0 is a normal water balance for the place and season, -1 one
standard deviation drier, +1 wetter. The 12-month index for December measures the whole calendar
year, so it is taken as the year's value. From it:

- a trend map over 1951-2023 (index units per decade, with significance; see ``water_cycle``);
- the curve of its land mean year by year, and the share of that land at -1 or below
  (moderately dry or drier) each year, over the nodes with data in nine years in ten.

CRU TS fills cells far from any station with its climatology, so where stations are few,
above all before 1950, the index sits near 0 for want of data, not for want of drought.
"""

import io
import json
import urllib.request
from typing import TYPE_CHECKING

import h5py
import numpy as np

from histeclipse_pipeline.paleotemp import COLUMNS, ROWS
from histeclipse_pipeline.sky import Json, verified
from histeclipse_pipeline.water_cycle import (
    Mask,
    area_share,
    curve,
    layer,
    month_dates,
    symmetric_bound,
    text,
    to_nodes,
    to_png,
    trend,
)

if TYPE_CHECKING:
    from collections.abc import Sequence
    from pathlib import Path

    from histeclipse_pipeline.krapp import Grid

SOURCE = "https://doi.org/10.20350/digitalCSIC/16497"
FILE_URL = "https://digital.csic.es/bitstream/10261/364137/12/spei12.nc"
FILE_SHA256 = "3dcfc60d5cab926bcde31f7b424653bc40ebcea8603c1ac4484abfe535f32d31"
CREDIT = (
    "SPEIbase v2.10 (Beguería, Vicente-Serrano, Reig-Gracia & Latorre Garcés 2024, "
    "Digital.CSIC, doi:10.20350/digitalCSIC/16497), 12-month SPEI from CRU TS 4.08, ODbL 1.0; "
    "December values as yearly, trends and land means computed for this site and offered under "
    "the same licence"
)
LICENCE = "ODbL 1.0"
PERIOD = (1951, 2023)
DECEMBER = 12
#: At or below this, a year counts as moderately dry or drier.
DRY = -1.0
#: Of all years, the share a node needs to count in the curves.
CURVE_NEEDED = 0.9
#: Colour bounds are rounded to this many index units per decade.
STEP = 0.05
#: Values above this are the file's missing marker (1e30).
_MISSING_ABOVE = 1e20


def read_decembers(data: bytes) -> tuple[list[int], Grid, Grid, Grid]:
    """Read each December's 12-month SPEI: years, fields (years first), latitude, longitude."""
    with h5py.File(io.BytesIO(data), "r") as opened:
        time = opened["time"]
        units = text(time.attrs["units"], "SPEI time units")
        days: list[float] = np.asarray(time[()], dtype=np.float64).tolist()  # pyright: ignore[reportAny]
        picked = [
            (year, row)
            for row, (year, month) in enumerate(month_dates(units, days))
            if month == DECEMBER
        ]
        spei = opened["spei"]
        fields = np.stack([np.asarray(spei[row], dtype=np.float64) for _, row in picked])
        latitude = np.asarray(opened["lat"][()], dtype=np.float64)
        longitude = np.asarray(opened["lon"][()], dtype=np.float64)
    fields = np.where(np.abs(fields) > _MISSING_ABOVE, np.nan, fields)
    return [year for year, _ in picked], fields, latitude, longitude


def build(years: Sequence[int], nodes: Grid, folder: Path) -> int:
    """Write the trend map and the index with the curves, from the Decembers on the nodes."""
    first, last = PERIOD
    picked = [index for index, year in enumerate(years) if first <= year <= last]
    found = trend([years[index] for index in picked], nodes[picked])
    bound = symmetric_bound([found.slope], STEP)
    folder.mkdir(parents=True, exist_ok=True)
    _ = (folder / "spei12.png").write_bytes(to_png(found, bound))
    land: Mask = np.isfinite(nodes).sum(axis=0) >= CURVE_NEEDED * len(years)
    kept, means = curve(years, nodes, land)
    by_year = dict(zip(years, np.unstack(nodes), strict=True))
    dry: list[float | None] = []
    for year in kept:
        with np.errstate(invalid="ignore"):
            flags = by_year[year] <= DRY
        share = area_share(flags, land & np.isfinite(by_year[year]))
        dry.append(None if share is None else round(share, 3))
    curves: list[Json] = [
        {
            "id": "spei12",
            "years": list[Json](kept),
            "values": list[Json](means),
            "dryShare": list[Json](dry),
        },
    ]
    maps: list[Json] = [{**layer("spei12", found, PERIOD, bound, 3), "units": "SPEI per decade"}]
    index = index_file(maps, curves)
    _ = (folder / "index.json").write_text(json.dumps(index, separators=(",", ":")) + "\n")
    return len(maps)


def index_file(maps: list[Json], curves: list[Json]) -> dict[str, Json]:
    """Build the manifest the web app reads: credit, scale, encoding, the map and the curves."""
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "licence": LICENCE,
        "index": "SPEI, 12 months to December (standardised: 0 normal, -1 one deviation drier)",
        "dry": DRY,
        "coverage": "land",
        "significance": 0.1,
        "encoding": "R trend from -bound to +bound; G no trend; B significant; A data",
        "columns": COLUMNS,
        "rows": ROWS,
        "maps": maps,
        "curves": curves,
    }


def fetch_drought(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download the 12-month SPEI (checked against its pinned checksum) and write the map."""
    request = urllib.request.Request(FILE_URL, headers={"User-Agent": "histeclipse-pipeline"})
    with urllib.request.urlopen(request, timeout=1800) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{FILE_URL}: expected bytes"
        raise TypeError(msg)
    years, fields, latitude, longitude = read_decembers(verified(body, FILE_SHA256, "SPEIbase"))
    return build(years, to_nodes(fields, latitude, longitude), folder)
