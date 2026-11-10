"""Every craft sent beyond Earth orbit: GCAT's record, with NSSDCA's chronology."""

from __future__ import annotations

import pytest

from histeclipse_pipeline.spacecraft import (
    Chronicle,
    chronicles,
    coordinate,
    craft_record,
    gcat_date,
    gcat_rows,
    near_day,
)

HEADER = (
    "#JCAT\tLaunch_Tag\tPiece\tType\tName\tLDate\tParent\tSDate\tPrimary\tDDate\tStatus"
    "\tDest\tOwner\tState"
)


def gcat(*rows: str) -> list[dict[str, str]]:
    """Read rows written as GCAT writes them, under its header and a note."""
    return gcat_rows("\n".join([HEADER, "# Updated 2026 Nov  9", *rows]))


#: Voyager 2 leaves Earth for Jupiter; its dust cover is a part, not a craft.
VOYAGER = (
    "D00574\t1977-076\t1977-076A\tP   D\tVoyager 2\t1977 Aug 20\t-\t1977 Aug 20 1937\tEarth"
    "\t1977 Aug 22 0824\tEO\tHCO\tJPL\tUS"
)
COVER = (
    "D00576\t1977-076\t1977-076A\tC  FD\tVoyager 2 IRIS dust cover\t1977 Aug 20\tD00574"
    "\t1977 Aug 20 1937\tEarth\t1977 Aug 22 0824\tEAO\tHCO\tJPL\tUS"
)
AT_JUPITER = (
    "D00574\t1977-076\t1977-076A\tP   D\tVoyager 2\t1977 Aug 20\tHCO\t1979 Apr 30 1830?"
    "\tJupiter\t1979 Sep 18 0240?\tEN\tHCO\tJPL\tUS"
)
#: A craft in a high Earth orbit, never beyond it.
VELA = (
    "D00010\t1963-039\t1963-039A\tP   D\tVela 1\t1963 Oct 17\t-\t1963 Oct 17\tEarth\t-"
    "\tO\t-\tUSAF\tUS"
)
#: Apollo 11's command module, crewed, and its lunar module, which the chronology does not link.
COLUMBIA = (
    "D00273\t1969-059\t1969-059A\tPH HD\tColumbia\t1969 Jul 16\t-\t1969 Jul 16 1647\tEarth"
    "\t1969 Jul 19 0311\tEAO\tLuna\tNASA\tUS"
)
EAGLE = (
    "D00274\t1969-059\t1969-059C\tPP HD\tEagle\t1969 Jul 16\t-\t1969 Jul 16 1647\tEarth"
    "\t1969 Jul 19 0311\tEO\tLuna\tNASA\tUS"
)


def test_gcat_dates_are_written_as_iso_their_doubt_kept() -> None:
    assert gcat_date("1977 Aug 22 0824") == "1977-08-22T08:24"
    assert gcat_date("1979 Apr 30 1830?") == "1979-04-30T18:30?"
    assert gcat_date("1979 May?") == "1979-05?"
    assert gcat_date("1969 Jul  3") == "1969-07-03"
    assert gcat_date("-") is None
    with pytest.raises(ValueError, match="not a GCAT date"):
        _ = gcat_date("soon")


def test_a_landing_s_coordinates_may_be_unknown_or_unsure() -> None:
    assert coordinate("-") is None
    assert coordinate("2?") == 2.0
    assert coordinate(" -23.1") == -23.1


def test_the_chronology_gives_each_craft_its_objective_and_outcome() -> None:
    page = (
        '<a href="https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1964-077A">'
        " Mariner 4</a>\n-  28 November 1964  -  Mars Flyby<br>\n"
        '<a href="tent_launch.html#luna1958a"> Luna 1958A</a>\n'
        '-  23 September 1958  -  Attempted Lunar Impact? <font color="maroon">(Launch Failure)'
        "</font><br>\n"
        '<a href="x.html?id=1975-050D"> Venera 9</a>\n-  8 June 1975  -  Venus\n'
        '<a href="x?id=1975-050A"> Orbiter</a>\nand\n<a href="x?id=1975-050D"> Lander</a><br>\n'
        '<a href="x?id=DRAGONFLY"> Dragonfly</a>\n-  2028  -  Quadcopter Mission to Titan<br>\n'
    )
    assert chronicles(page) == [
        Chronicle("Mariner 4", "1964-11-28", "Mars Flyby", "1964-077A"),
        Chronicle("Luna 1958A", "1958-09-23", "Attempted Lunar Impact? (Launch Failure)", None),
        Chronicle(
            "Venera 9",
            "1975-06-08",
            "Venus Orbiter and Lander",
            "1975-050D",
            ("1975-050A", "1975-050D"),
        ),
    ]


