"""Tests for the Smithsonian GVP's Holocene volcanoes and eruptions."""

from histeclipse_pipeline.volcanoes import (
    Eruption,
    Volcano,
    astronomical,
    details_file,
    read_eruptions,
    read_volcanoes,
    volcanoes_file,
)

VOLCANOES = {
    "features": [
        {
            "properties": {
                "Volcano_Number": 211020,
                "Volcano_Name": "Vesuvius",
                "Primary_Volcano_Type": "Stratovolcano(es)",
                "Country": "Italy",
                "Latitude": 40.821,
                "Longitude": 14.426,
                "Elevation": 1281,
                "Last_Eruption_Year": 1944,
                "Primary_Photo_Link": "https://volcano.si.edu/gallery/photos/GVP-01531.jpg",
                "Primary_Photo_Caption": "Mount Vesuvius behind the city of Naples.",
                "Primary_Photo_Credit": "Photo by Dan Dzurisin, 1983 (U.S. Geological Survey).",
                "Geological_Summary": "One of the best-known volcanoes.",
            }
        },
        {
            "properties": {
                "Volcano_Number": 1,
                "Volcano_Name": "Quiet field",
                "Primary_Volcano_Type": "Volcanic field",
                "Country": "Nowhere",
                "Latitude": -1.5,
                "Longitude": 2.5,
                "Elevation": None,
                "Last_Eruption_Year": -8300,
                "Primary_Photo_Link": None,
                "Geological_Summary": None,
            }
        },
    ]
}

ERUPTIONS = {
    "features": [
        {
            "properties": {
                "Volcano_Number": 211020,
                "Activity_Type": "Confirmed Eruption",
                "ExplosivityIndexMax": 5,
                "StartEvidenceMethod": "Observations: Reported",
                "StartDateYear": 79,
                "StartDateYearUncertainty": None,
                "StartDateMonth": 10,
                "StartDateDay": 24,
            }
        },
        {
            "properties": {
                "Volcano_Number": 211020,
                "Activity_Type": "Uncertain Eruption",
                "ExplosivityIndexMax": None,
                "StartEvidenceMethod": None,
                "StartDateYear": -217,
                "StartDateYearUncertainty": 10,
                "StartDateMonth": 0,
                "StartDateDay": None,
            }
        },
        {"properties": {"Volcano_Number": 1, "StartDateYear": None}},
    ]
}


def test_years_before_the_common_era_become_astronomical() -> None:
    assert astronomical(-217) == -216
    assert astronomical(-1) == 0
    assert astronomical(79) == 79


def test_reads_each_volcano_with_its_photo_if_it_has_one() -> None:
    vesuvius, field = read_volcanoes(VOLCANOES)
    assert vesuvius == Volcano(
        number=211020,
        name="Vesuvius",
        kind="Stratovolcano(es)",
        country="Italy",
        latitude=40.821,
        longitude=14.426,
        elevation_m=1281,
        last_year=1944,
        photo=(
            "https://volcano.si.edu/gallery/photos/GVP-01531.jpg",
            "Mount Vesuvius behind the city of Naples.",
            "Photo by Dan Dzurisin, 1983 (U.S. Geological Survey).",
        ),
        summary="One of the best-known volcanoes.",
    )
    assert (field.elevation_m, field.last_year, field.photo, field.summary) == (
        None,
        -8299,
        None,
        "",
    )


def test_reads_the_dated_eruptions_oldest_first() -> None:
    assert read_eruptions(ERUPTIONS) == [
        Eruption(211020, -216, 10, 0, 0, None, confirmed=False, evidence=""),
        Eruption(211020, 79, 0, 10, 24, 5, confirmed=True, evidence="Observations: Reported"),
    ]


def test_the_site_files_hold_compact_eruptions_and_the_cards_details_apart() -> None:
    volcanoes = read_volcanoes(VOLCANOES)
    data = volcanoes_file(volcanoes, read_eruptions(ERUPTIONS), "2026-11-04")
    assert data["evidence"] == ["Observations: Reported"]
    assert data["eruptions"] == [
        [211020, -216, 10, 0, 0, -1, 0, -1],
        [211020, 79, 0, 10, 24, 5, 1, 0],
    ]
    assert data["volcanoes"] == [
        {
            "number": 211020,
            "name": "Vesuvius",
            "kind": "Stratovolcano(es)",
            "country": "Italy",
            "latitude": 40.821,
            "longitude": 14.426,
            "elevationM": 1281,
            "lastYear": 1944,
        },
        {
            "number": 1,
            "name": "Quiet field",
            "kind": "Volcanic field",
            "country": "Nowhere",
            "latitude": -1.5,
            "longitude": 2.5,
            "elevationM": None,
            "lastYear": -8299,
        },
    ]
    assert details_file(volcanoes)["volcanoes"] == {
        "211020": {
            "summary": "One of the best-known volcanoes.",
            "photo": {
                "src": "https://volcano.si.edu/gallery/photos/GVP-01531.jpg",
                "caption": "Mount Vesuvius behind the city of Naples.",
                "credit": "Photo by Dan Dzurisin, 1983 (U.S. Geological Survey).",
            },
        }
    }
