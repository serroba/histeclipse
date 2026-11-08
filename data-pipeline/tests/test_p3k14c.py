"""Archaeological radiocarbon dates from p3k14c, calibrated and counted by cell."""

from __future__ import annotations

import pytest

from histeclipse_pipeline.p3k14c import (
    REACH_BP,
    RadiocarbonDate,
    calibrated,
    compact_json,
    curve_arrays,
    heat_file,
    median_calendar_age,
    parse_dates,
    read_curves,
    tile_files,
    tile_key,
)
from tests.json_values import json_round_trip

HEADER = (
    "LabID,Age,Error,Material,Taxa,d13C,Method,Long,Lat,LocAccuracy,Period,SiteID,SiteName,"
    "Country,Province,Continent,Source,Reference\n"
)
TEXT = HEADER + (
    "A-1,1000,30,charcoal,,,,-1.5,51.5,1,Saxon,,Old Sarum,UK,,Europe,x,y\n"
    "A-2,2000,40,bone,,,,-1.2,51.8,1,,,Old Sarum,UK,,Europe,x,y\n"
    "B-1,1500,0,charcoal,,,,10,10,1,,,Zero error,X,,Africa,x,y\n"
    "B-2,,30,charcoal,,,,10,10,1,,,No age,X,,Africa,x,y\n"
    "B-3,900,30,charcoal,,,,200,10,1,,,Off the map,X,,Africa,x,y\n"
    "C-1,1200,50,shell,,,,150.5,-33.5,2,,,Sydney,Australia,,Australia,x,y\n"
)


def straight_curve() -> tuple[list[float], list[float], list[float]]:
    """A made-up curve where radiocarbon age equals calendar age, yearly from 0 to 20,000 BP."""
    years = [float(year) for year in range(20_001)]
    return years, years, [0.0] * len(years)


def test_reads_dates_with_an_age_an_error_and_a_place() -> None:
    dates = parse_dates(TEXT)
    assert [date.lab for date in dates] == ["A-1", "A-2", "C-1"]
    first = dates[0]
    assert first.age == 1000
    assert first.site == "Old Sarum"
    assert first.period == "Saxon"
    assert first.material == "charcoal"


def test_calibrates_to_the_median_calendar_age() -> None:
    curve = curve_arrays(*straight_curve())
    median = median_calendar_age(3000, 30, curve)
    assert median is not None
    assert median == pytest.approx(3000, abs=1)
    # Older than the curve reaches: no calendar age.
    assert median_calendar_age(60_000, 100, curve) is None
    # So far below it that no year fits at all: none either, and the date is left out.
    assert median_calendar_age(-50_000, 10, curve) is None
    lost = RadiocarbonDate("Z-1", -50_000, 10, 1, 1, "Nowhere", "X", "", "")
    assert calibrated([lost], curve, curve) == []


def test_weighs_each_row_by_its_width() -> None:
    curve = curve_arrays([0.0, 10.0, 30.0, 60.0], [0.0, 10.0, 30.0, 60.0], [0.0] * 4)
    assert list(curve.width) == [10.0, 15.0, 25.0, 30.0]


def test_uses_each_hemisphere_s_curve() -> None:
    north = curve_arrays(*straight_curve())
    years, ages, sigmas = straight_curve()
    south = curve_arrays(years, [age + 100 for age in ages], sigmas)
    dated = calibrated(parse_dates(TEXT), north, south)
    by_lab = {date.lab: median for date, median in dated}
    assert by_lab["A-1"] == pytest.approx(1000, abs=1)
    # South of the equator the made-up southern curve reads 100 years younger.
    assert by_lab["C-1"] == pytest.approx(1100, abs=1)


def test_counts_by_cell_and_step_within_reach() -> None:
    def date(lab: str, latitude: float, longitude: float) -> RadiocarbonDate:
        return RadiocarbonDate(lab, 1000, 30, latitude, longitude, "Site", "X", "", "")

    dated = [
        (date("a", 51.5, -1.5), 1000),
        (date("b", 51.9, -1.1), 1100),
        (date("c", 51.5, -1.5), 1300),
        (date("d", -33.5, 150.5), 200),
        (date("e", 51.5, -1.5), REACH_BP + 5),
    ]
    built = heat_file(dated, "2026-11-08")
    assert json_round_trip(built) == built
    columns = [built[name] for name in ("latitude", "longitude", "step", "count")]
    lists = [column for column in columns if isinstance(column, list)]
    assert len(lists) == len(columns)
    rows = list(zip(*lists, strict=True))
    assert rows == [(-34, 150, 0, 1), (51, -2, 4, 2), (51, -2, 5, 1)]


def test_writes_dates_by_tile_with_their_sites_once() -> None:
    dated = calibrated(
        parse_dates(TEXT), curve_arrays(*straight_curve()), curve_arrays(*straight_curve())
    )
    tiles = tile_files(dated)
    assert set(tiles) == {"50_-5", "-35_150"}
    assert tile_key(51.5, -1.5) == "50_-5"
    uk = tiles["50_-5"]
    assert json_round_trip(uk) == uk
    assert uk["sites"] == [["Old Sarum", "UK"]]
    samples = uk["samples"]
    assert isinstance(samples, list)
    assert samples[0] == [51, -2, 1000, 30, 1000, 0, "A-1", "charcoal", "Saxon"]


def test_reads_both_curves_from_the_site_s_file() -> None:
    curve = {"calBP": [0, 5, 10], "age": [0, 5, 10], "sigma": [1, 1, 1]}
    north, south = read_curves({"curves": {"intcal20": curve, "shcal20": curve}})
    assert list(north.cal_bp) == [0, 5, 10]
    assert list(south.sigma) == [1, 1, 1]
    cases: list[tuple[object, str]] = [
        ([], "an object"),
        ({}, "curves"),
        ({"curves": {"intcal20": curve}}, "shcal20"),
        ({"curves": {"intcal20": {"calBP": [0]}, "shcal20": curve}}, "age"),
    ]
    for broken, match in cases:
        with pytest.raises(TypeError, match=match):
            _ = read_curves(broken)


def test_writes_json_compactly_keeping_accents() -> None:
    assert compact_json({"site": ["Sine-Ngayène", 1]}) == '{"site":["Sine-Ngayène",1]}'
