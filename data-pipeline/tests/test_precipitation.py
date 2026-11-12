import gzip
import io
from datetime import UTC, datetime
from typing import TYPE_CHECKING

import h5py
import numpy as np
import pytest

from histeclipse_pipeline.netcdf3 import Variable
from histeclipse_pipeline.precipitation import (
    GPCC_FILES,
    Yearly,
    build,
    gpcc_url,
    masked,
    read_gpcc,
    read_gpcp,
    window,
    yearly,
)
from histeclipse_pipeline.water_cycle import decode
from tests.manifests import by_id, manifest, mapping, number, numbers, pixel
from tests.netcdf3_files import Var, netcdf3

if TYPE_CHECKING:
    from pathlib import Path

#: A coarse test grid: two rows of four cells, like GPCC's (north first, -180 to 180).
LATITUDE = np.array([45.0, -45.0])
LONGITUDE = np.array([-135.0, -45.0, 45.0, 135.0])
FILL = -99999.9921875


def node(latitude: int, longitude: int) -> tuple[int, int]:
    return 90 - latitude, longitude + 180


def gpcc_file(first: int, last: int) -> bytes:
    """GPCC-like months: 100 mm everywhere; in the north-east cell 1 mm more each year.

    The far south-west cell is sea (missing); the north-west has a gauge only from 1981.
    """
    months = [(year, month) for year in range(first, last + 1) for month in range(1, 13)]
    hours = [
        (datetime(year, month, 1, tzinfo=UTC) - datetime(first, 1, 1, tzinfo=UTC)).days * 24.0
        for year, month in months
    ]
    precip = np.full((len(months), 2, 4), 100.0)
    gauge = np.ones((len(months), 2, 4))
    for row, (year, _) in enumerate(months):
        precip[row, 0, 3] += (year - 1950) / 12
        gauge[row, 0, 0] = 1.0 if year > 1980 else 0.0
    precip[:, 1, 0] = FILL
    gauge[:, 1, 0] = FILL
    fill: dict[str, str | float] = {"_FillValue": FILL, "missing_value": FILL}
    return gzip.compress(
        netcdf3(
            {"time": 0, "lat": 2, "lon": 4},
            {
                "time": Var(
                    ("time",),
                    np.array(hours),
                    ">f8",
                    {"units": f"hours since {first}-1-1 00:00:00"},
                ),
                "lon": Var(("lon",), LONGITUDE, ">f8"),
                "lat": Var(("lat",), LATITUDE, ">f8"),
                "precip": Var(("time", "lat", "lon"), precip, ">f4", fill),
                "gauge": Var(("time", "lat", "lon"), gauge, ">f4", fill),
            },
            records=len(months),
        )
    )


def gpcp_file() -> bytes:
    """GPCP-like rates, mm a day, January 1979 to March 2025 (a year still in progress)."""
    months = [(year, month) for year in range(1979, 2026) for month in range(1, 13)][:-9]
    days = [
        (datetime(year, month, 1, tzinfo=UTC) - datetime(1800, 1, 1, tzinfo=UTC)).days
        for year, month in months
    ]
    rates = np.full((len(months), 2, 4), 2.0, dtype=np.float32)
    rates[:, 1, 0] = -9.96921e36
    for row, (year, _) in enumerate(months):
        rates[row, 1, 2] = 2.0 - (year - 1979) * 0.01  # drying: 3.65 mm a year less each year
    out = io.BytesIO()
    with h5py.File(out, "w") as opened:
        time = opened.create_dataset("time", data=np.array(days, dtype=np.float64))
        time.attrs["units"] = np.bytes_(b"days since 1800-1-1 00:00:0.0")
        _ = opened.create_dataset("lat", data=LATITUDE)
        _ = opened.create_dataset("lon", data=np.mod(LONGITUDE, 360))
        _ = opened.create_dataset("precip", data=rates)
    return out.getvalue()


