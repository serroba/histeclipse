"""Where the ocean has gained heat since 1960: IAP's gridded heat content as trend maps (#527).

IAP v4.2 (Cheng et al. 2024, *IAPv4 ocean temperature and ocean heat content gridded dataset*,
Earth System Science Data 16, 3517, doi:10.5194/essd-16-3517-2024) gives, for each month from
1940, the ocean heat content anomaly of each 1° cell from the surface down to 100, 300, 700,
1500, 2000 m and deeper, in J/m² (per square metre of sea surface), against 1981-2010 and with
the seasonal cycle removed. Each month is one classic NetCDF-3 file of about 2.3 MB; IAP also
packs each decade's months into one zip. There are no yearly files.

The decades 1960-2019 are read from their zips, each pinned by its SHA-256. The months of
2020-2025 are read one by one, as IAP's zip of the current decade grows every month; they are
pinned together by one checksum of their names and checksums (:func:`manifest`). Each file is
read, reduced to the layers kept here, and dropped: nothing raw is stored.

From each year's mean (a cell counts in a year when all twelve months have data) come trend
maps (``water_cycle.trend``): the least-squares slope over a window, kept where a node has two
thirds of the years, with its significance at the 10% level, here put in W/m², the heat the
column under a square metre of sea surface gained each second on average (a J/m² per year
divided by the seconds in a year). The windows: 1960-2025 for the 0-700 m and 0-2000 m layers,
and 2005-2025 for 0-2000 m, the years Argo floats have sampled the open ocean to 2000 m. Before
Argo, most of the deep layer, and the Southern Ocean at every depth, was seldom measured; IAP
fills those gaps with covariances from climate models, so the early part of the long trends
there leans on that filling. The 0-2000 m trends are the heat gained by the whole column, so
they include the 0-700 m layer's.

The maps are on the same node-registered 1° grid as the site's other maps (``krapp.regrid``)
and packed as ``water_cycle.to_png`` packs trends: R the trend from ``-bound`` to ``+bound``,
G no trend, B significant, A data. The bound is shared by the three maps.

IAP states no licence for its files; they are freely given out from its server and credited
here, as the site does for IAP's global series (``ocean_heat.py``).
"""

import hashlib
import io
import json
import re
import urllib.request
import zipfile
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

import numpy as np

from histeclipse_pipeline.netcdf3 import read_netcdf3
from histeclipse_pipeline.paleotemp import COLUMNS, ROWS
from histeclipse_pipeline.precipitation import masked
from histeclipse_pipeline.sky import Json, verified
from histeclipse_pipeline.water_cycle import Trend, layer, symmetric_bound, to_nodes, to_png, trend

if TYPE_CHECKING:
    from collections.abc import Iterable, Iterator, Sequence
    from pathlib import Path

    from histeclipse_pipeline.krapp import Grid

