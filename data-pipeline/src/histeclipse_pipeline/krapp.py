"""Land temperature over the last 800,000 years, from Krapp et al.'s statistical reconstruction.

Krapp, Beyer, Edmundson, Valdes & Manica (2021), *A statistics-based reconstruction of
high-resolution global terrestrial climate for the last 800,000 years*, Scientific Data 8, 228
(doi:10.1038/s41597-021-01009-3): annual mean temperature (bio01) every 1,000 years from 0 to
799 ka on a 0.5° grid, from a statistical emulator of 72 HadCM3 snapshot runs, bias-corrected to
present-day observations. It covers land only, with each step's own coastline and with the ice
sheets and inland seas left out, so the ice ages show as land that is colder, larger (the
shelves exposed by the lower sea) and partly missing (under the ice). The file is the one the
pastclim package serves (Zenodo record 8415273, CC BY 4.0).

Each kept step becomes a small RGBA PNG on the same node-registered 1° grid as the Scotese
maps (361 columns from 180° W to 180° E, 181 rows from 90° N to 90° S), so the site samples
both the same way. A node takes the mean of the valid 0.5° cells centred within half a degree
of it (four cells; two at a pole), wrapping round the 180° meridian; a node with none has no
data. Temperature bytes run linearly from ``coldest`` (0) to ``warmest`` (255) °C. The
channels:

- R: this step's temperature byte;
- G: today's (0 ka) temperature byte, on the same scale, so the change from today is R - G;
- B: 255 where today has data, 0 where it has not;
- A: 255 where this step has data, 0 where it has not (sea, ice).

Today's map rides along in every image because the globe's shader has used up WebGL's sixteen
texture samplers: each map has to be one texture, and the change from today has to be read from
that one texture. In the 0 ka image G equals R and B equals A.

No-data pixels are not left at an arbitrary value: the GPU filters textures before the shader
sees the masks, so at a coast a land pixel's temperature is blended with its sea neighbour's.
In R and G, the first few rings of no-data pixels therefore take the mean of their data
neighbours (a dilation), and the blend at a coast stays a land temperature. Pixels further out
are set to 0, which compresses best and is never blended into land.

Each frame's ``mean`` is an area-weighted (cos latitude) mean over the nodes with data: a mean
of ice-free land on that step's coastline, not a global mean, and not comparable with the
Scotese maps' global means.
"""

import io
import json
import math
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

import h5py
import numpy as np
import numpy.typing as npt
from PIL import Image

from histeclipse_pipeline.paleotemp import COLUMNS, ROWS
from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from collections.abc import Iterable, Iterator
    from pathlib import Path

type Grid = npt.NDArray[np.float64]

ZENODO_RECORD = "https://zenodo.org/records/8415273"
FILE_URL = "https://zenodo.org/api/records/8415273/files/Krapp2021_bio01_v1.4.0.nc/content"
FILE_SHA256 = "d32e3ad17ec5fb1cdb07ce811c15c9821f8b51df5e6f6823e459c29e4749c712"
CREDIT = (
    "Krapp, Beyer, Edmundson, Valdes & Manica (2021), A statistics-based reconstruction of "
    "high-resolution global terrestrial climate for the last 800,000 years, Scientific Data 8, "
    "228, CC BY 4.0, via the pastclim release (Zenodo 8415273); land only, ice sheets left out; "
    "averaged onto a 1° grid and packed into 8-bit images for this site"
)
#: Keep every this many thousand years. The source has every 1,000 (800 steps, 0-799 ka), but
#: those images come to 15.6 MB; every 2,000 (400 steps, 0-798 ka) to 7.8 MB.
STEP_KA = 2
#: Rings of no-data pixels that take their data neighbours' value.
DILATION_PASSES = 3
#: A cell's centre counts for a node within this many degrees (plus rounding slack).
_REACH = 0.5 + 1e-6


@dataclass(frozen=True)
class Source:
    """The reconstruction's axes: thousands of years ago, and cell centres, degrees."""

    ka: tuple[int, ...]
    latitude: Grid
    longitude: Grid


def node_weights(centres: Grid, nodes: Grid, *, period: float | None = None) -> Grid:
    """Mark, nodes by cells, which cells' centres lie within half a degree of each node (0/1).

    With ``period``, distances wrap (longitude: 360).
    """
    distance = np.abs(nodes[:, None] - centres[None, :])
    if period is not None:
        distance = np.minimum(distance, period - distance)
    return np.asarray(distance <= _REACH, dtype=np.float64)


