"""The planets' maps: checked against their pinned checksums, shrunk and brightened for the web."""

from __future__ import annotations

import hashlib
from typing import TYPE_CHECKING

import numpy as np
import pytest
from PIL import Image

from histeclipse_pipeline.arrays import dims
from histeclipse_pipeline.planet_maps import (
    MAPS,
    cassini_fits_map,
    checked,
    filled_by_latitude,
    fits_bands,
    stretched,
    web_map,
    write_map,
)

if TYPE_CHECKING:
    from pathlib import Path


def test_each_map_is_pinned_and_from_a_mission_release() -> None:
    assert [source.stem for source in MAPS] == [
        "planets/mercury",
        "planets/mars",
        "planets/jupiter",
        "planets/saturn",
        "planets/venus-radar",
        "planets/mars-height",
        "moon-height",
        "moon-minerals",
        "planets/mercury-colour",
        "planets/jupiter-2024",
        "moons/phobos",
        "moons/io",
        "moons/europa",
        "moons/ganymede",
        "moons/callisto",
        "moons/mimas",
        "moons/enceladus",
        "moons/tethys",
        "moons/dione",
        "moons/rhea",
        "moons/titan",
        "moons/iapetus",
        "earth-blue-marble",
        "moon-lroc",
    ]
    for source in MAPS:
        assert len(source.sha256) == 64
        assert source.url.startswith(
            (
                "https://assets.science.nasa.gov/",
                "https://planetarymaps.usgs.gov/",
                "https://svs.gsfc.nasa.gov/",
                "https://atmos.nmsu.edu/PDS/",
                "https://archive.stsci.edu/missions/hlsp/opal/",
            )
        )


def test_each_map_comes_in_the_sizes_the_site_loads_never_enlarged() -> None:
    sizes = {source.stem: source.widths for source in MAPS}
    # No sharp size for Phobos, 22 km across; Titan's is its own 4040, not enlarged.
    assert sizes["moons/europa"] == (2048, 4096)
    assert sizes["moons/phobos"] == (2048,)
    assert sizes["moons/titan"] == (2048, 4040)
    assert sizes["planets/mars"] == (2048, 4096)
    assert sizes["earth-blue-marble"] == (4096, 8192)
    # Cassini's map is 3601 wide: its sharp size is its own.
    assert max(sizes["planets/jupiter"]) <= 3601


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


def fits(bands: np.typing.NDArray[np.float32], bitpix: int = -32) -> bytes:
    """A FITS file of (3, rows, columns) floats, as Cassini's maps are stored."""
    count, rows, columns = dims(bands.astype(np.float64))
    cards = [
        "SIMPLE  =                    T",
        f"BITPIX  = {bitpix:>20}",
        "NAXIS   =                    3",
        f"NAXIS1  = {columns:>20}",
        f"NAXIS2  = {rows:>20}",
        f"NAXIS3  = {count:>20}",
        "LON_W   = '360.0:-0.1:0.0' /west longitude",
        "COMMENT a card without a value",
        "END",
    ]
    header = "".join(card.ljust(80) for card in cards).encode("ascii")
    header += b" " * (-len(header) % 2880)
    return header + bands.astype(">f4").tobytes()


def test_reads_a_fits_map_of_three_float_bands() -> None:
    bands = np.arange(3 * 2 * 4, dtype=np.float32).reshape(3, 2, 4)
    read = fits_bands(fits(bands))
    assert read.shape == (2, 4, 3)
    assert np.array_equal(read[1, 2:3], [[6.0, 14.0, 22.0]])
    with pytest.raises(ValueError, match="three bands"):
        _ = fits_bands(fits(bands, bitpix=16))
    with pytest.raises(ValueError, match="no END"):
        _ = fits_bands(b"SIMPLE  =                    T".ljust(80))


def test_fills_gaps_with_the_nearest_latitude_imaged() -> None:
    bands = np.zeros((4, 3, 3))
    bands[1] = [[10, 20, 30], [0, 0, 0], [30, 40, 50]]
    bands[2, 0] = [5, 5, 5]
    filled = filled_by_latitude(bands)
    # Row 1's gap takes its own row's mean; rows 0 and 3 are empty and take the nearest rows'.
    assert np.array_equal(filled[1, 1:2], [[20.0, 30.0, 40.0]])
    assert np.array_equal(filled[0, 2:3], [[20.0, 30.0, 40.0]])
    assert np.array_equal(filled[3, 0:1], [[5.0, 5.0, 5.0]])
    assert np.array_equal(filled[2, 0:3], [[5.0, 5.0, 5.0]] * 3)
    with pytest.raises(ValueError, match="nothing"):
        _ = filled_by_latitude(np.zeros((2, 2, 3)))


def test_turns_cassinis_map_north_up_with_zero_longitude_in_the_middle() -> None:
    # Columns 0°, 90°, 180°, 270° east (west 360, 270, 180, 90), then 0° again: the first is a
    # dark seam, dropped.
    bands = np.zeros((3, 2, 5), dtype=np.float32)
    for column, value in enumerate([1, 20, 30, 40, 10]):
        bands[:, :, column] = value
    bands[:, 0, 4] = 200  # the first row's 0°: the north, kept at the top
    image = cassini_fits_map(fits(bands))
    assert image.size == (4, 2)
    pixels: np.typing.NDArray[np.uint8] = np.asarray(image, dtype=np.uint8)
    # 180° at the left edge, then 270°, 0° in the middle, 90°.
    assert np.array_equal(pixels[1:2, :, 0], [[30, 40, 10, 20]])
    assert np.array_equal(pixels[0:1, 2:3], [[[200, 200, 200]]])


def test_turns_a_map_half_a_turn_to_put_zero_longitude_in_the_middle() -> None:
    # Four columns from 0° at the left edge: 0°, 90°, 180°, 270°.
    columns = np.zeros((2, 4, 3), dtype=np.uint8)
    for column, value in enumerate([10, 20, 30, 40]):
        columns[:, column] = value
    turned = np.asarray(web_map(Image.fromarray(columns), width=4, half_turn=True), dtype=np.uint8)
    # 180° at the left edge, 0° in the middle.
    assert np.array_equal(turned[0:1, :, 0], [[30, 40, 10, 20]])
