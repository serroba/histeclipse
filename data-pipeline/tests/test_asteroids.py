"""The asteroids and dwarf planets: which are drawn, in what group, and how each is fitted."""

from __future__ import annotations

import json
import urllib.parse

from histeclipse_pipeline.asteroids import (
    BEYOND_NEPTUNE,
    CENTAUR_YEARS,
    CHOSEN,
    DWARF_PLANETS,
    ECLIPTIC_POLE,
    GM_SUN,
    GM_SYSTEM,
    GROUPS,
    NEAR_EARTH_YEARS,
    SBDB,
    SBDB_TROJANS,
    SMALLEST_KM,
    START,
    STOP,
    TESTED,
    Asteroid,
    about,
    asteroid_list,
    body_json,
    check_moments,
)
from histeclipse_pipeline.julian_day import Calendar, CalendarDate, julian_day
from histeclipse_pipeline.moon_orbits import Orbit


def test_the_main_belt_s_asteroids_100_km_across_or_more_are_asked_for() -> None:
    query = urllib.parse.parse_qs(urllib.parse.urlparse(SBDB).query)
    assert query["sb-class"] == ["MBA,OMB"]
    assert json.loads(query["sb-cdata"][0]) == {"AND": [f"diameter|GE|{SMALLEST_KM}"]}
    assert SMALLEST_KM == 100


def test_jupiter_s_trojans_of_that_size_are_asked_for_too() -> None:
    query = urllib.parse.parse_qs(urllib.parse.urlparse(SBDB_TROJANS).query)
    assert query["sb-class"] == ["TJN"]
    assert json.loads(query["sb-cdata"][0]) == {"AND": [f"diameter|GE|{SMALLEST_KM}"]}


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


def test_a_list_asked_for_as_trojans_is_read_into_that_group() -> None:
    text = json.dumps(
        {
            "fields": ["pdes", "name", "full_name", "diameter", "class"],
            "data": [["624", "Hektor", "   624 Hektor (A907 CF)", "225", "TJN"]],
        }
    )
    assert asteroid_list(text, "trojan") == [Asteroid("624", "Hektor", 225.0, "trojan")]


def test_the_orbits_are_fitted_on_the_ecliptic_across_horizons_span() -> None:
    assert ECLIPTIC_POLE[0] == 270.0
    assert round(ECLIPTIC_POLE[1], 4) == 66.5607
    assert julian_day(CalendarDate(1600, 1, 2, Calendar.GREGORIAN)) == START
    assert julian_day(CalendarDate(2500, 1, 1, Calendar.GREGORIAN)) == STOP


def test_centaurs_and_near_earth_asteroids_are_fitted_to_fewer_years() -> None:
    assert julian_day(CalendarDate(1800, 1, 1, Calendar.GREGORIAN)) == CENTAUR_YEARS[0]
    assert julian_day(CalendarDate(1900, 1, 1, Calendar.GREGORIAN)) == NEAR_EARTH_YEARS[0]
    assert julian_day(CalendarDate(2100, 1, 1, Calendar.GREGORIAN)) == CENTAUR_YEARS[1]
    assert NEAR_EARTH_YEARS[1] == CENTAUR_YEARS[1]
    by_number = {body.number: body for body in CHOSEN}
    assert by_number["2060"].years == CENTAUR_YEARS
    assert by_number["1036"].years == NEAR_EARTH_YEARS
    # Eros keeps to its orbit across all of Horizons' years.
    assert by_number["433"].years == (START, STOP)


def test_each_chosen_body_is_in_a_known_group_once_with_a_size() -> None:
    numbers = [body.number for body in CHOSEN]
    assert len(set(numbers)) == len(numbers)
    assert all(body.group in GROUPS for body in CHOSEN)
    assert all(body.diameter > 0 and body.sized for body in CHOSEN)
    # The main belt and the Trojans are SBDB's lists, not chosen.
    assert {body.group for body in CHOSEN} == set(GROUPS) - {"main-belt", "trojan"}
    # Every body the site's tests use beyond the main belt is among them.
    assert set(TESTED) - {"1", "2", "4", "10", "624"} <= set(numbers)


def test_the_iau_s_dwarf_planets_beyond_ceres_are_all_chosen() -> None:
    assert len(DWARF_PLANETS) == 5
    assert DWARF_PLANETS - {"1"} <= {body.number for body in CHOSEN}


def test_a_body_beyond_neptune_is_fitted_about_the_solar_system_s_centre_of_mass() -> None:
    assert about("main-belt") == ("sun", "500@10", GM_SUN)
    assert about("centaur") == ("sun", "500@10", GM_SUN)
    for group in BEYOND_NEPTUNE:
        assert about(group) == ("barycentre", "500@0", GM_SYSTEM)
    # The planets add 1.3 parts in a thousand to the Sun's pull, nearly all of it Jupiter's
    # and Saturn's.
    assert round(GM_SYSTEM / GM_SUN, 5) == 1.00134


def test_pluto_is_asked_of_horizons_as_its_system_s_centre_of_mass() -> None:
    pluto = next(body for body in CHOSEN if body.name == "Pluto")
    assert (pluto.number, pluto.command, pluto.group) == ("134340", "9", "kuiper-belt")


def test_a_fit_is_checked_at_the_same_moments_each_run_within_its_years() -> None:
    moments = check_moments(CENTAUR_YEARS)
    assert moments == check_moments(CENTAUR_YEARS)
    assert moments == sorted(moments)
    assert len(moments) == 24
    assert all(CENTAUR_YEARS[0] <= moment <= CENTAUR_YEARS[1] for moment in moments)


def test_a_body_is_written_with_its_group_its_size_s_source_and_its_years() -> None:
    orbit = Orbit(
        planet="sun",
        axis=5_906_440_628.4,
        eccentricity=0.2488,
        inclination=17.14,
        longitude=(238.9, 0.00397, 0.0),
        swings=(),
        pericentre=(224.1, 0.0),
        node=(110.3, 0.0),
        pole=ECLIPTIC_POLE,
    )
    pluto = next(body for body in CHOSEN if body.name == "Pluto")
    written = body_json(pluto, orbit, 0.061)
    assert written["name"] == "Pluto"
    assert written["group"] == "kuiper-belt"
    assert written["dwarfPlanet"] is True
    assert written["diameterKm"] == 2376.6
    assert written["sized"] == "nimmo2017"
    assert written["about"] == "barycentre"
    assert written["fittedJdTT"] == [START, STOP]
    assert written["offDegrees"] == 0.06
    assert written["axisKm"] == 5_906_440_628
    assert "planet" not in written
    # And one that is no dwarf planet says nothing of it.
    eros = body_json(CHOSEN[0], orbit, 0.13)
    assert "dwarfPlanet" not in eros
    assert eros["about"] == "sun"
    assert eros["sized"] == "jplSbdb"
