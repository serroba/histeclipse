"""Checks against NASA's Five Millennium Canon of Lunar Eclipses (Espenak & Meeus, 2009).

Reference rows come from https://eclipse.gsfc.nasa.gov/LEcat5/ (TD of greatest eclipse,
gamma, penumbral and umbral magnitude, and the zenith point rounded to whole degrees).
"""

from dataclasses import dataclass

import pytest

from histeclipse_pipeline.ephemeris import Ephemeris
from histeclipse_pipeline.julian_day import Calendar, CalendarDate, julian_day
from histeclipse_pipeline.lunar import (
    SEARCH_MARGIN_DAYS,
    LunarEclipse,
    LunarEclipseKind,
    find_lunar_eclipses,
)
from kernels import ANCIENT, BEFORE_SPLIT, MODERN

SECONDS_PER_DAY = 86_400


@dataclass(frozen=True)
class NasaRow:
    catalog_number: str
    date: CalendarDate
    kind: LunarEclipseKind
    gamma: float
    penumbral_magnitude: float
    umbral_magnitude: float
    zenith: tuple[int, int]


def td(year: int, month: int, day: int, hms: str, calendar: Calendar) -> CalendarDate:
    hours, minutes, seconds = (int(part) for part in hms.split(":"))
    return CalendarDate(
        year, month, day + (hours * 3600 + minutes * 60 + seconds) / 86_400, calendar
    )


J, G = Calendar.JULIAN, Calendar.GREGORIAN
P, N, T = LunarEclipseKind.PARTIAL, LunarEclipseKind.PENUMBRAL, LunarEclipseKind.TOTAL

ANCIENT_ROWS = [
    # The Babylonian eclipse of Nabopolassar's 5th year, recorded in Ptolemy's Almagest.
    NasaRow("03325", td(-620, 4, 22, "07:19:16", J), P, 0.9127, 1.2177, 0.1492, (-9, -31)),
]
SPLIT_ROWS = [
    NasaRow("09579", td(1969, 8, 27, "10:48:15", G), N, -1.5407, 0.0131, -0.9516, (-11, -161)),
    NasaRow("09580", td(1969, 9, 25, "20:10:19", G), N, 1.0655, 0.9007, -0.0953, (2, 55)),
    NasaRow("09581", td(1970, 2, 21, "08:30:43", G), P, 0.9619, 1.1402, 0.0463, (11, -124)),
]
MODERN_ROWS = [
    NasaRow("09706", td(2025, 3, 14, "06:59:56", G), T, 0.3484, 2.2595, 1.1784, (3, -102)),
    NasaRow("09707", td(2025, 9, 7, "18:12:58", G), T, -0.2752, 2.3440, 1.3619, (-6, 87)),
]


def search_all(ephemeris: Ephemeris) -> list[LunarEclipse]:
    return find_lunar_eclipses(
        ephemeris,
        ephemeris.start_jd + SEARCH_MARGIN_DAYS,
        ephemeris.end_jd - SEARCH_MARGIN_DAYS,
    )


def assert_matches(
    found: list[LunarEclipse],
    rows: list[NasaRow],
    *,
    time_tolerance_s: float,
    zenith_tolerance_deg: float,
) -> None:
    assert len(found) == len(rows)
    for eclipse, row in zip(found, rows, strict=True):
        offset_s = (eclipse.greatest_jd_tt - julian_day(row.date)) * SECONDS_PER_DAY
        assert abs(offset_s) < time_tolerance_s, row.catalog_number
        assert eclipse.kind is row.kind, row.catalog_number
        assert eclipse.gamma == pytest.approx(row.gamma, abs=0.002), row.catalog_number
        assert eclipse.umbral_magnitude == pytest.approx(row.umbral_magnitude, abs=0.003)
        assert eclipse.penumbral_magnitude == pytest.approx(row.penumbral_magnitude, abs=0.003)
        latitude, longitude = row.zenith
        assert eclipse.sublunar_latitude == pytest.approx(latitude, abs=zenith_tolerance_deg)
        assert eclipse.sublunar_longitude == pytest.approx(longitude, abs=zenith_tolerance_deg)


def test_modern_eclipses_match_nasa() -> None:
    with Ephemeris([MODERN]) as ephemeris:
        found = search_all(ephemeris)
    assert_matches(found, MODERN_ROWS, time_tolerance_s=5, zenith_tolerance_deg=0.6)
    assert all(65 < eclipse.delta_t_seconds < 75 for eclipse in found)


def test_finds_eclipses_on_both_sides_of_the_ephemeris_split(across_split: Ephemeris) -> None:
    assert_matches(
        search_all(across_split), SPLIT_ROWS, time_tolerance_s=5, zenith_tolerance_deg=0.6
    )


def test_ancient_eclipse_matches_nasa() -> None:
    # NASA's canon uses the VSOP87/ELP-2000/82 theories; DE441's lunar orbit differs by about
    # 80 s of eclipse timing after 2,600 years. ΔT also differs (NASA 18,941 s, Skyfield's
    # Morrison-Stephenson-Hohenkerk spline 18,776 s), which shifts the zenith point by ~0.7°.
    with Ephemeris([ANCIENT]) as ephemeris:
        found = search_all(ephemeris)
    assert_matches(found, ANCIENT_ROWS, time_tolerance_s=120, zenith_tolerance_deg=1.5)
    assert found[0].delta_t_seconds == pytest.approx(18_776, abs=50)


def test_returns_nothing_when_no_eclipse_happens() -> None:
    with Ephemeris([BEFORE_SPLIT]) as ephemeris:
        assert search_all(ephemeris) == []


def test_excludes_eclipses_outside_the_requested_range() -> None:
    with Ephemeris([MODERN]) as ephemeris:
        march_only = find_lunar_eclipses(
            ephemeris, ephemeris.start_jd + SEARCH_MARGIN_DAYS, 2_460_800.5
        )
    assert [eclipse.kind for eclipse in march_only] == [T]


def test_rejects_search_without_enough_ephemeris_margin() -> None:
    with Ephemeris([MODERN]) as ephemeris, pytest.raises(ValueError, match="at least"):
        find_lunar_eclipses(ephemeris, ephemeris.start_jd, ephemeris.end_jd)
