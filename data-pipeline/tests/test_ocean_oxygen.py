"""Tests for ocean oxygen from GOBAI-O₂: inventories by layer, their trends and the trend map."""

import math
from typing import TYPE_CHECKING

import h5py
import numpy as np
import pytest

from histeclipse_pipeline.ocean_oxygen import (
    BOTTOM,
    CREDIT,
    LICENCE,
    MICRO,
    PA_PER_DBAR,
    PMOL,
    RADIUS,
    band_thickness,
    build,
    cell_areas,
    cleaned,
    column,
    layer_edges,
    normal_gravity,
    summarise,
    wrapped,
)
from histeclipse_pipeline.water_cycle import decode
from tests.manifests import by_id, manifest, mapping, number, numbers, pixel

if TYPE_CHECKING:
    from pathlib import Path

#: A small stand-in for GOBAI-O₂'s grid, longitudes running past 360 as the file's do.
LATITUDE = np.array([-0.5, 0.5])
LONGITUDE = np.array([20.5, 200.5, 379.5])
PRESSURE = np.array([100.0, 500.0, 1500.0])
YEARS = list(range(2004, 2014))
FILL = 9.96921e36


def gobai_file(path: Path) -> Path:
    """Oxygen of 200 µmol/kg falling 1 a year everywhere, uncertain by 5.

    The cells at 200.5° E have no data in 2006, so they are left out of every year.
    """
    oxygen = np.empty((len(YEARS), 3, 2, 3), dtype=np.float32)
    for index, year in enumerate(YEARS):
        oxygen[index] = 200.0 - (year - 2004)
    oxygen[2, :, :, 1] = FILL
    uncertainty = np.full(oxygen.shape, 5.0, dtype=np.float32)
    with h5py.File(str(path), "w") as opened:
        _ = opened.create_dataset("time", data=np.array(YEARS, dtype=np.float32))
        _ = opened.create_dataset("pres", data=PRESSURE.astype(np.float32))
        _ = opened.create_dataset("lat", data=LATITUDE.astype(np.float32))
        _ = opened.create_dataset("lon", data=LONGITUDE.astype(np.float32))
        _ = opened.create_dataset("oxy", data=oxygen)
        _ = opened.create_dataset("uncer", data=uncertainty)
    return path


def test_gravity_grows_from_equator_to_pole() -> None:
    gravity = normal_gravity(np.array([0.0, 90.0]))
    assert gravity[0] == pytest.approx(9.780327)
    assert gravity[1] == pytest.approx(9.832186, abs=1e-5)


def test_cells_of_a_degree_tile_the_sphere() -> None:
    latitudes = np.arange(-89.5, 90.0, 1.0)
    total = float(cell_areas(latitudes, 1.0).sum()) * 360
    assert total == pytest.approx(4 * math.pi * RADIUS**2)


def test_levels_split_between_layers_by_thickness() -> None:
    pressure = np.array([10.0, 30.0])
    assert layer_edges(pressure).tolist() == [0.0, 20.0, BOTTOM]
    assert band_thickness(pressure, 0.0, 200.0).tolist() == [20.0, 180.0]
    assert band_thickness(pressure, 200.0, BOTTOM).tolist() == [0.0, 1800.0]


def test_fill_values_become_no_data() -> None:
    found = cleaned(np.array([1.0, FILL, np.nan]))
    assert found[0] == 1.0
    assert np.isnan(found[1:]).all()


def test_column_weighs_each_level_by_its_mass() -> None:
    oxygen = np.array([[[100.0, np.nan]]])  # one level, one latitude, two longitudes
    found = column(oxygen, np.array([BOTTOM]), np.array([0.0]))
    expected = 100 * MICRO * BOTTOM * PA_PER_DBAR / 9.780327
    assert found.item(0, 0) == pytest.approx(expected)
    assert math.isnan(found.item(0, 1))


def test_longitudes_past_360_wrap() -> None:
    assert wrapped(LONGITUDE).tolist() == [20.5, -159.5, 19.5]


def test_inventories_trends_and_map(tmp_path: Path) -> None:
    summary = summarise(gobai_file(tmp_path / "gobai.nc"))
    assert summary.years == YEARS
    out = tmp_path / "ocean-oxygen"
    assert build(summary, out, "2026-11-13") == len(YEARS) * 4
    index = manifest(out)
    assert index["licence"] == LICENCE
    assert index["credit"] == CREDIT
    assert index["years"] == YEARS

    # Two latitudes by two longitudes (the third left out), each 0-2000 dbar.
    mass = float(cell_areas(LATITUDE, 1.0).sum()) * 2 * BOTTOM * PA_PER_DBAR / 9.7803
    first = summary.totals[0]
    assert first.inventory["0-2000"] == pytest.approx(200 * MICRO * mass, rel=1e-4)
    assert first.uncertainty["0-2000"] == pytest.approx(5 * MICRO * mass, rel=1e-4)
    # The layers add up to the whole.
    parts = sum(first.inventory[name] for name in ("0-200", "200-1000", "1000-2000"))
    assert parts == pytest.approx(first.inventory["0-2000"])
    inventory = by_id(index["inventory"])
    whole = inventory["0-2000"]
    assert numbers(whole["values"])[0] == round(first.inventory["0-2000"] / PMOL, 3)
    assert len(numbers(whole["uncertainty"])) == len(YEARS)
    assert number(whole["trendPercentPerDecade"]) == pytest.approx(-5.0, abs=0.01)
    assert whole["significant"] is True
    assert number(inventory["200-1000"]["top"]) == 200.0

    concentration = mapping(index["concentration"])
    assert numbers(concentration["values"])[0] == pytest.approx(200.0)
    assert numbers(concentration["uncertainty"])[0] == pytest.approx(5.0)
    assert number(concentration["trendPerDecade"]) == pytest.approx(-10.0)

    layer = by_id(index["maps"])["column-trend"]
    assert layer["period"] == [2004, 2013]
    bound = number(layer["bound"])
    image = out / "column-trend.png"
    # 0°, 20° E: the cells at 19.5° and 20.5° E.
    red, green, blue, alpha = pixel(image, (90, 200))
    expected = -10 * MICRO * BOTTOM * PA_PER_DBAR / 9.780327
    assert decode(red, bound) - decode(green, bound) == pytest.approx(expected, abs=bound / 100)
    assert (blue, alpha) == (255, 255)
    # 0°, 160° W: the cells left out.
    assert pixel(image, (90, 20))[3] == 0
