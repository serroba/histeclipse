import io
import math
from typing import TYPE_CHECKING

import h5py
import numpy as np
import pytest

from histeclipse_pipeline.permafrost import (
    FILL,
    MAP_PERIODS,
    Borehole,
    Extent,
    Floats,
    Shares,
    borehole_summary,
    boreholes,
    cci_url,
    cell_areas,
    extent,
    index_file,
    map_json,
    median,
    read_extent,
    trend,
    write_permafrost,
)
from tests.json_values import json_round_trip, read_json

if TYPE_CHECKING:
    from pathlib import Path

YEARS = "\t".join(f"MAGT [°C] ({year})" for year in range(2007, 2017))
HEADER = (
    "Event\tID\tCountry\tEvent 2\tPI\tCode\tSlope [deg]\tAspect [deg]\tLatitude\tLongitude\t"
    f"Elevation [m]\t{YEARS}\tDepth sed [m] (depth of MAGT measurement)\t"
    "Depth sed [m] (depth of zero annual amplitude)\tPeriod (period starting and ending ap...)\t"
    "Accuracy (Temperature measurement accur...)"
)


def row(event: str, name: str, temperatures: list[str], zaa: str = "15.00") -> str:
    cells = [event, "1", "Russia", name, "A PI", "", "", "", "70.5", "-150.25", "12"]
    return "\t".join([*cells, *temperatures, "10.00", zaa, "Jan-Dec", "0.10"])


TABLE = "\n".join(
    [
        "/* DATA DESCRIPTION:",
        "Citation:\tGTN-P (2018)",
        "*/",
        HEADER,
        row("GTN-P_TSP_1", "Warming hole", [f"{-5 + 0.05 * year:.2f}" for year in range(10)]),
        row("GTN-P_TSP_2", "Short", ["-1.00", "-1.10", "", "", "", "", "", "", "", ""], zaa=""),
        "",
    ]
)


def test_reads_the_borehole_table() -> None:
    holes = boreholes(TABLE)
    assert [hole.id for hole in holes] == ["GTN-P_TSP_1", "GTN-P_TSP_2"]
    first, second = holes
    assert first.name == "Warming hole"
    assert first.latitude == 70.5
    assert first.longitude == -150.25
    assert first.elevation == 12.0
    assert first.depth == 10.0
    assert first.zaa == 15.0
    assert first.temperatures[0] == -5.0
    assert first.temperatures[-1] == pytest.approx(-4.55)
    assert second.zaa is None
    assert second.temperatures[2:] == [None] * 8


def test_fits_a_trend_per_decade_only_with_enough_years() -> None:
    assert trend([0.1 * year for year in range(10)]) == pytest.approx(1.0)
    assert trend([0.0, None, None, None, 0.0, None, None, None, None, None]) is None
    assert trend([1.0, 1.0, 1.0, 1.0, None, None, None, None, None, None]) is None
    assert trend([None, None, None, None, None, 2.0, 2.1, 2.2, 2.3, 2.4]) == pytest.approx(1.0)
    assert trend([1.0, 1.0, None, 1.0, 1.0, 1.0, None, None, None, None]) == 0.0
    assert math.copysign(1.0, trend([-1.0] * 10) or 1.0) == 1.0  # no -0.0


def test_takes_the_median() -> None:
    assert median([3.0, 1.0, 2.0]) == 2.0
    assert median([4.0, 1.0, 2.0, 3.0]) == 2.5


def test_summarises_the_boreholes() -> None:
    cooling = Borehole("c", "c", "x", 0, 0, None, None, None, [-0.1 * y for y in range(10)])
    holes = [*boreholes(TABLE), cooling]
    assert borehole_summary(holes) == {
        "boreholes": 3,
        "withTrend": 2,
        "warming": 1,
        "cooling": 1,
        "medianTrend": -0.25,
    }
    assert borehole_summary([])["medianTrend"] is None


def test_cell_areas_add_up_to_the_band() -> None:
    latitudes = np.arange(0.5, 90.0, 1.0)
    areas = cell_areas(latitudes, 1.0) * 360
    hemisphere = 2 * math.pi * 6371.0072**2
    assert float(np.sum(areas)) == pytest.approx(hemisphere)


def grid() -> tuple[Shares, Floats]:
    """100 rows by 200 columns at 0.01°: the south half all continuous, the north half split."""
    shares = np.zeros((100, 200), dtype=np.uint8)
    shares[:50] = 100
    shares[50:, :50] = 57
    shares[50:, 50:100] = 14
    shares[50:, 100:150] = 5
    shares[50:, 150:] = FILL
    latitudes: Floats = 25.005 + 0.01 * np.arange(100, dtype=np.float64)
    return shares, latitudes


