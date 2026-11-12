"""Measured warming on land since 1850, from Berkeley Earth's gridded land temperatures (#485).

Berkeley Earth's land-only field (``Complete_TAVG_LatLong1.nc``; Rohde & Hausfather 2020, *The
Berkeley Earth Land/Ocean Temperature Record*, Earth System Science Data 12, 3469,
doi:10.5194/essd-12-3469-2020): monthly air temperature anomalies from 1750 on a 1° grid of
cells, against 1951-1980, with each cell's land fraction. Licensed CC BY-NC 4.0, for
non-commercial use, as this site is.

The site shows it after Krapp et al.'s ice-age maps (``krapp.py``), whose present is
pre-industrial, so it is measured here from 1850-1900, the baseline the boundaries story's
chart uses. Each frame is the mean of the five years ending at its year, every five years from
1850, and the last year in the file: 5-year means, so a single hot or cold year does not jump
out. A year counts where all twelve months have data; a frame where at least four of its five
years do; the baseline where at least 40 of its 51 years do (where it has fewer, as over
Antarctica, the cell has no data and stays uncoloured). Cells under half land are left out:
the site colours land only, as Krapp's maps do.

The images are packed as Krapp's are, on the same node-registered 1° grid (``krapp.regrid``),
so the globe's shader reads them the same way and shows the change as R - G:

- R: the frame's anomaly against 1850-1900, °C, as a byte from ``coldest`` to ``warmest``;
- G: 0 °C, the baseline, on the same scale;
- B: 255 where the baseline has data;
- A: 255 where the frame has data.
"""

import io
import json
import urllib.request
from typing import TYPE_CHECKING

import h5py
import numpy as np

from histeclipse_pipeline.krapp import Grid, bounds, land_mean, regrid, to_png
from histeclipse_pipeline.paleotemp import COLUMNS, ROWS
from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from collections.abc import Iterable, Mapping
    from pathlib import Path

SOURCE = "https://berkeleyearth.org/data/"
FILE_URL = (
    "https://berkeley-earth-temperature.s3.us-west-1.amazonaws.com/Global/Gridded/"
    "Complete_TAVG_LatLong1.nc"
)
#: The release of 9 January 2025, through December 2024. A newer release changes it.
FILE_SHA256 = "4b78118b5552cc4987a7c575b042a0ea92de55d7c01f47783edb81d082c40664"
CREDIT = (
    "Berkeley Earth (Rohde & Hausfather 2020, The Berkeley Earth Land/Ocean Temperature "
    "Record, Earth System Science Data 12, 3469), gridded land temperatures, release of "
    "9 January 2025, CC BY-NC 4.0; 5-year means against 1850-1900, land only, averaged onto a "
    "1° grid and packed into 8-bit images for this site"
)
BASELINE = (1850, 1900)
#: Of the baseline's 51 years, how many a cell needs.
BASELINE_YEARS = 40
FIRST_FRAME = 1850
STEP_YEARS = 5
#: Of a frame's five years, how many a cell needs.
FRAME_YEARS = 4
#: Months in a year: a year counts only when it has them all.
MONTHS = 12
#: A cell counts as land from this fraction up.
LAND = 0.5


def annual_mean(months: Grid) -> Grid:
    """Average twelve months (first axis) into a year; NaN where any month has none."""
    if months.shape[0] != MONTHS:
        msg = f"expected 12 months, got {months.shape[0]}"
        raise ValueError(msg)
    complete = np.isfinite(months).all(axis=0)
    with np.errstate(invalid="ignore"):
        mean = np.where(complete, months.mean(axis=0), np.nan)
    return np.asarray(mean, dtype=np.float64)


def mean_of(years: Iterable[Grid], needed: int) -> Grid:
    """Average the years cell by cell; NaN where fewer than ``needed`` have data."""
    stack = np.stack(list(years))
    count = np.isfinite(stack).sum(axis=0)
    total = np.where(np.isfinite(stack), stack, 0.0).sum(axis=0)
    with np.errstate(invalid="ignore", divide="ignore"):
        mean = np.where(count >= needed, total / count, np.nan)
    return np.asarray(mean, dtype=np.float64)


def frame_years(last: int) -> list[int]:
    """Every five years from 1850 to ``last``, and ``last`` itself."""
    years = list(range(FIRST_FRAME, last + 1, STEP_YEARS))
    return years if years[-1] == last else [*years, last]


