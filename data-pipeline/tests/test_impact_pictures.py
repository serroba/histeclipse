"""Tests for the impact craters' pages and photos."""

from histeclipse_pipeline.impact_pictures import (
    craters_from,
    distance_km,
    guessed,
    impact_pictures,
    nearest,
    photo_only,
    plain_name,
)
from histeclipse_pipeline.pictures import Picture

CRATERS = {
    "Meteor Crater": (35.03, -111.02),
    "Mjølnir crater": (73.8, 29.67),
    "Manicouagan Reservoir": (51.38, -68.7),
}


def summary(title: str, description: str, lat: float, lon: float) -> dict[str, object]:
    return {
        "type": "standard",
        "description": description,
        "coordinates": {"lat": lat, "lon": lon},
        "titles": {"canonical": title.replace(" ", "_")},
        "content_urls": {"desktop": {"page": f"https://en.wikipedia.org/wiki/{title}"}},
    }


PAGES: dict[str, object] = {
    "Lonar_crater": summary("Lonar Lake", "Crater lake in India", 19.98, 76.51),
    "Lonar_Lake": summary("Lonar Lake", "Crater lake in India", 19.98, 76.51),
    "Paris": summary("Paris", "Capital of France", 48.86, 2.35),
    "Far_crater": summary("Far crater", "Impact crater", 0.0, 0.0),
    "Meteor_Crater": summary("Meteor Crater", "Impact crater in Arizona", 35.03, -111.02),
    "Mjølnir_crater": summary("Mjølnir crater", "Impact crater in the Barents Sea", 73.8, 29.67),
}


def fetch(url: str) -> object:
    for key, page in PAGES.items():
        if url.endswith(key.replace("ø", "%C3%B8")):
            return page
    return {}


def impact(
    id_: int, name: str, lat: float, lon: float, diameter: float | None = 10.0
) -> dict[str, object]:
    return {
        "id": id_,
        "name": name,
        "diameterKm": diameter,
        "then": [[round(lat * 100), round(lon * 100)]],
    }


def test_names_in_plain_letters_and_distances_along_the_ground() -> None:
    assert plain_name("Mjølnir crater") == "mjolnircrater"
    assert plain_name("Keurusselkä") == "keurusselka"
    assert round(distance_km((0.0, 0.0), (0.0, 1.0))) == 111


def test_reads_wikidatas_craters() -> None:
    answer = {
        "results": {
            "bindings": [
                {
                    "coord": {"value": "Point(-111.02 35.03)"},
                    "article": {"value": "https://en.wikipedia.org/wiki/Meteor_Crater"},
                },
                {
                    "coord": {"value": "nowhere"},
                    "article": {"value": "https://en.wikipedia.org/wiki/Lost"},
                },
            ]
        }
    }
    assert craters_from(answer) == {"Meteor Crater": (35.03, -111.02)}


def test_the_nearest_crater_in_reach_named_alike() -> None:
    assert nearest("Mjolnir", (73.5, 29.5), 40.0, CRATERS) == "Mjølnir crater"
    assert nearest("Manicouagan", (51.4, -68.7), 100.0, CRATERS) == "Manicouagan Reservoir"
    assert nearest("Manicouagan", (10.0, 10.0), 100.0, CRATERS) is None
    assert nearest("Lonar", (19.98, 76.51), 1.8, CRATERS) is None


def test_a_page_by_its_name_when_it_says_crater_and_lies_in_reach() -> None:
    assert guessed("Lonar", (19.98, 76.51), 1.8, fetch) == "Lonar Lake"
    assert guessed("Paris", (48.86, 2.35), 1.0, fetch) is None
    asked: list[str] = []

    def record(url: str) -> object:
        asked.append(url)
        return {}

    assert guessed("Senzeille/Hony", (50.2, 4.5), None, record) is None
    assert all("Senzeille%2FHony" in url for url in asked)
    assert guessed("Far", (40.0, 40.0), 1.0, fetch) is None
    assert guessed("Barringer", (35.03, -111.02), 1.2, fetch) == "Meteor Crater"


def shot(file: str, licence: str = "CC BY 4.0", page: str = "p") -> Picture:
    return Picture(
        page, "s", 1, 1, "a", licence, None, f"https://commons.wikimedia.org/wiki/File:{file}"
    )


def test_keeps_free_photos_of_the_place_only() -> None:
    for kept in ("Lonar.jpg", "Henbury_Meteorite_Crater.jpg", "Boxhole_meteorite_crater.jpg"):
        assert photo_only(shot(kept)) == shot(kept)
    assert photo_only(shot("Kaali.jpg", "Public domain")) == shot("Kaali.jpg", "Public domain")
    for left in (
        "Lonar_location_map.svg",
        "Odessa_meteorite.jpg",
        "Campo_del_Cielo_meteorite,_NHM,_London.jpg",
        "Ilyinets_Crater_Meteorite_Stamp.jpg",
        "Beaverhead_shatter_cone.jpg",
        "ISS061-E-139042_-_View_of_India.jpg",
        "%D0%98%D0%BC%D0%BF%D0%B0%D0%BA%D1%82%D0%BD%D0%BE%D0%B5_%D1%81%D1%82%D0%B5%D0%BA%D0%BB%D0%BE_%D0%96%D0%B0%D0%BC%D0%B0%D0%BD%D1%88%D0%B8%D0%BD%D0%B8%D1%82.jpg",
    ):
        assert photo_only(shot(left)) == Picture("p")
    assert photo_only(shot("Charlevoix.jpg", "LGPL")) == Picture("p")
    assert photo_only(shot("Ouarkziz.png", "Attribution")) == Picture("p")
    assert photo_only(Picture("p")) == Picture("p")
    assert photo_only(shot("x.jpg", page="https://en.wikipedia.org/wiki/List_of_craters")) is None


def test_each_impact_by_its_id_where_a_page_is_found() -> None:
    impacts = {
        "impacts": [
            impact(10, "Barringer", 35.03, -111.02, 1.2),
            impact(108, "Mjolnir", 73.8, 29.67, 40.0),
            impact(1, "Lonar", 19.98, 76.51, 1.8),
            impact(2, "Nowhere", -10.0, -10.0, None),
        ]
    }
    found = impact_pictures(impacts, CRATERS, fetch)
    assert {key: entry.page for key, entry in found.items()} == {
        "10": "https://en.wikipedia.org/wiki/Meteor Crater",
        "108": "https://en.wikipedia.org/wiki/Mjølnir crater",
        "1": "https://en.wikipedia.org/wiki/Lonar Lake",
    }