BASE_URL = "http://www.ocean.iap.ac.cn/ftp/cheng/IAPv4.2_Ocean_Heat_Content_anomaly_0_6000m/"
SOURCE = "http://www.ocean.iap.ac.cn/pages/dataService/dataService.html"
#: The decade zips of the release of 7 November 2026, and their SHA-256. A new release
#: changes them. Served over plain HTTP only; the checksums guard them.
DECADES: tuple[tuple[str, str], ...] = (
    ("1960_1969", "263b48acfab0d943a1b6518346345bab3be997d30be6cf43610a9a5cd8cd7a2c"),
    ("1970_1979", "29a7a7ef5aae7d036e884bdca18065c1c1a492b7ed72a4daf50072d9966dfdfe"),
    ("1980_1989", "0a335ccac796b296556216c15d60929ffb9839e4a0831eb56decb594da8134f4"),
    ("1990_1999", "8cbcdb44dbad31bf61562613dbc75a227c0f48db85ee7dabf457d2b4753c629e"),
    ("2000_2009", "46cae35aa75af3378639f79ce24401669157fc6501f5e99eaceea0af7e383295"),
    ("2010_2019", "6e0c9be2654306e59740d1c733d4db39cd79af3fd3892f090f7ecbac7c785aaf"),
)
#: The months read one by one, and the SHA-256 of their manifest (see :func:`manifest`).
TAIL_YEARS = (2020, 2025)
TAIL_SHA256 = "58cd1a2625a24103cff4c7d48afc955d44cbf46b75c3bd98fdfddc70dedeb721"
CREDIT = (
    "IAP v4.2 gridded ocean heat content anomalies (Cheng et al. 2024, IAPv4 ocean temperature "
    "and ocean heat content gridded dataset, Earth System Science Data 16, 3517), Institute of "
    "Atmospheric Physics, Chinese Academy of Sciences, release of November 2026, no licence "
    "stated; yearly means, trends in W/m² and their significance computed for this site, "
    "averaged onto a 1° grid and packed into 8-bit images"
)
ACCESSED = "2026-11-13"
LICENCE = "none stated; freely available from the IAP, credited"
#: The layers kept, by their variable in IAP's files.
LAYERS = {"0-700m": "OHC700", "0-2000m": "OHC2000"}
#: The maps: layer and window.
MAPS: tuple[tuple[str, tuple[int, int]], ...] = (
    ("0-700m", (1960, 2025)),
    ("0-2000m", (1960, 2025)),
    ("0-2000m", (2005, 2025)),
)
MONTHS = 12
#: Seconds in a (Julian) year: a J/m² per year over this is W/m².
SECONDS_PER_YEAR = 365.25 * 86400
#: Years in a decade: ``water_cycle.trend`` gives slopes per decade.
DECADE = 10
#: The colour bound is rounded up to this many W/m².
STEP = 0.5
#: IAP's missing marker is 1e30; anything this large is missing.
_MISSING_FROM = 1e29
_MONTH_FILE = re.compile(r"OHCa_IAP_0_6000m_year_(\d{4})_month_(\d{2})\.nc$")


def month_name(year: int, month: int) -> str:
    """Name IAP's file for a month, e.g. ``OHCa_IAP_0_6000m_year_2020_month_01.nc``."""
    return f"OHCa_IAP_0_6000m_year_{year}_month_{month:02d}.nc"


def tail_names() -> list[str]:
    """List the files read one by one, in order."""
    first, last = TAIL_YEARS
    return [month_name(year, month) for year in range(first, last + 1) for month in range(1, 13)]


def manifest(files: Iterable[tuple[str, bytes]]) -> bytes:
    """List each file's name and SHA-256, one a line, in the order given; pinned as a whole."""
    lines = (f"{name} {hashlib.sha256(data).hexdigest()}\n" for name, data in files)
    return "".join(lines).encode()


@dataclass(frozen=True)
class Month:
    """One month's layers (J/m², NaN where no data), latitude first, and its axes."""

    year: int
    month: int
    layers: dict[str, Grid]
    latitude: Grid
    longitude: Grid


def read_month(data: bytes) -> Month:
    """Read one of IAP's monthly files: its month (from ``time``, yyyymm) and the layers kept."""
    variables, _ = read_netcdf3(data)
    stamp = round(float(variables["time"].values.item(0)))
    year, month = divmod(stamp, 100)
    if not 1 <= month <= MONTHS:
        msg = f"time {stamp} is not yyyymm"
        raise ValueError(msg)
    layers: dict[str, Grid] = {}
    for name, variable in LAYERS.items():
        values = masked(variables[variable])
        layers[name] = np.asarray(
            np.where(np.fabs(values) >= _MISSING_FROM, np.nan, values), dtype=np.float64
        )
    return Month(year, month, layers, variables["lat"].values, variables["lon"].values)


def zip_months(archive: bytes) -> Iterator[bytes]:
    """Yield each monthly file in a decade's zip, by name, one at a time."""
    with zipfile.ZipFile(io.BytesIO(archive)) as opened:
        for name in sorted(opened.namelist()):
            if _MONTH_FILE.search(name):
                yield opened.read(name)


