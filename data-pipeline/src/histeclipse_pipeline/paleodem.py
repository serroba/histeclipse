"""Earth's surface over the last 540 million years, from the PALEOMAP PaleoDEMs.

Scotese & Wright (2018), *PALEOMAP Paleodigital Elevation Models (PaleoDEMS) for the
Phanerozoic* (doi:10.5281/zenodo.5460860, CC BY 4.0): elevation and ocean depth on a 1° grid,
every 5 million years from 540 Ma to today. Each grid becomes one small greyscale PNG the globe
colours in its shader.

Elevations are packed into a byte so the GPU can blend neighbouring pixels: 0 to 127 for the
sea floor (deepest first), 128 to 255 for land, each scaled linearly. A byte step is about
87 m under the sea and 51 m on land, finer than a 1° grid can show.

The grids are node-registered: 361 columns from 180° W to 180° E (both edges, the same
meridian) and 181 rows from 90° N to 90° S. Every file's first value, at (180° W, 90° N), is
a spike of about 10 km; it is replaced by its neighbour.
"""

import io
import json
import re
import urllib.request
import zipfile
from dataclasses import dataclass
from math import cos, radians
from typing import TYPE_CHECKING

from PIL import Image

from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from pathlib import Path

ZENODO_RECORD = "https://zenodo.org/records/5460860"
CSV_URL = "https://zenodo.org/api/records/5460860/files/PaleoDEMS_long_lat_elev_csv_v2.zip/content"
CSV_SHA256 = "db43e6261411ff468c9030ca240778a73f224bf34bf8186c735477e41454c873"
CREDIT = (
    "PALEOMAP PaleoDEMs, Scotese & Wright (2018), CC BY 4.0; packed into 8-bit images for this site"
)
COLUMNS = 361
ROWS = 181
#: The deepest sea floor and highest land the byte encoding spans, metres.
SEA_DEPTH = 11_000
LAND_HEIGHT = 6_500
SEA_LEVEL_BYTE = 128

_FILE_NAME = re.compile(r"Map[\d.]+_(\d{3})Ma\.csv$")


@dataclass(frozen=True)
class Grid:
    """One time step: millions of years ago, and elevations row by row, north to south."""

    ma: int
    rows: list[list[float]]


def read_grid(ma: int, text: str) -> Grid:
    """Parse one CSV of ``lon,lat,elev`` rows into a north-to-south grid.

    The files differ: most start with a ``# lon,lat,elev`` comment, one with a plain
    ``longitude,latitude,elevation`` header, about half end their lines with a bare CR, and
    one (150 Ma) leaves out the 180° E column and the 90° S row.
    """
    values: dict[tuple[int, int], float] = {}
    for line in text.splitlines():
        if not line.strip() or line.lstrip()[0] not in "-0123456789":
            continue
        lon, lat, elevation = (float(part) for part in line.split(","))
        values[round(lon), round(lat)] = elevation
    # The corner spike: every file has ~10 km at (180° W, 90° N), where its neighbours are sea.
    # Replaced first, so the filling below cannot copy it.
    if (-179, 90) in values:
        values[-180, 90] = values[-179, 90]
    # One file (150 Ma) stops at 179° E and 89° S. 180° E is 180° W again, and the row at
    # the pole is one point, so both are filled from their nearest neighbours.
    for lon in range(-180, 181):
        if (lon, -89) in values:
            _ = values.setdefault((lon, -90), values[lon, -89])
    for lat in range(-90, 91):
        if (-180, lat) in values:
            _ = values.setdefault((180, lat), values[-180, lat])
    rows: list[list[float]] = []
    for row in range(ROWS):
        lat = 90 - row
        try:
            rows.append([values[column - 180, lat] for column in range(COLUMNS)])
        except KeyError as error:
            msg = f"{ma} Ma: the grid has no value at {error.args[0]}"
            raise ValueError(msg) from error
    return Grid(ma, rows)


def encode(elevation: float) -> int:
    """Pack an elevation in metres into a byte: below 128 under the sea, 128 and up on land."""
    if elevation >= 0:
        scaled = min(elevation, LAND_HEIGHT) / LAND_HEIGHT
        return SEA_LEVEL_BYTE + round(scaled * 127)
    scaled = min(-elevation, SEA_DEPTH) / SEA_DEPTH
    return SEA_LEVEL_BYTE - 1 - round(scaled * 127)


def decode(byte: int) -> float:
    """Return the elevation a byte stands for, metres (what the shader computes)."""
    if byte >= SEA_LEVEL_BYTE:
        return (byte - SEA_LEVEL_BYTE) / 127 * LAND_HEIGHT
    return -(SEA_LEVEL_BYTE - 1 - byte) / 127 * SEA_DEPTH


def to_png(grid: Grid) -> bytes:
    """Write the grid as an optimised 8-bit greyscale PNG, north at the top."""
    image = Image.new("L", (COLUMNS, ROWS))
    image.putdata([encode(value) for row in grid.rows for value in row])
    out = io.BytesIO()
    image.save(out, format="PNG", optimize=True)
    return out.getvalue()


def land_fraction(grid: Grid) -> float:
    """Share of the surface above sea level, weighting each row by its area (cos latitude)."""
    land = total = 0.0
    for index, row in enumerate(grid.rows):
        weight = cos(radians(90 - index))
        # The last column repeats the first (the same meridian), so it is not counted twice.
        cells = row[:-1]
        land += weight * sum(1 for value in cells if value >= 0)
        total += weight * len(cells)
    return land / total


def read_archive(data: bytes) -> list[Grid]:
    """Every grid in the Zenodo CSV archive, youngest first."""
    grids: list[Grid] = []
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        for name in archive.namelist():
            match = _FILE_NAME.search(name)
            if match is not None:
                ma = int(match.group(1))
                grids.append(read_grid(ma, archive.read(name).decode("ascii")))
    return sorted(grids, key=lambda grid: grid.ma)


def file_name(ma: int) -> str:
    """Name the image for a time step, e.g. ``250.png``."""
    return f"{ma}.png"


def index_file(grids: list[Grid]) -> dict[str, Json]:
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
            {"ma": grid.ma, "file": file_name(grid.ma), "land": round(land_fraction(grid), 3)}
            for grid in grids
        ],
    }


def write_paleodem(grids: list[Grid], folder: Path) -> int:
    """Write one PNG per time step and ``index.json``; return the number of images."""
    folder.mkdir(parents=True, exist_ok=True)
    for grid in grids:
        _ = (folder / file_name(grid.ma)).write_bytes(to_png(grid))
    body = json.dumps(index_file(grids), separators=(",", ":"))
    _ = (folder / "index.json").write_text(body + "\n")
    return len(grids)


def fetch_paleodem(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download the CSV archive (checked against its pinned checksum) and write the images."""
    request = urllib.request.Request(CSV_URL, headers={"User-Agent": "histeclipse-pipeline"})
    with urllib.request.urlopen(request, timeout=300) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{CSV_URL}: expected bytes"
        raise TypeError(msg)
    return write_paleodem(read_archive(verified(body, CSV_SHA256, "PaleoDEM archive")), folder)
