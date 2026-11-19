"""The ocean's temperature by depth each month since 1940 (#590), and the equatorial Pacific (#895).

IAP v4.2 (Cheng et al. 2024, *IAPv4 ocean temperature and ocean heat content gridded dataset*,
Earth System Science Data 16, 3517, doi:10.5194/essd-16-3517-2024) gives each month from 1940
the temperature anomaly of each 1° cell at 119 standard depths from 1 to 6000 m. IAP packs each
decade's months into one zip of classic NetCDF-3 files, about 30 MB a month, compressed with
Deflate64 (read by the system's ``unzip``, as Python's ``zipfile`` cannot); each zip is pinned
by its SHA-256 and read a file at a time, and nothing raw is stored beyond the download cache.

Kept from each month:

- three depths, the surface (1 m), 100 m and 700 m, as maps on the site's node-registered 1°
  grid (``krapp.regrid``), each against its calendar month's mean over 1991-2020 (IAP's own
  anomalies are taken against that period again, so these match the site's sea surface maps);
- a section along the equator for El Niño and La Niña (#895): the mean over 2°S-2°N of each
  1° column from 120°E to 80°W (160 columns, west first) at each standard depth to 400 m (41
  levels), against 1991-2020 in the same way.

Before Argo floats (from about 2005) the deep ocean, and before the TAO buoys (the 1990s) the
equatorial subsurface, were seldom measured: IAP fills the gaps from climate models'
covariances, so the early maps and sections lean on that filling, more the deeper they go.

The maps are packed as ``water_cycle.to_png`` packs trends: R the anomaly from ``-bound`` to
``+bound``, G no change, B 255, A data; one bound for each depth. The sections are packed the
same way without the spreading round coasts, as 160 by 41 images, the surface at the top.

IAP states no licence for its files; they are freely given out from its server and credited
here, as for its heat content (``ocean_heat_map.py``).
"""

import io
import json
import re
import subprocess
import urllib.request
import zipfile
from dataclasses import dataclass
from typing import TYPE_CHECKING

import numpy as np
from PIL import Image

from histeclipse_pipeline.enso_sst import sha256_of
from histeclipse_pipeline.netcdf3 import read_netcdf3
from histeclipse_pipeline.paleotemp import COLUMNS, ROWS
from histeclipse_pipeline.precipitation import masked
from histeclipse_pipeline.sky import Json
from histeclipse_pipeline.water_cycle import Trend, to_nodes, to_png

if TYPE_CHECKING:
    from collections.abc import Iterable, Iterator
    from pathlib import Path

    from histeclipse_pipeline.krapp import Grid

BASE_URL = (
    "http://www.ocean.iap.ac.cn/ftp/cheng/IAPv4.2_IAP_Temperature_anomaly_gridded_1month_netcdf/"
)
SOURCE = "http://www.ocean.iap.ac.cn/pages/dataService/dataService.html"
PAPER = "https://doi.org/10.5194/essd-16-3517-2024"
CREDIT = (
    "IAP v4.2 gridded ocean temperature anomalies (Cheng et al. 2024, IAPv4 ocean temperature "
    "and ocean heat content gridded dataset, Earth System Science Data 16, 3517), Institute of "
    "Atmospheric Physics, Chinese Academy of Sciences, no licence stated; anomalies against "
    "1991-2020 computed for this site, averaged onto a 1° grid and packed into 8-bit images"
)
LICENCE = "none stated; freely available from the IAP, credited"
BASE = (1991, 2020)
MONTHS = 12
#: The depths mapped: name, metres, the colour bound and the step values are rounded to, °C.
#: Rounding keeps the maps small (about 84 MB for 1940-2026, #590); the steps are finer than
#: the ocean was measured at those depths before Argo.
DEPTHS: tuple[tuple[str, float, float, float], ...] = (
    ("surface", 1.0, 4.0, 0.1),
    ("100m", 100.0, 4.0, 0.1),
    ("700m", 700.0, 1.0, 0.025),
)
#: The equatorial section: latitudes either side of the equator, longitudes east, depth.
SECTION_LATITUDE = 2.0
SECTION_WEST = 120.0
SECTION_EAST = 280.0
SECTION_DEPTH = 400.0
SECTION_BOUND = 4.0
SECTION_STEP = 0.1
#: IAP's missing marker is 999; anything this large is missing.
_MISSING_FROM = 900.0
_MONTH_FILE = re.compile(r"year_(\d{4})_month_(\d{2})\.nc$")


