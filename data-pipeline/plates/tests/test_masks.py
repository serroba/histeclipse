from __future__ import annotations

import io
import json
import zipfile
from typing import TYPE_CHECKING

import numpy as np
import pygplates
import pytest
from PIL import Image

from histeclipse_plates.masks import (
    CONTINENTS,
    FOLDER,
    ROTATIONS,
    SEA_LEVEL_BYTE,
    Mask,
    aligned,
    best_turn,
    build,
    continent_share,
    land_inside,
    mask,
    paleomap_land,
    reconstructed_inside,
    sealed,
    verified,
    write_masks,
)

if TYPE_CHECKING:
    from pathlib import Path

# One square continent on plate 1, from 10° S to 10° N and 0° to 20° E.
SQUARE = [(-10.0, 0.0), (-10.0, 20.0), (10.0, 20.0), (10.0, 0.0)]
# Plate 1 turns 20° about the North Pole by 100 Ma (east is positive), fixed to plate 0.
ROTATION_TEXT = "1 0.0 90.0 0.0 0.0 0 !today\n1 100.0 90.0 0.0 20.0 0 !100 Ma\n"


def square() -> pygplates.FeatureCollection:
    feature = pygplates.Feature.create_reconstructable_feature(
        pygplates.FeatureType.gpml_unclassified_feature,
        pygplates.PolygonOnSphere(SQUARE),
        reconstruction_plate_id=1,
    )
    return pygplates.FeatureCollection([feature])


def rotation(folder: Path) -> pygplates.RotationModel:
    path = folder / "test.rot"
    _ = path.write_text(ROTATION_TEXT)
    return pygplates.RotationModel([str(path)])


def test_draws_a_mask_node_by_node() -> None:
    drawn = mask(lambda latitude, longitude: latitude > 0 and longitude > 0, rows=5, columns=9)
    assert drawn.shape == (5, 9)
    assert drawn[1, 6] == 255
    assert drawn[3, 6] == 0
    assert drawn[1, 2] == 0


def test_seals_narrow_gaps_but_keeps_wide_seaways() -> None:
    drawn = np.zeros((20, 60), dtype=np.uint8)
    drawn[5:15, 5:20] = 255
    drawn[5:15, 26:40] = 255  # a gap six nodes wide (20 to 25): sealed by four each side
    drawn[5:15, 50:58] = 255  # a seaway ten nodes wide (40 to 49): kept
    out = sealed(drawn)
    assert out[10, 22] == 255
    assert out[10, 45] == 0
    assert out[1, 30] == 0  # the sea beyond is left alone
    assert sealed(drawn, nodes=1)[10, 22] == 0
    # East and west wrap round: a gap across 180° is sealed too.
    edges = np.zeros((5, 10), dtype=np.uint8)
    edges[:, :4] = 255
    edges[:, 5:] = 255
    assert sealed(edges, nodes=1)[2, 4] == 255


def test_weights_continents_by_area() -> None:
    half = np.zeros((181, 361), dtype=np.uint8)
    half[:90] = 255
    assert continent_share(half) == pytest.approx(0.5, abs=0.01)


def test_reconstructs_a_continent_along_its_rotation(tmp_path: Path) -> None:
    model = rotation(tmp_path)
    today = reconstructed_inside(square(), model, 0.0)
    assert today(0.0, 10.0)
    assert not today(0.0, 40.0)
    # By 100 Ma the square has turned 20° east about the pole.
    then = reconstructed_inside(square(), model, 100.0)
    assert then(0.0, 30.0)
    assert not then(0.0, 5.0)


def test_writes_masks_and_an_index(tmp_path: Path) -> None:
    count = write_masks(square(), rotation(tmp_path), [0, 100], tmp_path / "out", (19, 37))
    assert count == 2
    index = json.loads((tmp_path / "out" / "index.json").read_text())  # pyright: ignore[reportAny]
    assert (index["rows"], index["columns"]) == (19, 37)
    assert index["frames"][1]["file"] == "100.png"
    assert 0 < index["frames"][0]["continents"] < 0.05


