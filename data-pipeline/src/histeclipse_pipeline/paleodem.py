"""Earth's surface over the last 540 million years, from the PALEOMAP PaleoDEMs.

Scotese & Wright (2018), *PALEOMAP Paleodigital Elevation Models (PaleoDEMS) for the
Phanerozoic* (doi:10.5281/zenodo.5460860, CC BY 4.0): elevation and ocean depth every
5 million years from 540 Ma to today. The 0.1° grids (NetCDF-4) are smoothed and halved to
0.2°, five times finer than the 1° set, and each becomes one greyscale PNG the globe colours
in its shader.

Elevations are packed into a byte so the GPU can blend neighbouring pixels: 0 to 127 for the
sea floor (deepest first), 128 to 255 for land, each scaled linearly. A byte step is about
87 m under the sea and 51 m on land.

The grids are node-registered: columns from 180° W to 180° E (both edges, the same meridian)
and rows from 90° N to 90° S. The source has three kinds of fault, repaired here:

- heights above 9.5 km in 20 of the 109 grids, mostly over trenches (the Challenger Deep
  reads +10,500 m at 0 Ma) where the 1° set has sea: a lost sign, or a fill value. They are
  filled from their nearest sound neighbours. Himalayan heights up to 9.3 km are kept;
- the pole rows, each a single point, hold scattered values (a 10 km spike at 180° W in
  many grids); each takes the row next to it;
- the two 180° columns disagree, by kilometres in places; both take their neighbours' mean.
"""

import io
import json
import re
import urllib.request
import zipfile
from dataclasses import dataclass
from typing import TYPE_CHECKING

import h5py
import numpy as np
import numpy.typing as npt
from PIL import Image

from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from collections.abc import Iterable, Iterator
    from pathlib import Path

type Heights = npt.NDArray[np.float64]

ZENODO_RECORD = "https://zenodo.org/records/5460860"
ARCHIVE_URL = (
    "https://zenodo.org/api/records/5460860/files/"
    "Scotese_Wright_2018_Maps_1-88_6minX6min_PaleoDEMS_nc.zip/content"
)
ARCHIVE_SHA256 = "ab360184d8260a815ef5ed6b8b4e0abdbf99ef5ee8aa87dfd070af323ceb42da"
CREDIT = (
    "PALEOMAP PaleoDEMs, Scotese & Wright (2018), CC BY 4.0; 0.1° grids smoothed to 0.2°, "
    "spikes and seams repaired, packed into 8-bit images for this site"
)
#: The source grids, 0.1° apart.
SOURCE_COLUMNS = 3601
SOURCE_ROWS = 1801
#: Every second node of the smoothed grid: 0.2° apart.
COLUMNS = 1801
ROWS = 901
#: Heights above this are faults in the source, not mountains.
FAULT_HEIGHT = 9_500
#: The deepest sea floor and highest land the byte encoding spans, metres.
SEA_DEPTH = 11_000
LAND_HEIGHT = 6_500
SEA_LEVEL_BYTE = 128

_FILE_NAME = re.compile(r"_(\d+)Ma\.nc$")


@dataclass(frozen=True)
class Grid:
    """One time step: millions of years ago, and heights in metres, north row first."""

    ma: int
    heights: Heights


def read_grid(ma: int, data: bytes) -> Grid:
    """Read one NetCDF-4 grid (its ``z`` variable, metres) and check its shape."""
    with h5py.File(io.BytesIO(data)) as file:
        heights = file["z"][()].astype(np.float64)
    if heights.shape != (SOURCE_ROWS, SOURCE_COLUMNS):
        msg = f"{ma} Ma: expected {SOURCE_ROWS} by {SOURCE_COLUMNS} nodes, got {heights.shape}"
        raise ValueError(msg)
    return Grid(ma, heights)


def fill(heights: Heights, faulty: npt.NDArray[np.bool_]) -> Heights:
    """Replace faulty nodes, ring by ring from the edge in, by their sound neighbours' mean."""
    out = heights.copy()
    missing = faulty.copy()
    while missing.any():
        sound = ~missing
        total = np.zeros_like(out)
        count = np.zeros_like(out)
        for axis, shift in ((0, 1), (0, -1), (1, 1), (1, -1)):
            total += np.roll(np.where(sound, out, 0.0), shift, axis=axis)
            count += np.roll(sound.astype(np.float64), shift, axis=axis)
        reached = missing & (count > 0)
        if not reached.any():
            msg = "no sound node to fill from"
            raise ValueError(msg)
        out[reached] = total[reached] / count[reached]
        missing &= ~reached
    return out


def repair(heights: Heights) -> Heights:
    """Fill the faults, flatten each pole row and join the 180° seam (see the module notes)."""
    out = fill(heights, heights > FAULT_HEIGHT)
    out[0, :] = out[1, :]
    out[-1, :] = out[-2, :]
    seam = (out[:, 1] + out[:, -2]) / 2
    out[:, 0] = seam
    out[:, -1] = seam
    return out