@dataclass(frozen=True)
class Month:
    """One month: its maps (°C on IAP's grid, latitude first) and its equatorial section."""

    year: int
    month: int
    maps: dict[str, Grid]
    section: Grid
    latitude: Grid
    longitude: Grid
    depths: Grid


def read_month(data: bytes) -> Month:
    """Read one of IAP's monthly files: its month (``time``, yyyymm), maps and section."""
    variables, _ = read_netcdf3(data)
    stamp = round(float(variables["time"].values.item(0)))
    year, month = divmod(stamp, 100)
    if not 1 <= month <= MONTHS:
        msg = f"time {stamp} is not yyyymm"
        raise ValueError(msg)
    values = masked(variables["temp"])
    temp = np.asarray(np.where(np.fabs(values) >= _MISSING_FROM, np.nan, values), np.float64)
    latitude = variables["lat"].values
    longitude = variables["lon"].values
    depths = variables["depth_std"].values
    listed: list[float] = depths.tolist()  # pyright: ignore[reportAny]
    maps: dict[str, Grid] = {}
    for name, metres, _, _ in DEPTHS:
        if metres not in listed:
            msg = f"no level at {metres} m"
            raise ValueError(msg)
        maps[name] = np.asarray(temp[:, :, listed.index(metres)], np.float64)
    rows = np.fabs(latitude) < SECTION_LATITUDE
    columns = (longitude > SECTION_WEST) & (longitude < SECTION_EAST)
    levels = depths <= SECTION_DEPTH
    band = temp[rows][:, columns][:, :, levels]
    known = np.isfinite(band)
    with np.errstate(invalid="ignore", divide="ignore"):
        mean = np.where(known, band, 0.0).sum(axis=0) / known.sum(axis=0)
    section = np.asarray(mean.T, np.float64)  # depth first, then longitude
    return Month(year, month, maps, section, latitude, longitude, depths[levels])


#: Deflate64, which IAP's zips use and Python's ``zipfile`` cannot read: ``unzip`` reads it.
DEFLATE64 = 9


def unzipped(path: Path, name: str) -> bytes:
    """Read one file of a zip with the system's ``unzip`` (Info-ZIP reads Deflate64)."""
    found = subprocess.run(  # noqa: S603 - fixed program, a path and a name from the zip itself
        ["unzip", "-p", str(path), name],  # noqa: S607 - unzip from the system's PATH
        capture_output=True,
        check=True,
    )
    return found.stdout


def zip_months(path: Path) -> Iterator[bytes]:
    """Yield each monthly file in a decade's zip, in order of name, one at a time."""
    with zipfile.ZipFile(path) as opened:
        for info in sorted(opened.infolist(), key=lambda each: each.filename):
            if not _MONTH_FILE.search(info.filename):
                continue
            if info.compress_type == DEFLATE64:
                yield unzipped(path, info.filename)
            else:
                yield opened.read(info.filename)


@dataclass
class Normals:
    """Sums each calendar month over the base years, then gives the means."""

    sums: dict[tuple[str, int], Grid]
    counts: dict[tuple[str, int], int]

    def add(self, month: Month) -> None:
        """Add a month if it is in the base years."""
        if not BASE[0] <= month.year <= BASE[1]:
            return
        for name, field in [*month.maps.items(), ("section", month.section)]:
            key = (name, month.month)
            self.sums[key] = field if key not in self.sums else self.sums[key] + field
            self.counts[key] = self.counts.get(key, 0) + 1

    def mean(self, name: str, month: int) -> Grid:
        """Return a calendar month's mean over the base years; all thirty must have been read."""
        key = (name, month)
        if self.counts.get(key, 0) != BASE[1] - BASE[0] + 1:
            msg = f"{name}, month {month}: the base {BASE[0]}-{BASE[1]} is not complete"
            raise ValueError(msg)
        return np.asarray(self.sums[key] / self.counts[key], np.float64)


