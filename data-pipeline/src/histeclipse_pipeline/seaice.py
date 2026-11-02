"""Sea ice today and at the Last Glacial Maximum, for the ice-age globe.

Today: NSIDC's Sea Ice Index (G02135, version 4; Fetterer et al., doi:10.7265/N5K072F8), the
monthly sea-ice concentration grids for March and September 1981-2010, averaged. NOAA@NSIDC data,
free to use with credit. The grids are 25 km on NSIDC's polar stereographic projections (Hughes
1980 ellipsoid, true scale at 70°), read here from their uncompressed GeoTIFFs.

The Last Glacial Maximum, 21,000 years ago: three climate models' PMIP4/CMIP6 "lgm" runs, sea-ice
concentration ("siconc"), March and September averaged over the years in one file of each:
MPI-ESM1-2-LR, MIROC-ES2L and AWI-ESM-1-1-LR. All three were published under CC BY-SA 4.0 and
relaxed to CC BY 4.0 in June 2022 (CMIP6 source_id licence register). Models differ, so all three
are kept; the reader picks.

Each source becomes two 1° maps: the most ice in the year (the larger of March and September,
cell by cell) and the ice that lasts all year (the smaller). In the north March is the winter
maximum and September the summer minimum; in the south the other way round.
"""

import io
import json
import math
import struct
import urllib.request
import warnings
from dataclasses import dataclass
from typing import TYPE_CHECKING

import h5py
import numpy as np
from PIL import Image

from histeclipse_pipeline.paleotemp import COLUMNS, ROWS

if TYPE_CHECKING:
    from collections.abc import Callable, Iterable
    from pathlib import Path

type Grid = np.typing.NDArray[np.float64]

SCHEMA_VERSION = 1
#: A byte holds concentration in steps of 0.4%: 250 is full cover.
STEPS_PER_PERCENT = 2.5
NSIDC_URL = "https://noaadata.apps.nsidc.org/NOAA/G02135/{pole}/monthly/geotiff/{month:02d}_{name}/{p}_{year}{month:02d}_concentration_v4.0.tif"
NSIDC_YEARS = range(1981, 2011)
NSIDC_CREDIT = (
    "NSIDC Sea Ice Index, version 4 (Fetterer et al., doi:10.7265/N5K072F8), NOAA@NSIDC: "
    "March and September concentration, 1981-2010 mean"
)
PMIP_CREDIT = (
    "{label} PMIP4/CMIP6 lgm run, sea-ice concentration (siconc), CC BY 4.0 since 2022 (CMIP6 "
    "licence register); March and September means of the years in {file}, regridded to 1°"
)
CMIP6_BASE = "https://esgf.ceda.ac.uk/thredds/fileServer/esg_cmip6/CMIP6/PMIP/"


@dataclass(frozen=True, slots=True)
class Model:
    """One climate model's LGM sea-ice file on ESGF: its folder there, and the file."""

    id: str
    label: str
    folder: str
    file: str

    @property
    def path(self) -> str:
        """Where the file is, under the CMIP6 archive."""
        return self.folder + self.file


MODELS = (
    Model(
        "mpi-esm1-2-lr",
        "MPI-ESM1-2-LR",
        "MPI-M/MPI-ESM1-2-LR/lgm/r1i1p1f1/SImon/siconc/gn/v20190710/",
        "siconc_SImon_MPI-ESM1-2-LR_lgm_r1i1p1f1_gn_233001-234912.nc",
    ),
    Model(
        "miroc-es2l",
        "MIROC-ES2L",
        "MIROC/MIROC-ES2L/lgm/r1i1p1f2/SImon/siconc/gn/v20191002/",
        "siconc_SImon_MIROC-ES2L_lgm_r1i1p1f2_gn_320001-329912.nc",
    ),
    Model(
        "awi-esm-1-1-lr",
        "AWI-ESM-1-1-LR",
        "AWI/AWI-ESM-1-1-LR/lgm/r1i1p1f1/SImon/siconc/gn/v20200212/",
        "siconc_SImon_AWI-ESM-1-1-LR_lgm_r1i1p1f1_gn_399101-400012.nc",
    ),
)

# --- NSIDC polar stereographic grids ----------------------------------------------------------

