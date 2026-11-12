"""Earth's Blue Marble at its full size, cut in tiles the site fetches only for the ground in view.

The source is the map the planet-maps command already shrinks (#258): NASA's Blue Marble Next
Generation for April 2004, with topography and bathymetry, 21600 by 10800 pixels (about 1.85 km a
pixel at the equator), in the public domain and pinned by the same checksum. One texture cannot
hold it, so close up the site draws it in pieces (#568).

The tiles form a pyramid in simple cylindrical projection, addressed ``z/x/y`` as web maps are:
level ``z`` is ``2**(z + 1)`` tiles across and ``2**z`` down, ``x`` counted east from 180° W and
``y`` south from the north pole, each tile ``TILE_SIZE`` pixels square. The full map is level 4,
32 by 16 tiles of 675 pixels, 11.25° a side. Levels below are not cut: the 2048, 4096 and 8192
maps already serve them. The manifest lists the levels there are, each with the maps it was cut
from, so a level kept elsewhere can be added later without changing the others.

Level 5 (#569), 64 by 32 tiles at about 0.93 km a pixel, comes from the same month's map at
500 m, which NASA publishes as eight tiles of 21600 pixels, each 90° a side: ``A`` to ``D`` west
to east from 180° W, ``1`` the north and ``2`` the south. Each is halved to 10800 pixels and cut
into 16 by 16 tiles of its own.

WebP holds the ground as well as JPEG does at about half the bytes: some 14 MB for all 512 tiles
of level 4 at quality 85, where JPEG takes 22 MB. Level 5's 2,048 tiles take some 52 MB.
"""

import json
from dataclasses import dataclass
from typing import TYPE_CHECKING

from PIL import Image

from histeclipse_pipeline.planet_maps import BLUE_MARBLE, MAPS, MapSource, checked, download

if TYPE_CHECKING:
    from collections.abc import Iterable, Iterator, Sequence
    from pathlib import Path

TILE_SIZE = 675
#: WebP quality of each level's tiles.
WEBP_QUALITY = {4: 85, 5: 85}
MANIFEST = "manifest.json"
SCHEMA_VERSION = 1
#: NASA's 500 m tiles: four across (A to D, from 180° W) and two down (1 north, 2 south).
SOURCE_COLUMNS = "ABCD"
SOURCE_ROWS = 2
#: The level NASA's 500 m tiles are cut into, halved: 16 by 16 tiles from each.
SOURCE_LEVEL = 5


@dataclass(frozen=True)
class TileLevel:
    """One level of the pyramid: ``columns`` (``2**(z + 1)``) by ``rows`` (``2**z``) tiles."""

    z: int
    columns: int
    rows: int


@dataclass(frozen=True)
class SourceTile:
    """One of NASA's 500 m tiles, 90° a side, by its name (``A1`` to ``D2``) and checksum."""

    name: str
    sha256: str

    @property
    def url(self) -> str:
        """Where NASA publishes it."""
        return f"{BLUE_MARBLE}/april/world.topo.bathy.200404.3x21600x21600.{self.name}.jpg"

    @property
    def column(self) -> int:
        """Its place west to east, 0 from 180° W."""
        return SOURCE_COLUMNS.index(self.name[0])

    @property
    def row(self) -> int:
        """Its place north to south, 0 the north."""
        return int(self.name[1]) - 1


#: The Blue Marble of April 2004 at 500 m, with topography and bathymetry (public domain).
BMNG_500M = (
    SourceTile("A1", "431bca4ed4f9c29b407b60b740a754c8d7e4c2471c3b8adae9bdc95c2d3e0904"),
    SourceTile("B1", "c5f2d35fa23a35beef1274f3e0adb38874a8efc3b6c8df2be6daae090cd5deee"),
    SourceTile("C1", "98ac189f609e6775197f8fac86e0c4ff2b6e5f75ce6c51131b23b08acea1ad0d"),
    SourceTile("D1", "dd413312521b6c7610c53359a5370c7df663dd1932b00391a32a90566873f363"),
    SourceTile("A2", "fe014d6a646dc3940067d4fe633cd202ad0fa41152e998c8f0df5b24922129fa"),
    SourceTile("B2", "6a4845c0aef98241808e989ad9320b19de71d52279c13bb8fd8d370ca063b3f2"),
    SourceTile("C2", "c21975fed9abf8f0a6907cdb50f92e650a53b8075b6d2c645cf231352d9688e9"),
    SourceTile("D2", "2ffe83405c7f070ed18a60e7710ab1e1268606c69e35a8942e0b9388bd089f7c"),
)


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


def level_at(z: int) -> TileLevel:
    """Return level ``z`` of the pyramid."""
    return TileLevel(z=z, columns=1 << (z + 1), rows=1 << z)


def tiles(image: Image.Image, tile_size: int) -> Iterator[tuple[int, int, Image.Image]]:
    """Cut ``image`` into tiles of ``tile_size``: each one's column, row and pixels, in RGB."""
    level = level_of(image.width, image.height, tile_size)
    rgb = image.convert("RGB")
    for x in range(level.columns):
        for y in range(level.rows):
            box = (x * tile_size, y * tile_size, (x + 1) * tile_size, (y + 1) * tile_size)
            yield x, y, rgb.crop(box)