def node_latitudes() -> Grid:
    """Return the grid's rows, 90° N to 90° S."""
    return np.linspace(90.0, -90.0, ROWS)


def node_longitudes() -> Grid:
    """Return the grid's columns, 180° W to 180° E."""
    return np.linspace(-180.0, 180.0, COLUMNS)


def regrid(values: Grid, latitude: Grid, longitude: Grid) -> Grid:
    """Average the valid (finite) cells around each 1° node; NaN where there are none.

    ``values`` is indexed latitude first, in the order of ``latitude`` and ``longitude``.
    """
    rows = node_weights(latitude, node_latitudes())
    columns = node_weights(longitude, node_longitudes(), period=360.0)
    valid = np.isfinite(values)
    total = rows @ np.where(valid, values, 0.0) @ columns.T
    count = rows @ valid.astype(np.float64) @ columns.T
    with np.errstate(invalid="ignore", divide="ignore"):
        mean = np.where(count > 0, total / count, np.nan)
    return np.asarray(mean, dtype=np.float64)


def _neighbour_mean(grid: Grid) -> Grid:
    """Each pixel's mean over its finite 8-neighbours (longitude wraps; NaN if none)."""
    body = grid[:, :-1]  # the last column repeats the first (the same meridian)
    wrapped = np.pad(body, ((0, 0), (1, 1)), mode="wrap")
    padded = np.pad(wrapped, ((1, 1), (0, 0)), constant_values=np.nan)
    rows, columns = ROWS, COLUMNS - 1
    neighbours = np.stack(
        [
            padded[1 + dy : 1 + dy + rows, 1 + dx : 1 + dx + columns]
            for dy in (-1, 0, 1)
            for dx in (-1, 0, 1)
            if (dy, dx) != (0, 0)
        ]
    )
    known = np.isfinite(neighbours)
    total = np.where(known, neighbours, 0.0).sum(axis=0)
    count = known.sum(axis=0)
    with np.errstate(invalid="ignore", divide="ignore"):
        mean = np.where(count > 0, total / count, np.nan)
    return np.asarray(np.concatenate([mean, mean[:, :1]], axis=1), dtype=np.float64)


def dilate(grid: Grid, passes: int = DILATION_PASSES) -> Grid:
    """Give the first ``passes`` rings of NaN pixels round the data their neighbours' mean."""
    out = grid.copy()
    for _ in range(passes):
        out = np.where(np.isfinite(out), out, _neighbour_mean(out))
    return np.asarray(out, dtype=np.float64)


def bounds(grids: Iterable[Grid]) -> tuple[float, float]:
    """Find the coldest and warmest node over every grid, rounded outward to whole degrees."""
    low = math.inf
    high = -math.inf
    for grid in grids:
        low = min(low, float(np.nanmin(grid)))
        high = max(high, float(np.nanmax(grid)))
    return float(math.floor(low)), float(math.ceil(high))


def channels(
    temperatures: Grid, coldest: float, warmest: float
) -> tuple[npt.NDArray[np.uint8], npt.NDArray[np.uint8]]:
    """Pack °C into a temperature byte (linear from coldest, 0, to warmest, 255) and a mask.

    The mask is 255 where there is data and 0 where there is none; the no-data temperature
    bytes come from :func:`dilate` near the data and are 0 beyond it.
    """
    filled = dilate(temperatures)
    scaled = (np.clip(filled, coldest, warmest) - coldest) / (warmest - coldest)
    byte = np.where(np.isfinite(scaled), np.round(scaled * 255), 0).astype(np.uint8)
    mask = np.where(np.isfinite(temperatures), 255, 0).astype(np.uint8)
    return byte, mask


def encode(
    temperatures: Grid, today: Grid, coldest: float, warmest: float
) -> npt.NDArray[np.uint8]:
    """Pack a step and today into RGBA: this step's byte, today's byte, today's mask, its mask."""
    then, then_mask = channels(temperatures, coldest, warmest)
    now, now_mask = channels(today, coldest, warmest)
    return np.stack([then, now, now_mask, then_mask], axis=-1)


def decode(byte: int, coldest: float, warmest: float) -> float:
    """Return the temperature a byte stands for, °C (what the shader computes)."""
    return coldest + byte / 255 * (warmest - coldest)


def to_png(temperatures: Grid, today: Grid, coldest: float, warmest: float) -> bytes:
    """Write a step and today as an optimised RGBA PNG (see :func:`encode`), north at the top."""
    out = io.BytesIO()
    packed = encode(temperatures, today, coldest, warmest)
    Image.fromarray(packed).save(out, format="PNG", optimize=True)
    return out.getvalue()


