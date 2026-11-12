"""Earth's tiles: the full map cut in a z/x/y pyramid of WebP tiles, with a manifest of levels."""

from __future__ import annotations

from typing import TYPE_CHECKING

import numpy as np
import pytest
from PIL import Image

from histeclipse_pipeline.earth_tiles import (
    TILE_SIZE,
    TileLevel,
    blue_marble,
    level_of,
    tiles,
    write_tiles,
)
from tests.json_values import read_json

if TYPE_CHECKING:
    from pathlib import Path


def numbered(columns: int, rows: int, tile: int) -> Image.Image:
    """A map whose every tile is one flat colour: red its column, green its row."""
    pixels = np.zeros((rows * tile, columns * tile, 3), dtype=np.uint8)
    for x in range(columns):
        for y in range(rows):
            pixels[y * tile : (y + 1) * tile, x * tile : (x + 1) * tile] = (x * 16, y * 16, 200)
    return Image.fromarray(pixels)


def test_the_full_blue_marble_is_level_4_of_32_by_16_tiles() -> None:
    assert level_of(21600, 10800, TILE_SIZE) == TileLevel(z=4, columns=32, rows=16)
    # Each level doubles the last: 2 by 1 tiles at the top of the pyramid, 64 by 32 below level 4.
    assert level_of(2 * TILE_SIZE, TILE_SIZE, TILE_SIZE) == TileLevel(z=0, columns=2, rows=1)
    assert level_of(43200, 21600, TILE_SIZE) == TileLevel(z=5, columns=64, rows=32)


@pytest.mark.parametrize(
    ("width", "height"),
    [(21600, 10000), (21601, 10800), (675, 337), (3 * 675 * 2, 3 * 675)],
)
def test_a_map_that_does_not_cut_into_a_level_is_refused(width: int, height: int) -> None:
    with pytest.raises(ValueError, match=r"does not cut|power of two"):
        _ = level_of(width, height, TILE_SIZE)


def test_tiles_run_east_from_180_west_and_south_from_the_north_pole() -> None:
    cut = {(x, y): tile for x, y, tile in tiles(numbered(4, 2, 8), 8)}
    assert sorted(cut) == [(x, y) for x in range(4) for y in range(2)]
    for (x, y), tile in cut.items():
        assert tile.size == (8, 8)
        assert tile.mode == "RGB"
        assert tile.getpixel((0, 0)) == (x * 16, y * 16, 200)
        assert tile.getpixel((7, 7)) == (x * 16, y * 16, 200)


def test_tiles_and_manifest_are_written_as_z_x_y(tmp_path: Path) -> None:
    source = blue_marble()
    written = write_tiles(numbered(4, 2, 16), tmp_path, source, tile_size=16, quality=95)
    files = sorted(path.relative_to(tmp_path).as_posix() for path in tmp_path.rglob("*.webp"))
    assert files == [f"1/{x}/{y}.webp" for x in range(4) for y in range(2)]
    assert written == sum(path.stat().st_size for path in tmp_path.rglob("*.webp"))
    with Image.open(tmp_path / "1" / "3" / "1.webp") as tile:
        assert tile.format == "WEBP"
        assert tile.size == (16, 16)
        pixel = tile.convert("RGB").getpixel((8, 8))
        assert isinstance(pixel, tuple)
        # WebP is lossy: the colour comes back within a few levels.
        assert all(abs(got - want) <= 4 for got, want in zip(pixel, (48, 16, 200), strict=True))
    manifest = read_json(tmp_path / "manifest.json")
    assert manifest == {
        "schemaVersion": 1,
        "tileSize": 16,
        "path": "{z}/{x}/{y}.webp",
        "levels": [
            {
                "z": 1,
                "columns": 4,
                "rows": 2,
                "source": {"url": source.url, "sha256": source.sha256},
            }
        ],
    }


def test_the_tiles_come_from_the_pinned_blue_marble() -> None:
    source = blue_marble()
    assert source.url.endswith("world.topo.bathy.200404.3x21600x10800.jpg")
    assert len(source.sha256) == 64