#: Hughes 1980 ellipsoid.
HUGHES_A = 6_378_273.0
HUGHES_E = 0.081816153
TRUE_SCALE_LATITUDE = 70.0
CELL_M = 25_000.0
#: Concentration is stored in tenths of a percent; values above are flags: 2510 the pole hole
#: the satellites cannot see (always ice-covered in winter and summer alike), 2530 coast, 2540
#: land.
FULL_COVER = 1000
POLE_HOLE = 2510


@dataclass(frozen=True, slots=True)
class PolarGrid:
    """An NSIDC polar stereographic grid: which pole, its size and upper-left corner (m)."""

    north: bool
    columns: int
    rows: int
    left: float
    top: float
    #: The meridian pointing straight down the grid from the pole, degrees.
    central_longitude: float


NORTH = PolarGrid(
    north=True, columns=304, rows=448, left=-3_850_000.0, top=5_850_000.0, central_longitude=-45.0
)
SOUTH = PolarGrid(
    north=False, columns=316, rows=332, left=-3_950_000.0, top=4_350_000.0, central_longitude=0.0
)


def _t(latitude: Grid) -> Grid:
    phi = np.radians(latitude)
    sine = HUGHES_E * np.sin(phi)
    return np.asarray(
        np.tan(np.pi / 4 - phi / 2) / ((1 - sine) / (1 + sine)) ** (HUGHES_E / 2),
        dtype=np.float64,
    )


def polar_xy(grid: PolarGrid, latitude: Grid, longitude: Grid) -> tuple[Grid, Grid]:
    """Project latitude and longitude (degrees) onto a polar grid: x and y in metres (Snyder)."""
    sign = 1.0 if grid.north else -1.0
    phi_c = math.radians(TRUE_SCALE_LATITUDE)
    m_c = math.cos(phi_c) / math.sqrt(1 - (HUGHES_E * math.sin(phi_c)) ** 2)
    t_c = float(np.squeeze(_t(np.array([TRUE_SCALE_LATITUDE]))))
    rho = HUGHES_A * m_c * _t(sign * latitude) / t_c
    lam = np.radians(sign * (longitude - grid.central_longitude))
    return (
        np.asarray(rho * np.sin(lam), dtype=np.float64),
        np.asarray(-sign * rho * np.cos(lam), dtype=np.float64),
    )


def read_concentration(data: bytes) -> np.typing.NDArray[np.uint16]:
    """Read an NSIDC v4 concentration GeoTIFF: little-endian, 16-bit, uncompressed strips."""
    if data[:4] != b"II*\x00":
        msg = "not a little-endian TIFF"
        raise ValueError(msg)
    (offset,) = struct.unpack_from("<I", data, 4)
    (count,) = struct.unpack_from("<H", data, offset)
    tags: dict[int, tuple[int, int, int]] = {}
    for entry in range(count):
        tag, kind, number, value = struct.unpack_from("<HHII", data, offset + 2 + 12 * entry)
        tags[tag] = (kind, number, value)
    width, height = tags[256][2], tags[257][2]
    if tags[258][2] != 16 or tags[259][2] != 1:  # noqa: PLR2004
        msg = "expected 16-bit samples without compression"
        raise ValueError(msg)

    def longs(tag: int) -> list[int]:
        kind, number, value = tags[tag]
        size = "I" if kind == 4 else "H"  # noqa: PLR2004
        if number == 1:
            return [value]
        return list(struct.unpack_from(f"<{number}{size}", data, value))

    raw = b"".join(
        data[start : start + length] for start, length in zip(longs(273), longs(279), strict=True)
    )
    return np.frombuffer(raw, dtype="<u2", count=width * height).reshape(height, width).copy()


def mean_concentration(images: Iterable[np.typing.NDArray[np.uint16]]) -> Grid:
    """Mean percent cover over the years, cell by cell; the pole hole is full, land is NaN."""
    stack = np.stack([np.asarray(image, dtype=np.float64) for image in images])
    stack = np.where(np.equal(stack, POLE_HOLE), float(FULL_COVER), stack)
    valid = stack <= FULL_COVER
    total = np.where(valid, stack, 0.0).sum(axis=0)
    seen = valid.sum(axis=0)
    return np.asarray(
        np.where(seen > 0, total / np.maximum(seen, 1) / 10.0, np.nan), dtype=np.float64
    )


def node_grid() -> tuple[Grid, Grid]:
    """Latitude and longitude of every 1° node: 90° N first, 180° W to 180° E."""
    latitudes = np.linspace(90.0, -90.0, ROWS)
    longitudes = np.linspace(-180.0, 180.0, COLUMNS)
    lon, lat = np.meshgrid(longitudes, latitudes)
    return np.asarray(lat, dtype=np.float64), np.asarray(lon, dtype=np.float64)


