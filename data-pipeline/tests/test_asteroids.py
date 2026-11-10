"""The asteroid belt: which asteroids are drawn, as JPL's Small-Body Database lists them."""

from __future__ import annotations

import json
import urllib.parse

from histeclipse_pipeline.asteroids import (
    ECLIPTIC_POLE,
    SBDB,
    SMALLEST_KM,
    START,
    STOP,
    Asteroid,
    asteroid_list,
)
from histeclipse_pipeline.julian_day import Calendar, CalendarDate, julian_day


def test_the_main_belt_s_asteroids_100_km_across_or_more_are_asked_for() -> None:
    query = urllib.parse.parse_qs(urllib.parse.urlparse(SBDB).query)
    assert query["sb-class"] == ["MBA,OMB"]
    assert json.loads(query["sb-cdata"][0]) == {"AND": [f"diameter|GE|{SMALLEST_KM}"]}
    assert SMALLEST_KM == 100


def test_the_list_is_read_largest_first_and_unmeasured_ones_left_out() -> None:
    # Given SBDB's answer: Vesta, Ceres, an asteroid with no name, one with no diameter.
    text = json.dumps(
        {
            "fields": ["pdes", "name", "full_name", "diameter", "class"],
            "data": [
                ["4", "Vesta", "     4 Vesta (A807 FA)", "522.77", "MBA"],
                ["1", "Ceres", "     1 Ceres (A801 AA)", "939.4", "MBA"],
                ["9999", None, "  9999 (1990 AB)", "100.5", "OMB"],
                ["7", "Iris", "     7 Iris (A847 PA)", None, "MBA"],
            ],
        }
    )
    # Then each is kept, largest first, by its number when it has no name.
    assert asteroid_list(text) == [
        Asteroid("1", "Ceres", 939.4),
        Asteroid("4", "Vesta", 522.77),
        Asteroid("9999", "9999", 100.5),
    ]


def test_the_orbits_are_fitted_on_the_ecliptic_across_horizons_span() -> None:
    assert ECLIPTIC_POLE[0] == 270.0
    assert round(ECLIPTIC_POLE[1], 4) == 66.5607
    assert julian_day(CalendarDate(1600, 1, 2, Calendar.GREGORIAN)) == START
    assert julian_day(CalendarDate(2500, 1, 1, Calendar.GREGORIAN)) == STOP
