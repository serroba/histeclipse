"""The ozone layer as a surface round the Earth: the CAMS reanalysis's days."""

from __future__ import annotations

import io
import json
import math
import zipfile
from datetime import UTC, date, datetime, timedelta
from typing import TYPE_CHECKING

import h5py
import numpy as np
import pytest
from PIL import Image

from histeclipse_pipeline.ozone_shell import (
    COLUMNS,
    LEVELS,
    PINS,
    ROWS,
    YEARS,
    Season,
    below_mkm2,
    build,
    digest,
    dobson,
    height_km,
    index_file,
    partial_pressure,
    read_season,
    request,
    surface,
    to_png,
)

if TYPE_CHECKING:
    from pathlib import Path

    import numpy.typing as npt


type Grid = npt.NDArray[np.float64]

LATITUDE = np.linspace(90.0, -90.0, ROWS)
LONGITUDE: Grid = np.arange(COLUMNS, dtype=np.float64) * 3.0
LEVEL_ARRAY = np.array(LEVELS)
#: One Dobson unit, kg/m².
DU = 2.1415e-5


def mixing(pressures_mpa: list[float]) -> Grid:
    """Give the mass mixing ratio that makes each level's partial pressure, one column."""
    wanted = np.array(pressures_mpa)
    ratio: Grid = wanted / (28.9644 / 47.9982) / (LEVEL_ARRAY * 1e5)
    return ratio


#: A column with the layer: over 12 mPa from 50 to 20 hPa. And one in the hole: never.
LAYER = mixing([2, 3, 5, 8, 13, 15, 14, 9, 6, 4])
HOLE = mixing([2, 3, 3, 1, 0.5, 1, 4, 5, 4, 3])


def season(days: int = 3, *, year: int = 2006) -> Season:
    """A season with the layer everywhere but south of 70°S, 150 DU there and 300 elsewhere."""
    ozone = np.empty((days, len(LEVELS), ROWS, COLUMNS))
    ozone[:] = LAYER[None, :, None, None]
    south = LATITUDE <= -70
    ozone[:, :, south, :] = HOLE[None, :, None, None]
    column = np.full((days, ROWS, COLUMNS), 300 * DU)
    column[:, south, :] = 150 * DU
    return Season(date(year, 7, 1), LEVEL_ARRAY, ozone, column)


def moments(first: date, days: int, hour: int = 12) -> list[int]:
    start = datetime(first.year, first.month, first.day, hour, tzinfo=UTC)
    return [int((start + timedelta(days=day)).timestamp()) for day in range(days)]


def netcdf(
    name: str,
    values: Grid,
    times: list[int],
    *,
    levels: Grid | None = None,
    longitude: Grid = LONGITUDE,
) -> bytes:
    out = io.BytesIO()
    with h5py.File(out, "w") as opened:
        _ = opened.create_dataset("valid_time", data=np.array(times, dtype=np.float64))
        _ = opened.create_dataset("latitude", data=LATITUDE)
        _ = opened.create_dataset("longitude", data=longitude)
        if levels is not None:
            _ = opened.create_dataset("pressure_level", data=levels)
        _ = opened.create_dataset(name, data=values.astype(np.float32))
    return out.getvalue()


def archive(made: Season, **changes: bytes) -> bytes:
    times = moments(made.first, made.column.shape[0])  # pyright: ignore[reportAny]
    files = {
        "data_plev.nc": netcdf("go3", made.ozone, times, levels=made.levels),
        "data_sfc.nc": netcdf("gtco3", made.column, times),
        **changes,
    }
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as opened:
        for name, data in files.items():
            opened.writestr(name, data)
    return out.getvalue()


def test_each_season_from_2003_to_2025_is_asked_for_from_july_to_december() -> None:
    assert list(YEARS) == list(range(2003, 2026))
    asked = request(2006)
    assert asked["date"] == ["2006-07-01/2006-12-31"]
    assert asked["time"] == ["12:00"]
    assert asked["grid"] == ["3.0", "3.0"]
    assert asked["pressure_level"] == ["200", "150", "100", "70", "50", "30", "20", "10", "7", "5"]
    assert asked["variable"] == ["ozone", "total_column_ozone"]
    assert sorted(PINS) == list(YEARS)