def test_a_craft_beyond_earth_orbit_keeps_its_phases_and_its_outcome() -> None:
    # Given Voyager 2's phases, its dust cover, and a craft that stayed in Earth orbit.
    craft, never = craft_record(
        gcat(VOYAGER, COVER, VELA),
        gcat(AT_JUPITER),
        [],
        [Chronicle("Voyager 2", "1977-08-20", "Jupiter/Saturn/Uranus/Neptune Flyby", "1977-076A")],
    )
    # Then Voyager 2 alone is kept, its phases in order, its outcome and mission named.
    assert [c["name"] for c in craft] == ["Voyager 2"]
    voyager = craft[0]
    assert voyager["phases"] == [
        ["Earth", "1977-08-20T19:37", "1977-08-22T08:24", "EO", "HCO"],
        ["Jupiter", "1979-04-30T18:30?", "1979-09-18T02:40?", "EN", "HCO"],
    ]
    assert voyager["about"] == "Jupiter/Saturn/Uranus/Neptune Flyby"
    assert voyager["mission"] == "Voyager 2"
    assert voyager["crewed"] is False
    assert never == []


def test_a_crewed_mission_is_found_by_its_day_and_named_for_all_its_craft() -> None:
    # Given Apollo 11's two craft, which the chronology names only by mission.
    craft, _ = craft_record(
        gcat(COLUMBIA, EAGLE),
        [],
        [],
        [Chronicle("Apollo 11", "1969-07-16", "Crewed Lunar Landing", None)],
    )
    # Then the crewed one takes its outcome, and both its name.
    by_name = {c["name"]: c for c in craft}
    assert by_name["Columbia"]["about"] == "Crewed Lunar Landing"
    assert by_name["Columbia"]["crewed"] is True
    assert "about" not in by_name["Eagle"]
    assert by_name["Eagle"]["mission"] == "Apollo 11"
    # The lander carried a crew too, on a crewed mission.
    assert by_name["Eagle"]["crewed"] is True


def test_a_craft_that_never_left_is_kept_from_the_chronology() -> None:
    # Given a launch failure, a stranded probe, and an Earth orbiter the chronology lists.
    _, never = craft_record(
        [],
        [],
        [],
        [
            Chronicle("Luna 1958A", "1958-09-23", "Attempted Lunar Impact? (Launch Failure)", None),
            Chronicle("Mars 96", "1996-11-16", "Attempted Mars Orbiter/Landers", "1996-064A"),
            Chronicle("Hubble Space Telescope", "1990-04-24", "Earth Orbiting Observatory", None),
        ],
    )
    # Then the two that set out are kept, the Earth orbiter not.
    assert [n["name"] for n in never] == ["Luna 1958A", "Mars 96"]


def test_a_landing_is_kept_with_its_craft() -> None:
    landing = {
        "JCAT": "D00274",
        "Piece": "1969-059C",
        "World": "Luna",
        "Lat": "0.67",
        "Lon": "23.47",
        "LandDate": "1969 Jul 20 2017",
        "LSite": "Mare Tranquillitatis",
    }
    craft, _ = craft_record(gcat(EAGLE), [], [landing], [])
    assert craft[0]["landing"] == {
        "world": "Luna",
        "lat": 0.67,
        "lon": 23.47,
        "date": "1969-07-20T20:17",
        "site": "Mare Tranquillitatis",
    }


def test_a_launch_a_day_off_in_another_time_zone_is_the_same_launch() -> None:
    assert near_day("2025-02-27T00:16", "2025-02-26")
    assert not near_day("2025-03-01", "2025-02-26")
    assert near_day("1979-05?", "1979-05")


def test_a_craft_that_shared_the_rocket_keeps_its_own_name() -> None:
    # Given an uncrewed flight and a CubeSat launched with it, the chronology naming the flight.
    flight = (
        "D01100\t2022-156\t2022-156A\tP   D\tArtemis I\t2022 Nov 16\t-\t2022 Nov 16 0647"
        "\tEarth\t2022 Nov 21\tEO\tLuna\tNASA\tUS"
    )
    cubesat = (
        "D01101\t2022-156\t2022-156B\tP   D\tLunaH-Map\t2022 Nov 16\t-\t2022 Nov 16 0647"
        "\tEarth\t2022 Nov 21\tEO\tHCO\tASU\tUS"
    )
    craft, _ = craft_record(
        gcat(flight, cubesat),
        [],
        [],
        [Chronicle("Artemis 1", "2022-11-16", "Lunar Test Flight", "2022-156A")],
    )
    by_name = {c["name"]: c for c in craft}
    assert by_name["Artemis I"]["mission"] == "Artemis 1"
    assert "mission" not in by_name["LunaH-Map"]


