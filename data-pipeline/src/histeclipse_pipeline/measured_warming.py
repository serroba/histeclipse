"""Measured warming on land and sea since 1850, from Berkeley Earth's gridded field (#485, #587).

Berkeley Earth's land-and-ocean field (``Land_and_Ocean_LatLong1.nc``; Rohde & Hausfather 2020,
*The Berkeley Earth Land/Ocean Temperature Record*, Earth System Science Data 12, 3469,
doi:10.5194/essd-12-3469-2020): monthly surface temperature anomalies from 1850 on a 1° grid of
cells, against 1951-1980, with each cell's land fraction. Over land it is the air temperature;
over the sea, the water's surface temperature (from HadSST4); over sea ice, the air's, the
version Berkeley Earth recommends. Licensed CC BY-NC 4.0, for non-commercial use, as this
site is.

The site shows it after Krapp et al.'s ice-age maps (``krapp.py``), whose present is
pre-industrial, so it is measured here from 1850-1900, the baseline the boundaries story's
chart uses. Each frame is the mean of the five years ending at its year, every five years from
1850, and the last year in the file: 5-year means, so a single hot or cold year does not jump
out. A year counts where all twelve months have data; a frame where at least four of its five
years do; the baseline where at least 40 of its 51 years do. Cells under half land are left
out: in early years, much of the sea, away from the ships' tracks, has no data either.

Much land has too few records in 1850-1900 for a baseline of its own (#497): two thirds of
the tropics, much of Australia and Antarctica; and so has much of the sea. Left without one,
a cell would show as unchanged. There the cell is measured from 1951-1980, which the field
covers nearly everywhere, and shifted back by how much warmer 1951-1980 was than 1850-1900 in
its 15° band of latitude (a cos-latitude weighted mean over the cells that have both), or over
its whole surface where its band has none. Land and sea are shifted apart, each by its own
cells, as the sea warmed more slowly. That shift, some 0.3 to 0.6 °C, is the one estimate; the
warming since is measured. Only inland Antarctica, without 25 years of 1951-1980, is left
without data. A cell counts as land from half land up, else as sea.

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
from dataclasses import dataclass
from typing import TYPE_CHECKING

import h5py
import numpy as np
import numpy.typing as npt

from histeclipse_pipeline.krapp import Grid, bounds, land_mean, regrid, to_png
from histeclipse_pipeline.paleotemp import COLUMNS, ROWS
from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from collections.abc import Iterable, Mapping
    from pathlib import Path

SOURCE = "https://berkeleyearth.org/data/"
FILE_URL = (
    "https://berkeley-earth-temperature.s3.us-west-1.amazonaws.com/Global/Gridded/"
    "Land_and_Ocean_LatLong1.nc"
)
#: The release of 9 January 2025, through December 2024. A newer release changes it.
FILE_SHA256 = "ac5d960eab0868472f43a50362d325e1a2200005936b6c123d78f5180c86e468"
CREDIT = (
    "Berkeley Earth (Rohde & Hausfather 2020, The Berkeley Earth Land/Ocean Temperature "
    "Record, Earth System Science Data 12, 3469), gridded land and ocean temperatures, air "
    "temperature over sea ice, release of 9 January 2025, CC BY-NC 4.0; 5-year means against "
    "1850-1900, averaged onto a 1° grid and packed into 8-bit images for this site"
)
BASELINE = (1850, 1900)
#: Of the baseline's 51 years, how many a cell needs.
BASELINE_YEARS = 40
#: Where a cell has no baseline of its own: the later period it is measured from instead.
LATER = (1951, 1980)
#: Of the later period's 30 years, how many a cell needs.
LATER_YEARS = 25
#: The bands of latitude whose mean shift from the later period to the baseline is used, °.
BAND_DEGREES = 15
FIRST_FRAME = 1850
STEP_YEARS = 5
#: Of a frame's five years, how many a cell needs.
FRAME_YEARS = 4
#: Months in a year: a year counts only when it has them all.
MONTHS = 12
#: A cell counts as land from this fraction up; below, as sea.
LAND = 0.5
#: The two surfaces, shifted apart where a baseline is estimated.
SURFACES = ("land", "sea")


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


@dataclass(frozen=True)
class Shift:
    """How much warmer 1951-1980 was than 1850-1900 on one surface, land or sea."""

    surface: str
    #: Each band's shift (south edge, °; °C).
    bands: list[tuple[int, float]]
    #: The whole surface's, for bands with no cells of both.
    overall: float


@dataclass(frozen=True)
class Baseline:
    """Each cell's 1850-1900 mean, measured or estimated, and how much is estimated."""

    #: °C, as the field's anomalies; NaN where neither period has enough data.
    values: Grid
    #: True where the cell's own 1850-1900 records were too few, and the baseline is estimated.
    estimated: npt.NDArray[np.bool_]
    #: True where the cell is land, else sea.
    land: npt.NDArray[np.bool_]
    #: The land's shift, then the sea's.
    shifts: list[Shift]