@dataclass
class Years:
    """Sums each year's months as they come, then gives the yearly means."""

    sums: dict[int, dict[str, Grid]] = field(default_factory=dict)
    months: dict[int, set[int]] = field(default_factory=dict)
    latitude: Grid | None = None
    longitude: Grid | None = None

    def add(self, month: Month) -> None:
        """Add a month; NaN in any month leaves the cell NaN for its year."""
        seen = self.months.setdefault(month.year, set())
        if month.month in seen:
            msg = f"{month.year}-{month.month:02d} read twice"
            raise ValueError(msg)
        seen.add(month.month)
        sums = self.sums.setdefault(month.year, {})
        for name, values in month.layers.items():
            sums[name] = values if name not in sums else sums[name] + values
        self.latitude, self.longitude = month.latitude, month.longitude

    def yearly(self, name: str) -> tuple[list[int], Grid]:
        """Return the complete years and the layer's yearly means on the 1° nodes, years first."""
        if self.latitude is None or self.longitude is None:
            msg = "no months read"
            raise ValueError(msg)
        years = sorted(year for year, seen in self.months.items() if len(seen) == MONTHS)
        means = np.stack([self.sums[year][name] / MONTHS for year in years])
        return years, to_nodes(means, self.latitude, self.longitude)


def watts(found: Trend) -> Trend:
    """Turn a trend in J/m² per decade into W/m²."""
    return Trend(found.slope / DECADE / SECONDS_PER_YEAR, found.significant)


def window(years: Sequence[int], nodes: Grid, period: tuple[int, int]) -> Trend:
    """Fit the trend over ``period`` (W/m²), which the years must cover."""
    first, last = period
    picked = [index for index, year in enumerate(years) if first <= year <= last]
    if len(picked) != last - first + 1:
        msg = f"the years read do not cover {first}-{last}"
        raise ValueError(msg)
    return watts(trend([years[index] for index in picked], nodes[picked]))


def map_name(name: str, period: tuple[int, int]) -> str:
    """Name a map by its layer and window, e.g. ``0-2000m-1960-2025``."""
    first, last = period
    return f"{name}-{first}-{last}"


def build(read: Years, folder: Path) -> int:
    """Write the trend maps and the index; return the number of maps."""
    nodes = {name: read.yearly(name) for name in LAYERS}
    maps = [(name, period, window(*nodes[name], period)) for name, period in MAPS]
    bound = symmetric_bound((found.slope for _, _, found in maps), STEP)
    folder.mkdir(parents=True, exist_ok=True)
    layers: list[Json] = []
    for name, period, found in maps:
        described = layer(map_name(name, period), found, period, bound, 2)
        _ = (folder / str(described["file"])).write_bytes(to_png(found, bound))
        layers.append({**described, "layer": name.replace("m", " m")})
    index = index_file(layers)
    _ = (folder / "index.json").write_text(json.dumps(index, separators=(",", ":")) + "\n")
    return len(maps)


def index_file(layers: list[Json]) -> dict[str, Json]:
    """Build the manifest the web app reads: credit, units, encoding and the maps."""
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "paper": "https://doi.org/10.5194/essd-16-3517-2024",
        "licence": LICENCE,
        "accessed": ACCESSED,
        "units": "W/m²",
        "unitsNote": (
            "heat gained by the water column under each square metre of sea surface, per "
            "second, averaged over the window (the J/m² per year trend over 31 557 600 s)"
        ),
        "sourceBaseline": "1981\u20132010, seasonal cycle removed",
        "significance": 0.1,
        "encoding": "R trend from -bound to +bound; G no trend; B significant; A data",
        "columns": COLUMNS,
        "rows": ROWS,
        "maps": layers,
    }


def _download(url: str) -> bytes:  # pragma: no cover - needs network access
    # Each URL is under the pinned BASE_URL.
    request = urllib.request.Request(url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
    with urllib.request.urlopen(request, timeout=1800) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{url}: expected bytes"
        raise TypeError(msg)
    return body


def fetch_ocean_heat_map(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download IAP's months (checked against the pinned checksums), reduce them, write maps."""
    read = Years()
    for span, sha256 in DECADES:
        archive = verified(_download(f"{BASE_URL}{span}.zip"), sha256, f"IAP OHC {span}")
        for data in zip_months(archive):
            read.add(read_month(data))
        del archive
    tail = [(name, _download(f"{BASE_URL}Monthly/{name}")) for name in tail_names()]
    _ = verified(manifest(tail), TAIL_SHA256, f"IAP OHC months {TAIL_YEARS[0]}-{TAIL_YEARS[1]}")
    for _name, data in tail:
        read.add(read_month(data))
    return build(read, folder)
