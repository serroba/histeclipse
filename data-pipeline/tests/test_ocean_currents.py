"""Tests for the ocean's currents near the surface and at 1,500 m (#927)."""

import io
import math
from typing import TYPE_CHECKING

import numpy as np
import pytest
from PIL import Image

from histeclipse_pipeline.ocean_currents import (
    DEPTHS,
    EQUATOR,
    FIRST,
    LAST,
    Currents,
    all_months,
    cached_month,
    cleaned,
    index_file,
    keep_month,
    manifest,
    month_name,
    pack,
    read_currents,
    stamp,
    write_index,
    write_month,
)
from histeclipse_pipeline.paleotemp import COLUMNS, ROWS
from tests.json_values import read_json
from tests.netcdf3_files import Var, netcdf3

if TYPE_CHECKING:
    from pathlib import Path

    from histeclipse_pipeline.krapp import Grid

LATITUDE = np.array([-60.5, -1.5, 1.5, 40.5])
LONGITUDE = np.array([0.5, 90.5, 180.5, 270.5])
LEVELS = np.array([1.0, 100.0, 1500.0])


def _month_file(levels: Grid | None = None) -> bytes:
    """A month of IAP's: 0.5 m/s east and 0.1 north at 1 m, a tenth of that deeper; one fill."""
    depths = LEVELS if levels is None else levels
    shape = (LATITUDE.size, LONGITUDE.size, depths.size)
    scale = np.where(depths <= 1.0, 1.0, 0.1)
    u = np.full(shape, 0.5) * scale
    v = np.full(shape, 0.1) * scale
    u[3, 3, :] = 1e20
    return netcdf3(
        {"lat": LATITUDE.size, "lon": LONGITUDE.size, "depth": depths.size},
        {
            "lat": Var(("lat",), LATITUDE),
            "lon": Var(("lon",), LONGITUDE),
            "depth": Var(("depth",), depths),
            "u": Var(("lat", "lon", "depth"), u),
            "v": Var(("lat", "lon", "depth"), v),
        },
    )


def test_names_and_lists_the_months() -> None:
    assert month_name(1940, 1) == "CZ16_1_2000m_GV_year_1940_month_1.nc"
    months = all_months()
    assert (months[0], months[-1]) == (FIRST, LAST)
    assert len(months) == 984
    assert stamp(1940, 3) == "1940-03"
    assert manifest([("a.nc", "11"), ("b.nc", "22")]) == b"a.nc 11\nb.nc 22\n"


def test_reads_two_depths_leaving_out_the_equator_and_fills() -> None:
    currents = read_currents(_month_file())
    assert set(currents.u) == {name for name, _, _ in DEPTHS}
    surface: list[list[float]] = currents.u["surface"].tolist()  # pyright: ignore[reportAny]
    assert surface[0][0] == pytest.approx(0.5)
    # Within EQUATOR degrees of the equator: none.
    assert EQUATOR > 1.5
    assert math.isnan(surface[1][0])
    assert math.isnan(surface[2][2])
    # The fill value.
    assert math.isnan(surface[3][3])
    deep: list[list[float]] = currents.v["1500m"].tolist()  # pyright: ignore[reportAny]
    assert deep[3][0] == pytest.approx(0.01)
    with pytest.raises(ValueError, match="no level at 1500"):
        _ = read_currents(_month_file(np.array([1.0, 100.0])))


def test_cleans_blow_ups_and_not_a_numbers() -> None:
    values = np.array([[0.2, np.nan, 60.0]])
    kept: list[list[float]] = cleaned(values, np.array([30.0])).tolist()  # pyright: ignore[reportAny]
    assert kept[0][0] == pytest.approx(0.2)
    assert math.isnan(kept[0][1])
    assert math.isnan(kept[0][2])


def test_packs_east_north_and_where_there_is_a_current() -> None:
    u = np.array([[-1.0, 0.0], [2.0, np.nan]])
    v = np.array([[1.0, 0.0], [-0.5, 0.0]])
    data = pack(u, v, 1.0)
    with Image.open(io.BytesIO(data)) as image:
        pixels = np.asarray(image)
    assert pixels.shape == (2, 2, 4)
    assert pixels[0, 0].tolist() == [0, 255, 128, 255]  # pyright: ignore[reportAny]
    assert pixels[0, 1].tolist() == [128, 128, 128, 255]  # pyright: ignore[reportAny]
    # Clipped at the bound.
    assert pixels[1, 0].tolist() == [255, 64, 128, 255]  # pyright: ignore[reportAny]
    assert pixels[1, 1, 3] == 0


def test_writes_each_depth_on_the_site_grid_and_the_index(tmp_path: Path) -> None:
    write_month(read_currents(_month_file()), (2010, 1), tmp_path)
    for name, _, _ in DEPTHS:
        with Image.open(tmp_path / name / "2010-01.png") as image:
            assert image.size == (COLUMNS, ROWS)
    write_index(tmp_path, "2026-11-20")
    written = read_json(tmp_path / "index.json")
    assert written == index_file("2026-11-20")
    assert isinstance(written, dict)
    assert (written["first"], written["last"]) == ("1940-01", "2021-12")
    assert written["depths"] == [
        {"id": "surface", "metres": 1.0, "bound": 1.0},
        {"id": "1500m", "metres": 1500.0, "bound": 0.2},
    ]


def test_keeps_a_month_in_the_cache_and_skips_a_broken_one(tmp_path: Path) -> None:
    currents = read_currents(_month_file())
    assert cached_month(tmp_path, "a.nc") is None
    keep_month(tmp_path, "a.nc", currents, "abc")
    held = cached_month(tmp_path, "a.nc")
    assert held is not None
    again, sha256 = held
    assert sha256 == "abc"
    assert isinstance(again, Currents)
    kept: list[list[float]] = again.u["surface"].tolist()  # pyright: ignore[reportAny]
    assert kept[0][0] == pytest.approx(0.5)
    assert math.isnan(kept[1][0])
    assert not (tmp_path / "a.nc.partial").exists()
    _ = (tmp_path / "b.nc.npz").write_bytes(b"cut short")
    assert cached_month(tmp_path, "b.nc") is None