def from_polar(grid: PolarGrid, concentration: Grid) -> Grid:
    """Sample a polar grid at every 1° node of its hemisphere (nearest cell); NaN elsewhere."""
    lat, lon = node_grid()
    out = np.full(lat.shape, np.nan)
    hemisphere = lat > 0 if grid.north else lat < 0
    x, y = polar_xy(grid, lat[hemisphere], lon[hemisphere])
    column = np.floor((x - grid.left) / CELL_M).astype(np.intp)
    row = np.floor((grid.top - y) / CELL_M).astype(np.intp)
    inside = (column >= 0) & (column < grid.columns) & (row >= 0) & (row < grid.rows)
    values = np.full(x.shape, np.nan)
    values[inside] = concentration[row[inside], column[inside]]
    out[hemisphere] = values
    return out


# --- Climate models ---------------------------------------------------------------------------


def regrid(latitude: Grid, longitude: Grid, values: Grid) -> Grid:
    """Average model cells onto the 1° nodes they are nearest to; cells with no data are NaN.

    Gaps a coarse model leaves between nodes are filled from their neighbours, twice over.
    """
    keep = np.isfinite(values) & np.isfinite(latitude) & np.isfinite(longitude)
    lon = (longitude[keep] + 180.0) % 360.0 - 180.0
    row = np.rint(90.0 - latitude[keep]).astype(np.intp)
    column = np.rint(lon + 180.0).astype(np.intp)
    flat = row * COLUMNS + column
    total = np.bincount(flat, weights=values[keep], minlength=ROWS * COLUMNS)
    count = np.bincount(flat, minlength=ROWS * COLUMNS)
    out = np.where(count > 0, total / np.maximum(count, 1), np.nan).reshape(ROWS, COLUMNS)
    for _ in range(2):
        out = _fill_from_neighbours(out)
    # 180° W and 180° E are the same meridian.
    out[:, -1] = np.where(np.isfinite(out[:, 0]), out[:, 0], out[:, -1])
    return np.asarray(out, dtype=np.float64)


def _fill_from_neighbours(grid: Grid) -> Grid:
    padded = np.pad(grid, 1, constant_values=np.nan)
    neighbours = np.stack(
        [
            padded[1 + dy : 1 + dy + ROWS, 1 + dx : 1 + dx + COLUMNS]
            for dy in (-1, 0, 1)
            for dx in (-1, 0, 1)
        ]
    )
    known = np.isfinite(neighbours)
    total = np.where(known, neighbours, 0.0).sum(axis=0)
    count = known.sum(axis=0)
    # Only cells with at least three known neighbours: a gap, not open coast.
    filled = np.where(count >= 3, total / np.maximum(count, 1), np.nan)  # noqa: PLR2004
    return np.asarray(np.where(np.isfinite(grid), grid, filled), dtype=np.float64)


def model_months(data: bytes) -> tuple[Grid, Grid, Grid, Grid]:
    """Latitude, longitude and the March and September mean cover (%) of a CMIP6 siconc file."""
    with h5py.File(io.BytesIO(data), "r") as opened:
        # Curvilinear grids name them "latitude"/"longitude"; AWI's unstructured one "lat"/"lon".
        lat_name, lon_name = ("latitude", "longitude") if "latitude" in opened else ("lat", "lon")
        latitude = np.asarray(opened[lat_name][()], dtype=np.float64)
        longitude = np.asarray(opened[lon_name][()], dtype=np.float64)
        cover = np.asarray(opened["siconc"][()], dtype=np.float64)
    cover = np.where(cover > 1e10, np.nan, cover)  # noqa: PLR2004 - the fill value, 1e20
    # Monthly from January: March is index 2, September 8, of each year.
    # Land cells have no value in any year: left NaN, without a warning.
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        march = np.asarray(np.nanmean(cover[2::12], axis=0), dtype=np.float64)
        september = np.asarray(np.nanmean(cover[8::12], axis=0), dtype=np.float64)
    return latitude, longitude, march, september


# --- Output -----------------------------------------------------------------------------------


def most_and_least(march: Grid, september: Grid) -> tuple[Grid, Grid]:
    """Return the most cover in the year and the cover that lasts all year, %, NaN as none."""
    a = np.nan_to_num(march, nan=0.0)
    b = np.nan_to_num(september, nan=0.0)
    return np.asarray(np.maximum(a, b), dtype=np.float64), np.asarray(
        np.minimum(a, b), dtype=np.float64
    )


