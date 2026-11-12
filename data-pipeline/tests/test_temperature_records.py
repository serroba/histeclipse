from typing import TYPE_CHECKING

import pytest

from histeclipse_pipeline import temperature_records as t
from tests.json_values import read_json

if TYPE_CHECKING:
    from pathlib import Path


def _rounded(rows: list[t.Row]) -> list[t.Row]:
    return [
        (
            year,
            round(value, 6),
            None if low is None else round(low, 6),
            None if high is None else round(high, 6),
        )
        for year, value, low, high in rows
    ]


GISTEMP_TEXT = (
    "Land-Ocean: Global Means\n"
    "Year,Jan,J-D,D-N\n"
    "1880,-.19,-.17,***\n"
    "1881,-.19,-.07,-.08\n"
    "2025,1.37,1.18,1.20\n"
    "2026,1.08,***,***\n"
    "\n"
)
GISTEMP_CI = '"year","ci95"\n1880,0.14\n2025,0.05\n\n'


def test_reads_gistemp_annual_means_with_their_range_where_there_is_one() -> None:
    record = t.gistemp(GISTEMP_TEXT, GISTEMP_CI)
    assert _rounded(record.rows) == [
        (1880, -0.17, -0.31, -0.03),
        (1881, -0.07, None, None),
        (2025, 1.18, 1.13, 1.23),
    ]
    assert record.own_baseline == "1951-1980"
    assert record.source_id == "gistemp4"


def test_reads_noaa_annual_means_and_turns_a_variance_into_a_range() -> None:
    text = (
        "1850   -0.758424 -999.000000 -999.000000 -999.000000 -999.000000\n"
        "1851   -0.5 0.0025 0 0 0\n"
        "\n"
        f"{t.LAST_YEAR + 1}   0.56 -999.0 -999.0 -999.0 -999.0\n"
    )
    record = t.noaa(text)
    assert record.rows[0] == (1850, -0.758424, None, None)
    assert _rounded(record.rows)[1] == (1851, -0.5, -0.598, -0.402)
    assert len(record.rows) == 2  # the incomplete year is dropped


def test_averages_era5_days_and_keeps_only_complete_years() -> None:
    lines = ["# header", "date,2t,clim_91-20,ano_91-20,status"]
    lines += [f"2023-01-{day:02d},14,13,0.5,FINAL" for day in range(1, 366)]
    lines += [f"2024-01-{day:02d},14,13,1.0,FINAL" for day in range(1, 366)]  # leap: one short
    record = t.era5("\n".join(lines) + "\n")
    assert record.rows == [(2023, 0.5, None, None)]
    assert "CC BY 4.0" in record.credit


def test_reads_hadcrut_and_drops_the_incomplete_year() -> None:
    text = f"Time,Anomaly,Lower,Upper\n1850,-0.4,-0.6,-0.2\n{t.LAST_YEAR + 1},1.0,0.9,1.1\n"
    assert t.hadcrut(text).rows == [(1850, -0.4, -0.6, -0.2)]


def test_reads_berkeley_annual_means_with_their_half_width() -> None:
    text = (
        "% Berkeley Earth\n"
        "% Year, Annual Anomaly, Annual Unc.\n"
        " \n"
        "  1850      -0.436        0.170              NaN             NaN\n"
    )
    record = t.berkeley(text)
    assert _rounded(record.rows) == [(1850, -0.436, -0.606, -0.266)]


def _record(rows: list[t.Row], name: str = "r") -> t.Record:
    return t.Record(
        id=name,
        name=name,
        kind="test",
        source_id=name,
        credit="c",
        source="s",
        own_baseline="1961-1990",
        rows=rows,
    )


def test_needs_every_year_of_a_period() -> None:
    with pytest.raises(ValueError, match="every year of 1850-1900"):
        _ = t.period_mean([(1850, 0.0, None, None)], t.BASELINE)


def test_puts_full_records_on_their_own_1850_1900_mean_and_matches_late_ones() -> None:
    first, last = t.BASELINE
    full_a = _record([(year, -0.3, -0.4, -0.2) for year in range(first, 2001)], "a")
    full_b = _record([(year, 0.1, None, None) for year in range(first, 2001)], "b")
    late = _record([(year, 0.5, None, None) for year in range(1990, 2001)], "late")
    series = t.on_baseline([full_a, full_b], [(late, (1990, 2000))])
    a, b, matched = series
    assert (a.shift, a.points[0]) == (-0.3, (first, 0.0, -0.1, 0.1))
    assert (b.shift, b.points[0]) == (0.1, (first, 0.0, None, None))
    # Both full records read 0 over 1990-2000 once on 1850-1900, so the late one is shifted to 0.
    assert matched.shift == 0.5
    assert matched.points[0] == (1990, 0.0, None, None)
    assert "1990-2000 mean matches the mean of a, b" in matched.baseline
    assert last in [point[0] for point in a.points]


def test_writes_the_series_and_their_spread(tmp_path: Path) -> None:
    one = t.shifted(_record([(1850, 0.2, 0.1, 0.3), (1851, 0.4, None, None)], "one"), 0.0, "x")
    two = t.shifted(
        t.Record(
            id="two",
            name="two",
            kind="k",
            source_id="two",
            credit="c2",
            source="s2",
            own_baseline="b",
            rows=[(1851, 0.6, None, None)],
            note="a note",
        ),
        0.1,
        "y",
    )
    count = t.write_temperature_records([one, two], tmp_path / "out")
    assert count == 3
    body = read_json(tmp_path / "out" / "index.json")
    assert isinstance(body, dict)
    assert body["schemaVersion"] == 1
    assert body["baseline"] == "1850\u20131900"
    assert body["credit"] == "c; c2"
    assert body["source"] == ["s", "s2"]
    assert body["spread"] == [[1850, 0.2, 0.2, 1], [1851, 0.4, 0.5, 2]]
    series = body["series"]
    assert isinstance(series, list)
    first, second = series
    assert isinstance(first, dict)
    assert isinstance(second, dict)
    assert "note" not in first
    assert first["points"] == [[1850, 0.2, 0.1, 0.3], [1851, 0.4, None, None]]
    assert second["note"] == "a note"
    assert second["shift"] == 0.1
    assert second["sourceId"] == "two"
