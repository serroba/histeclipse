"""Earth's Blue Marble at its full size, cut in tiles the site fetches only for the ground in view.

The source is the map the planet-maps command already shrinks (#258): NASA's Blue Marble Next
Generation for April 2004, with topography and bathymetry, 21600 by 10800 pixels (about 1.85 km a
pixel at the equator), in the public domain and pinned by the same checksum. One texture cannot
hold it, so close up the site draws it in pieces (#568).

The tiles form a pyramid in simple cylindrical projection, addressed ``z/x/y`` as web maps are:
level ``z`` is ``2**(z + 1)`` tiles across and ``2**z`` down, ``x`` counted east from 180° W and
``y`` south from the north pole, each tile ``TILE_SIZE`` pixels square. The full map is level 4,
32 by 16 tiles of 675 pixels, 11.25° a side. Levels below are not cut: the 2048, 4096 and 8192
maps already serve them. A sharper source (#569) adds levels above, each named with its own
source in the manifest, which lists the levels there are.

WebP holds the ground as well as JPEG does at about half the bytes: some 14 MB for all 512 tiles
at quality 85, where JPEG takes 22 MB.
"""

import json
from dataclasses import dataclass
from typing import TYPE_CHECKING

from PIL import Image

from histeclipse_pipeline.planet_maps import MAPS, MapSource, checked, download

if TYPE_CHECKING:
    from collections.abc import Iterator
    from pathlib import Path

TILE_SIZE = 675
WEBP_QUALITY = 85
MANIFEST = "manifest.json"
SCHEMA_VERSION = 1


@dataclass(frozen=True)
class TileLevel:
    """One level of the pyramid: ``columns`` (``2**(z + 1)``) by ``rows`` (``2**z``) tiles."""

    z: int
    columns: int
    rows: int


def level_of(width: int, height: int, tile_size: int) -> TileLevel:
    """Find the level a map of ``width`` by ``height`` fills in tiles of ``tile_size``."""
    columns, rest = divmod(width, tile_size)
    if rest != 0 or height * 2 != width or columns < 2:  # noqa: PLR2004 - two tiles at z = 0
        msg = f"a {width} by {height} map does not cut into {tile_size}-pixel tiles, twice as wide"
        raise ValueError(msg)
    z = columns.bit_length() - 2
    if columns != 2 ** (z + 1):
        msg = f"{columns} tiles across is not a power of two"
        raise ValueError(msg)
    return TileLevel(z=z, columns=columns, rows=columns // 2)


def tiles(image: Image.Image, tile_size: int) -> Iterator[tuple[int, int, Image.Image]]:
    """Cut ``image`` into tiles of ``tile_size``: each one's column, row and pixels, in RGB."""
    level = level_of(image.width, image.height, tile_size)
    rgb = image.convert("RGB")
    for x in range(level.columns):
        for y in range(level.rows):
            box = (x * tile_size, y * tile_size, (x + 1) * tile_size, (y + 1) * tile_size)
            yield x, y, rgb.crop(box)


def write_tiles(
    image: Image.Image,
    folder: Path,
    source: MapSource,
    *,
    tile_size: int = TILE_SIZE,
    quality: int = WEBP_QUALITY,
) -> int:
    """Write ``image``'s tiles as ``folder/z/x/y.webp`` and the manifest; return their bytes."""
    level = level_of(image.width, image.height, tile_size)
    written = 0
    for x, y, tile in tiles(image, tile_size):
        path = folder / str(level.z) / str(x) / f"{y}.webp"
        path.parent.mkdir(parents=True, exist_ok=True)
        tile.save(path, "WEBP", quality=quality, method=6)
        written += path.stat().st_size
    manifest = {
        "schemaVersion": SCHEMA_VERSION,
        "tileSize": tile_size,
        "path": "{z}/{x}/{y}.webp",
        "levels": [
            {
                "z": level.z,
                "columns": level.columns,
                "rows": level.rows,
                "source": {"url": source.url, "sha256": source.sha256},
            }
        ],
    }
    _ = (folder / MANIFEST).write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return written


def blue_marble() -> MapSource:
    """Return the pinned Blue Marble, the one the planet-maps command shrinks."""
    return next(source for source in MAPS if source.stem == "earth-blue-marble")


def fetch_earth_tiles(folder: Path, cache: Path) -> int:  # pragma: no cover - needs network access
    """Download the Blue Marble once into ``cache``, check it, and tile it under ``folder``."""
    # 21600 by 10800 pixels, past Pillow's guard against decompression bombs; pinned by checksum.
    Image.MAX_IMAGE_PIXELS = None
    source = blue_marble()
    path = cache / source.url.rsplit("/", 1)[-1]
    if not path.exists():
        download(source.url, path)
    with Image.open(checked(path, source.sha256)) as image:
        return write_tiles(image, folder, source)