def to_png(cover: Grid) -> bytes:
    """Percent cover as an 8-bit greyscale PNG, 2.5 steps a percent."""
    encoded = np.clip(np.rint(np.nan_to_num(cover) * STEPS_PER_PERCENT), 0, 250).astype(np.uint8)
    out = io.BytesIO()
    Image.fromarray(encoded, mode="L").save(out, format="PNG", optimize=True)
    return out.getvalue()


def area_share(cover: Grid, threshold: float = 15.0) -> float:
    """Share of Earth's surface with at least `threshold` % cover (the usual extent)."""
    weights = np.cos(np.radians(np.linspace(90, -90, ROWS)))[:, np.newaxis] * np.ones(
        (1, COLUMNS - 1)
    )
    covered = cover[:, :-1] >= threshold
    return round(float((weights * covered).sum() / weights.sum()), 4)


type Json = dict[str, object]


@dataclass(frozen=True, slots=True)
class Source:
    """Where a pair of maps comes from: its id, label, era ("today" or "lgm") and credit."""

    id: str
    label: str
    era: str
    credit: str


def write_source(folder: Path, source: Source, months: tuple[Grid, Grid]) -> Json:
    """Write a source's two maps and return its index entry."""
    most, least = most_and_least(*months)
    _ = (folder / f"{source.id}-most.png").write_bytes(to_png(most))
    _ = (folder / f"{source.id}-year-round.png").write_bytes(to_png(least))
    return {
        "id": source.id,
        "label": source.label,
        "era": source.era,
        "credit": source.credit,
        "most": f"{source.id}-most.png",
        "yearRound": f"{source.id}-year-round.png",
        "extent": area_share(most),
    }


def write_index(folder: Path, sources: list[Json]) -> None:
    """Write ``index.json``."""
    index: Json = {
        "schemaVersion": SCHEMA_VERSION,
        "columns": COLUMNS,
        "rows": ROWS,
        "stepsPerPercent": STEPS_PER_PERCENT,
        "sources": sources,
    }
    _ = (folder / "index.json").write_text(json.dumps(index, separators=(",", ":")) + "\n")


def nsidc_months(download: Callable[[str], bytes]) -> tuple[Grid, Grid]:
    """Today's March and September mean cover on the 1° nodes, both hemispheres."""
    months: list[Grid] = []
    for month, name in ((3, "Mar"), (9, "Sep")):
        both = np.full((ROWS, COLUMNS), np.nan)
        for grid, pole, p in ((NORTH, "north", "N"), (SOUTH, "south", "S")):
            images = (
                read_concentration(
                    download(NSIDC_URL.format(pole=pole, month=month, name=name, p=p, year=year))
                )
                for year in NSIDC_YEARS
            )
            sampled = from_polar(grid, mean_concentration(images))
            both = np.where(np.isfinite(sampled), sampled, both)
        months.append(both)
    return months[0], months[1]


def build(folder: Path, download: Callable[[str], bytes]) -> int:
    """Write today's sea ice and each model's LGM sea ice, and the index; return the count."""
    folder.mkdir(parents=True, exist_ok=True)
    today = Source("nsidc", "NSIDC, 1981-2010", "today", NSIDC_CREDIT)
    sources: list[Json] = [write_source(folder, today, nsidc_months(download))]
    for model in MODELS:
        latitude, longitude, march, september = model_months(download(CMIP6_BASE + model.path))
        months = (regrid(latitude, longitude, march), regrid(latitude, longitude, september))
        credit = PMIP_CREDIT.format(label=model.label, file=model.file)
        sources.append(write_source(folder, Source(model.id, model.label, "lgm", credit), months))
    write_index(folder, sources)
    return len(sources)


def fetch_seaice(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download what is needed and write the maps."""

    def download(url: str) -> bytes:
        if not url.startswith("https://"):
            msg = f"{url}: only https downloads"
            raise ValueError(msg)
        request = urllib.request.Request(url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310 - https only, checked above
        with urllib.request.urlopen(request, timeout=300) as response:  # noqa: S310  # pyright: ignore[reportAny]
            body: object = response.read()  # pyright: ignore[reportAny]
        if not isinstance(body, bytes):
            msg = f"{url}: expected bytes"
            raise TypeError(msg)
        return body

    return build(folder, download)