def normals(months: Iterable[Month]) -> Normals:
    """Read the base years' means from every month (the first pass)."""
    found = Normals({}, {})
    for month in months:
        found.add(month)
    return found


def pack(values: Grid, bound: float) -> bytes:
    """Pack a section as the maps are packed, without spreading round its edges."""
    known = np.isfinite(values)
    scaled = (np.clip(np.where(known, values, 0.0), -bound, bound) + bound) / (2 * bound)
    value = np.round(scaled * 255).astype(np.uint8)
    zero = np.full(value.shape, 128, dtype=np.uint8)
    flag = np.full(value.shape, 255, dtype=np.uint8)
    mask = np.where(known, 255, 0).astype(np.uint8)
    out = io.BytesIO()
    Image.fromarray(np.stack([value, zero, flag, mask], axis=-1)).save(out, "PNG", optimize=True)
    return out.getvalue()


def rounded(values: Grid, step: float) -> Grid:
    """Round to a multiple of ``step``; NaN stays NaN."""
    return np.asarray(np.round(values / step) * step, np.float64)


def month_text(year: int, month: int) -> str:
    """Write a month as ``YYYY-MM``."""
    return f"{year:04d}-{month:02d}"


def write_month(month: Month, usual: Normals, folder: Path) -> None:
    """Write a month's three maps and its section, each against the base years' mean."""
    stamp = month_text(month.year, month.month)
    for name, _, bound, step in DEPTHS:
        anomaly = month.maps[name] - usual.mean(name, month.month)
        regridded: Grid = to_nodes(anomaly[None], month.latitude, month.longitude)[0]  # pyright: ignore[reportAny]
        nodes = rounded(regridded, step)
        place = folder / name
        place.mkdir(parents=True, exist_ok=True)
        _ = (place / f"{stamp}.png").write_bytes(to_png(Trend(nodes, np.isfinite(nodes)), bound))
    section = rounded(month.section - usual.mean("section", month.month), SECTION_STEP)
    place = folder / "section"
    place.mkdir(parents=True, exist_ok=True)
    _ = (place / f"{stamp}.png").write_bytes(pack(section, SECTION_BOUND))


def index_file(
    first: tuple[int, int], last: tuple[int, int], depths: Grid, accessed: str
) -> dict[str, Json]:
    """Build the manifest: credit, baseline, the depths and their bounds, and the section."""
    levels: list[float] = depths.tolist()  # pyright: ignore[reportAny]
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "paper": PAPER,
        "licence": LICENCE,
        "accessed": accessed,
        "units": "°C",
        "baseline": f"{BASE[0]}\N{EN DASH}{BASE[1]}, each calendar month against its own mean",
        "encoding": "R anomaly from -bound to +bound; G zero; B 255; A data",
        "files": "<depth>/YYYY-MM.png and section/YYYY-MM.png",
        "first": month_text(*first),
        "last": month_text(*last),
        "columns": COLUMNS,
        "rows": ROWS,
        "depths": [
            {"id": name, "metres": metres, "bound": bound, "step": step}
            for name, metres, bound, step in DEPTHS
        ],
        "section": {
            "latitude": SECTION_LATITUDE,
            "west": SECTION_WEST,
            "east": SECTION_EAST,
            "levels": list[Json](levels),
            "bound": SECTION_BOUND,
            "step": SECTION_STEP,
        },
    }


def write_all(
    months: Iterable[Month], usual: Normals, folder: Path, accessed: str
) -> dict[str, Json]:
    """Write every month (the second pass) and the index; return the index."""
    first: tuple[int, int] | None = None
    last = (0, 0)
    depths: Grid | None = None
    for month in months:
        write_month(month, usual, folder)
        stamp = (month.year, month.month)
        first = first or stamp
        last = stamp
        depths = month.depths
    if first is None or depths is None:
        msg = "no months to write"
        raise ValueError(msg)
    index = index_file(first, last, depths, accessed)
    _ = (folder / "index.json").write_text(
        json.dumps(index, separators=(",", ":"), ensure_ascii=False) + "\n"
    )
    return index