def land_mean(temperatures: Grid) -> float:
    """Area-weighted (cos latitude) mean over the nodes with data, °C: ice-free land only."""
    body = temperatures[:, :-1]  # the last column repeats the first
    weights = np.broadcast_to(np.cos(np.radians(node_latitudes()))[:, None], body.shape)
    valid = np.isfinite(body)
    mean: np.float64 = np.average(body[valid], weights=weights[valid])
    return float(mean)


def kept(ka: Iterable[int], step: int = STEP_KA) -> list[int]:
    """Pick the steps to keep, youngest first: every ``step`` thousand years from the present."""
    return sorted(each for each in ka if each % step == 0)


#: The variable the file stores, and its no-data value (-9e33; anything far below is no data).
VARIABLE = "bio01"
_NO_DATA_BELOW = -1e30


def read_source(opened: h5py.File) -> Source:
    """Read the axes. Time is in years before 1950, negative, oldest first; it becomes ka."""
    years = np.asarray(opened["time"][()], dtype=np.float64)
    ages: list[float] = (-years / 1000).tolist()  # pyright: ignore[reportAny]
    if any(age < 0 or age != round(age) for age in ages):
        msg = "expected times in whole thousands of years before present, as negative years"
        raise ValueError(msg)
    return Source(
        ka=tuple(round(age) for age in ages),
        latitude=np.asarray(opened["latitude"][()], dtype=np.float64),
        longitude=np.asarray(opened["longitude"][()], dtype=np.float64),
    )


def read_frames(opened: h5py.File, source: Source, ka: Iterable[int]) -> Iterator[tuple[int, Grid]]:
    """Yield each asked-for step, regridded onto the 1° nodes, in the order asked."""
    variable = opened[VARIABLE]
    position = {each: index for index, each in enumerate(source.ka)}
    for each in ka:
        values = np.asarray(variable[position[each]], dtype=np.float64)
        values = np.where(values < _NO_DATA_BELOW, np.nan, values)
        yield each, regrid(values, source.latitude, source.longitude)


def write_krapp(frames: Iterable[tuple[int, Grid]], folder: Path, step: int = STEP_KA) -> int:
    """Keep every ``step`` thousand years, then write one PNG per step and ``index.json``.

    The encoding's bounds span every kept step, so the frames are held until all are read.
    Every image carries today's (0 ka) map too, so the frames must include 0 ka.
    """
    grids = [(ka, grid) for ka, grid in frames if ka % step == 0]
    today = next((grid for ka, grid in grids if ka == 0), None)
    if today is None:
        msg = "the frames must include today (0 ka)"
        raise ValueError(msg)
    coldest, warmest = bounds(grid for _, grid in grids)
    folder.mkdir(parents=True, exist_ok=True)
    for ka, grid in grids:
        _ = (folder / file_name(ka)).write_bytes(to_png(grid, today, coldest, warmest))
    means = [(ka, land_mean(grid)) for ka, grid in grids]
    body = json.dumps(index_file(means, coldest, warmest), separators=(",", ":"))
    _ = (folder / "index.json").write_text(body + "\n")
    return len(grids)


def build(data: bytes, folder: Path, step: int = STEP_KA) -> int:
    """Write the images from the NetCDF file's bytes."""
    with h5py.File(io.BytesIO(data), "r") as opened:
        source = read_source(opened)
        frames = read_frames(opened, source, kept(source.ka, step))
        return write_krapp(frames, folder, step)


def fetch_krapp(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download the bio01 file (checked against its pinned checksum) and write the images."""
    request = urllib.request.Request(FILE_URL, headers={"User-Agent": "histeclipse-pipeline"})
    with urllib.request.urlopen(request, timeout=900) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{FILE_URL}: expected bytes"
        raise TypeError(msg)
    return build(verified(body, FILE_SHA256, "Krapp et al. bio01 file"), folder)


def file_name(ka: int) -> str:
    """Name the image for a time step by thousands of years ago, e.g. ``21.png``."""
    return f"{ka}.png"


def index_file(frames: list[tuple[int, float]], coldest: float, warmest: float) -> dict[str, Json]:
    """Build the manifest the web app reads: credit, encoding, grid shape and time steps."""
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": ZENODO_RECORD,
        "coverage": "land",
        "columns": COLUMNS,
        "rows": ROWS,
        "coldest": coldest,
        "warmest": warmest,
        "frames": [
            {"ma": ka / 1000, "file": file_name(ka), "mean": round(mean, 1)} for ka, mean in frames
        ],
    }
