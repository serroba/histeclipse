"""Lunisolar month tables: new moons and solar terms against published instants, and the rules."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

import numpy as np
import pytest

from histeclipse_pipeline.ephemeris import Ephemeris
from histeclipse_pipeline.julian_day import Calendar, CalendarDate, julian_day
from histeclipse_pipeline.lunisolar import (
    BABYLON_LATITUDE,
    BABYLON_LONGITUDE,
    CHINA_STANDARD_FROM_JD,
    EVENINGS,
    ChineseMonth,
    CrescentMonths,
    Evenings,
    babylonian_table,
    china_longitude,
    chinese_months,
    chinese_table,
    chinese_year_table,
    crescent_months,
    crescent_table,
    evenings_after,
    major_terms,
    new_moons,
    ut_of,
    write_table,
)
from tests.kernels import ANCIENT, MODERN

if TYPE_CHECKING:
    from pathlib import Path

MINUTE = 1 / 1440


def utc(month: int, day: int, hour: int, minute: int) -> float:
    """A 2025 UTC instant as a Julian Day (UT1 and UTC differ by under a second)."""
    return julian_day(
        CalendarDate(2025, month, day + (hour * 60 + minute) / 1440, Calendar.GREGORIAN)
    )


def test_finds_new_moons_at_the_published_instants() -> None:
    # USNO / timeanddate new moons of 2025, UTC.
    expected = [utc(4, 27, 19, 31), utc(5, 27, 3, 2), utc(6, 25, 10, 31), utc(7, 24, 19, 11)]
    with Ephemeris([MODERN]) as ephemeris:
        found = ut_of(new_moons(ephemeris, utc(4, 1, 0, 0), utc(8, 1, 0, 0)))
    assert found == pytest.approx(expected, abs=2 * MINUTE)


def test_finds_major_solar_terms() -> None:
    with Ephemeris([MODERN]) as ephemeris:
        times, terms = major_terms(ephemeris, utc(6, 1, 0, 0), utc(7, 1, 0, 0))
    # The June solstice, the Sun at 90°: 21 June 2025, 02:42 UTC.
    assert terms.tolist() == [3]
    assert ut_of(times) == pytest.approx([utc(6, 21, 2, 42)], abs=2 * MINUTE)


def test_china_keeps_beijing_time_before_1929() -> None:
    before, after = CHINA_STANDARD_FROM_JD - 1, CHINA_STANDARD_FROM_JD + 1
    assert china_longitude(np.array([before, after])).tolist() == pytest.approx(
        [116.4167, 120.0], abs=1e-3
    )


def test_numbers_months_with_a_leap_month_where_a_major_term_is_missing() -> None:
    # Months of 30 days; the winter solstice (term 9) in months 0 and 13, so 13 months from one
    # 11th month to the next, and month 3 holds no major term.
    starts = np.arange(15, dtype=np.int64) * 30
    holding = [0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
    term_days = np.array([30 * month + 10 for month in holding], dtype=np.int64)
    terms = np.array([(9 + position) % 12 for position in range(13)], dtype=np.int64)
    months = chinese_months(starts, term_days, terms)
    assert [(month.number, month.leap) for month in months] == [
        (11, False),
        (12, False),
        (1, False),
        (1, True),
        (2, False),
        (3, False),
        (4, False),
        (5, False),
        (6, False),
        (7, False),
        (8, False),
        (9, False),
        (10, False),
    ]


def test_groups_months_into_years_with_their_lengths_and_leap() -> None:
    months = [
        ChineseMonth(0, 12, leap=False),
        ChineseMonth(30, 1, leap=False),
        ChineseMonth(59, 1, leap=True),
        ChineseMonth(89, 2, leap=False),
        ChineseMonth(118, 1, leap=False),
    ]
    table = chinese_table(months, first_year=5)
    assert table["firstYear"] == 5
    # From the first month: 29, 30 and 29 days; the leap month is the second.
    assert table["years"] == [[30, 0b010, 2]]


def evenings(q: list[list[float]]) -> Evenings:
    days = np.arange(len(q), dtype=np.int64)[:, np.newaxis] * 29 + np.arange(EVENINGS)
    return Evenings(days=days, q=np.array(q, dtype=np.float64))


def test_a_month_begins_after_the_first_evening_the_crescent_is_seen() -> None:
    no = -np.inf
    months = crescent_months(
        evenings([[no, 0.9, 2.0, 3.0], [-0.5, 0.1, 1.5, 3.0], [-0.1, 0.8, 2.0, 3.0]])
    )
    assert months.first_days.tolist() == [2, 31, 60]
    # Easily seen; seen only just; and the evening before was nearly seen.
    assert months.uncertain.tolist() == [False, True, True]


def test_a_month_never_runs_past_30_days() -> None:
    no = -np.inf
    months = crescent_months(evenings([[0.5, 1.0, 2.0, 3.0], [no, no, no, 1.0]]))
    assert months.first_days.tolist() == [1, 31]
    assert months.uncertain.tolist() == [False, True]


def test_refuses_a_crescent_never_seen() -> None:
    with pytest.raises(ValueError, match="not seen"):
        _ = crescent_months(evenings([[-1.0, -1.0, -1.0, -1.0]]))


def test_tables_months_as_lengths() -> None:
    months = CrescentMonths(
        first_days=np.array([100, 130, 159], dtype=np.int64),
        uncertain=np.array([False, True, False]),
    )
    table = crescent_table(months)
    assert (table["firstDay"], table["lengths"], table["uncertain"]) == (100, "10", [1])
    with pytest.raises(ValueError, match="outside 29-30"):
        _ = crescent_table(
            CrescentMonths(
                first_days=np.array([0, 31], dtype=np.int64), uncertain=np.array([False, False])
            )
        )


def test_sees_the_crescents_of_621_bce_at_babylon() -> None:
    start = julian_day(CalendarDate(-620, 3, 26.0, Calendar.JULIAN))
    with Ephemeris([ANCIENT]) as ephemeris:
        conjunctions = new_moons(ephemeris, start, start + 40)
        seen = evenings_after(ephemeris, conjunctions, BABYLON_LATITUDE, BABYLON_LONGITUDE)
        table = babylonian_table(ephemeris, start, start + 40)
    # Each evening the crescent is older and higher.
    finite = np.where(np.isfinite(seen.q), seen.q, -99.0)
    assert bool(np.all(np.diff(finite, axis=1) > 0))
    assert len(table["lengths"]) == len(conjunctions) - 1
    assert table["firstDay"] == crescent_months(seen).first_days.tolist()[0]


def test_builds_no_chinese_years_from_less_than_a_year(tmp_path: Path) -> None:
    with Ephemeris([MODERN]) as ephemeris:
        table = chinese_year_table(ephemeris, utc(4, 1, 0, 0), utc(8, 1, 0, 0), 2025)
    assert table["years"] == []
    write_table(table, tmp_path / "out" / "chinese.json")
    written = json.loads((tmp_path / "out" / "chinese.json").read_text())  # pyright: ignore[reportAny]
    assert written == table