def halve(heights: Heights) -> Heights:
    """Smooth with a 1-2-1 filter both ways, then keep every second node (both edges kept).

    Longitude wraps around (the duplicate 180° column is left out and put back); latitude
    repeats its edge rows.
    """
    unique = heights[:, :-1]
    across = (np.roll(unique, 1, axis=1) + 2 * unique + np.roll(unique, -1, axis=1)) / 4
    padded = np.pad(across, ((1, 1), (0, 0)), mode="edge")
    smooth = (padded[:-2] + 2 * padded[1:-1] + padded[2:]) / 4
    wrapped = np.concatenate([smooth, smooth[:, :1]], axis=1)
    return wrapped[::2, ::2]


def encode(heights: Heights) -> npt.NDArray[np.uint8]:
    """Pack heights in metres into bytes: below 128 under the sea, 128 and up on land."""
    land = SEA_LEVEL_BYTE + np.round(np.clip(heights, 0, LAND_HEIGHT) / LAND_HEIGHT * 127)
    sea = SEA_LEVEL_BYTE - 1 - np.round(np.clip(-heights, 0, SEA_DEPTH) / SEA_DEPTH * 127)
    return np.where(heights >= 0, land, sea).astype(np.uint8)


def decode(byte: int) -> float:
    """Return the height a byte stands for, metres, as the shader reads it.

    Sea level lies between bytes 127 and 128, so the lowest land reads a few tens of metres
    up and the shallowest sea as many down: blended bytes then cross sea level smoothly.
    """
    sea_level = SEA_LEVEL_BYTE - 0.5
    if byte >= SEA_LEVEL_BYTE:
        return (byte - sea_level) / sea_level * LAND_HEIGHT
    return -(sea_level - byte) / sea_level * SEA_DEPTH


def to_png(heights: Heights) -> bytes:
    """Write heights as an optimised 8-bit greyscale PNG, north at the top."""
    out = io.BytesIO()
    Image.fromarray(encode(heights), mode="L").save(out, format="PNG", optimize=True)
    return out.getvalue()


def land_fraction(heights: Heights) -> float:
    """Share of the surface above sea level, weighting each row by its area (cos latitude)."""
    weights = np.cos(np.radians(np.linspace(90, -90, len(heights))))
    # The last column repeats the first (the same meridian), so it is not counted twice.
    land = (heights[:, :-1] >= 0).mean(axis=1)
    share: np.float64 = np.average(land, weights=weights)
    return float(share)


def read_archive(data: bytes) -> Iterator[Grid]:
    """Yield every grid in the Zenodo NetCDF archive, youngest first, one at a time.

    Each is 52 MB as doubles, so they are not all held at once. macOS metadata is skipped.
    """
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        members: list[tuple[int, str]] = []
        for name in archive.namelist():
            match = _FILE_NAME.search(name)
            if match is not None and not name.startswith("__MACOSX/"):
                members.append((int(match.group(1)), name))
        for ma, name in sorted(members):
            yield read_grid(ma, archive.read(name))


def file_name(ma: int) -> str:
    """Name the image for a time step, e.g. ``250.png``."""
    return f"{ma}.png"


def index_file(frames: list[tuple[int, float]]) -> dict[str, Json]:
    """Build the manifest the web app reads: credit, encoding, grid shape and time steps."""
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": ZENODO_RECORD,
        "columns": COLUMNS,
        "rows": ROWS,
        "seaDepth": SEA_DEPTH,
        "landHeight": LAND_HEIGHT,
        "frames": [
            {"ma": ma, "file": file_name(ma), "land": round(land, 3)} for ma, land in frames
        ],
    }


def write_paleodem(grids: Iterable[Grid], folder: Path) -> int:
    """Repair and halve each grid, write one PNG per time step and ``index.json``."""
    folder.mkdir(parents=True, exist_ok=True)
    frames: list[tuple[int, float]] = []
    for grid in grids:
        heights = halve(repair(grid.heights))
        _ = (folder / file_name(grid.ma)).write_bytes(to_png(heights))
        frames.append((grid.ma, land_fraction(heights)))
    body = json.dumps(index_file(frames), separators=(",", ":"))
    _ = (folder / "index.json").write_text(body + "\n")
    return len(frames)


def fetch_paleodem(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download the 0.1° archive (checked against its pinned checksum) and write the images."""
    request = urllib.request.Request(ARCHIVE_URL, headers={"User-Agent": "histeclipse-pipeline"})
    with urllib.request.urlopen(request, timeout=600) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{ARCHIVE_URL}: expected bytes"
        raise TypeError(msg)
    return write_paleodem(read_archive(verified(body, ARCHIVE_SHA256, "PaleoDEM archive")), folder)