def _weighted_mean(values: Grid, weights: Grid) -> float | None:
    known = np.isfinite(values)
    if not known.any():
        return None
    return float(np.average(values[known], weights=weights[known]))


def _shift(surface: str, both: Grid, rows: Grid, weights: Grid) -> tuple[Shift, Grid]:
    """One surface's shift from 1950-1980 to 1850-1900, by band, and as a value for each cell.

    ``both`` is 1951-1980 less 1850-1900 on this surface's cells with both, NaN elsewhere.
    """
    overall = _weighted_mean(both, weights)
    if overall is None:
        msg = f"no {surface} cell has both 1850-1900 and 1951-1980"
        raise ValueError(msg)
    bands: list[tuple[int, float]] = []
    by_cell = np.full(both.shape, overall)
    for south in range(-90, 90, BAND_DEGREES):
        band = (rows >= south) & (rows < south + BAND_DEGREES)
        mean = _weighted_mean(np.where(band, both, np.nan), weights)
        if mean is not None:
            bands.append((south, round(mean, 2)))
            by_cell = np.where(band, mean, by_cell)
    return Shift(surface, bands, round(overall, 2)), np.asarray(by_cell, dtype=np.float64)


def baseline(annual: Mapping[int, Grid], land: Grid, latitude: Grid) -> Baseline:
    """Each cell's 1850-1900 baseline: its own, or 1951-1980's shifted back by its band's.

    Land and sea are shifted apart, each by its own cells.
    """
    first, last = BASELINE
    early = mean_of((annual[year] for year in range(first, last + 1)), BASELINE_YEARS)
    start, end = LATER
    later = mean_of((annual[year] for year in range(start, end + 1)), LATER_YEARS)
    both = later - early  # NaN unless the cell has both
    rows = np.broadcast_to(latitude[:, None], both.shape)
    weights = np.cos(np.radians(rows))
    on_land = np.asarray(land >= LAND)
    estimated = np.isnan(early) & np.isfinite(later)
    values = early
    shifts: list[Shift] = []
    for surface, cells in zip(SURFACES, (on_land, ~on_land), strict=True):
        shift, by_cell = _shift(surface, np.where(cells, both, np.nan), rows, weights)
        shifts.append(shift)
        values = np.where(cells & estimated, later - by_cell, values)
    return Baseline(values, np.asarray(estimated), on_land, shifts)


