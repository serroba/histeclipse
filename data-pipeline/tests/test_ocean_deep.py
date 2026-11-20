"""Tests for the deep ocean's temperature each year (#940)."""

import math
from typing import TYPE_CHECKING

import numpy as np
import pytest
from PIL import Image

from histeclipse_pipeline.ocean_deep import (
    DEEP,
    baseline,
    deep_index,
    read_deep,
    whole_years,
    write_deep,
    years_of,
)
from histeclipse_pipeline.ocean_temperature import BASE
from histeclipse_pipeline.paleotemp import COLUMNS, ROWS
from tests.json_values import read_json
from tests.netcdf3_files import Var, netcdf3

if TYPE_CHECKING:
    from pathlib import Path

    from histeclipse_pipeline.krapp import Grid

LATITUDE = np.array([-60.5, -10.5, 20.5, 50.5])
LONGITUDE = np.array([10.5, 120.5, 200.5, 330.5])
LEVELS = np.array([1.0, 2000.0, 3000.0, 4000.0, 5000.0, 6000.0])


def _month_file(year: int, month: int, warm: float = 0.0, levels: Grid | None = None) -> bytes:
    """A month of IAP's: ``warm`` °C at every deep level; one cell missing at 5,000 m."""
    depths = LEVELS if levels is None else levels
    temp = np.full((LATITUDE.size, LONGITUDE.size, depths.size), warm)
    temp[0, 0, -2] = 999.0
    return netcdf3(
        {"lat": LATITUDE.size, "lon": LONGITUDE.size, "depth_std": depths.size, "time": 1},
        {
            "lat": Var(("lat",), LATITUDE),
            "lon": Var(("lon",), LONGITUDE),
            "time": Var(("time",), np.array([float(year * 100 + month)])),
            "depth_std": Var(("depth_std",), depths),
            "temp": Var(("lat", "lon", "depth_std"), temp, attributes={"_FillValue": 999.0}),
        },
    )


def test_reads_the_deep_levels() -> None:
    month = read_deep(_month_file(2015, 6, warm=0.03))
    assert (month.year, month.month) == (2015, 6)
    assert set(month.maps) == {name for name, *_ in DEEP}
    deep: list[list[float]] = month.maps["5000m"].tolist()  # pyright: ignore[reportAny]
    assert math.isnan(deep[0][0])
    assert deep[1][1] == pytest.approx(0.03)
    with pytest.raises(ValueError, match="not yyyymm"):
        _ = read_deep(_month_file(2015, 13))
    with pytest.raises(ValueError, match="no level at 5000"):
        _ = read_deep(_month_file(2015, 6, levels=np.array([1.0, 2000.0, 3000.0, 4000.0])))


def _year(year: int, warm: float, months: int = 12) -> list[bytes]:
    return [_month_file(year, month, warm) for month in range(1, months + 1)]


def test_averages_whole_years_against_the_base_and_writes_them(tmp_path: Path) -> None:
    files = [data for year in range(BASE[0], BASE[1] + 1) for data in _year(year, 0.01)]
    files += _year(1960, -0.04) + _year(2026, 0.5, months=9)
    found = years_of(read_deep(data) for data in files)
    assert whole_years(found) == [1960, *range(BASE[0], BASE[1] + 1)]
    usual: list[list[float]] = baseline(found, "2000m").tolist()  # pyright: ignore[reportAny]
    assert usual[1][1] == pytest.approx(0.01)
    # A year that is not whole is NaN everywhere.
    assert np.isnan(found.mean("2000m", 2026)).all()
    index = write_deep(found, tmp_path, "2026-11-20")
    assert (index["first"], index["last"]) == (1960, 2020)
    assert not (tmp_path / "deep" / "2000m" / "2026.png").exists()
    for name, _, bound, _ in DEEP:
        with Image.open(tmp_path / "deep" / name / "1960.png") as image:
            assert image.size == (COLUMNS, ROWS)
            pixels = np.asarray(image)
        # 1960 is 0.05 °C colder than the base: below the middle, by a share of the bound.
        expected = round((0.5 - 0.05 / (2 * bound)) * 255)
        assert abs(int(pixels[90, 120, 0]) - expected) <= 2  # pyright: ignore[reportAny]
    written = read_json(tmp_path / "deep.json")
    assert written == deep_index(1960, 2020, "2026-11-20")
    assert isinstance(written, dict)
    assert written["files"] == "deep/<depth>/YYYY.png"


def test_needs_every_base_year_and_some_whole_year(tmp_path: Path) -> None:
    found = years_of(read_deep(data) for data in _year(1960, 0.0))
    with pytest.raises(ValueError, match="lacks 1991"):
        _ = baseline(found, "2000m")
    partial = years_of(read_deep(data) for data in _year(1960, 0.0, months=3))
    with pytest.raises(ValueError, match="no whole years"):
        _ = write_deep(partial, tmp_path, "x")
