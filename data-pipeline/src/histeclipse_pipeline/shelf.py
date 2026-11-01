"""Today's coasts and continental shelves, for drawing coastlines at past sea levels.

ETOPO1 (Amante & Eakins 2009, NOAA NGDC): land and sea-floor heights, 1 arc-minute, here every
sixth node (0.1°), from NOAA's ERDDAP server as an ESRI ASCII grid. NOAA's terms: the data may be
used and redistributed for free. It is the ice-surface version: Antarctica and Greenland at the
top of their ice.

Only the band where glacial sea level moves the coast matters, so heights are packed into a byte
one metre a step, from 200 m below today's sea level (byte 0, and everything deeper) to 55 m
above (byte 255, and everything higher). In the ice ages sea level fell by up to about 130 m and
rose a few metres above today's.

The grid is node-registered: 3601 columns from 180° W to 180° E (both edges, the same meridian)
and 1801 rows from 90° N to 90° S, like the PaleoDEMs.
"""

import io
import json
import urllib.request
from typing import TYPE_CHECKING

import numpy as np
import numpy.typing as npt
from PIL import Image

from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from pathlib import Path

type Heights = npt.NDArray[np.float64]

GRID_URL = (
    "https://coastwatch.pfeg.noaa.gov/erddap/griddap/etopo180.esriAscii"
    "?altitude%5B(-90.0):6:(90.0)%5D%5B(-180.0):6:(180.0)%5D"
)
GRID_SHA256 = "a2f17d6f9586b6a63df832abad300c95bd9ee83191aaab8f25243e7d71a58734"
SOURCE = "https://www.ncei.noaa.gov/products/etopo-global-relief-model"
CREDIT = (
    "ETOPO1 (Amante & Eakins 2009, NOAA NGDC), every sixth node (0.1°), via NOAA ERDDAP; "
    "packed into an 8-bit image from 200 m below to 55 m above today's sea level"
)
COLUMNS = 3601
ROWS = 1801
#: The band the byte encoding covers, metres from today's sea level.
LOWEST = -200
HIGHEST = 55
_HEADER_LINES = 6


def read_grid(text: str) -> Heights:
    """Read an ESRI ASCII grid (a six-line header, then rows north to south) and check it."""
    header = dict(line.split(maxsplit=1) for line in text.splitlines()[:_HEADER_LINES])
    shape = (int(header["nrows"]), int(header["ncols"]))
    if shape != (ROWS, COLUMNS):
        msg = f"expected {ROWS} by {COLUMNS} nodes, got {shape}"
        raise ValueError(msg)
    heights: Heights = np.loadtxt(io.StringIO(text), skiprows=_HEADER_LINES, dtype=np.float64)
    missing = int(np.count_nonzero(np.equal(heights, float(header["nodata_value"]))))
    if missing:
        msg = f"{missing} nodes have no value"
        raise ValueError(msg)
    return heights


def encode(heights: Heights) -> npt.NDArray[np.uint8]:
    """One metre a byte, from LOWEST (0) to HIGHEST (255), clamped at both ends."""
    return np.round(np.clip(heights, LOWEST, HIGHEST) - LOWEST).astype(np.uint8)


def to_png(heights: Heights) -> bytes:
    """Write heights as an optimised 8-bit greyscale PNG, north at the top."""
    out = io.BytesIO()
    Image.fromarray(encode(heights), mode="L").save(out, format="PNG", optimize=True)
    return out.getvalue()


def write_shelf(heights: Heights, folder: Path) -> int:
    """Write ``today.png`` and ``index.json``; return the image's size in bytes."""
    folder.mkdir(parents=True, exist_ok=True)
    image = to_png(heights)
    _ = (folder / "today.png").write_bytes(image)
    index: dict[str, Json] = {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "file": "today.png",
        "columns": COLUMNS,
        "rows": ROWS,
        "lowest": LOWEST,
        "highest": HIGHEST,
    }
    _ = (folder / "index.json").write_text(json.dumps(index, separators=(",", ":")) + "\n")
    return len(image)


def fetch_shelf(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download the grid (checked against its pinned checksum) and write the image."""
    request = urllib.request.Request(GRID_URL, headers={"User-Agent": "histeclipse-pipeline"})
    with urllib.request.urlopen(request, timeout=300) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{GRID_URL}: expected bytes"
        raise TypeError(msg)
    return write_shelf(read_grid(verified(body, GRID_SHA256, "ETOPO1 grid").decode()), folder)
