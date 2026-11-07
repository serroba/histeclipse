"""Where each time zone is, from the tz database's tables."""

from __future__ import annotations

import pytest

from histeclipse_pipeline.timezones import (
    parse_coordinates,
    place_of,
    read_links,
    read_zone_tab,
    timezones_file,
)

ZONE_TAB = """# tzdb timezone descriptions
#
#codes\tcoordinates\tTZ\tcomments
AU\t-3352+15113\tAustralia/Sydney\tNew South Wales (most areas)
IN\t+2232+08822\tAsia/Kolkata
AQ\t-720041+0023206\tAntarctica/Troll\tTroll
"""

BACKWARD = """# Links for backward compatibility
Link\tAsia/Kolkata\tAsia/Calcutta
Link\tAustralia/Sydney\tAustralia/NSW\t#= a note
Link\tAustralia/NSW\tAustralia/Old_NSW
Link\tNowhere/Lost\tLost/Alias
"""


def test_parses_degrees_and_minutes_and_seconds() -> None:
    assert parse_coordinates("-3352+15113") == pytest.approx((-33.8667, 151.2167), abs=1e-4)
    assert parse_coordinates("-720041+0023206") == pytest.approx((-72.0114, 2.535), abs=1e-4)


def test_rejects_what_is_not_iso_6709() -> None:
    with pytest.raises(ValueError, match="ISO 6709"):
        _ = parse_coordinates("33S 151E")


def test_reads_each_zone_skipping_comments() -> None:
    zones = read_zone_tab(ZONE_TAB)
    assert set(zones) == {"Australia/Sydney", "Asia/Kolkata", "Antarctica/Troll"}


def test_rejects_a_line_too_short() -> None:
    with pytest.raises(ValueError, match="too few fields"):
        _ = read_zone_tab("AU\t-3352+15113\n")


def test_follows_aliases_and_aliases_of_aliases() -> None:
    zones = read_zone_tab(ZONE_TAB)
    links = read_links(BACKWARD)
    assert links["Asia/Calcutta"] == "Asia/Kolkata"
    assert place_of("Asia/Calcutta", zones, links) == zones["Asia/Kolkata"]
    assert place_of("Australia/Old_NSW", zones, links) == zones["Australia/Sydney"]
    assert place_of("Lost/Alias", zones, links) is None
    assert place_of("Etc/UTC", zones, links) is None


def test_stops_on_a_loop_of_aliases() -> None:
    links = {"A": "B", "B": "A"}
    assert place_of("A", {}, links) is None


def test_writes_every_zone_and_alias_with_a_place_to_a_tenth_of_a_degree() -> None:
    data = timezones_file(read_zone_tab(ZONE_TAB), read_links(BACKWARD), "2026f", "2026-11-07")
    places = data["zones"]
    assert isinstance(places, dict)
    assert places["Australia/Sydney"] == [-33.9, 151.2]
    assert places["Asia/Calcutta"] == [22.5, 88.4]
    assert "Lost/Alias" not in places
    assert (
        data["credit"] == "The tz database (IANA), version 2026f, public domain: each zone's place"
    )
