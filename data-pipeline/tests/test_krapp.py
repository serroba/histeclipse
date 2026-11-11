import io
import json
import math
from typing import TYPE_CHECKING

import h5py
import numpy as np
import pytest
from PIL import Image

from histeclipse_pipeline.krapp import (
    Grid,
    bounds,
    build,
    decode,
    dilate,
    encode,
    kept,
    land_mean,
    read_frames,
    read_source,
    regrid,
    to_png,
    write_krapp,
)
from histeclipse_pipeline.paleotemp import COLUMNS, ROWS

if TYPE_CHECKING:
    from pathlib import Path

#: The source's 0.5° cell centres.
LATITUDE = np.arange(-89.75, 90.0, 0.5)
LONGITUDE = np.arange(-179.75, 180.0, 0.5)


def cells(value: float = np.nan) -> Grid:
    return np.full((len(LATITUDE), len(LONGITUDE)), value)


def lat_index(latitude: float) -> int:
    return int(np.argmin(np.abs(LATITUDE - latitude)))


def lon_index(longitude: float) -> int:
    return int(np.argmin(np.abs(LONGITUDE - longitude)))


def node(latitude: int, longitude: int) -> tuple[int, int]:
    return 90 - latitude, longitude + 180


def test_averages_the_four_cells_round_a_node() -> None:
    values = cells()
    for latitude, longitude, value in (
        (45.25, 10.25, 1.0),
        (44.75, 10.25, 2.0),
        (45.25, 9.75, 3.0),
        (44.75, 9.75, 6.0),
    ):
        values[lat_index(latitude), lon_index(longitude)] = value
    grid = regrid(values, LATITUDE, LONGITUDE)
    assert grid.shape == (ROWS, COLUMNS)
    assert grid[node(45, 10)] == pytest.approx(3.0)
    # Each cell is a quarter degree from one node and three quarters from the next.
    assert np.isfinite(grid).sum() == 1


def test_averages_only_the_valid_cells() -> None:
    values = cells()
    values[lat_index(-4.75), lon_index(-60.25)] = 25.0
    values[lat_index(-5.25), lon_index(-59.75)] = 27.0
    grid = regrid(values, LATITUDE, LONGITUDE)
    assert grid[node(-5, -60)] == pytest.approx(26.0)


def test_wraps_round_the_180_meridian() -> None:
    values = cells()
    values[lat_index(10.25), lon_index(179.75)] = 4.0
    values[lat_index(10.25), lon_index(-179.75)] = 8.0
    values[lat_index(10.25), lon_index(178.75)] = 1.0
    grid = regrid(values, LATITUDE, LONGITUDE)
    assert grid[node(10, -180)] == pytest.approx(6.0)
    assert grid[node(10, 180)] == pytest.approx(6.0)
    assert grid[node(10, 179)] == pytest.approx(1.0)
    assert math.isnan(grid.item(node(10, -179)))


def test_takes_either_latitude_order() -> None:
    values = cells()
    values[lat_index(60.25), lon_index(0.25)] = 5.0
    flipped = regrid(values[::-1], LATITUDE[::-1], LONGITUDE)
    assert flipped[node(60, 0)] == pytest.approx(5.0)
    assert math.isnan(flipped.item(node(-60, 0)))


def test_the_pole_node_takes_the_cells_next_to_it() -> None:
    values = cells()
    values[lat_index(89.75), :] = -20.0
    assert np.allclose(regrid(values, LATITUDE, LONGITUDE)[:1], -20.0)


def test_fills_a_few_rings_round_the_data() -> None:
    grid = np.full((ROWS, COLUMNS), np.nan)
    grid[90, 10] = 5.0
    grid[90, 12] = 7.0
    filled = dilate(grid, passes=2)
    assert filled[90, 11] == pytest.approx(6.0)
    assert filled[89, 10] == pytest.approx(5.0)
    assert math.isfinite(filled.item(92, 10))
    assert math.isnan(filled.item(93, 10))
    assert filled[90, 10] == 5.0  # data stays as it is