def test_sums_complete_years_only() -> None:
    dates = [(2000, month) for month in range(1, 13)] + [(2001, 1)]
    months = np.ones((13, 1))
    months[3, 0] = np.nan
    years, totals = yearly(dates, months, lambda _y, _m: 2.0)
    assert years == [2000]
    assert np.isnan(totals.item(0, 0))
    years, totals = yearly(dates[:12], np.ones((12, 1)), lambda _y, _m: 2.0)
    assert totals.tolist() == [[24.0]]


def test_reads_gpcc_and_gpcp() -> None:
    gpcc, gauged = read_gpcc([gpcc_file(1950, 1990), gpcc_file(1991, 2024)])
    assert (gpcc.years[0], gpcc.years[-1]) == (1950, 2024)
    assert gpcc.totals.item(0, 0, 1) == pytest.approx(1200.0)
    assert gpcc.totals.item(-1, 0, 3) == pytest.approx(1274.0)
    assert np.isnan(gpcc.totals.item(0, 1, 0))
    assert gauged[:, 0, 0].tolist() == [year > 1980 for year in gpcc.years]
    assert not gauged[:, 1, 0].any()
    gpcp = read_gpcp(gpcp_file())
    assert (gpcp.years[0], gpcp.years[-1]) == (1979, 2024)
    assert gpcp.totals.item(0, 0, 0) == pytest.approx(730.0)  # 365 days of 2 mm
    assert gpcp.totals.item(1, 0, 0) == pytest.approx(732.0)  # 1980: a leap year
    assert np.isnan(gpcp.totals.item(0, 1, 0))


def test_rejects_a_gpcc_file_without_time_units() -> None:
    data = gzip.compress(
        netcdf3({"time": 0}, {"time": Var(("time",), np.zeros(1), ">f8")}, records=1)
    )
    with pytest.raises(TypeError, match="time has no units"):
        _ = read_gpcc([data])


def test_missing_markers_are_nan() -> None:
    marked = Variable(np.array([1.0, float(np.float32(FILL))]), {"_FillValue": (FILL,)})
    assert np.isnan(masked(marked)).tolist() == [False, True]


def test_window_needs_every_year() -> None:
    record = Yearly([2000, 2001], np.zeros((2, 2, 4)), LATITUDE, LONGITUDE)
    with pytest.raises(ValueError, match="does not cover 1999-2001"):
        _ = window(record, np.zeros((2, 181, 361)), (1999, 2001))


def test_writes_trend_maps_and_curves_for_both_records(tmp_path: Path) -> None:
    gpcc, gauged = read_gpcc([gpcc_file(1950, 1990), gpcc_file(1991, 2024)])
    gpcp = read_gpcp(gpcp_file())
    out = tmp_path / "precipitation"
    assert build(gpcc, gauged, gpcp, out) == 3
    index = manifest(out)
    assert index["baseline"] == "1981\u20132010"
    assert set(mapping(index["sources"])) == {"GPCC", "GPCP"}
    maps = by_id(index["maps"])
    assert maps["gpcc-1951"]["period"] == [1951, 2024]
    assert maps["gpcp-1980"]["coverage"] == "land and sea"
    bound = number(maps["gpcc-1951"]["bound"])
    image = out / "gpcc-1951.png"
    red, green, blue, alpha = pixel(image, node(45, 135))  # wetter: +10 mm a year a decade
    assert decode(red, bound) - decode(green, bound) == pytest.approx(10.0, abs=bound / 100)
    assert (blue, alpha) == (255, 255)
    assert pixel(image, node(45, -45))[2:] == (0, 255)  # no change: not significant
    assert pixel(image, node(-45, -135))[3] == 0  # sea, in GPCC
    curves = by_id(index["curves"])
    assert numbers(curves["gpcc-land"]["years"])[0] == 1950
    gauged_share = numbers(curves["gpcc-land"]["gauged"])
    assert gauged_share[0] < gauged_share[-1] == 1.0
    assert numbers(curves["gpcp-land"]["years"])[-1] == 2024
    world = numbers(curves["gpcp-global"]["values"])
    assert world[0] > world[-1]


def test_names_the_release_files() -> None:
    assert len(GPCC_FILES) == 27
    assert gpcc_url("1891_1895").endswith(
        "250_degree/gpcc_precipitation_analysis_monthly_1891_1895_v2025_250.nc.gz"
    )
