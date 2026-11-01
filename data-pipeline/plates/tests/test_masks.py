from __future__ import annotations

import io
import json
import zipfile
from typing import TYPE_CHECKING

import numpy as np
import pygplates
import pytest

from histeclipse_plates.masks import (
    CONTINENTS,
    FOLDER,
    ROTATIONS,
    build,
    continent_share,
    mask,
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


def test_seals_hairline_gaps_but_keeps_wide_straits() -> None:
    drawn = np.zeros((9, 20), dtype=np.uint8)
    drawn[2:7, 2:8] = 255
    drawn[2:7, 9:13] = 255  # a gap one node wide at column 8: sealed
    drawn[2:7, 16:19] = 255  # a strait three nodes wide (columns 13 to 15): kept
    out = sealed(drawn)
    assert out[4, 8] == 255
    assert out[4, 14] == 0
    assert out[0, 5] == 0  # the sea beyond is left alone
    # East and west wrap round: a gap across 180° is sealed too.
    edges = np.zeros((5, 10), dtype=np.uint8)
    edges[:, :4] = 255
    edges[:, 5:] = 255
    assert sealed(edges)[2, 4] == 255


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
