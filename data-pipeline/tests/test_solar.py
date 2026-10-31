"""Checks against NASA's Five Millennium Canon of Solar Eclipses (Espenak & Meeus, 2006).

Reference rows come from https://eclipse.gsfc.nasa.gov/SEcat5/ (TD of greatest eclipse, type,
gamma, eclipse magnitude, and the point of greatest eclipse rounded to whole degrees).
"""

from dataclasses import dataclass, replace
from typing import TYPE_CHECKING

import pytest

from histeclipse_pipeline.ephemeris import Ephemeris
from histeclipse_pipeline.julian_day import Calendar, CalendarDate, julian_day
from histeclipse_pipeline.solar import (
    SEARCH_MARGIN_DAYS,
    BesselianElements,
    SolarEclipse,
    SolarEclipseKind,
    circumstances,
    evaluate,
    find_solar_eclipses,
    greatest_eclipse_hours,
    new_moon_candidates,
)
from tests.kernels import ANNULAR_2023, HYBRID_2023, MODERN, THALES, TOTAL_2024

if TYPE_CHECKING:
    from pathlib import Path

SECONDS_PER_DAY = 86_400
J, G = Calendar.JULIAN, Calendar.GREGORIAN
T, A, H, P = (
    SolarEclipseKind.TOTAL,
    SolarEclipseKind.ANNULAR,
    SolarEclipseKind.HYBRID,
    SolarEclipseKind.PARTIAL,
)


@dataclass(frozen=True)
class NasaRow:
    catalog_number: str
    kernel: Path
    date: CalendarDate
    kind: SolarEclipseKind
    gamma: float
    magnitude: float
    greatest: tuple[int, int]


def td(year: int, month: int, day: int, hms: str, calendar: Calendar) -> CalendarDate:
    hours, minutes, seconds = (int(part) for part in hms.split(":"))
    return CalendarDate(
        year, month, day + (hours * 3600 + minutes * 60 + seconds) / 86_400, calendar
    )


MODERN_ROWS = [
    NasaRow("09559", HYBRID_2023, td(2023, 4, 20, "04:17:56", G), H, -0.3952, 1.0132, (-10, 126)),
    NasaRow("09560", ANNULAR_2023, td(2023, 10, 14, "18:00:41", G), A, 0.3753, 0.9520, (11, -83)),
    NasaRow("09561", TOTAL_2024, td(2024, 4, 8, "18:18:29", G), T, 0.3431, 1.0566, (25, -104)),
    NasaRow("09563", MODERN, td(2025, 3, 29, "10:48:36", G), P, 1.0405, 0.9376, (61, -77)),
]
# 585 BCE May 28: the eclipse Herodotus says Thales foretold, ending a battle between the
# Lydians and the Medes (identification debated).
THALES_ROW = NasaRow("03379", THALES, td(-584, 5, 28, "19:28:50", J), T, 0.3201, 1.0798, (38, -45))


def search(kernel: Path) -> list[SolarEclipse]:
    with Ephemeris([kernel]) as ephemeris:
        return find_solar_eclipses(
            ephemeris,
            [kernel],
            ephemeris.start_jd + SEARCH_MARGIN_DAYS,
            ephemeris.end_jd - SEARCH_MARGIN_DAYS,
        )


def assert_matches(row: NasaRow, *, seconds: float, degrees: float) -> SolarEclipse:
    [eclipse] = search(row.kernel)
    offset = (eclipse.greatest_jd_tt - julian_day(row.date)) * SECONDS_PER_DAY
    assert abs(offset) < seconds
    assert eclipse.kind is row.kind
    assert eclipse.gamma == pytest.approx(row.gamma, abs=0.0005)
    assert eclipse.magnitude == pytest.approx(row.magnitude, abs=0.0005)
    latitude, longitude = row.greatest
    assert eclipse.greatest_latitude == pytest.approx(latitude, abs=degrees)
    assert eclipse.greatest_longitude == pytest.approx(longitude, abs=degrees)
    return eclipse


@pytest.mark.parametrize("row", MODERN_ROWS, ids=[row.catalog_number for row in MODERN_ROWS])
def test_modern_eclipses_match_nasa(row: NasaRow) -> None:
    eclipse = assert_matches(row, seconds=2, degrees=0.6)
    assert 68 < eclipse.delta_t_seconds < 75


def test_thales_eclipse_matches_nasa() -> None:
    # As with lunar eclipses, NASA's older lunar theory (ELP-2000/82) and DE441 differ by about a
    # minute after 2,600 years; ΔT differs too (NASA 18,384 s, Skyfield 18,213 s), shifting the
    # point of greatest eclipse by about 0.7° of longitude.
    eclipse = assert_matches(THALES_ROW, seconds=120, degrees=1.5)
    assert eclipse.delta_t_seconds == pytest.approx(18_213, abs=50)


