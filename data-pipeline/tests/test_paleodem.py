import io
import json
import zipfile
from typing import TYPE_CHECKING

import h5py
import numpy as np
import pytest
from PIL import Image

from histeclipse_pipeline.paleodem import (
    COLUMNS,
    LAND_HEIGHT,
    ROWS,
    SEA_DEPTH,
    SOURCE_COLUMNS,
    SOURCE_ROWS,
    Grid,
    Heights,
    decode,
    encode,
    fill,
    halve,
    land_fraction,
    read_archive,
    read_grid,
    repair,
    to_png,
    write_paleodem,
)

if TYPE_CHECKING:
    from pathlib import Path


def heights(rows: int, columns: int, *, land_north_of: float = 100.0) -> Heights:
    """Sea 4 km deep everywhere, with land 500 m high north of a latitude."""
    latitudes = np.linspace(90, -90, rows)[:, np.newaxis]
    return np.where(latitudes > land_north_of, 500.0, -4000.0) * np.ones((1, columns))


def netcdf(values: Heights) -> bytes:
    """The grid as the archive holds it: a NetCDF-4 (HDF5) file with a ``z`` variable."""
    out = io.BytesIO()
    with h5py.File(out, "w") as file:
        _ = file.create_dataset("z", data=values.astype(np.float32))
    return out.getvalue()


def source(*, land_north_of: float = 100.0) -> Heights:
    return heights(SOURCE_ROWS, SOURCE_COLUMNS, land_north_of=land_north_of)


def test_reads_a_netcdf_grid() -> None:
    grid = read_grid(250, netcdf(source(land_north_of=60)))
    assert grid.heights.shape == (SOURCE_ROWS, SOURCE_COLUMNS)
    assert grid.heights[0, 0] == 500.0
    assert grid.heights[-1, 0] == -4000.0


def test_rejects_a_grid_of_another_size() -> None:
    with pytest.raises(ValueError, match="expected 1801 by 3601"):
        _ = read_grid(5, netcdf(heights(181, 361)))


def test_fills_faults_from_their_sound_neighbours() -> None:
    values = np.full((7, 9), -3000.0)
    values[2:5, 3:6] = 10_500.0  # a block, filled from the edge in
    filled = fill(values, values > 9500)
    assert np.allclose(filled, -3000.0)


def test_cannot_fill_a_grid_with_nothing_sound() -> None:
    values = np.full((3, 3), 10_000.0)
    with pytest.raises(ValueError, match="no sound node"):
        _ = fill(values, values > 9500)


def test_repairs_spikes_poles_and_the_seam() -> None:
    values = heights(9, 13)
    values[4, 6] = 10_500.0  # the Challenger Deep with its sign lost
    values[3, 6] = 9_300.0  # a high peak, kept
    values[0, 0] = 10_000.0  # the corner spike
    values[0, 5] = 2_000.0  # a scattered pole value
    values[2, 0] = -1000.0  # the two 180° columns disagree
    values[2, -1] = -5000.0
    repaired = repair(values)
    assert repaired[4, 6] < 0
    assert repaired[3, 6] == 9_300.0
    assert np.array_equal(repaired[:1], repaired[1:2])
    assert np.array_equal(repaired[-1:], repaired[-2:-1])
    assert np.array_equal(repaired[:, 0], repaired[:, -1])
    assert repaired[2, 0] == -4000.0  # the mean of the columns beside the seam


def test_halves_the_grid_keeping_both_edges() -> None:
    values = heights(9, 17, land_north_of=0)
    values[:, 0] = values[:, -1] = 100.0  # the seam, on land
    half = halve(values)
    assert half.shape == (5, 9)
    assert np.array_equal(half[:, 0], half[:, -1])
    # Smoothing wraps across 180°: the seam's neighbours on both sides feel it alike.
    assert half[-1, 1] == half[-1, -2]
    assert half[0, 4] == 500.0
    assert half[-1, 4] == -4000.0
    assert np.isclose(halve(np.full((5, 9), 7.0)), 7.0).all()


def test_packs_heights_into_a_byte_with_sea_level_between_127_and_128() -> None:
    packed = encode(np.array([0, -1, LAND_HEIGHT, 9000, -SEA_DEPTH, -12_000], dtype=np.float64))
    assert packed.tolist() == [128, 127, 255, 255, 0, 0]
    samples = (-10_000, -4000, -200, 0, 300, 2000, 6000)
    packed_bytes = bytes(encode(np.array(samples, dtype=np.float64)))
    for metres, byte in zip(samples, packed_bytes, strict=True):
        step = SEA_DEPTH / 127 if metres < 0 else LAND_HEIGHT / 127
        assert abs(decode(byte) - metres) <= step


def test_weights_land_by_area() -> None:
    # Land north of 0°: half the sphere.
    assert land_fraction(heights(181, 361, land_north_of=0)) == pytest.approx(0.5, abs=0.01)
    assert land_fraction(heights(181, 361)) == 0


def test_writes_greyscale_images_and_an_index(tmp_path: Path) -> None:
    image = Image.open(io.BytesIO(to_png(heights(ROWS, COLUMNS, land_north_of=60))))
    assert (image.mode, image.size) == ("L", (COLUMNS, ROWS))
    assert image.getpixel((10, 0)) == 128 + round(500 / LAND_HEIGHT * 127)
    grids = [Grid(0, source(land_north_of=0)), Grid(5, source())]
    assert write_paleodem(iter(grids), tmp_path) == 2
    index = json.loads((tmp_path / "index.json").read_text())  # pyright: ignore[reportAny]
    assert (index["columns"], index["rows"]) == (COLUMNS, ROWS)
    assert index["frames"][0]["file"] == "0.png"
    assert index["frames"][0]["land"] == pytest.approx(0.5, abs=0.01)
    assert index["seaDepth"] == SEA_DEPTH
    with Image.open(tmp_path / "5.png") as written:
        assert written.size == (COLUMNS, ROWS)


def test_reads_every_grid_in_the_archive_youngest_first() -> None:
    out = io.BytesIO()
    grid = netcdf(source())
    with zipfile.ZipFile(out, "w") as archive:
        archive.writestr("nc/Map05_PALEOMAP_6min_Late_Miocene_10Ma.nc", grid)
        archive.writestr("nc/Map01_PALEOMAP_6min_Holocene_0Ma.nc", grid)
        archive.writestr("__MACOSX/nc/._Map01_PALEOMAP_6min_Holocene_0Ma.nc", b"\0")
        archive.writestr("nc/.DS_Store", b"\0")
    assert [grid.ma for grid in read_archive(out.getvalue())] == [0, 10]