def test_a_season_is_read_and_its_checksum_is_of_its_numbers() -> None:
    made = season()
    read = read_season(archive(made))
    assert read.first == date(2006, 7, 1)
    assert read.ozone.shape == (3, 10, ROWS, COLUMNS)
    assert read.column.shape == (3, ROWS, COLUMNS)
    assert read.levels.tolist() == list(LEVELS)
    # Packed again, the same numbers; another day's, not.
    assert digest(read) == digest(read_season(archive(made)))
    assert digest(read) != digest(read_season(archive(season(year=2007))))
    other = season()
    other.column[0, 0, 0] += DU
    assert digest(read) != digest(read_season(archive(other)))


def test_a_season_on_another_grid_other_levels_or_other_hours_is_refused() -> None:
    made = season()
    times = moments(made.first, 3)
    shifted = netcdf(
        "go3",
        made.ozone,
        times,
        levels=LEVEL_ARRAY,
        longitude=np.asarray(LONGITUDE + 1.5, dtype=np.float64),
    )
    with pytest.raises(ValueError, match="does not run from 90°N and 0°E"):
        _ = read_season(archive(made, **{"data_plev.nc": shifted}))
    out = io.BytesIO()
    with h5py.File(out, "w") as opened:
        _ = opened.create_dataset("valid_time", data=np.array(times, dtype=np.float64))
        _ = opened.create_dataset("latitude", data=np.linspace(90.0, -90.0, 31))
        _ = opened.create_dataset("longitude", data=LONGITUDE)
        _ = opened.create_dataset("gtco3", data=np.ones((3, 31, COLUMNS), dtype=np.float32))
    with pytest.raises(ValueError, match="not the three-degree grid"):
        _ = read_season(archive(made, **{"data_sfc.nc": out.getvalue()}))
    fewer = netcdf("go3", made.ozone[:, :9], times, levels=LEVEL_ARRAY[:9])
    with pytest.raises(ValueError, match="the levels are"):
        _ = read_season(archive(made, **{"data_plev.nc": fewer}))
    midnight = netcdf("gtco3", made.column, moments(made.first, 3, hour=0))
    with pytest.raises(ValueError, match="not one field a day at 12:00 UTC"):
        _ = read_season(archive(made, **{"data_sfc.nc": midnight}))
    later = netcdf("gtco3", made.column, moments(date(2006, 7, 2), 3))
    with pytest.raises(ValueError, match="starts on another day"):
        _ = read_season(archive(made, **{"data_sfc.nc": later}))
    short = netcdf("gtco3", made.column[:2], times[:2])
    with pytest.raises(ValueError, match="not a day by the levels by the grid"):
        _ = read_season(archive(made, **{"data_sfc.nc": short}))


def test_a_level_s_height_is_seven_km_for_each_fall_of_the_pressure_by_e() -> None:
    heights = height_km(np.array([1000.0, 1000.0 / math.e, 30.0]))
    assert heights.tolist() == pytest.approx([0.0, 7.0, 7.0 * math.log(1000 / 30)])


def test_the_partial_pressure_is_the_mixing_ratio_by_volume_times_the_pressure() -> None:
    pressures = partial_pressure(season(1).ozone, LEVEL_ARRAY)
    assert pressures.shape == (1, 10, ROWS, COLUMNS)
    assert pressures[0, :, 30, 0].tolist() == pytest.approx([2, 3, 5, 8, 13, 15, 14, 9, 6, 4])


def test_the_surface_is_where_ozone_crosses_12_mpa_and_absent_where_it_never_does() -> None:
    made = season(1)
    lower, upper = surface(partial_pressure(made.ozone, LEVEL_ARRAY), LEVEL_ARRAY)
    z = height_km(LEVEL_ARRAY)
    # Going up: 8 mPa at 70 hPa, 13 at 50: 12 is four fifths of the way. Coming down from 9
    # at 10 hPa to 14 at 20: three fifths of the way.
    assert lower[0, 30, 0] == pytest.approx(z[3] + 0.8 * (z[4] - z[3]))  # pyright: ignore[reportAny]
    assert upper[0, 30, 0] == pytest.approx(z[7] + 0.6 * (z[6] - z[7]))  # pyright: ignore[reportAny]
    assert lower[0, 30, 0] < upper[0, 30, 0]
    # In the hole, none.
    assert np.isnan(lower[0, -1, 0])  # pyright: ignore[reportAny]
    assert np.isnan(upper[0, -1, 0])  # pyright: ignore[reportAny]


