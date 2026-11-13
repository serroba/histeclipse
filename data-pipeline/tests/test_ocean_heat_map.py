import hashlib
import io
import zipfile
from typing import TYPE_CHECKING

import numpy as np
import pytest

from histeclipse_pipeline.ocean_heat_map import (
    SECONDS_PER_YEAR,
    Years,
    build,
    manifest,
    map_name,
    month_name,
    read_month,
    tail_names,
    window,
    zip_months,
)
from histeclipse_pipeline.water_cycle import decode
from tests.manifests import by_id, number, pixel
from tests.manifests import manifest as read_manifest
from tests.netcdf3_files import Var, netcdf3

if TYPE_CHECKING:
    from pathlib import Path

FILL = 1e30
#: IAP's axes: cell centres from the south, longitude 1-360.
LATITUDE = np.arange(-89.5, 90.0, 1.0)
LONGITUDE = np.arange(1.0, 361.0)
#: One W/m² sustained for a year, in J/m².
ONE_WATT_YEAR = SECONDS_PER_YEAR


def month_file(year: int, month: int, *, gap: bool = False) -> bytes:
    """An IAP-like month: the upper ocean warms 1 W/m², the column to 2000 m 2 W/m².

    Only the cells either side of the equator at 10° E (rows 89-90, column 9) warm; the rest
    is sea with no change, but for the first row (89.5° S), which is land. With ``gap``, the
    cell just south of the equator has no 0-2000 m value.
    """
    elapsed = (year - 1960) + (month - 0.5) / 12
    upper = np.zeros((180, 360))
    whole = np.zeros((180, 360))
    upper[89:91, 9] = ONE_WATT_YEAR * elapsed
    whole[89:91, 9] = 2 * ONE_WATT_YEAR * elapsed
    upper[0, :] = FILL
    whole[0, :] = FILL
    if gap:
        whole[89, 9] = FILL
    fill: dict[str, str | float] = {"_FillValue": FILL, "units": "J/m^2"}
    return netcdf3(
        {"lat": 180, "lon": 360, "time": 1},
        {
            "lat": Var(("lat",), LATITUDE, ">f4"),
            "lon": Var(("lon",), LONGITUDE, ">f4"),
            "time": Var(("time",), np.array([year * 100 + month]), ">f8"),
            "OHC100": Var(("lat", "lon"), upper, ">f4", fill),
            "OHC700": Var(("lat", "lon"), upper, ">f4", fill),
            "OHC2000": Var(("lat", "lon"), whole, ">f4", fill),
        },
    )


def decade_zip(years: range) -> bytes:
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as opened:
        for year in reversed(years):
            for month in range(1, 13):
                opened.writestr(month_name(year, month), month_file(year, month))
        opened.writestr("readme.txt", "not a month")
    return out.getvalue()


def test_names_the_tail_months_in_order() -> None:
    names = tail_names()
    assert len(names) == 72
    assert names[0] == "OHCa_IAP_0_6000m_year_2020_month_01.nc"
    assert names[-1] == "OHCa_IAP_0_6000m_year_2025_month_12.nc"


def test_manifest_lists_names_and_checksums() -> None:
    listed = manifest([("a.nc", b"x"), ("b.nc", b"y")]).decode().splitlines()
    assert listed == [
        f"a.nc {hashlib.sha256(b'x').hexdigest()}",
        f"b.nc {hashlib.sha256(b'y').hexdigest()}",
    ]


def test_reads_a_month() -> None:
    read = read_month(month_file(1961, 7))
    assert (read.year, read.month) == (1961, 7)
    assert sorted(read.layers) == ["0-2000m", "0-700m"]
    assert np.isnan(read.layers["0-700m"].item(0, 5))
    assert read.layers["0-700m"][50, 50] == 0.0
    assert read.layers["0-2000m"][89, 9] == pytest.approx(2 * ONE_WATT_YEAR * (1 + 6.5 / 12), 1e-6)


def test_rejects_a_time_that_is_not_yyyymm() -> None:
    data = month_file(1961, 7).replace(
        np.array([196107.0], dtype=">f8").tobytes(), np.array([196113.0], dtype=">f8").tobytes()
    )
    with pytest.raises(ValueError, match="not yyyymm"):
        _ = read_month(data)


def test_reads_the_months_of_a_zip_in_order() -> None:
    months = [read_month(data) for data in zip_months(decade_zip(range(1960, 1962)))]
    assert len(months) == 24
    assert (months[0].year, months[0].month) == (1960, 1)
    assert (months[-1].year, months[-1].month) == (1961, 12)


def test_averages_complete_years_and_rejects_a_month_twice() -> None:
    years = Years()
    for month in range(1, 13):
        years.add(read_month(month_file(1960, month, gap=month == 3)))
    years.add(read_month(month_file(1961, 1)))  # a year still in progress
    with pytest.raises(ValueError, match="read twice"):
        years.add(read_month(month_file(1961, 1)))
    kept, nodes = years.yearly("0-2000m")
    assert kept == [1960]
    assert nodes.shape == (1, 181, 361)
    # Node 0° N, 10° E averages the cells either side; one had a gap in March.
    assert nodes[0, 90, 190] == pytest.approx(2 * ONE_WATT_YEAR * 0.5, 1e-6)
    upper_kept, upper = years.yearly("0-700m")
    assert upper_kept == [1960]
    assert upper[0, 90, 190] == pytest.approx(ONE_WATT_YEAR * 0.5, 1e-6)
    assert np.isnan(upper.item(0, 180, 0))  # 90° S: land
    assert upper[0, 90, 0] == 0.0


def test_needs_months_to_give_years() -> None:
    with pytest.raises(ValueError, match="no months read"):
        _ = Years().yearly("0-700m")


def test_trend_is_in_watts_per_square_metre() -> None:
    years = list(range(1960, 1970))
    nodes = np.asarray([[[ONE_WATT_YEAR * (year - 1960)]] for year in years], dtype=np.float64)
    found = window(years, nodes, (1960, 1969))
    assert found.slope.item(0) == pytest.approx(1.0)
    assert bool(found.significant.item(0))
    with pytest.raises(ValueError, match="do not cover 1950-1969"):
        _ = window(years, nodes, (1950, 1969))


def test_writes_maps_and_index(tmp_path: Path) -> None:
    years = Years()
    for data in zip_months(decade_zip(range(1960, 2026))):
        years.add(read_month(data))
    assert build(years, tmp_path) == 3
    index = read_manifest(tmp_path)
    assert index["units"] == "W/m²"
    assert index["licence"] == "none stated; freely available from the IAP, credited"
    assert index["accessed"] == "2026-11-13"
    maps = by_id(index["maps"])
    assert sorted(maps) == ["0-2000m-1960-2025", "0-2000m-2005-2025", "0-700m-1960-2025"]
    whole = maps["0-2000m-1960-2025"]
    assert whole["layer"] == "0-2000 m"
    assert whole["period"] == [1960, 2025]
    bound = number(whole["bound"])
    assert bound == pytest.approx(0.5)  # the 98th percentile is no trend: the floor
    red, green, blue, alpha = pixel(tmp_path / "0-2000m-1960-2025.png", (90, 190))
    assert decode(red, bound) == pytest.approx(bound, abs=0.01)  # 2 W/m², clipped
    assert (green, blue, alpha) == (128, 255, 255)
    _, _, _, alpha = pixel(tmp_path / "0-700m-1960-2025.png", (180, 0))
    assert alpha == 0
    assert map_name("0-700m", (1960, 2025)) == "0-700m-1960-2025"