def frames(annual: Mapping[int, Grid], land: Grid) -> tuple[Grid, list[tuple[int, Grid]]]:
    """Measure each frame's 5-year mean from the baseline; the baseline's own coverage too.

    Returns the baseline (0 where it has data, NaN elsewhere) and each frame's anomalies, land
    cells only, still on the source's cells.
    """
    first, last = BASELINE
    baseline = mean_of((annual[year] for year in range(first, last + 1)), BASELINE_YEARS)
    baseline = np.where(land >= LAND, baseline, np.nan)
    out: list[tuple[int, Grid]] = []
    for year in frame_years(max(annual)):
        span = [annual[each] for each in range(year - STEP_YEARS + 1, year + 1) if each in annual]
        out.append((year, mean_of(span, FRAME_YEARS) - baseline))
    return np.where(np.isfinite(baseline), 0.0, np.nan), out


def read_annual(opened: h5py.File) -> dict[int, Grid]:
    """Read every complete year's mean anomaly, by year, indexed latitude first."""
    times = np.asarray(opened["time"][()], dtype=np.float64)
    years = np.floor(times).astype(np.int64)
    temperature = opened["temperature"]
    annual: dict[int, Grid] = {}
    first = int(years.min())
    last = int(years.max())
    for year in range(first, last + 1):
        rows: list[int] = np.flatnonzero(years == year).tolist()  # pyright: ignore[reportAny]
        if len(rows) != MONTHS:  # a year still in progress
            continue
        months = np.asarray(temperature[rows[0] : rows[-1] + 1], dtype=np.float64)
        annual[year] = annual_mean(months)
    return annual


def write_warming(
    baseline: Grid,
    measured: Iterable[tuple[int, Grid]],
    latitude: Grid,
    longitude: Grid,
    folder: Path,
) -> int:
    """Regrid the baseline and frames onto the 1° nodes; write a PNG per frame and the index."""
    zero = regrid(baseline, latitude, longitude)
    grids = [(year, regrid(grid, latitude, longitude)) for year, grid in measured]
    coldest, warmest = bounds([zero, *(grid for _, grid in grids)])
    folder.mkdir(parents=True, exist_ok=True)
    for year, grid in grids:
        _ = (folder / file_name(year)).write_bytes(to_png(grid, zero, coldest, warmest))
    means = [(year, land_mean(grid)) for year, grid in grids]
    body = json.dumps(index_file(means, coldest, warmest), separators=(",", ":"))
    _ = (folder / "index.json").write_text(body + "\n")
    return len(grids)


def build(data: bytes, folder: Path) -> int:
    """Write the images from the NetCDF file's bytes."""
    with h5py.File(io.BytesIO(data), "r") as opened:
        latitude = np.asarray(opened["latitude"][()], dtype=np.float64)
        longitude = np.asarray(opened["longitude"][()], dtype=np.float64)
        land = np.asarray(opened["land_mask"][()], dtype=np.float64)
        baseline, measured = frames(read_annual(opened), land)
    return write_warming(baseline, measured, latitude, longitude, folder)


def fetch_measured_warming(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download the land field (checked against its pinned checksum) and write the images."""
    request = urllib.request.Request(FILE_URL, headers={"User-Agent": "histeclipse-pipeline"})
    with urllib.request.urlopen(request, timeout=900) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{FILE_URL}: expected bytes"
        raise TypeError(msg)
    return build(verified(body, FILE_SHA256, "Berkeley Earth land field"), folder)


def file_name(year: int) -> str:
    """Name the image for a frame by its last year, e.g. ``2024.png``."""
    return f"{year}.png"


def index_file(frames: list[tuple[int, float]], coldest: float, warmest: float) -> dict[str, Json]:
    """Build the manifest the web app reads: credit, baseline, encoding, grid and frames."""
    first, last = BASELINE
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "licence": "CC BY-NC 4.0",
        "baseline": f"{first}\u2013{last}",
        "years": STEP_YEARS,
        "coverage": "land",
        "columns": COLUMNS,
        "rows": ROWS,
        "coldest": coldest,
        "warmest": warmest,
        "frames": [
            {"year": year, "file": file_name(year), "mean": round(mean, 2)} for year, mean in frames
        ],
    }
