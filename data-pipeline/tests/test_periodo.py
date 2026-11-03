"""Tests for PeriodO's named periods, by country."""

from typing import TYPE_CHECKING

from histeclipse_pipeline.periodo import _get, citation, periods_file, periods_of  # pyright: ignore[reportPrivateUsage]

if TYPE_CHECKING:
    from histeclipse_pipeline.sky import Json

DUMP: Json = {
    "authorities": {
        "a1": {
            "source": {
                "partOf": {
                    "title": "Life in biblical Israel",
                    "yearPublished": 2001,
                    "creators": [{"name": "King, Philip J."}, {"name": "Stager, Lawrence E."}],
                }
            },
            "periods": {
                "p1": {
                    "label": "Early Bronze",
                    "start": {"in": {"year": "-3499"}},
                    "stop": {"in": {"year": "-2249"}},
                    "spatialCoverage": [
                        {"id": "http://www.wikidata.org/entity/Q801"},
                        {"id": "http://www.wikidata.org/entity/Q999"},
                    ],
                },
                "p2": {"label": "Undated", "start": {"in": {}}, "stop": {"in": {"year": "1"}}},
                "p3": {
                    "label": "Elsewhere",
                    "start": {"in": {"earliestYear": "100"}},
                    "stop": {"in": {"latestYear": "200"}},
                    "spatialCoverage": [{"id": "http://www.wikidata.org/entity/Q1"}],
                },
            },
        },
        "a2": {"source": {"title": "An atlas"}, "periods": {}},
    }
}


def test_cites_sources_shortly() -> None:
    assert citation(_get(DUMP, "authorities", "a1")) == "King & Stager 2001"
    assert citation({"source": {"title": "An atlas"}}) == "An atlas"
    assert (
        citation(
            {
                "source": {
                    "creators": [{"name": "A"}, {"name": "B"}, {"name": "C"}],
                    "yearPublished": 1999,
                }
            }
        )
        == "A et al. 1999"
    )
    assert citation(None) == "PeriodO"


def test_keeps_dated_periods_that_cover_a_known_country() -> None:
    citations, periods = periods_of(DUMP, {"Q801": 0})
    assert citations == ["King & Stager 2001"]
    assert periods == [["Early Bronze", -3499, -2249, 0, [0]]]


def test_the_site_file() -> None:
    ring = [(34.0, 29.0), (36.0, 29.0), (36.0, 33.0), (34.0, 29.0)]
    data = periods_file([("Q801", "Israel", [ring])], DUMP, "2026-11-03")
    assert data["countries"] == [
        {"name": "Israel", "rings": [[3400, 2900, 3600, 2900, 3600, 3300, 3400, 2900]]}
    ]
    assert data["periods"] == [["Early Bronze", -3499, -2249, 0, [0]]]
    assert data["accessed"] == "2026-11-03"