def test_adds_up_the_areas_and_averages_the_map(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("histeclipse_pipeline.permafrost.BAND", 50)
    shares, latitudes = grid()
    year = extent(2010, shares, latitudes)
    cells = cell_areas(latitudes, 0.01)
    south, north = float(np.sum(cells[:50])), float(np.sum(cells[50:]))
    assert year.zones["continuous"] == pytest.approx(south * 200)
    assert year.zones["discontinuous"] == pytest.approx(north * 50)
    assert year.zones["sporadic"] == pytest.approx(north * 50)
    assert year.zones["isolated"] == pytest.approx(north * 50)
    assert year.permafrost == pytest.approx(south * 200 + north * 50 * (0.57 + 0.14 + 0.05))
    assert year.map.shape == (2, 4)
    shown: list[list[float]] = year.map.tolist()  # pyright: ignore[reportAny]
    assert shown[0] == [100.0] * 4
    assert shown[1][:3] == [57.0, 14.0, 5.0]
    assert math.isnan(shown[1][3])


def nc_file(shares: Shares, latitudes: Floats) -> bytes:
    out = io.BytesIO()
    with h5py.File(out, "w") as opened:
        _ = opened.create_dataset("PFR", data=shares[None].astype(np.int16))
        _ = opened.create_dataset("lat", data=latitudes.astype(np.float32))
    return out.getvalue()


def test_reads_a_file_either_way_up(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("histeclipse_pipeline.permafrost.BAND", 50)
    shares, latitudes = grid()
    upright = read_extent(2010, nc_file(shares, latitudes))
    flipped = read_extent(2010, nc_file(shares[::-1], latitudes[::-1]))
    assert upright.permafrost == pytest.approx(flipped.permafrost)
    assert np.array_equal(upright.map, flipped.map, equal_nan=True)


def yearly(years: range, value: float) -> list[Extent]:
    shape = np.full((2, 3), value)
    shape[0, 0] = np.nan
    shape[1, 2] = 0.0
    zones = {"continuous": 1e6, "discontinuous": 0.0, "sporadic": 0.0, "isolated": 0.0}
    return [Extent(year, 2.5e6, zones, shape.copy()) for year in years]


def every_year(early: float = 60.0, late: float = 40.0) -> list[Extent]:
    (first, last), (later, latest) = MAP_PERIODS
    return yearly(range(first, last + 1), early) + yearly(range(later, latest + 1), late)


def test_keeps_only_map_cells_with_permafrost() -> None:
    shown = map_json(every_year())
    assert shown["periods"] == ["2003\u20132007", "2019\u20132023"]
    assert shown["cells"] == [[0, 1, 60, 40], [0, 2, 60, 40], [1, 0, 60, 40], [1, 1, 60, 40]]


def test_needs_every_year_of_both_map_periods() -> None:
    with pytest.raises(ValueError, match="expected 5 years"):
        _ = map_json(every_year()[1:])


def test_a_cell_with_no_data_in_one_period_is_kept_as_null() -> None:
    extents = every_year()
    for each in extents[5:]:
        each.map[0, 1] = np.nan
    cells = map_json(extents)["cells"]
    assert isinstance(cells, list)
    assert [0, 1, 60, None] in cells


def test_writes_the_index(tmp_path: Path) -> None:
    holes = boreholes(TABLE)
    extents = every_year()
    count = write_permafrost(holes, extents, tmp_path)
    assert count == 12 + len(extents)
    index = read_json(tmp_path / "index.json")
    assert isinstance(index, dict)
    assert index == json_round_trip(index_file(holes, extents))
    extent_part = index["extent"]
    assert isinstance(extent_part, dict)
    assert extent_part["years"] == [*range(2003, 2008), *range(2019, 2024)]
    assert extent_part["permafrost"] == [2.5] * 10
    borehole_part = index["boreholes"]
    assert isinstance(borehole_part, dict)
    sites = borehole_part["sites"]
    assert isinstance(sites, list)
    first = sites[0]
    assert isinstance(first, dict)
    assert first["trend"] == pytest.approx(0.5)


def test_names_each_years_file_by_its_forcing() -> None:
    assert "ERA5_MODISLST_BIASCORRECTED-AREA4_PP-2002-" in cci_url(2002)
    assert cci_url(2003).endswith(
        "/2003/ESACCI-PERMAFROST-L4-PFR-MODISLST_CRYOGRID-AREA4_PP-2003-fv05.0.nc"
    )
