"""The ozone layer over the whole Earth each October since 1970 (#722).

The source is the Multi-Sensor Reanalysis of total ozone, MSR-2 (R. J. van der A, M. A. F.
Allaart and H. J. Eskes, KNMI; Atmos. Meas. Tech. 8, 3021, 2015, doi:10.5194/amt-8-3021-2015),
as the Copernicus Climate Change Service gives it in its Climate Data Store: "Ozone monthly
gridded data from 1970 to present derived from satellite observations"
(doi:10.24381/cds.4ebfe4eb), CC BY 4.0. Each month is the mean total column of ozone, in Dobson
units, every half degree (before 1979, when it rests on ground stations and the first
instruments, every degree of latitude and degree and a half of longitude).

It is a reanalysis: satellite measurements, corrected against ground stations, taken into a model
of the air's ozone, which carries it where nothing was measured. From 1979 it has no gaps, and
the places no satellite saw (the polar night) are the model's, not measurements. Before 1979 it
rests on one early instrument (BUV on Nimbus 4) that saw less each year: its Octobers have
gaps, from 1972 over the south, and those of 1977 and 1978 have values for under a tenth of
the Earth and are left out. A gap is written as no value, never filled.

Written here: October of each year, the month the Antarctic ozone hole is deepest, as a
greyscale PNG every degree, and ``maps.json`` naming them, with how much of the Earth each has
values for, its lowest ozone in the south, and, where all the south has values, how much of it
lay under 220 Dobson units, the line that marks the hole.

The Climate Data Store gives the years in three versions of the product, none covering them
all, the older two as classic NetCDF files and the newest as NetCDF-4. Fetching needs a free
account, the dataset's licence accepted on its page, and the account's key in
``~/.cdsapirc``. The files of each span are pinned by one checksum over them all, since the
store packs each download afresh.
"""

from __future__ import annotations

import hashlib
import io
import json
import math
import re
import time
import urllib.request
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

import h5py
import numpy as np
from PIL import Image

from histeclipse_pipeline.netcdf3 import read_netcdf3
from histeclipse_pipeline.water_cycle import text

if TYPE_CHECKING:
    from histeclipse_pipeline.sky import Json

type Grid = np.typing.NDArray[np.float64]

DATASET = "satellite-ozone-v1"
API = "https://cds.climate.copernicus.eu/api/retrieve/v1"
SOURCE = "https://doi.org/10.24381/cds.4ebfe4eb"
LICENCE = "CC BY 4.0"
CREDIT = (
    "Multi-Sensor Reanalysis of total ozone, MSR-2 (van der A, Allaart & Eskes 2015, Atmos. Meas."
    " Tech. 8, 3021, doi:10.5194/amt-8-3021-2015; KNMI), from the Copernicus Climate Change"
    " Service, Climate Data Store: Ozone monthly gridded data from 1970 to present derived from"
    " satellite observations (doi:10.24381/cds.4ebfe4eb), CC BY 4.0; October of each year,"
    " thinned to one degree for this site. Contains modified Copernicus Climate Change Service"
    " information; neither the European Commission nor ECMWF is responsible for any use of it"
)


@dataclass(frozen=True)
class Span:
    """The years one version of the product is taken for, and its files' checksum."""

    version: str
    first: int
    last: int
    sha256: str


#: Each year from the newest version that has it.
SPANS = (
    Span("v0023", 1970, 1994, "fc364ce7daad0fb60c1c2baeb2cf3172618d1e09c7fd8abe010670a0d4a18205"),
    Span("v0023", 1995, 2018, "89d30f986b48461286a97e21eb4d7fdde0668585e44393f6654090f1c7f867d7"),
    Span("v0024", 2019, 2021, "b53f9dd530df33f7501c75b343642973fab030acacca6e7b560dd5057ceb5981"),
    Span("v0025", 2022, 2025, "b55c047c3209a31453ad44c286bc79bba3ff93fc815b9d172a3911debf13b2ed"),
)

