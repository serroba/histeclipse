"""Julian Day conversion for proleptic Julian and Gregorian calendar dates.

Follows Meeus, *Astronomical Algorithms* (2nd ed.), chapter 7, using floor
division throughout so the formulas stay continuous for negative years, and
integer arithmetic in place of the classic ``30.6001`` floating-point fudge.

Years use astronomical numbering: 1 BCE is year 0 and 587 BCE is year -586.
Supported range is Julian Day 0 (-4712 January 1.5, Julian calendar) onward.
"""

import math
from dataclasses import dataclass
from enum import StrEnum

# Julian Day of 1582 October 15 (Gregorian) at 0h, the first day of the Gregorian reform.
GREGORIAN_REFORM_JD = 2_299_160.5

_JD_EPOCH_OFFSET = 1524.5
_GREGORIAN_ALPHA_EPOCH = 1_867_216.25
_DAYS_PER_GREGORIAN_CENTURY = 36_524.25
_DAYS_PER_JULIAN_YEAR = 365.25
_MARCH_BASED_YEAR_OFFSET = 4716
_FEBRUARY = 2
_MONTHS_PER_YEAR = 12
_E_THRESHOLD = 14


class Calendar(StrEnum):
    """Which calendar a date is expressed in."""

    JULIAN = "julian"
    GREGORIAN = "gregorian"


@dataclass(frozen=True, slots=True)
class CalendarDate:
    """A calendar date with a fractional day: ``day=1.5`` is noon on the 1st."""

    year: int
    month: int
    day: float
    calendar: Calendar

    def __post_init__(self) -> None:
        """Reject dates that do not exist in their calendar."""
        if not 1 <= self.month <= _MONTHS_PER_YEAR:
            msg = f"Month must be in 1..12, got {self.month}"
            raise ValueError(msg)
        last_day = days_in_month(self.year, self.month, self.calendar)
        if not 1 <= self.day < last_day + 1:
            msg = f"Day must be in [1, {last_day + 1}), got {self.day}"
            raise ValueError(msg)


def is_leap_year(year: int, calendar: Calendar) -> bool:
    """Return whether ``year`` (astronomical numbering) is a leap year."""
    if calendar is Calendar.JULIAN:
        return year % 4 == 0
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


def days_in_month(year: int, month: int, calendar: Calendar) -> int:
    """Return the number of days in a month."""
    if month == _FEBRUARY:
        return 29 if is_leap_year(year, calendar) else 28
    return 30 if month in {4, 6, 9, 11} else 31


def julian_day(date: CalendarDate) -> float:
    """Convert a calendar date to a Julian Day."""
    year, month = date.year, date.month
    if month <= _FEBRUARY:
        year -= 1
        month += _MONTHS_PER_YEAR
    correction = 0
    if date.calendar is Calendar.GREGORIAN:
        century = year // 100
        correction = 2 - century + century // 4
    jd = (
        math.floor(_DAYS_PER_JULIAN_YEAR * (year + _MARCH_BASED_YEAR_OFFSET))
        + (306 * (month + 1)) // 10
        + date.day
        + correction
        - _JD_EPOCH_OFFSET
    )
    if jd < 0:
        msg = f"Dates before Julian Day 0 are not supported: {date}"
        raise ValueError(msg)
    return jd


def calendar_date(jd: float, calendar: Calendar) -> CalendarDate:
    """Convert a Julian Day to a calendar date."""
    if not math.isfinite(jd) or jd < 0:
        msg = f"Julian Day must be finite and non-negative, got {jd}"
        raise ValueError(msg)
    whole = math.floor(jd + 0.5)
    fraction = jd + 0.5 - whole
    a = whole
    if calendar is Calendar.GREGORIAN:
        alpha = math.floor((whole - _GREGORIAN_ALPHA_EPOCH) / _DAYS_PER_GREGORIAN_CENTURY)
        a = whole + 1 + alpha - alpha // 4
    b = a + 1524
    c = math.floor((b - 122.1) / _DAYS_PER_JULIAN_YEAR)
    d = math.floor(_DAYS_PER_JULIAN_YEAR * c)
    e = ((b - d) * 10_000) // 306_001
    day = b - d - (306 * e) // 10 + fraction
    month = e - 1 if e < _E_THRESHOLD else e - 13
    year = c - _MARCH_BASED_YEAR_OFFSET if month > _FEBRUARY else c - (_MARCH_BASED_YEAR_OFFSET - 1)
    return CalendarDate(year=year, month=month, day=day, calendar=calendar)