def frames(annual: Mapping[int, Grid], base: Baseline) -> tuple[Grid, list[tuple[int, Grid]]]:
    """Measure each frame's 5-year mean from the baseline; the baseline's own coverage too.

    Returns 0 where there is a baseline (NaN elsewhere) and each frame's anomalies, still on
    the source's cells; a frame only where the file has enough of its years.
    """
    out: list[tuple[int, Grid]] = []
    for year in frame_years(max(annual)):
        span = [annual[each] for each in range(year - STEP_YEARS + 1, year + 1) if each in annual]
        # The file's first years cannot fill a frame: 1850's would hold 1850 alone.
        if len(span) >= FRAME_YEARS:
            out.append((year, mean_of(span, FRAME_YEARS) - base.values))
    return np.where(np.isfinite(base.values), 0.0, np.nan), out


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
    base: Baseline,
    axes: tuple[Grid, Grid],
    folder: Path,
) -> int:
    """Regrid the baseline and frames onto the 1° nodes; write a PNG per frame and the index.

    ``axes`` are the source's cell centres: latitude, then longitude.
    """
    latitude, longitude = axes
    zero = regrid(baseline, latitude, longitude)
    grids = [(year, regrid(grid, latitude, longitude)) for year, grid in measured]
    coldest, warmest = bounds([zero, *(grid for _, grid in grids)])
    folder.mkdir(parents=True, exist_ok=True)
    for year, grid in grids:
        _ = (folder / file_name(year)).write_bytes(to_png(grid, zero, coldest, warmest))
    means = [(year, land_mean(grid)) for year, grid in grids]
    index = index_file(means, coldest, warmest, estimate_of(base, latitude))
    _ = (folder / "index.json").write_text(json.dumps(index, separators=(",", ":")) + "\n")
    return len(grids)


def estimate_of(base: Baseline, latitude: Grid) -> dict[str, Json]:
    """Describe the estimated baseline: from when, over how much of land and sea, how far."""
    start, end = LATER
    rows = np.broadcast_to(latitude[:, None], base.values.shape)
    weights = np.cos(np.radians(rows))
    flags = np.where(np.isfinite(base.values), base.estimated.astype(np.float64), np.nan)

    def share(cells: npt.NDArray[np.bool_]) -> float:
        return round(_weighted_mean(np.where(cells, flags, np.nan), weights) or 0.0, 2)

    surfaces: list[Json] = []
    for shift in base.shifts:
        cells = base.land if shift.surface == "land" else ~base.land
        surfaces.append(
            {
                "surface": shift.surface,
                "share": share(cells),
                "bands": [{"south": south, "shift": value} for south, value in shift.bands],
                "shift": shift.overall,
            }
        )
    return {
        "from": f"{start}\u2013{end}",
        "share": share(np.ones(base.land.shape, dtype=np.bool_)),
        "surfaces": surfaces,
    }


def build(data: bytes, folder: Path) -> int:
    """Write the images from the NetCDF file's bytes."""
    with h5py.File(io.BytesIO(data), "r") as opened:
        latitude = np.asarray(opened["latitude"][()], dtype=np.float64)
        longitude = np.asarray(opened["longitude"][()], dtype=np.float64)
        land = np.asarray(opened["land_mask"][()], dtype=np.float64)
        annual = read_annual(opened)
    base = baseline(annual, land, latitude)
    zero, measured = frames(annual, base)
    return write_warming(zero, measured, base, (latitude, longitude), folder)


def fetch_measured_warming(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download the land-and-ocean field (checked against its pinned checksum); write the images."""
    request = urllib.request.Request(FILE_URL, headers={"User-Agent": "histeclipse-pipeline"})
    with urllib.request.urlopen(request, timeout=900) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{FILE_URL}: expected bytes"
        raise TypeError(msg)
    return build(verified(body, FILE_SHA256, "Berkeley Earth land and ocean field"), folder)


def file_name(year: int) -> str:
    """Name the image for a frame by its last year, e.g. ``2024.png``."""
    return f"{year}.png"


def index_file(
    frames: list[tuple[int, float]], coldest: float, warmest: float, estimated: dict[str, Json]
) -> dict[str, Json]:
    """Build the manifest the web app reads: credit, baseline, encoding, grid and frames."""
    first, last = BASELINE
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "licence": "CC BY-NC 4.0",
        "baseline": f"{first}\u2013{last}",
        "estimated": estimated,
        "years": STEP_YEARS,
        "coverage": "land and sea",
        "columns": COLUMNS,
        "rows": ROWS,
        "coldest": coldest,
        "warmest": warmest,
        "frames": [
            {"year": year, "file": file_name(year), "mean": round(mean, 2)} for year, mean in frames
        ],
    }