#: The month written: the Antarctic hole is deepest in October.
MONTH = 10
#: Below this many Dobson units is the ozone hole, as NASA and WMO draw it.
HOLE_DU = 220.0
#: The hole is looked for south of this latitude.
HOLE_NORTHMOST = -40.0
#: A PNG's value v stands for ``OFFSET_DU + v * STEP_DU`` Dobson units; 0 for no value.
OFFSET_DU = 100.0
STEP_DU = 2.0
ROWS, COLUMNS = 181, 361
#: The reanalysis's grids, rows by columns: half a degree; and, before 1979, 1° by 1.5°.
GRIDS = {(361, 720), (181, 240)}
EARTH_KM = 6371.0
POLE = 90.0
#: All of a region has values, to within rounding.
WHOLE = 0.999
#: An October with values for less of the Earth than this is left out.
LEAST_COVERED = 0.1
FILE_NAME = re.compile(
    r"^(\d{4})(\d{2})-C3S-L4_OZONE-O3_PRODUCTS-MSR-ASSIM-ALG-MONTHLY-(v\d{4})\.nc$"
)


def request(span: Span) -> dict[str, Json]:
    """Give what the Climate Data Store is asked for: every month of a span's years."""
    return {
        "processing_level": "level_4",
        "variable": "atmosphere_mole_content_of_ozone",
        "vertical_aggregation": "total_columns_uv",
        "sensor": "msr",
        "year": [str(year) for year in range(span.first, span.last + 1)],
        "month": [f"{month:02d}" for month in range(1, 13)],
        "version": span.version,
    }


def digest(archive: bytes) -> str:
    """Give one checksum over an archive's files, by name, whatever the packing."""
    total = hashlib.sha256()
    with zipfile.ZipFile(io.BytesIO(archive)) as opened:
        for name in sorted(opened.namelist()):
            total.update(name.encode())
            total.update(hashlib.sha256(opened.read(name)).digest())
    return total.hexdigest()


def _fields(data: bytes) -> tuple[Grid, Grid, Grid, str]:
    """Give a month's column, its latitudes and longitudes, and its units.

    The older versions are classic NetCDF, the newest NetCDF-4.
    """
    if data.startswith(b"CDF"):
        variables, _ = read_netcdf3(data)
        column = variables["total_ozone_column"]
        return (
            column.values,
            variables["latitude"].values,
            variables["longitude"].values,
            str(column.attributes.get("units")),
        )
    with h5py.File(io.BytesIO(data), "r") as opened:
        return (
            np.asarray(opened["total_ozone_column"][()], dtype=np.float64),
            np.asarray(opened["latitude"][()], dtype=np.float64),
            np.asarray(opened["longitude"][()], dtype=np.float64),
            text(opened["total_ozone_column"].attrs["units"], "the ozone column's units"),
        )


def read_month(data: bytes) -> Grid:
    """Read one month's file: Dobson units from 90°N down, 179.5°W eastward, NaN where none."""
    column, latitude, longitude, units = _fields(data)
    if units != "Dobson units":
        msg = f"the ozone column is in {units}, not Dobson units"
        raise ValueError(msg)
    rows, columns = column.shape[-2:]  # pyright: ignore[reportAny]
    if (rows, columns) not in GRIDS:
        msg = f"the ozone grid is {rows} by {columns}, not one of the reanalysis's"
        raise ValueError(msg)
    grid: Grid = column.reshape((rows, columns))
    first, last, west = float(latitude[0]), float(latitude[-1]), float(longitude[0])  # pyright: ignore[reportAny]
    if not (first == -POLE and last == POLE and west == -180 + 360 / columns):
        msg = "the ozone grid does not run from the South Pole to the North, ending at 180°E"
        raise ValueError(msg)
    north_first: Grid = grid[::-1]
    return np.where(north_first <= 0, np.nan, north_first)