def source_tiles(
    image: Image.Image, source: SourceTile, z: int, tile_size: int
) -> Iterator[tuple[int, int, Image.Image]]:
    """Cut one of NASA's 90° tiles into level ``z``'s: each one's column, row and pixels, in RGB.

    The image is resized to the level's pixels over its quarter of the world's width and half of
    its height, and its tiles are numbered from its own place in the world.
    """
    level = level_at(z)
    across, down = level.columns // len(SOURCE_COLUMNS), level.rows // SOURCE_ROWS
    if across == 0 or down == 0:
        msg = f"level {z} has fewer tiles than NASA's eight"
        raise ValueError(msg)
    if image.width != image.height:
        msg = f"{source.name} is {image.width} by {image.height}, not square"
        raise ValueError(msg)
    rgb = image.convert("RGB").resize(
        (across * tile_size, down * tile_size), Image.Resampling.LANCZOS
    )
    for i in range(across):
        for j in range(down):
            box = (i * tile_size, j * tile_size, (i + 1) * tile_size, (j + 1) * tile_size)
            yield source.column * across + i, source.row * down + j, rgb.crop(box)


def save_tiles(
    cut: Iterable[tuple[int, int, Image.Image]], folder: Path, z: int, quality: int
) -> int:
    """Write tiles as ``folder/z/x/y.webp``; return their bytes."""
    written = 0
    for x, y, tile in cut:
        path = folder / str(z) / str(x) / f"{y}.webp"
        path.parent.mkdir(parents=True, exist_ok=True)
        tile.save(path, "WEBP", quality=quality, method=6)
        written += path.stat().st_size
    return written


def level_entry(level: TileLevel, sources: Sequence[tuple[str, str]]) -> dict[str, object]:
    """Return a level as the manifest lists it, with each source's ``(url, sha256)``."""
    return {
        "z": level.z,
        "columns": level.columns,
        "rows": level.rows,
        "sources": [{"url": url, "sha256": sha256} for url, sha256 in sources],
    }


def write_manifest(folder: Path, tile_size: int, levels: Sequence[dict[str, object]]) -> None:
    """Write the manifest of the levels there are, given coarsest first."""
    manifest = {
        "schemaVersion": SCHEMA_VERSION,
        "tileSize": tile_size,
        "path": "{z}/{x}/{y}.webp",
        "levels": list(levels),
    }
    folder.mkdir(parents=True, exist_ok=True)
    _ = (folder / MANIFEST).write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def write_tiles(
    image: Image.Image,
    folder: Path,
    source: MapSource,
    *,
    tile_size: int = TILE_SIZE,
    quality: int = WEBP_QUALITY[4],
) -> tuple[int, dict[str, object]]:
    """Write a whole map's tiles as ``folder/z/x/y.webp``; return their bytes and level entry."""
    level = level_of(image.width, image.height, tile_size)
    written = save_tiles(tiles(image, tile_size), folder, level.z, quality)
    return written, level_entry(level, [(source.url, source.sha256)])


def write_source_tiles(
    images: Iterable[tuple[SourceTile, Image.Image]],
    folder: Path,
    *,
    z: int = SOURCE_LEVEL,
    tile_size: int = TILE_SIZE,
    quality: int = WEBP_QUALITY[SOURCE_LEVEL],
) -> tuple[int, dict[str, object]]:
    """Write level ``z`` from NASA's tiles; return its bytes and level entry."""
    written = 0
    sources: list[tuple[str, str]] = []
    for source, image in images:
        written += save_tiles(source_tiles(image, source, z, tile_size), folder, z, quality)
        sources.append((source.url, source.sha256))
    return written, level_entry(level_at(z), sources)


def blue_marble() -> MapSource:
    """Return the pinned Blue Marble, the one the planet-maps command shrinks."""
    return next(source for source in MAPS if source.stem == "earth-blue-marble")


def cached(url: str, sha256: str, cache: Path) -> Path:  # pragma: no cover - needs network access
    """Download ``url`` once into ``cache`` and return it, checked against ``sha256``."""
    path = cache / url.rsplit("/", 1)[-1]
    if not path.exists():
        download(url, path)
    return checked(path, sha256)


def _opened_500m(cache: Path) -> Iterator[tuple[SourceTile, Image.Image]]:  # pragma: no cover
    """NASA's 500 m tiles, each downloaded once into ``cache``, checked and opened in turn."""
    for tile in BMNG_500M:
        with Image.open(cached(tile.url, tile.sha256, cache)) as image:
            yield tile, image


def fetch_earth_tiles(folder: Path, cache: Path) -> int:  # pragma: no cover - needs network access
    """Download the Blue Marble maps once into ``cache``, check them, and tile them."""
    # 21600 pixels a side, past Pillow's guard against decompression bombs; pinned by checksum.
    Image.MAX_IMAGE_PIXELS = None
    source = blue_marble()
    with Image.open(cached(source.url, source.sha256, cache)) as image:
        full_bytes, full = write_tiles(image, folder, source)
    sharp_bytes, sharp = write_source_tiles(_opened_500m(cache), folder)
    write_manifest(folder, TILE_SIZE, [full, sharp])
    return full_bytes + sharp_bytes
