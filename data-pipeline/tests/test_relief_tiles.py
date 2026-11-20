import io
import struct
import zipfile
from typing import TYPE_CHECKING

import numpy as np
import pytest
from PIL import Image

from histeclipse_pipeline.arrays import as_floats, as_ints
from histeclipse_pipeline.relief_tiles import (
    BORDER,
    LAKE,
    LAND,
    OCEAN,
    OFFSET,
    Level,
    averaged,
    bordered,
    classes,
    cut,
    decode,
    encode,
    open_ocean,
    polygon_mask,
    rasterised,
    write_level,
    write_manifest,
)
from tests.json_values import read_json
from tests.test_today_ice import archive, shapefile, square

if TYPE_CHECKING:
    from pathlib import Path


def flat(values: object) -> list[int]:
    """An array's values as plain ints, flattened."""
    return as_ints(np.asarray(values, dtype=np.int64))


def grid(rows: list[str]) -> np.typing.NDArray[np.float32]:
    """Heights from a picture: '#' deep sea (-4000 m), '-' shallow sea (-50 m), '.' land (10 m)."""
    value = {"#": -4000.0, "-": -50.0, ".": 10.0}
    return np.array([[value[cell] for cell in row] for row in rows], dtype=np.float32)


def test_averages_blocks_of_cells() -> None:
    heights = np.arange(16, dtype=np.float32).reshape(4, 4)
    assert as_floats(np.ravel(averaged(heights, 2)).astype(np.float64)) == [2.5, 4.5, 10.5, 12.5]
    with pytest.raises(ValueError, match="does not divide"):
        _ = averaged(np.zeros((3, 4), dtype=np.float32), 2)


def test_traces_the_ocean_joined_to_the_deep_sea() -> None:
    heights = grid(
        [
            "#--..-..",
            "..-..-.-",
            "..----..",
            "........",
        ]
    )
    ocean = open_ocean(heights)
    # Joined, turning corners down, across and back up.
    assert flat(ocean[0, :3]) == [1, 1, 1]
    assert ocean[2, 2:6].all()
    assert ocean[0, 5]
    # A pocket cut off by land is not.
    assert not ocean[1, 7]


def test_the_ocean_wraps_round_at_180_degrees_but_not_over_the_poles() -> None:
    heights = grid(
        [
            "-......#",
            "-.......",
            "........",
            "-.......",
        ]
    )
    ocean = open_ocean(heights)
    # Column 0 meets column 7 across 180°.
    assert ocean[0, 0]
    assert ocean[1, 0]
    # The bottom row's sea does not reach the top's over the pole.
    assert not ocean[3, 0]


def test_classes_ocean_lakes_inland_seas_and_land() -> None:
    heights = grid(
        [
            "#-..-.",
            "..-..-",
        ]
    )
    lakes = np.zeros(heights.shape, dtype=np.bool_)
    lakes[0, 5] = True
    land = np.ones(heights.shape, dtype=np.bool_)
    # An inland sea (the Caspian): below sea level and off the land map.
    land[0, 4] = False
    water = classes(heights, lakes, land)
    assert flat(water[0, :2]) == [OCEAN, OCEAN]
    assert water[0, 5] == LAKE
    assert water[0, 4] == LAKE
    # A depression on the land map (the Qattara) stays land.
    assert water[1, 2] == LAND
    assert water[0, 2] == LAND


def test_encodes_heights_to_the_metre_in_two_bytes() -> None:
    heights = np.array([[-10_950.4, -0.6, 0.0, 8_848.0]], dtype=np.float32)
    water = np.array([[OCEAN, OCEAN, LAND, LAKE]], dtype=np.uint8)
    rgb = encode(heights, water)
    assert rgb.shape == (1, 4, 3)
    back, classes_back = decode(rgb)
    assert flat(back) == [-10_950, -1, 0, 8_848]
    assert flat(classes_back) == flat(water)
    # Red is the high byte.
    assert flat(rgb[:, 3:, :1]) == [(8_848 + OFFSET) >> 8]


def test_borders_wrap_east_and_west_and_repeat_at_the_poles() -> None:
    cells = np.arange(12, dtype=np.uint8).reshape(3, 4, 1)
    out = bordered(cells, 1)[..., :1]
    assert out.shape == (5, 6, 1)
    assert flat(out[1:2]) == [3, 0, 1, 2, 3, 0]
    assert flat(out[:1]) == flat(out[1:2])
    assert flat(out[4:]) == flat(out[3:4])