def test_a_capsule_built_for_a_crew_flown_without_one_is_not_crewed() -> None:
    zond = (
        "D00194\t1968-013\t1968-013A\tPP HD\tZond-4\t1968 Mar  2\t-\t1968 Mar  2"
        "\tEarth\t1968 Mar  9\tL\tG of Guinea\tMOM\tSU"
    )
    craft, _ = craft_record(
        gcat(zond), [], [], [Chronicle("Zond 4", "1968-03-02", "Test Flight", "1968-013A")]
    )
    assert craft[0]["crewed"] is False


def test_a_part_named_for_the_mission_does_not_take_its_outcome() -> None:
    odyssey = (
        "D00316\t1970-029\t1970-029A\tPH HD\tOdyssey\t1970 Apr 11\t-\t1970 Apr 11"
        "\tEarth\t1970 Apr 14\tEAO\tLuna\tNASA\tUS"
    )
    experiments = (
        "D00328\t1970-029\t1970-029A\tPXALD--\tApollo 13 ALSEP\t1970 Apr 11\tD00326"
        "\t1970 Apr 11\tEarth\t1970 Apr 14\tEAO\tLuna\tNASA\tUS"
    )
    craft, _ = craft_record(
        gcat(odyssey, experiments),
        [],
        [],
        [Chronicle("Apollo 13", "1970-04-11", "Crewed Lunar Mission (Landing Aborted)", None)],
    )
    by_name = {c["name"]: c for c in craft}
    assert by_name["Odyssey"]["about"] == "Crewed Lunar Mission (Landing Aborted)"
    assert "about" not in by_name["Apollo 13 ALSEP"]


def test_a_subsatellite_left_by_a_crewed_mission_is_not_crewed() -> None:
    casper = (
        "D00441\t1972-031\t1972-031A\tPH HD\tCasper\t1972 Apr 16\t-\t1972 Apr 16"
        "\tEarth\t1972 Apr 19\tEAO\tLuna\tNASA\tUS"
    )
    subsatellite = (
        "D00443\t1972-031\t1972-031D\tP   D\tApollo 16 Subsatellite\t1972 Apr 16\t-"
        "\t1972 Apr 16\tEarth\t1972 Apr 19\tEAO\tLuna\tNASA\tUS"
    )
    craft, _ = craft_record(
        gcat(casper, subsatellite),
        [],
        [],
        [Chronicle("Apollo 16", "1972-04-16", "Crewed Lunar Landing", None)],
    )
    by_name = {c["name"]: c for c in craft}
    assert by_name["Casper"]["crewed"] is True
    assert by_name["Apollo 16 Subsatellite"]["crewed"] is False


def test_a_craft_designated_the_old_way_links_nssdca_under_the_chronicle_s_id() -> None:
    # Given Luna 1, "1959 MU 1" to GCAT, found in the chronology by its launch day.
    luna = (
        "D00002\t1959 MU\t1959 MU 1\tP   D\tAMS Luna-1\t1959 Jan  2\t-\t1959 Jan  3"
        "\tEarth\t1959 Jan  4\tEO\tHCO\tOKB1\tSU"
    )
    craft, _ = craft_record(
        gcat(luna), [], [], [Chronicle("Luna 1", "1959-01-02", "Lunar Flyby", "1959-012A")]
    )
    # Then NSSDCA's page is the one the chronology links.
    assert craft[0]["nssdc"] == "1959-012A"


def test_an_orbiter_found_by_its_own_designation_keeps_it() -> None:
    # Given Venera 9's orbiter, the chronology linking its lander first and both in its text.
    orbiter = (
        "D00480\t1975-050\t1975-050A\tP   D\tVenera-9\t1975 Jun  8\t-\t1975 Jun  8"
        "\tEarth\t1975 Jun 10\tEO\tHCO\tLA\tSU"
    )
    craft, _ = craft_record(
        gcat(orbiter),
        [],
        [],
        [
            Chronicle(
                "Venera 9",
                "1975-06-08",
                "Venus Orbiter and Lander",
                "1975-050D",
                ("1975-050A", "1975-050D"),
            )
        ],
    )
    # Then the orbiter links its own page, not the lander's.
    assert craft[0]["nssdc"] == "1975-050A"


