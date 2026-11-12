"""Today's ice on land and its shelves, to bring the ice-age ice sheets to the coast (#511).

PaleoMIST 1.0 (``icesheets.py``) is a reconstruction on a 0.25° grid of grounded ice: it stops a
little short of Antarctica's and Greenland's coasts and leaves out the floating ice shelves, so
the relief of the bedrock beneath (lowland green, basins below sea level blue) showed through
where in fact there is ice. Natural Earth's glaciated areas and Antarctic ice shelves (1:10m,
public domain) give today's ice to the coast.

They are rasterised onto the ice maps' grid (1441 columns from 180° W to 180° E, 721 rows from
90° N to 90° S, node-registered), a node counting as ice where its point falls inside a polygon
(its holes, nunataks and lakes, left out). The ice-sheet frames then take at least ``FLOOR``
metres wherever today has ice: between 0 and 80,000 years ago Antarctica and Greenland always
had at least today's ice, so this fills what the reconstruction misses without moving its
margins.
"""

import urllib.request
from typing import TYPE_CHECKING

import numpy as np
import numpy.typing as npt
from PIL import Image, ImageDraw

from histeclipse_pipeline.archaeoglobe import read_regions, rings_by_record
from histeclipse_pipeline.sky import verified

if TYPE_CHECKING:
    from collections.abc import Iterable

type Mask = npt.NDArray[np.bool_]
type Ring = list[tuple[float, float]]

LAYERS = (
    (
        "https://naciscdn.org/naturalearth/10m/physical/ne_10m_glaciated_areas.zip",
        "de6ff396ab7eee8cbe2146030cc29278ef67c468e5675c748b1372e241ecbbff",
    ),
    (
        "https://naciscdn.org/naturalearth/10m/physical/ne_10m_antarctic_ice_shelves_polys.zip",
        "1d421d2487e2721a6e0aee8187e008c9bd8f0adbf4a5297b8503f7bf3c30b04d",
    ),
)
CREDIT = (
    "today's ice to the coast from Natural Earth 1:10m glaciated areas and Antarctic ice shelves "
    "(public domain)"
)
#: Ice drawn at least this thick, metres, where today has ice: thin, so it shows faintly blue.
FLOOR = 304.0
#: Degrees between the grid's nodes.
STEP = 0.25


def signed_area(ring: Ring) -> float:
    """Shoelace area, square degrees: negative for a clockwise ring (outer), positive for a hole."""
    total = 0.0
    for (x1, y1), (x2, y2) in zip(ring, [*ring[1:], ring[0]], strict=True):
        total += x1 * y2 - x2 * y1
    return total / 2


def _pixels(ring: Ring) -> list[tuple[float, float]]:
    """Place a ring in the grid's pixels: x east from 180° W, y south from 90° N, one per node."""
    return [((lon + 180.0) / STEP, (90.0 - lat) / STEP) for lon, lat in ring]


def rasterise(records: Iterable[list[Ring]], columns: int, rows: int) -> Mask:
    """Mark the nodes inside any record's polygons, outside their holes.

    A shapefile's outer rings run clockwise and its holes anticlockwise: each record's outer
    rings are filled first, then its holes cleared.
    """
    image = Image.new("1", (columns, rows), 0)
    draw = ImageDraw.Draw(image)
    for rings in records:
        outer = [ring for ring in rings if signed_area(ring) <= 0]
        holes = [ring for ring in rings if signed_area(ring) > 0]
        for ring in outer:
            draw.polygon(_pixels(ring), fill=1)
        for ring in holes:
            draw.polygon(_pixels(ring), fill=0)
    return np.asarray(image, dtype=np.bool_)


def today_ice(archives: Iterable[bytes], columns: int, rows: int) -> Mask:
    """Rasterise every layer's polygons and join them."""
    mask = np.zeros((rows, columns), dtype=np.bool_)
    for archive in archives:
        shp, _dbf = read_regions(archive)
        mask |= rasterise(rings_by_record(shp), columns, rows)
    return mask


def with_today(thickness: npt.NDArray[np.float64], mask: Mask) -> npt.NDArray[np.float64]:
    """Thicken a frame's ice to at least ``FLOOR`` metres wherever today has ice."""
    return np.asarray(np.where(mask, np.maximum(thickness, FLOOR), thickness), dtype=np.float64)


def fetch_today_ice(columns: int, rows: int) -> Mask:  # pragma: no cover - needs network access
    """Download Natural Earth's two ice layers (checked against pinned checksums) and rasterise."""
    archives: list[bytes] = []
    for url, sha256 in LAYERS:
        headers = {"User-Agent": "histeclipse-pipeline"}
        request = urllib.request.Request(url, headers=headers)  # noqa: S310
        with urllib.request.urlopen(request, timeout=300) as response:  # noqa: S310  # pyright: ignore[reportAny]
            body: object = response.read()  # pyright: ignore[reportAny]
        if not isinstance(body, bytes):
            msg = f"{url}: expected bytes"
            raise TypeError(msg)
        archives.append(verified(body, sha256, url.rsplit("/", 1)[-1]))
    return today_ice(archives, columns, rows)