def test_cuts_a_level_into_tiles_with_their_borders() -> None:
    size = 2
    level = Level(0)
    assert (level.columns, level.rows) == (2, 1)
    cells = bordered(np.arange(8, dtype=np.uint8).reshape(2, 4, 1), 1)
    tiles = {(x, y): tile for x, y, tile in cut(cells, level, size, 1)}
    assert set(tiles) == {(0, 0), (1, 0)}
    # Each tile carries its neighbour's edge: the east tile's west border is the west tile's edge.
    assert flat(tiles[1, 0][1:2]) == [1, 2, 3, 0]
    assert flat(tiles[0, 0][1:2]) == [3, 0, 1, 2]
    with pytest.raises(ValueError, match="not level 1"):
        _ = list(cut(cells, Level(1), size, 1))


def test_rasterises_polygons_with_their_holes() -> None:
    # A lake over 0° to 90° E north of the equator, with an island in its north-west quarter;
    # cells of 22.5°. Cells on an edge may go either way: those well inside and out are checked.
    lake = [square(0.0, 0.0, 90.0, 90.0), square(0.0, 45.0, 45.0, 90.0, hole=True)]
    mask = polygon_mask([lake], 16, 8)
    assert mask[3, 9]  # 11° N, 34° E
    assert mask[1, 10]  # 56° N, 56° E
    assert not mask[0, 8]  # on the island
    assert not mask[3, 4]  # 11° N, 79° W
    assert not mask[6, 9]  # 56° S
    assert flat(rasterised(archive([lake]), 16, 8)) == flat(mask)


def lakes_archive(records: list[tuple[str, list[list[tuple[float, float]]]]]) -> bytes:
    """Natural Earth's lakes as a zip: each record's feature class and rings."""
    fields = [("featurecla", 12)]
    header_length = 32 + 32 * len(fields) + 1
    record_length = 1 + sum(length for _, length in fields)
    header = struct.pack("<BBBBIHH", 3, 126, 1, 1, len(records), header_length, record_length)
    header += bytes(20)
    for name, length in fields:
        header += name.encode().ljust(11, b"\0") + b"C" + bytes(4) + bytes([length, 0]) + bytes(14)
    body = b"".join(b" " + kind.encode().ljust(12) for kind, _ in records)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zipped:
        zipped.writestr("lakes.shp", shapefile([rings for _, rings in records]))
        zipped.writestr("lakes.dbf", header + b"\r" + body)
    return buffer.getvalue()


def test_leaves_out_a_feature_class_the_ice_ages_did_not_have() -> None:
    lake = [square(-170.0, 10.0, -100.0, 80.0)]
    reservoir = [square(100.0, 10.0, 170.0, 80.0)]
    both = lakes_archive([("Lake", lake), ("Reservoir", reservoir)])
    # 8 by 4 cells of 45°: the lake over the north-west, the dam's over the north-east.
    assert flat(rasterised(both, 8, 4)[:1, 1:2]) == [1]
    assert flat(rasterised(both, 8, 4)[:1, 6:7]) == [1]
    kept = rasterised(both, 8, 4, leave_out="Reservoir")
    assert flat(kept[:1, 1:2]) == [1]
    assert flat(kept[:1, 6:7]) == [0]


def test_writes_lossless_tiles_that_read_back(tmp_path: Path) -> None:
    rows, columns = 4, 8
    heights = np.full((rows, columns), -4000.0, dtype=np.float32)
    heights[:, 4:] = 123.0
    none = np.zeros((rows, columns), dtype=np.bool_)
    written = write_level(heights, none, ~none, tmp_path, z=0, tile_size=4)
    assert written > 0
    with Image.open(tmp_path / "0" / "1" / "0.webp") as image:
        east = np.asarray(image.convert("RGB"), dtype=np.uint8)
    assert east.shape == (4 + 2 * BORDER, 4 + 2 * BORDER, 3)
    back, water = decode(east)
    assert flat(back[BORDER : BORDER + 1, BORDER:-BORDER]) == [123] * 4
    # Its east border wraps to the west tile's sea.
    assert flat(back[BORDER : BORDER + 1, -1:]) == [-4000]
    assert flat(water[BORDER : BORDER + 1, -1:]) == [OCEAN]


def test_writes_the_manifest(tmp_path: Path) -> None:
    write_manifest(tmp_path, [3, 2], tile_size=675)
    manifest = read_json(tmp_path / "manifest.json")
    assert isinstance(manifest, dict)
    assert manifest["tileSize"] == 675
    assert manifest["border"] == BORDER
    assert manifest["offset"] == OFFSET
    assert manifest["water"] == {"ocean": OCEAN, "lake": LAKE, "land": LAND}
    assert manifest["levels"] == [
        {"z": 2, "columns": 8, "rows": 4},
        {"z": 3, "columns": 16, "rows": 8},
    ]
    sources = manifest["sources"]
    assert isinstance(sources, list)
    assert all(isinstance(each, dict) and len(str(each["sha256"])) == 64 for each in sources)
