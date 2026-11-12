"""Volcanic stratospheric aerosol optical depth: HolVol's monthly zonal means, made annual."""

from __future__ import annotations

import math

import numpy as np
import numpy.typing as npt
import pytest

from histeclipse_pipeline.volcanic_aod import (
    BANDS,
    HOLVOL_CREDIT,
    annual_bands,
    holvol_file,
    read_holvol,
)
from tests.netcdf3_files import Var, netcdf3

type Grid = npt.NDArray[np.float64]

LATITUDES: Grid = np.array([60.0, 30.0, 0.0, -30.0, -60.0])
COSINES = [math.cos(math.radians(latitude)) for latitude in (60.0, 30.0, 0.0, -30.0, -60.0)]


def months(first: int, years: int) -> Grid:
    """Fractional years, twelve to a year, as HolVol stores them (float32)."""
    steps = np.arange(years * 12, dtype=np.float64)
    return np.asarray(first + steps / 12, dtype=np.float32).astype(np.float64)


def holvol(aod: Grid, time: Grid) -> bytes:
    """A small NetCDF-3 file shaped like HolVol's SAOD file (time is the record dimension)."""
    return netcdf3(
        {"time": 0, "lat": LATITUDES.size},
        {
            "time": Var(("time",), time),
            "lat": Var(("lat",), LATITUDES),
            "aod550": Var(("time", "lat"), aod),
            "reff": Var(("time", "lat"), np.full(aod.shape, 0.2)),
        },
        records=time.size,
        global_attributes={"title": "EVA v1.2: stratospheric AOD"},
    )


def test_weights_latitudes_by_cosine_and_averages_months() -> None:
    time = months(-2, 2)  # a BCE start: floor, not truncation
    aod = np.zeros((24, LATITUDES.size))
    aod[:12, 2] = 0.12  # the equator, first year only
    aod[12:, 0] = 0.24  # 60° N, second year only
    annual = annual_bands(time, LATITUDES, aod)
    assert annual.first_year == -2
    total = sum(COSINES)
    assert annual.global_mean == [
        round(0.12 * COSINES[2] / total, 4),
        round(0.24 * COSINES[0] / total, 4),
    ]
    tropics = COSINES[2] / sum(COSINES[1:4])
    assert annual.bands["tropics"] == [round(0.12 * tropics, 4), 0.0]
    assert annual.bands["north"] == [0.0, 0.24]
    assert annual.bands["south"] == [0.0, 0.0]


def test_edges_of_thirty_degrees_belong_to_the_tropics() -> None:
    aod = np.tile(np.array([1.0, 2.0, 3.0, 4.0, 5.0]), (12, 1))
    annual = annual_bands(months(1815, 1), LATITUDES, aod)
    assert annual.bands["north"] == [1.0]
    assert annual.bands["south"] == [5.0]
    assert 2.0 < annual.bands["tropics"][0] < 4.0


def test_refuses_partial_or_broken_years() -> None:
    aod = np.zeros((13, LATITUDES.size))
    with pytest.raises(ValueError, match="whole years"):
        _ = annual_bands(months(0, 2)[:13], LATITUDES, aod)
    shuffled = months(0, 2)[::-1].copy()
    with pytest.raises(ValueError, match="consecutive"):
        _ = annual_bands(shuffled, LATITUDES, np.zeros((24, LATITUDES.size)))
    with pytest.raises(ValueError, match="no latitudes"):
        _ = annual_bands(months(0, 1), np.array([10.0]), np.zeros((12, 1)))


def test_reads_the_file_and_builds_the_site_file() -> None:
    aod = np.full((24, LATITUDES.size), 0.003)
    aod[12:18] = 0.5
    annual = read_holvol(holvol(aod, months(1257, 2)))
    assert annual.first_year == 1257
    assert annual.global_mean == [0.003, 0.2515]
    built = holvol_file(annual, "2026-11-13")
    assert built["credit"] == HOLVOL_CREDIT
    assert built["firstYear"] == 1257
    assert built["wavelength"] == 550
    assert built["global"] == [0.003, 0.2515]
    bands = built["bands"]
    assert isinstance(bands, list)
    assert [band["name"] for band in bands if isinstance(band, dict)] == [b[0] for b in BANDS]


def test_refuses_a_file_without_the_aod() -> None:
    data = netcdf3({"x": 1}, {"time": Var(("x",), np.zeros(1))})
    with pytest.raises(ValueError, match="lacks"):
        _ = read_holvol(data)