def test_a_surface_reaching_the_lowest_or_highest_level_read_is_put_at_that_level() -> None:
    made = season(1)
    made.ozone[0, :, 0, 0] = mixing([13, 14, 15, 15, 15, 15, 15, 15, 14, 13])
    lower, upper = surface(partial_pressure(made.ozone, LEVEL_ARRAY), LEVEL_ARRAY)
    z = height_km(LEVEL_ARRAY)
    assert lower[0, 0, 0] == pytest.approx(z[0])  # pyright: ignore[reportAny]
    assert upper[0, 0, 0] == pytest.approx(z[-1])  # pyright: ignore[reportAny]


def test_total_ozone_is_in_dobson_units_and_the_hole_s_area_is_the_south_under_220() -> None:
    made = season(2)
    units = dobson(made.column)
    assert units[0, 30, 0] == pytest.approx(300)
    areas = below_mkm2(units)
    # The cap south of 68.5°S, half a cell beyond the row at 69°S... the row at 72°S and south.
    cap = 2 * math.pi * 6371.0**2 * (1 - math.sin(math.radians(70.5))) / 1e6
    assert areas == [pytest.approx(cap, abs=0.1)] * 2
    # Low ozone in the north is not the Antarctic hole.
    units[:, LATITUDE >= 80, :] = 150
    assert below_mkm2(units) == areas


def test_a_season_is_packed_as_one_image_its_days_one_under_the_other() -> None:
    made = season(2)
    lower, upper = surface(partial_pressure(made.ozone, LEVEL_ARRAY), LEVEL_ARRAY)
    with Image.open(io.BytesIO(to_png(lower, upper, dobson(made.column)))) as image:
        assert image.mode == "RGB"
        assert image.size == (COLUMNS, 2 * ROWS)
        pixels = np.asarray(image)
    red, green, blue = (int(value) for value in pixels[30, 0])  # pyright: ignore[reportAny]
    assert 10 + red * 0.1 == pytest.approx(float(lower[0, 30, 0]), abs=0.05)  # pyright: ignore[reportAny]
    assert 10 + green * 0.1 == pytest.approx(float(upper[0, 30, 0]), abs=0.05)  # pyright: ignore[reportAny]
    assert 100 + blue * 2 == 300
    # In the hole: no surface, its total ozone still there. The second day follows the first.
    assert pixels[ROWS - 1, 0].tolist() == [0, 0, 25]  # pyright: ignore[reportAny]
    assert pixels[ROWS + 30, 0].tolist() == [red, green, blue]  # pyright: ignore[reportAny]


def test_the_seasons_are_written_with_an_index_that_credits_them(tmp_path: Path) -> None:
    count = build([season(2), season(3, year=2007)], tmp_path / "ozone")
    assert count == 2
    index = json.loads((tmp_path / "ozone" / "shell.json").read_text())  # pyright: ignore[reportAny]
    assert index == json.loads(json.dumps(index_file(index["seasons"])))  # pyright: ignore[reportAny]
    assert index["licence"] == "CC BY 4.0"
    assert "Inness et al. 2019" in index["credit"]
    assert "Copernicus Atmosphere Monitoring Service" in index["credit"]
    assert index["surfaceMPa"] == 12.0
    assert index["grid"] == {"rows": 61, "columns": 120, "stepDeg": 3.0, "north": 90.0, "west": 0.0}
    first, second = index["seasons"]  # pyright: ignore[reportAny]
    assert first["year"] == 2006
    assert first["file"] == "shell-2006.png"
    assert first["first"] == "2006-07-01"
    assert first["days"] == 2
    assert len(first["belowMkm2"]) == 2  # pyright: ignore[reportAny]
    assert second["days"] == 3
    with Image.open(tmp_path / "ozone" / "shell-2007.png") as image:
        assert image.size == (COLUMNS, 3 * ROWS)
