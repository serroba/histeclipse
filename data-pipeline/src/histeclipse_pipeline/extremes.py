"""How the hottest day and the wettest day of the year have changed, from HadEX3 (#530).

HadEX3 (Dunn et al. 2020, *Development of an Updated Global Land In Situ-Based Data Set of
Temperature and Precipitation Extremes: HadEX3*, JGR Atmospheres 125, e2019JD032263,
doi:10.1029/2019JD032263), version 3.0.4: yearly indices of moderate extremes computed from
daily station records and gridded at 1.25° by 1.875° over land, 1901-2018. Met Office, Crown
Copyright, under the Open Government Licence v3; it may contain data governed by WMO
Resolution 40 whose owners restrict commercial use, which this non-commercial site respects.

Two of its indices:

- TXx, the year's hottest day: its highest daily maximum temperature, °C;
- Rx1day, the year's wettest day: its largest one-day precipitation, mm.

For each, a trend map over 1951-2018 (per decade, with significance; see ``water_cycle``),
where a node has data in at least two thirds of those years, and the curve of the mean anomaly
against 1961-1990 over those same nodes, so the curve's area does not change from year to
year. HadEX3 is sparse where stations are: much of Africa, South America and the high north
has no data, and the maps leave it empty rather than guess.
"""

import gzip
import io
import json
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

import h5py
import numpy as np

from histeclipse_pipeline.paleotemp import COLUMNS, ROWS
from histeclipse_pipeline.sky import Json, verified
from histeclipse_pipeline.water_cycle import (
    anomalies,
    curve,
    layer,
    symmetric_bound,
    to_nodes,
    to_png,
    trend,
)

if TYPE_CHECKING:
    from pathlib import Path

    from histeclipse_pipeline.krapp import Grid

SOURCE = "https://www.metoffice.gov.uk/hadobs/hadex3/"
BASE_URL = "https://www.metoffice.gov.uk/hadobs/hadex3/data/"
VERSION = "3.0.4"
CREDIT = (
    "HadEX3 version 3.0.4 (Dunn et al. 2020, JGR Atmospheres 125, e2019JD032263), from "
    "https://www.metoffice.gov.uk/hadobs/hadex3/; © British Crown Copyright, Met Office, "
    "2020, provided under the Open Government Licence v3; trends and land means computed for "
    "this site"
)
LICENCE = (
    "Open Government Licence v3 (Crown Copyright, Met Office); some of its station data are "
    "for non-commercial use only"
)


@dataclass(frozen=True)
class Index:
    """One of HadEX3's indices: its name, meaning, units, colour step, and file's SHA-256."""

    name: str
    meaning: str
    units: str
    step: float
    sha256: str


#: The indices, by the id their files take here.
INDICES: dict[str, Index] = {
    "txx": Index(
        "TXx",
        "hottest day of the year (highest daily maximum temperature)",
        "°C",
        0.1,
        "2a0d3704017ce129078d68ea02708aeb633c3a6a620378032f6369799b7078b6",
    ),
    "rx1day": Index(
        "Rx1day",
        "wettest day of the year (largest one-day precipitation)",
        "mm",
        1.0,
        "09b0620656d6c07eedce567876e5782b769a15ad74bd61a3412e97ca696041b7",
    ),
}
PERIOD = (1951, 2018)
BASE = (1961, 1990)
#: Of the base period's years, the share a node needs for an anomaly.
BASE_NEEDED = 2 / 3
#: Values at or below this are HadEX3's missing marker (-99.9).
_MISSING_BELOW = -99.0


def file_url(name: str) -> str:
    """Return the URL of an index's gridded NetCDF file, gzipped."""
    return f"{BASE_URL}HadEX3_{name}_1901-2018_ADW_61-90_1.25x1.875deg.nc.gz"


def read_index(data: bytes) -> tuple[list[int], Grid, Grid, Grid]:
    """Read an index's yearly fields: years, fields (years first), latitude, longitude."""
    with h5py.File(io.BytesIO(gzip.decompress(data)), "r") as opened:
        years: list[int] = np.asarray(opened["time"][()], dtype=np.int64).tolist()  # pyright: ignore[reportAny]
        fields = np.asarray(opened["Ann"][()], dtype=np.float64)
        latitude = np.asarray(opened["latitude"][()], dtype=np.float64)
        longitude = np.asarray(opened["longitude"][()], dtype=np.float64)
    fields = np.where(fields <= _MISSING_BELOW, np.nan, fields)
    return years, fields, latitude, longitude


def build(sources: dict[str, bytes], folder: Path) -> int:
    """Write a trend map per index and the index file with the curves; return the map count."""
    first, last = PERIOD
    maps: list[Json] = []
    curves: list[Json] = []
    folder.mkdir(parents=True, exist_ok=True)
    for key, each in INDICES.items():
        years, fields, latitude, longitude = read_index(sources[key])
        nodes = to_nodes(fields, latitude, longitude)
        picked = [index for index, year in enumerate(years) if first <= year <= last]
        found = trend([years[index] for index in picked], nodes[picked])
        bound = symmetric_bound([found.slope], each.step)
        _ = (folder / f"{key}.png").write_bytes(to_png(found, bound))
        maps.append(
            {
                **layer(key, found, PERIOD, bound, 2),
                "index": each.name,
                "meaning": each.meaning,
                "units": f"{each.units} per decade",
            }
        )
        anomaly = anomalies(years, nodes, BASE, BASE_NEEDED)
        kept_years = [years[index] for index in picked]
        curve_years, values = curve(kept_years, anomaly[picked], np.isfinite(found.slope))
        curves.append(
            {
                "id": key,
                "index": each.name,
                "units": each.units,
                "years": list[Json](curve_years),
                "values": list[Json](values),
            }
        )
    index = index_file(maps, curves)
    _ = (folder / "index.json").write_text(json.dumps(index, separators=(",", ":")) + "\n")
    return len(maps)


def index_file(maps: list[Json], curves: list[Json]) -> dict[str, Json]:
    """Build the manifest the web app reads: credit, baseline, encoding, maps and curves."""
    first, last = BASE
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "licence": LICENCE,
        "version": VERSION,
        "baseline": f"{first}\u2013{last}",
        "coverage": "land with stations",
        "significance": 0.1,
        "encoding": "R trend from -bound to +bound; G no trend; B significant; A data",
        "columns": COLUMNS,
        "rows": ROWS,
        "maps": maps,
        "curves": curves,
    }


def fetch_extremes(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download the indices (checked against their pinned checksums) and write the maps."""
    sources: dict[str, bytes] = {}
    for key, each in INDICES.items():
        url = file_url(each.name)
        request = urllib.request.Request(url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
        with urllib.request.urlopen(request, timeout=900) as response:  # noqa: S310  # pyright: ignore[reportAny]
            body: object = response.read()  # pyright: ignore[reportAny]
        if not isinstance(body, bytes):
            msg = f"{url}: expected bytes"
            raise TypeError(msg)
        sources[key] = verified(body, each.sha256, f"HadEX3 {each.name}")
    return build(sources, folder)