def test_elements_are_centred_on_the_whole_hour_nearest_greatest_eclipse() -> None:
    [eclipse] = search(TOTAL_2024)
    # 2024 April 8, 18:00 TT, as in NASA's published elements.
    assert eclipse.elements.t0_jd_tt == pytest.approx(2_460_409.25, abs=1e-9)
    hours = (eclipse.greatest_jd_tt - eclipse.elements.t0_jd_tt) * 24
    assert 0 <= hours < 0.5


def test_elements_match_nasas_published_values_for_2024() -> None:
    # https://eclipse.gsfc.nasa.gov/SEsearch/SEdata.php?Ecl=+20240408 (t0 = 18:00 TDT, ΔT 74.0 s).
    [eclipse] = search(TOTAL_2024)
    elements = eclipse.elements
    for ours, nasa, tolerance in [
        (elements.x, (-0.3182440, 0.5117116, 0.0000326, -0.0000084), 2e-5),
        (elements.y, (0.2197640, 0.2709589, -0.0000595, -0.0000047), 2e-5),
        (elements.d, (7.5862002, 0.0148440, -0.0000020), 2e-5),
        (elements.l1, (0.5358140, 0.0000618, -0.0000128), 2e-5),
        (elements.l2, (-0.0102720, 0.0000615, -0.0000127), 2e-5),
    ]:
        for coefficient, expected in zip(ours, nasa, strict=False):
            assert coefficient == pytest.approx(expected, abs=tolerance)
    assert elements.tan_f1 == pytest.approx(0.0046683, abs=2e-7)
    assert elements.tan_f2 == pytest.approx(0.0046450, abs=2e-7)
    # μ is the ephemeris hour angle (UT taken as TT), so it does not depend on ΔT.
    assert evaluate(elements.mu, 0) == pytest.approx(89.591217, abs=2e-4)
    assert elements.mu[1] == pytest.approx(15.004080, abs=2e-5)


def test_finds_nothing_away_from_eclipse_season() -> None:
    with Ephemeris([MODERN]) as ephemeris:
        # 2025 June: a new moon, but far from the lunar nodes.
        assert new_moon_candidates(ephemeris, 2_460_820.5, 2_460_850.5) == []


def test_rejects_search_without_enough_ephemeris_margin() -> None:
    with Ephemeris([MODERN]) as ephemeris, pytest.raises(ValueError, match="at least"):
        _ = new_moon_candidates(ephemeris, ephemeris.start_jd, ephemeris.end_jd)


# Synthetic elements exercise the cases where the axis misses Earth.
BASE = BesselianElements(
    t0_jd_tt=2_451_545.0,
    delta_t=64.0,
    x=(1.3, 0.55, 0.0, 0.0),
    y=(0.0, 0.0, 0.0, 0.0),
    d=(10.0, 0.0, 0.0, 0.0),
    mu=(0.0, 15.0, 0.0, 0.0),
    l1=(0.54, 0.0, 0.0, 0.0),
    l2=(-0.006, 0.0, 0.0, 0.0),
    tan_f1=0.0047,
    tan_f2=0.0046,
)


def test_axis_far_from_earth_is_no_eclipse() -> None:
    assert circumstances(replace(BASE, x=(3.0, 0.0, 0.0, 0.0))) is None


def test_axis_missing_earth_gives_a_partial_eclipse_on_the_limb() -> None:
    eclipse = circumstances(replace(BASE, x=(1.3, 0.0, 0.0, 0.0)))
    assert eclipse is not None
    assert eclipse.kind is P
    assert eclipse.magnitude == pytest.approx((0.54 - 0.3) / (0.54 - 0.006), abs=1e-3)
    assert eclipse.gamma == pytest.approx(1.3, abs=1e-6)


@pytest.mark.parametrize(("l2", "kind"), [(-0.006, T), (0.006, A)])
def test_umbra_grazing_the_limb_is_a_non_central_total_or_annular_eclipse(
    l2: float, kind: SolarEclipseKind
) -> None:
    eclipse = circumstances(replace(BASE, x=(1.003, 0.0, 0.0, 0.0), l2=(l2, 0.0, 0.0, 0.0)))
    assert eclipse is not None
    assert eclipse.kind is kind


def test_greatest_eclipse_is_where_the_axis_is_closest() -> None:
    # x = 0.55 (h + 1) is zero at h = -1, where the axis is closest to Earth's center.
    elements = replace(BASE, x=(0.55, 0.55, 0.0, 0.0), y=(0.2, 0.0, 0.0, 0.0))
    assert greatest_eclipse_hours(elements) == pytest.approx(-1.0, abs=1e-6)


def test_evaluate_uses_lowest_power_first() -> None:
    assert evaluate((1.0, 2.0, 3.0), 2.0) == 1 + 2 * 2 + 3 * 4
