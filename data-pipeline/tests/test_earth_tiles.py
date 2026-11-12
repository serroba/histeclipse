"""Earth's tiles: the full map cut in a z/x/y pyramid of WebP tiles, with a manifest of levels."""

from __future__ import annotations

from typing import TYPE_CHECKING

import numpy as np
import pytest
from PIL import Image

from histeclipse_pipeline.earth_tiles import (
    BMNG_500M,
    TILE_SIZE,
    SourceTile,
    TileLevel,
    blue_marble,
    level_at,
    level_of,
    source_tiles,
    tiles,
    write_manifest,
    write_source_tiles,
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


def test_tiles_are_written_as_z_x_y_with_their_level(tmp_path: Path) -> None:
    source = blue_marble()
    written, level = write_tiles(numbered(4, 2, 16), tmp_path, source, tile_size=16, quality=95)
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
    assert level == {
        "z": 1,
        "columns": 4,
        "rows": 2,
        "sources": [{"url": source.url, "sha256": source.sha256}],
    }


def test_nasas_eight_tiles_are_named_west_to_east_and_north_to_south() -> None:
    assert [tile.name for tile in BMNG_500M] == ["A1", "B1", "C1", "D1", "A2", "B2", "C2", "D2"]
    assert [(tile.column, tile.row) for tile in BMNG_500M] == [
        (column, row) for row in range(2) for column in range(4)
    ]
    assert len({tile.sha256 for tile in BMNG_500M}) == len(BMNG_500M)
    assert all(len(tile.sha256) == 64 for tile in BMNG_500M)
    assert BMNG_500M[6].url.endswith(
        "bmng-topography-bathymetry/april/world.topo.bathy.200404.3x21600x21600.C2.jpg"
    )


def quartered(tile: SourceTile, cells: int, size: int) -> Image.Image:
    """One of NASA's tiles in flat cells, each coloured by the level's tile it should become.

    Red is its column in the world, green its row.
    """
    pixels = np.zeros((cells * size, cells * size, 3), dtype=np.uint8)
    for i in range(cells):
        for j in range(cells):
            x, y = tile.column * cells + i, tile.row * cells + j
            pixels[j * size : (j + 1) * size, i * size : (i + 1) * size] = (x * 16, y * 30, 100)
    return Image.fromarray(pixels)


@pytest.mark.parametrize("tile", BMNG_500M, ids=[tile.name for tile in BMNG_500M])
def test_each_of_nasas_tiles_is_halved_and_cut_into_its_place_in_the_level(
    tile: SourceTile,
) -> None:
    # Level 3 is 16 by 8 tiles: four across and four down from each of NASA's eight.
    cut = {(x, y): pixels for x, y, pixels in source_tiles(quartered(tile, 4, 16), tile, 3, 8)}
    assert sorted(cut) == [
        (tile.column * 4 + i, tile.row * 4 + j) for i in range(4) for j in range(4)
    ]
    for (x, y), pixels in cut.items():
        assert pixels.size == (8, 8)
        assert pixels.mode == "RGB"
        assert pixels.getpixel((4, 4)) == (x * 16, y * 30, 100)


def test_level_5_takes_16_by_16_tiles_from_each_of_nasas() -> None:
    assert level_at(5) == TileLevel(z=5, columns=64, rows=32)
    tile = BMNG_500M[7]  # D2: the south-east quarter.
    keys = [(x, y) for x, y, _ in source_tiles(Image.new("RGB", (64, 64)), tile, 5, 2)]
    assert len(keys) == 256
    assert min(keys) == (48, 16)
    assert max(keys) == (63, 31)


@pytest.mark.parametrize(
    ("z", "size", "match"), [(0, (32, 32), "fewer tiles"), (3, (32, 16), "not square")]
)
def test_a_level_or_tile_that_cannot_be_cut_is_refused(
    z: int, size: tuple[int, int], match: str
) -> None:
    with pytest.raises(ValueError, match=match):
        _ = list(source_tiles(Image.new("RGB", size), BMNG_500M[0], z, 8))


def test_level_5_and_the_manifest_list_every_source(tmp_path: Path) -> None:
    images = [(tile, quartered(tile, 2, 8)) for tile in BMNG_500M]
    written, level = write_source_tiles(images, tmp_path, z=2, tile_size=4, quality=90)
    files = {path.relative_to(tmp_path).as_posix() for path in tmp_path.rglob("*.webp")}
    assert files == {f"2/{x}/{y}.webp" for x in range(8) for y in range(4)}
    assert written == sum(path.stat().st_size for path in tmp_path.rglob("*.webp"))
    assert level["sources"] == [{"url": tile.url, "sha256": tile.sha256} for tile in BMNG_500M]
    _, full = write_tiles(numbered(4, 2, 4), tmp_path, blue_marble(), tile_size=4)
    write_manifest(tmp_path / "out", 4, [full, level])
    assert read_json(tmp_path / "out" / "manifest.json") == {
        "schemaVersion": 1,
        "tileSize": 4,
        "path": "{z}/{x}/{y}.webp",
        "levels": [full, level],
    }


def test_the_tiles_come_from_the_pinned_blue_marble() -> None:
    source = blue_marble()
    assert source.url.endswith("world.topo.bathy.200404.3x21600x10800.jpg")
    assert len(source.sha256) == 64
