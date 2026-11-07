"""The planets' maps: checked against their pinned checksums, shrunk and brightened for the web."""

from __future__ import annotations

import hashlib
from typing import TYPE_CHECKING

import numpy as np
import pytest
from PIL import Image

from histeclipse_pipeline.planet_maps import MAPS, checked, stretched, web_map, write_map

if TYPE_CHECKING:
    from pathlib import Path


def test_each_map_is_pinned_and_from_a_mission_release() -> None:
    assert [source.planet for source in MAPS] == ["mercury", "mars", "jupiter"]
    for source in MAPS:
        assert len(source.sha256) == 64
        assert source.url.startswith(
            ("https://assets.science.nasa.gov/", "https://planetarymaps.usgs.gov/")
        )


def test_a_file_whose_checksum_matches_is_used(tmp_path: Path) -> None:
    path = tmp_path / "map.jpg"
    _ = path.write_bytes(b"a map")
    assert checked(path, hashlib.sha256(b"a map").hexdigest()) == path


def test_a_changed_file_is_refused(tmp_path: Path) -> None:
    path = tmp_path / "map.jpg"
    _ = path.write_bytes(b"another map")
    with pytest.raises(ValueError, match="does not match the pinned"):
        _ = checked(path, hashlib.sha256(b"a map").hexdigest())


def test_the_web_map_is_rgb_and_twice_as_wide_as_tall() -> None:
    image = web_map(Image.new("L", (300, 140), 90), width=64)
    assert image.mode == "RGB"
    assert image.size == (64, 32)
    assert image.getpixel((10, 10)) == (90, 90, 90)


def test_a_dark_map_is_brightened_so_its_brightest_are_white() -> None:
    values = np.tile(np.linspace(0, 100, 200, dtype=np.uint8), (100, 1))
    image = stretched(Image.fromarray(values))
    assert image.mode == "RGB"
    assert image.getextrema() == ((0, 255), (0, 255), (0, 255))
    assert web_map(Image.fromarray(values), stretch=True, width=40).getpixel((39, 10)) == (
        255,
        255,
        255,
    )


def test_a_black_map_stays_black() -> None:
    assert stretched(Image.new("L", (4, 2))).getpixel((0, 0)) == (0, 0, 0)


def test_the_map_is_written_as_a_jpeg(tmp_path: Path) -> None:
    path = tmp_path / "planets" / "mars-64.jpg"
    write_map(Image.new("RGB", (64, 32), (180, 90, 60)), path)
    with Image.open(path) as image:
        assert image.format == "JPEG"
        assert image.size == (64, 32)
