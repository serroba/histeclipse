import io
import math
from typing import TYPE_CHECKING

import h5py
import numpy as np
import pytest

from histeclipse_pipeline.energy_imbalance import (
    Month,
    anchor_mean,
    band_weights,
    calendar_months,
    global_means,
    imbalance_file,
    read_ceres,
    trend_per_decade,
    write_imbalance,
    yearly,
)
from tests.json_values import json_round_trip, read_json

if TYPE_CHECKING:
    from pathlib import Path


def ceres_file(fluxes: list[float], days: list[float], bands: int = 4) -> bytes:
    """A small obs4MIPs-like file: each month's grid filled with one flux (W/m²)."""
    step = 180 / bands
    edges = [[-90 + step * band, -90 + step * (band + 1)] for band in range(bands)]
    grid = np.asarray([np.full((bands, 3), flux) for flux in fluxes], dtype=np.float32)
    buffer = io.BytesIO()
    with h5py.File(buffer, "w") as file:
        _ = file.create_dataset("time", data=np.asarray(days, dtype=np.float64))
        _ = file.create_dataset("lat_bnds", data=np.asarray(edges, dtype=np.float64))
        _ = file.create_dataset("rt", data=grid)
    return buffer.getvalue()


def months_from(start: tuple[int, int], values: list[float]) -> list[Month]:
    year, month = start
    out: list[Month] = []
    for value in values:
        out.append(Month(year, month, value))
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return out


def test_weights_bands_by_area_on_the_ellipsoid() -> None:
    weights = band_weights([(-90, 0), (0, 90)])
    assert weights == pytest.approx([0.5, 0.5])
    polar, tropical = band_weights([(60, 90), (0, 30)])
    # On a sphere the ratio is sin 30° / (1 - sin 60°), 3.73; geodetic latitudes on an
    # oblate Earth give the polar band a little more of the area.
    sphere = math.sin(math.radians(30)) / (1 - math.sin(math.radians(60)))
    assert tropical / polar == pytest.approx(3.693, abs=0.001)
    assert tropical / polar < sphere


def test_averages_by_area_and_refuses_gaps() -> None:
    grid = np.asarray([[[1.0, 1.0], [3.0, 3.0]]], dtype=np.float64)
    assert global_means(grid, [0.25, 0.75]) == pytest.approx([2.5])
    with pytest.raises(ValueError, match="missing"):
        _ = global_means(np.full((1, 2, 2), 1e20), [0.5, 0.5])
    with pytest.raises(ValueError, match="missing"):
        _ = global_means(np.full((1, 2, 2), math.nan), [0.5, 0.5])


def test_dates_the_months_from_march_2000() -> None:
    assert calendar_months([14.0, 44.75, 320.0]) == [(2000, 3), (2000, 4), (2001, 1)]
    with pytest.raises(ValueError, match="same month"):
        _ = calendar_months([1.0, 2.0])


def test_reads_the_grid_into_global_months() -> None:
    months = read_ceres(ceres_file([0.5, -1.25], [14.0, 44.75]))
    assert [(each.year, each.month) for each in months] == [(2000, 3), (2000, 4)]
    assert [each.value for each in months] == pytest.approx([0.5, -1.25])


def test_keeps_only_full_years_and_fits_a_trend() -> None:
    months = months_from((2000, 3), [1.0] * 10 + [2.0] * 12 + [3.0] * 3)
    assert [year for year, _ in yearly(months)] == [2001]
    assert [value for _, value in yearly(months)] == pytest.approx([2.0])
    rising = months_from((2001, 1), [0.01 * index for index in range(120)])
    assert trend_per_decade(rising) == pytest.approx(1.2)


def test_averages_the_anchor_period_and_needs_all_of_it() -> None:
    months = months_from((2005, 1), [0.5] * 6 + [0.7] * 120 + [0.9] * 6)
    assert anchor_mean(months) == pytest.approx(0.7)
    with pytest.raises(ValueError, match="120 months"):
        _ = anchor_mean(months[:-10])


def test_writes_the_file_the_site_reads(tmp_path: Path) -> None:
    months = months_from((2000, 3), [0.7 + 0.001 * index for index in range(200)])
    assert write_imbalance(months, tmp_path) == 200
    written = read_json(tmp_path / "imbalance.json")
    assert written == json_round_trip(imbalance_file(months))
    body = imbalance_file(months)
    assert body["period"] == "2000-03/2016-10"
    assert body["licence"] == "CC BY 4.0"
    assert body["trendPerDecade"] == pytest.approx(0.12)
    yearly_values = body["yearly"]
    assert isinstance(yearly_values, dict)
    assert yearly_values["years"] == list(range(2001, 2016))
    monthly = body["monthly"]
    assert isinstance(monthly, dict)
    times = monthly["time"]
    assert isinstance(times, list)
    assert times[:2] == [2000.21, 2000.29]  # mid-March and mid-April