def test_a_part_nssdca_has_no_page_for_links_its_carrier_s() -> None:
    # Given Eagle, and its ascent stage, which left the Moon from the descent stage (a lander).
    ascent = (
        "D01001\t1969-U01\t1969-U01\tP   D\tEagle\t1969 Jul 21\tD00271\t1969 Jul 21"
        "\tLuna\t1969 Jul 21\tEO\tLuna\tNASA\tUS"
    )
    descent = {
        "JCAT": "D00271",
        "Piece": "1969-059",
        "World": "Luna",
        "Lat": "0.7",
        "Lon": "23.4",
        "LandDate": "1969 Jul 20",
        "LSite": "Statio Tranquillitatis",
    }
    craft, _ = craft_record(
        gcat(COLUMBIA, EAGLE, ascent),
        [],
        [descent],
        [Chronicle("Apollo 11", "1969-07-16", "Crewed Lunar Landing", "1969-059A")],
    )
    by_id = {c["id"]: c for c in craft}
    # Then the ascent stage links Apollo 11's page, the craft launched with its descent stage.
    assert by_id["D01001"]["nssdc"] == "1969-059A"
    # And the lander keeps its own.
    assert by_id["D00274"]["nssdc"] == "1969-059C"


def test_a_craft_one_chronicle_names_is_not_taken_by_another_launched_that_day() -> None:
    # Given Mariner 7 and a Soviet probe lost at launch the same day, which GCAT does not list.
    mariner = (
        "D00281\t1969-030\t1969-030A\tP   D\tMariner 7\t1969 Mar 27\t-\t1969 Mar 27"
        "\tEarth\t1969 Mar 29\tEO\tHCO\tJPL\tUS"
    )
    craft, never = craft_record(
        gcat(mariner),
        [],
        [],
        [
            Chronicle("Mariner 7", "1969-03-27", "Mars Flyby", "1969-030A"),
            Chronicle(
                "Mars 1969A", "1969-03-27", "Attempted Mars Orbiter (Launch Failure)", "MARS69A"
            ),
        ],
    )
    # Then Mariner 7 keeps its page, and the lost probe is among those that never left.
    assert craft[0]["nssdc"] == "1969-030A"
    assert [n["name"] for n in never] == ["Mars 1969A"]


def test_a_craft_launched_again_from_the_moon_links_its_launch_s_page() -> None:
    # Given Luna 16's return capsule, as launched and as it left the Moon.
    launched = (
        "D00337\t1970-072\t1970-072A\tPX  D\tLuna-16 VA\t1970 Sep 12\t-\t1970 Sep 12"
        "\tEarth\t1970 Sep 13\tEO\tLuna\tLA\tSU"
    )
    left = (
        "D01058\t1970-U01\t1970-U01\tP   D\tLuna-16 VA\t1970 Sep 21\tD01057\t1970 Sep 21"
        "\tLuna\t1970 Sep 21\tEO\tEarth\tLA\tSU"
    )
    craft, _ = craft_record(gcat(launched, left), [], [], [])
    # Then the capsule leaving the Moon links the page of its launch.
    assert {c["id"]: c["nssdc"] for c in craft} == {"D00337": "1970-072A", "D01058": "1970-072A"}


def test_pioneer_5_which_the_chronology_leaves_out_links_nssdca_s_page() -> None:
    pioneer = (
        "D00006\t1960 ALP\t1960 ALP 1\tP   D\tPioneer V\t1960 Mar 11\t-\t1960 Mar 11"
        "\tEarth\t1960 Mar 12\tEO\tHCO\tSTL\tUS"
    )
    craft, _ = craft_record(gcat(pioneer), [], [], [])
    assert craft[0]["nssdc"] == "1960-001A"


def test_a_craft_nssdca_never_catalogued_has_no_page() -> None:
    # Given a probe lost at launch, with no designation NSSDCA uses and nothing that carried it.
    lost = (
        "D00009\t1960-U01\t1960-U01\tP   D\t[Luna-4]\t1960 Apr 15\t-\t1960 Apr 15"
        "\tEarth\t1960 Apr 15\tEO\tHCO\tOKB1\tSU"
    )
    craft, _ = craft_record(gcat(lost), [], [], [])
    assert craft[0]["nssdc"] is None