def octobers(archive: bytes, span: Span) -> dict[int, Grid]:
    """Read each October in an archive of a span's months, by year."""
    found: dict[int, Grid] = {}
    with zipfile.ZipFile(io.BytesIO(archive)) as opened:
        for name in opened.namelist():
            matched = FILE_NAME.match(Path(name).name)
            if matched is None:
                msg = f"{name}: not a month of the reanalysis"
                raise ValueError(msg)
            year, month, version = int(matched[1]), int(matched[2]), matched[3]
            if version != span.version or not span.first <= year <= span.last:
                msg = f"{name}: not of {span.version}, {span.first} to {span.last}"
                raise ValueError(msg)
            if month == MONTH:
                found[year] = read_month(opened.read(name))
    missing = [year for year in range(span.first, span.last + 1) if year not in found]
    if missing:
        msg = f"{span.version}: no October for {missing}"
        raise ValueError(msg)
    return found


def to_degree(grid: Grid) -> Grid:
    """Take the value at each whole degree, 90°N to 90°S, 180°W to 180°E.

    Half a degree apart, every other one; on the early years' grid, a degree by a degree and a
    half, each row and the nearest column.
    """
    rows, columns = int(grid.shape[0]), int(grid.shape[1])  # pyright: ignore[reportAny]
    each = (rows - 1) // (ROWS - 1)
    # A grid's columns end at 180°E: its first is one step east of 180°W.
    nearest = [(round(column * columns / 360) - 1) % columns for column in range(COLUMNS)]
    return grid[::each][:, nearest]


def to_png(grid: Grid) -> bytes:
    """Dobson units on the one-degree grid as an 8-bit greyscale PNG; 0 where there is none."""
    steps = np.rint((grid - OFFSET_DU) / STEP_DU)
    encoded = np.where(np.isnan(grid), 0, np.clip(steps, 1, 255)).astype(np.uint8)
    out = io.BytesIO()
    Image.fromarray(encoded, mode="L").save(out, format="PNG", optimize=True)
    return out.getvalue()


@dataclass(frozen=True)
class Hole:
    """What a month's map says of the south, and how much of the Earth it has values for."""

    #: The lowest ozone south of 40°S, DU; None where the month has no value there.
    lowest: float | None
    #: The area under 220 DU south of 40°S, million km²; None unless all the south has values.
    area: float | None
    #: The share of the Earth's surface with a value, and of the south's.
    covered: float
    south_covered: float


def hole(grid: Grid) -> Hole:
    """Measure a month on its own grid, each cell counted by its share of the sphere."""
    rows, columns = int(grid.shape[0]), int(grid.shape[1])  # pyright: ignore[reportAny]
    high = 180 / (rows - 1)
    latitude = np.linspace(90.0, -90.0, rows)
    south = latitude <= HOLE_NORTHMOST
    # A cell's area: between its edges in latitude, one column of longitude wide.
    step = math.radians(360 / columns)
    bounds: Grid = np.linspace(POLE + high / 2, -POLE - high / 2, rows + 1)
    edges: Grid = np.radians(np.clip(bounds, -POLE, POLE))
    heights: Grid = np.sin(edges)
    cell: Grid = EARTH_KM**2 * step * (heights[:-1] - heights[1:])
    valued = ~np.isnan(grid)
    covered = float((valued * cell[:, None]).sum() / (cell.sum() * columns))
    in_south = float((valued[south] * cell[south, None]).sum() / (cell[south].sum() * columns))
    below = (grid < HOLE_DU) & south[:, None]
    area = float((below * cell[:, None]).sum()) / 1e6
    return Hole(
        lowest=round(float(np.nanmin(grid[south])), 1) if in_south > 0 else None,
        area=round(area, 1) if in_south >= WHOLE else None,
        covered=round(covered, 3),
        south_covered=round(in_south, 3),
    )


def year_entry(year: int, version: str, grid: Grid) -> dict[str, Json]:
    """Describe one October for the index."""
    found = hole(grid)
    return {
        "year": year,
        "file": f"october-{year}.png",
        "version": version,
        "gridDeg": [180 / (grid.shape[0] - 1), 360 / grid.shape[1]],
        "covered": found.covered,
        "minimumDU": found.lowest,
        "belowMkm2": found.area,
    }