def test_fills_across_the_180_meridian() -> None:
    grid = np.full((ROWS, COLUMNS), np.nan)
    grid[50, 1] = 3.0
    filled = dilate(grid, passes=1)
    assert filled[50, 0] == filled[50, -1] == pytest.approx(3.0)
    assert filled[50, -2] == pytest.approx(np.nan, nan_ok=True)
    filled = dilate(grid, passes=2)
    assert filled[50, -2] == pytest.approx(3.0)


def test_bounds_round_outward() -> None:
    a = np.array([[np.nan, -12.3, 4.0]])
    b = np.array([[30.2, np.nan, 1.0]])
    assert bounds([a, b]) == (-13.0, 31.0)


def test_packs_a_step_and_today_into_rgba() -> None:
    grid = np.full((ROWS, COLUMNS), np.nan)
    grid[90, 100] = -20.0
    grid[90, 101] = 30.0
    grid[90, 102] = 5.0
    grid[90, 103] = 80.0  # beyond the bounds: clipped
    today = np.full((ROWS, COLUMNS), np.nan)
    today[90, 101:105] = 30.0  # today's land reaches one node further, and lacks the first
    packed = encode(grid, today, -20.0, 30.0)
    assert packed.shape == (ROWS, COLUMNS, 4)
    assert packed[90:91, 100:105, 0].tolist() == [[0, 255, 128, 255, 255]]  # R (104 filled)
    assert packed[90:91, 100:105, 1].tolist() == [[255, 255, 255, 255, 255]]  # G: today
    assert packed[90:91, 100:105, 2].tolist() == [[0, 255, 255, 255, 255]]  # B: today's data
    assert packed[90:91, 100:105, 3].tolist() == [[255, 255, 255, 255, 0]]  # A: this step's
    # Next to the data, R and G take its value; far away they are 0; nothing has data there.
    assert packed[90:91, 99:100].tolist() == [[[0, 255, 0, 0]]]
    assert packed[89, 101, 0] == 128  # mean of -20, 30 and 5
    assert packed[89, 101, 3] == 0
    assert packed[10:11, 10:11].tolist() == [[[0, 0, 0, 0]]]
    for celsius, byte in ((-20.0, 0), (30.0, 255), (5.0, 128)):
        assert abs(decode(byte, -20.0, 30.0) - celsius) <= 50 / 255 / 2 + 1e-9


def test_round_trips_through_a_png() -> None:
    rng = np.random.default_rng(1)
    grid = rng.uniform(-30, 30, (ROWS, COLUMNS))
    grid[:20] = np.nan
    today = rng.uniform(-30, 30, (ROWS, COLUMNS))
    today[-20:] = np.nan
    with Image.open(io.BytesIO(to_png(grid, today, -30.0, 30.0))) as image:
        assert (image.mode, image.size) == ("RGBA", (COLUMNS, ROWS))
        pixels = np.asarray(image)
    assert np.array_equal(pixels[:, :, 3], np.where(np.isnan(grid), 0, 255))
    assert np.array_equal(pixels[:, :, 2], np.where(np.isnan(today), 0, 255))
    back = -30.0 + pixels[20:, :, 0] / 255 * 60.0
    assert np.max(np.abs(back - grid[20:])) <= 60 / 255 / 2 + 1e-9
    back_today = -30.0 + pixels[:-20, :, 1] / 255 * 60.0
    assert np.max(np.abs(back_today - today[:-20])) <= 60 / 255 / 2 + 1e-9


def test_land_mean_weights_by_area_and_skips_no_data() -> None:
    grid = np.full((ROWS, COLUMNS), np.nan)
    grid[:91] = 30.0  # the northern hemisphere
    grid[91:] = 10.0
    assert land_mean(grid) == pytest.approx(20.0, abs=0.2)
    grid[91:] = np.nan
    grid[:, -1] = 99.0  # the repeated meridian is not counted
    assert land_mean(grid) == pytest.approx(30.0)


