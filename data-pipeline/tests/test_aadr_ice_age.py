"""Tests for the AADR's ice-age people on the Humans layer."""

from histeclipse_pipeline.aadr import HOLOCENE_BP, Genome, ice_age_file
from histeclipse_pipeline.aadr_people import Person


def genome(individual: str, bp: int, group: str = "Russia_Sunghir_UP") -> Genome:
    person = Person(individual, "Sunghir, Russia", *([None] * 13))
    return Genome((56, 40), (56.18, 40.5), bp, group, "Sikora2017", "10.1/s", person)


def test_keeps_the_ice_age_people_not_already_listed_oldest_first() -> None:
    data = ice_age_file(
        [
            genome("Sunghir1", 33210),
            genome("Sunghir2", 34630),
            genome("Holocene", HOLOCENE_BP),
            genome("Ranis", 45880, "Germany_Ranis_IUP"),
        ],
        "AADR",
        "https://doi.org/10.7910/DVN/FFIDCW",
    )
    entry = {
        "latitude": 56.18,
        "longitude": 40.5,
        "group": "Russia_Sunghir_UP",
        "paper": {"name": "Sikora2017", "doi": "10.1/s"},
    }
    assert data["people"] == [
        {"bp": 34630, **entry, "person": ["Sunghir2", "Sunghir, Russia", *([None] * 13)]},
        {"bp": 33210, **entry, "person": ["Sunghir1", "Sunghir, Russia", *([None] * 13)]},
    ]
    assert data["credit"] == "AADR"