def index_file(years: list[dict[str, Json]], omitted: list[int]) -> dict[str, Json]:
    """Make the index of the Octobers written, with whom to credit and how to read them."""
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "licence": LICENCE,
        "month": MONTH,
        "holeDU": HOLE_DU,
        "encoding": {"offsetDU": OFFSET_DU, "stepDU": STEP_DU},
        "columns": COLUMNS,
        "rows": ROWS,
        "omitted": list(omitted),
        "years": list(years),
    }


def build(archives: list[tuple[Span, bytes]], folder: Path) -> int:
    """Write each October's map and the index to ``folder``; give how many years were written."""
    folder.mkdir(parents=True, exist_ok=True)
    years: list[dict[str, Json]] = []
    omitted: list[int] = []
    for span, archive in archives:
        for year, grid in sorted(octobers(archive, span).items()):
            # An October with values for hardly any of the Earth is no map of it.
            if hole(grid).covered < LEAST_COVERED:
                omitted.append(year)
                continue
            _ = (folder / f"october-{year}.png").write_bytes(to_png(to_degree(grid)))
            years.append(year_entry(year, span.version, grid))
    text = json.dumps(index_file(years, omitted), separators=(",", ":"), ensure_ascii=False)
    _ = (folder / "maps.json").write_text(text + "\n")
    return len(years)


def _key() -> str:  # pragma: no cover - reads the user's own file
    for line in (Path.home() / ".cdsapirc").read_text().splitlines():
        name, _, value = line.partition(":")
        if name.strip() == "key":
            return value.strip()
    msg = "~/.cdsapirc has no key"
    raise ValueError(msg)


def _call(url: str, key: str, body: Json = None) -> dict[str, Json]:  # pragma: no cover - network
    asked = urllib.request.Request(  # noqa: S310
        url,
        data=None if body is None else json.dumps(body).encode(),
        headers={"PRIVATE-TOKEN": key, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(asked, timeout=120) as response:  # noqa: S310  # pyright: ignore[reportAny]
        answer: object = json.loads(response.read())  # pyright: ignore[reportAny]
    if not isinstance(answer, dict):
        msg = f"{url}: not an object"
        raise TypeError(msg)
    return answer  # pyright: ignore[reportUnknownVariableType]


def _retrieve(span: Span, key: str) -> bytes:  # pragma: no cover - needs network access
    job = _call(f"{API}/processes/{DATASET}/execution", key, {"inputs": request(span)})
    while True:
        status = _call(f"{API}/jobs/{job['jobID']}", key)["status"]
        if status == "successful":
            break
        if status == "failed":
            msg = f"the Climate Data Store could not make {span.version} {span.first}-{span.last}"
            raise RuntimeError(msg)
        time.sleep(5)
    results = _call(f"{API}/jobs/{job['jobID']}/results", key)
    asset = results["asset"]
    if not isinstance(asset, dict) or not isinstance(asset["value"], dict):
        msg = "the Climate Data Store's answer names no file"
        raise TypeError(msg)
    with urllib.request.urlopen(str(asset["value"]["href"]), timeout=900) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = "the Climate Data Store's file is not bytes"
        raise TypeError(msg)
    return body


def fetch_ozone_msr(folder: Path, cache: Path) -> int:  # pragma: no cover - needs network access
    """Fetch each span once into ``cache``, check it, and write the Octobers to ``folder``."""
    cache.mkdir(parents=True, exist_ok=True)
    archives: list[tuple[Span, bytes]] = []
    for span in SPANS:
        kept = cache / f"msr-{span.version}-{span.first}-{span.last}.zip"
        if not kept.exists():
            _ = kept.write_bytes(_retrieve(span, _key()))
        archive = kept.read_bytes()
        found = digest(archive)
        if found != span.sha256:
            msg = f"{kept.name}: files' SHA-256 {found} does not match the pinned {span.sha256}"
            raise ValueError(msg)
        archives.append((span, archive))
    return build(archives, folder)