#: The decade zips of the release of 7 November 2026 (to September 2026), and their SHA-256. A
#: new release changes them; the last grows every month. Served over plain HTTP only; the
#: checksums guard them.
DECADES: tuple[tuple[str, str], ...] = (
    ("1940_1949", "e7a2befc3a71d2e10532c72eb57991531a8e882c4714819a6d1b3964662231ef"),
    ("1950_1959", "292c2259196c5fe75dd71e77b8ad1eb8937adccbd6d4c3828ab97ca779e53498"),
    ("1960_1969", "87c1f0ddf245ec0a8d03ce9898958ef1bb98a0383382ece2ca5f4c19a10a8daa"),
    ("1970_1979", "e9a21870c284a7f2a55690aa7ebe3e2ee05cd94147f972aa1f37d3c79a692798"),
    ("1980_1989", "1686c69e88002910240a395f2a170280b72cc110c6db196ebfa922bc5d7aa5de"),
    ("1990_1999", "28c3e523f67499a588ab40da3c9ce7f0856f21594bc257696595710fa5406ebc"),
    ("2000_2009", "57a95b2ca44b5a50050c16965bb64436451668f7a915c5c43133edd799cad655"),
    ("2010_2019", "60484cc937cb1be70e486dd0a8d9bf68b700f2fd03ad3f8255152a5d9b679f83"),
    ("2020_2026", "63721e5c6e47a8fcff9c20553df6a2d901aa40bfebd0a13fd09532ac6a0c1fcd"),
)


def zip_name(span: str) -> str:
    """Name IAP's zip for a span of years, e.g. ``1940_1949``."""
    return f"Temperature_Anomaly_IAPv4.2_gridded_data_{span}.zip"


def base_spans() -> list[str]:
    """List the spans whose years reach into the base period."""
    return [span for span, _ in DECADES if int(span[5:]) >= BASE[0] and int(span[:4]) <= BASE[1]]


def months_in(paths: Iterable[Path]) -> Iterator[Month]:
    """Read every month of the zips at ``paths``, in order."""
    for path in paths:
        for data in zip_months(path):
            yield read_month(data)


def _cached(name: str, sha256: str, cache: Path) -> Path:  # pragma: no cover - needs network
    """Download one of IAP's zips into ``cache`` unless there; check it against its pin.

    IAP serves plain HTTP only; the URL is the pinned ``BASE_URL`` and the checksum guards it.
    """
    path = cache / name
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or sha256_of(path) != sha256:
        url = BASE_URL + name
        request = urllib.request.Request(url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
        with urllib.request.urlopen(request, timeout=7200) as response, path.open("wb") as out:  # noqa: S310  # pyright: ignore[reportAny]
            while chunk := response.read(1 << 20):  # pyright: ignore[reportAny]
                _ = out.write(chunk)  # pyright: ignore[reportAny]
    found = sha256_of(path)
    if found != sha256:
        msg = f"{name}: SHA-256 {found}, pinned {sha256}"
        raise ValueError(msg)
    return path


def fetch_ocean_temperature(
    folder: Path, cache: Path
) -> int:  # pragma: no cover - needs network access
    """Download the zips (checked against their pins) and write the maps; count the months."""
    import datetime as dt  # noqa: PLC0415

    paths = {span: _cached(zip_name(span), sha256, cache) for span, sha256 in DECADES}
    usual = normals(months_in(paths[span] for span in base_spans()))
    accessed = dt.datetime.now(tz=dt.UTC).date().isoformat()
    index = write_all(months_in(paths.values()), usual, folder, accessed)
    first, last = str(index["first"]), str(index["last"])
    return (int(last[:4]) - int(first[:4])) * MONTHS + int(last[5:]) - int(first[5:]) + 1
