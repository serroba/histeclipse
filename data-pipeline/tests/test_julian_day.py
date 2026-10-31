import math
from pathlib import Path

import pytest
from hypothesis import given
from hypothesis import strategies as st

from histeclipse_pipeline.julian_day import (
    GREGORIAN_REFORM_JD,
    Calendar,
    CalendarDate,
    calendar_date,
    days_in_month,
    is_leap_year,
    julian_day,
)
from tests.json_values import read_json

J = Calendar.JULIAN
G = Calendar.GREGORIAN

# Meeus reference values, shared with the web app's tests so both implementations agree.
VECTORS_PATH = Path(__file__).parents[2] / "test-vectors" / "julian-day.json"


def load_meeus_examples() -> list[tuple[CalendarDate, float]]:
    document = read_json(VECTORS_PATH)
    assert isinstance(document, dict)
    vectors = document["vectors"]
    assert isinstance(vectors, list)
    examples: list[tuple[CalendarDate, float]] = []
    for vector in vectors:
        assert isinstance(vector, dict)
        year, month, day = vector["year"], vector["month"], vector["day"]
        calendar, jd = vector["calendar"], vector["jd"]
        assert isinstance(year, int)
        assert isinstance(month, int)
        assert isinstance(day, int | float)
        assert isinstance(calendar, str)
        assert isinstance(jd, int | float)
        examples.append((CalendarDate(year, month, float(day), Calendar(calendar)), float(jd)))
    return examples


MEEUS_EXAMPLES = load_meeus_examples()


def test_shared_vectors_are_loaded() -> None:
    assert len(MEEUS_EXAMPLES) == 18


@pytest.mark.parametrize(("date", "expected"), MEEUS_EXAMPLES)
def test_julian_day_matches_meeus(date: CalendarDate, expected: float) -> None:
    assert julian_day(date) == pytest.approx(expected, abs=1e-9)


@pytest.mark.parametrize(("date", "jd"), MEEUS_EXAMPLES)
def test_calendar_date_matches_meeus(date: CalendarDate, jd: float) -> None:
    result = calendar_date(jd, date.calendar)
    assert (result.year, result.month, result.calendar) == (date.year, date.month, date.calendar)
    assert result.day == pytest.approx(date.day, abs=1e-6)


def test_gregorian_reform_follows_last_julian_day() -> None:
    last_julian = julian_day(CalendarDate(1582, 10, 4.0, J))
    first_gregorian = julian_day(CalendarDate(1582, 10, 15.0, G))
    assert first_gregorian == GREGORIAN_REFORM_JD
    assert first_gregorian - last_julian == 1


@pytest.mark.parametrize(
    ("year", "calendar", "expected"),
    [
        (1900, J, True),
        (1900, G, False),
        (2000, G, True),
        (2024, G, True),
        (2023, G, False),
        (0, J, True),
        (-4, J, True),
        (-1, J, False),
        (-100, G, False),
        (-400, G, True),
    ],
)
def test_is_leap_year(year: int, calendar: Calendar, *, expected: bool) -> None:
    assert is_leap_year(year, calendar) is expected


@pytest.mark.parametrize(
    ("month", "day"),
    [(0, 1.0), (13, 1.0), (2, 30.0), (4, 31.0), (1, 0.5), (1, 32.0)],
)
def test_rejects_invalid_dates(month: int, day: float) -> None:
    with pytest.raises(ValueError, match="must be in"):
        _ = CalendarDate(2001, month, day, G)


def test_accepts_february_29_in_leap_years_only() -> None:
    assert CalendarDate(1900, 2, 29.0, J).day == 29.0
    with pytest.raises(ValueError, match="Day must be in"):
        _ = CalendarDate(1900, 2, 29.0, G)


def test_rejects_dates_before_jd_zero() -> None:
    with pytest.raises(ValueError, match="before Julian Day 0"):
        _ = julian_day(CalendarDate(-4713, 12, 31.0, J))


@pytest.mark.parametrize("jd", [-0.5, math.nan, math.inf])
def test_calendar_date_rejects_out_of_range(jd: float) -> None:
    with pytest.raises(ValueError, match="finite and non-negative"):
        _ = calendar_date(jd, J)


# Day numbers covering roughly 4700 BCE to 3800 CE, the range the pipeline will need and more.
day_numbers = st.integers(min_value=1, max_value=3_100_000)
calendars = st.sampled_from(Calendar)


@given(day_numbers, calendars)
def test_round_trip_from_julian_day(day_number: int, calendar: Calendar) -> None:
    midnight = day_number - 0.5
    assert julian_day(calendar_date(midnight, calendar)) == midnight


@given(day_numbers, calendars)
def test_consecutive_days_are_consecutive_dates(day_number: int, calendar: Calendar) -> None:
    today = calendar_date(day_number - 0.5, calendar)
    tomorrow = calendar_date(day_number + 0.5, calendar)
    if today.day < days_in_month(today.year, today.month, calendar):
        expected = (today.year, today.month, today.day + 1)
    elif today.month < 12:
        expected = (today.year, today.month + 1, 1.0)
    else:
        expected = (today.year + 1, 1, 1.0)
    assert (tomorrow.year, tomorrow.month, tomorrow.day) == expected


@given(day_numbers, st.sampled_from([0.0, 0.25, 0.5, 0.75]))
def test_fraction_of_day_round_trips(day_number: int, fraction: float) -> None:
    jd = day_number + fraction
    for calendar in Calendar:
        assert julian_day(calendar_date(jd, calendar)) == pytest.approx(jd, abs=1e-6)