def test_builds_from_the_model_archive(tmp_path: Path) -> None:
    continents = tmp_path / CONTINENTS
    square().write(str(continents))
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as archive:
        archive.writestr(f"{FOLDER}/{CONTINENTS}", continents.read_bytes())
        for name in ROTATIONS:
            archive.writestr(f"{FOLDER}/{name}", ROTATION_TEXT)
    assert build(out.getvalue(), tmp_path / "out", ages=[0, 50], grid=(19, 37)) == 2
    assert (tmp_path / "out" / "50.png").exists()


def test_refuses_data_that_does_not_match_its_checksum() -> None:
    assert (
        verified(b"x", "2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881", "x")
        == b"x"
    )
    with pytest.raises(ValueError, match="expected sha256"):
        _ = verified(b"y", "0" * 64, "test data")


def blocks(
    columns: int, start: int, width: int, rows: int = 19
) -> np.ndarray[tuple[int, int], np.dtype[np.uint8]]:
    drawn = np.zeros((rows, columns), dtype=np.uint8)
    drawn[5:14, start : start + width] = 255
    drawn[:, -1] = drawn[:, 0]  # the last column repeats the first meridian
    return drawn


def test_finds_the_turn_that_lines_the_continents_up_with_the_land() -> None:
    land = blocks(37, 10, 6) > 0
    assert best_turn(blocks(37, 4, 6), land) == 6
    assert best_turn(blocks(37, 14, 6), land) == -4
    assert land_inside(blocks(37, 4, 6), land) == 0.0
    assert land_inside(blocks(37, 4, 6), land, 6) == pytest.approx(1.0)
    assert land_inside(blocks(37, 4, 6), np.zeros((19, 37), dtype=np.bool_)) == 0.0


def png(heights: Mask) -> bytes:
    out = io.BytesIO()
    Image.fromarray(heights, mode="L").save(out, format="PNG")
    return out.getvalue()


def test_reads_paleomap_land_onto_the_masks_grid() -> None:
    heights = np.full((5, 9), SEA_LEVEL_BYTE - 1, dtype=np.uint8)
    heights[:2] = SEA_LEVEL_BYTE + 10
    land = paleomap_land(png(heights), 9, 17)
    assert land.shape == (9, 17)
    assert land[0, 0]
    assert not land[8, 0]


def test_adds_the_turn_and_land_inside_where_paleomap_reaches(tmp_path: Path) -> None:
    folder = tmp_path / "plates"
    folder.mkdir()
    paleodem = tmp_path / "paleodem"
    paleodem.mkdir()
    _ = (folder / "0.png").write_bytes(png(blocks(37, 4, 6)))
    _ = (folder / "900.png").write_bytes(png(blocks(37, 4, 6)))
    land = np.full((19, 37), SEA_LEVEL_BYTE - 1, dtype=np.uint8)
    land[blocks(37, 10, 6) > 0] = SEA_LEVEL_BYTE + 50
    _ = (paleodem / "0.png").write_bytes(png(land))
    index = {"frames": [{"ma": 0, "file": "0.png"}, {"ma": 900, "file": "900.png"}, "odd"]}
    _ = (folder / "index.json").write_text(json.dumps(index))
    assert aligned(folder, paleodem) == 1
    frames = json.loads((folder / "index.json").read_text())["frames"]  # pyright: ignore[reportAny]
    assert frames[0]["turn"] == pytest.approx(60.0)
    assert frames[0]["landInside"] == {"asPublished": 0.0, "turned": 1.0}
    assert "turn" not in frames[1]


def test_refuses_an_index_without_frames(tmp_path: Path) -> None:
    _ = (tmp_path / "index.json").write_text(json.dumps({"frames": "none"}))
    with pytest.raises(TypeError, match="no frames"):
        _ = aligned(tmp_path, tmp_path)