def test_keeps_every_step_from_the_present() -> None:
    assert kept(range(9), step=1) == list(range(9))
    # The real file: 0 to 799 ka; every 2,000 years keeps 0 and 798 at the ends.
    every_other = kept(range(799, -1, -1))
    assert (len(every_other), every_other[0], every_other[-1]) == (400, 0, 798)
    assert kept([3, 0, 1, 2, 7, 4], step=2) == [0, 2, 4]


def source_file(ka: list[int]) -> bytes:
    """A file laid out like the real one: years BP as negative years, oldest first."""
    years = sorted(-1000.0 * each for each in ka)
    data = np.full((len(years), len(LATITUDE), len(LONGITUDE)), -9e33, dtype=np.float32)
    for index, year in enumerate(years):
        # One land node at 45° N 90° W, a degree colder for every thousand years back.
        for lat in (45.25, 44.75):
            for lon in (-90.25, -89.75):
                data[index, lat_index(lat), lon_index(lon)] = 10.0 + year / 1000
    out = io.BytesIO()
    with h5py.File(out, "w") as opened:
        _ = opened.create_dataset("time", data=np.array(years, dtype=np.float32))
        _ = opened.create_dataset("latitude", data=LATITUDE.astype(np.float32))
        _ = opened.create_dataset("longitude", data=LONGITUDE.astype(np.float32))
        _ = opened.create_dataset("bio01", data=data)
    return out.getvalue()


def test_reads_the_axes_and_frames() -> None:
    with h5py.File(io.BytesIO(source_file([0, 1, 2, 21])), "r") as opened:
        source = read_source(opened)
        assert source.ka == (21, 2, 1, 0)
        frames = list(read_frames(opened, source, [0, 21]))
    assert [ka for ka, _ in frames] == [0, 21]
    assert frames[1][1][node(45, -90)] == pytest.approx(-11.0)
    assert np.isfinite(frames[0][1]).sum() == 1  # the -9e33 cells are no data


def test_rejects_times_it_does_not_understand() -> None:
    out = io.BytesIO()
    with h5py.File(out, "w") as opened:
        _ = opened.create_dataset("time", data=np.array([-1500.0, 0.0], dtype=np.float32))
    with (
        h5py.File(io.BytesIO(out.getvalue()), "r") as opened,
        pytest.raises(ValueError, match="whole thousands"),
    ):
        _ = read_source(opened)


def test_writes_images_and_an_index(tmp_path: Path) -> None:
    folder = tmp_path / "out"
    assert build(source_file([0, 1, 2, 3, 21]), folder, step=2) == 2
    index = json.loads((folder / "index.json").read_text())  # pyright: ignore[reportAny]
    assert index["coverage"] == "land"
    assert (index["columns"], index["rows"]) == (COLUMNS, ROWS)
    assert (index["coldest"], index["warmest"]) == (8.0, 10.0)
    assert index["frames"] == [
        {"ma": 0, "file": "0.png", "mean": 10.0},
        {"ma": 0.002, "file": "2.png", "mean": 8.0},
    ]
    assert sorted(each.name for each in folder.iterdir()) == ["0.png", "2.png", "index.json"]
    with Image.open(folder / "2.png") as image:
        row, column = node(45, -90)
        # 8 °C then, 10 °C today, on a scale from 8 to 10: the change is -2 °C.
        assert image.getpixel((column, row)) == (0, 255, 255, 255)
    with Image.open(folder / "0.png") as image:
        assert image.getpixel((column, row)) == (255, 255, 255, 255)


def test_needs_today_among_the_frames(tmp_path: Path) -> None:
    grid = np.full((ROWS, COLUMNS), 1.0)
    with pytest.raises(ValueError, match="today"):
        _ = write_krapp([(2, grid)], tmp_path)
