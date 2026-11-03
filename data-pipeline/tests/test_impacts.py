"""Tests for the Impact Earth Database's craters and deposits."""

import pytest

from histeclipse_pipeline.impacts import (
    Impact,
    age_range,
    diameter,
    impacts_file,
    misplaced,
    positions_then,
    read_impacts,
    steps_needed,
)


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("66.038 ± 0.098", (66.136, 65.94)),
        ("0.02±0.002", (0.022, 0.018)),
        ("450 - 650", (650.0, 450.0)),
        ("~541 - 635", (635.0, 541.0)),
        ("2.3\u20132.7 Ma", (2.7, 2.3)),
        ("<66", (66.0, 0.0)),
        ("≤ 383", (383.0, 0.0)),
        ("<0.003?", (0.003, 0.0)),
        ("~85", (85.0, 85.0)),
        ("\u223c8\u2009Ma ", (8.0, 8.0)),
        ("3243 ± 4 Ma (Kruener et al., 1991)", (3247.0, 3239.0)),
        ("2490 (Krull Davatzes et al., 2015)", (2490.0, 2490.0)),
        ("2630000000", (2630.0, 2630.0)),
        ("Recent - 12 Feb 1947", (0.0, 0.0)),
        ("Middle Cambrian", None),
        ("Unknown", None),
        ("N/A", None),
    ],
)
def test_reads_an_age_as_written_into_the_range_it_allows(
    text: str, expected: tuple[float, float] | None
) -> None:
    found = age_range(text)
    if expected is None:
        assert found is None
    else:
        assert found == pytest.approx(expected)


def test_reads_a_diameter_as_the_larger_of_a_range() -> None:
    assert diameter("180 km") == 180.0
    assert diameter("1.5-1.8 km") == 1.8
    assert diameter(" km") is None


LISTING: dict[str, object] = {
    "list": [
        {
            "id": "47",
            "name": "Chicxulub ",
            "lat": "21.4",
            "lng": "-89.516667",
            "type": "Mixed\r",
            "sub_type": "Carbonates\r,Crystalline\r",
            "age": "66.038 ± 0.098",
            "country": "Mexico\r",
            "region": "Yucatán\r",
            "radius": "180 km",
        },
        {
            "id": "244",
            "name": "S6",
            "lat": "40.76",
            "lng": "73.98",
            "type": "Not Applicable",
            "sub_type": None,
            "age": "Unknown",
            "country": "South Africa\r",
            "region": None,
            "radius": " km",
        },
    ]
}


def test_reads_each_impact_with_its_text_cleaned() -> None:
    chicxulub, s6 = read_impacts("hypervelocity", LISTING)
    assert chicxulub == Impact(
        id=47,
        kind="hypervelocity",
        name="Chicxulub",
        country="Mexico",
        region="Yucatán",
        target="Mixed (Carbonates, Crystalline)",
        latitude=21.4,
        longitude=-89.516667,
        age="66.038 ± 0.098",
        older_ma=chicxulub.older_ma,
        younger_ma=chicxulub.younger_ma,
        diameter_km=180.0,
    )
    assert (chicxulub.older_ma, chicxulub.younger_ma) == pytest.approx((66.136, 65.94))
    assert (s6.target, s6.region, s6.older_ma, s6.diameter_km) == ("Not Applicable", "", None, None)


def test_a_place_in_the_wrong_hemisphere_for_its_country_is_misplaced() -> None:
    chicxulub, s6 = read_impacts("hypervelocity", LISTING)
    assert not misplaced(chicxulub)
    assert misplaced(s6)


def test_each_impact_is_carried_back_to_the_step_past_its_age() -> None:
    chicxulub, s6 = read_impacts("hypervelocity", LISTING)
    asked: list[tuple[int, int]] = []

    def reconstruct(points: list[tuple[float, float]], ma: int) -> list[tuple[float, float] | None]:
        asked.append((ma, len(points)))
        return [None if ma == 70 else (lat - ma / 10, lon) for lat, lon in points]

    assert steps_needed(chicxulub) == 15
    assert steps_needed(s6) == 0
    then = positions_then([chicxulub, s6], reconstruct)
    # Chicxulub from today to 70 Ma, where this model has it on no plate; S6 only as it is.
    assert asked == [(ma, 1) for ma in range(5, 75, 5)]
    assert then[47][0] == (21.4, -89.516667)
    assert then[47][1] == pytest.approx((20.9, -89.516667))
    assert then[47][-1] is None
    assert then[244] == [(40.76, 73.98)]


def test_the_site_file_keeps_ages_as_written_and_says_what_was_left_out() -> None:
    chicxulub, s6 = read_impacts("hypervelocity", LISTING)
    data = impacts_file([chicxulub], {47: [(21.4, -89.516667), None]}, [s6], "2026-11-04")
    assert data["accessed"] == "2026-11-04"
    assert data["impacts"] == [
        {
            "id": 47,
            "kind": "hypervelocity",
            "name": "Chicxulub",
            "country": "Mexico",
            "region": "Yucatán",
            "target": "Mixed (Carbonates, Crystalline)",
            "age": "66.038 ± 0.098",
            "olderMa": pytest.approx(66.136),
            "youngerMa": pytest.approx(65.94),
            "diameterKm": 180.0,
            "then": [[2140, -8952], None],
        }
    ]
    assert data["leftOut"] == [
        {
            "name": "S6",
            "kind": "hypervelocity",
            "why": "its place (40.76, 73.98) is not in South Africa, the country it names",
        }
    ]
