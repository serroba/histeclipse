"""Tests for what a genome card lists of each ancient individual (AADR)."""

from histeclipse_pipeline.aadr_people import (
    CHUNK,
    data_of,
    dated_by,
    kin_of,
    people_files,
    person_of,
    person_row,
    place_of,
    repository_of,
    sex_of,
)

COLUMNS = 49


def sunghir() -> list[str]:
    row = [".."] * COLUMNS
    row[2] = "Sunghir1"
    row[4] = "multiple elements (molar; long bone)"
    row[8] = "ENA:PRJEB22592"
    row[9] = "Direct: IntCal20"
    row[12] = "32326-30080 calBCE (28890±430 BP, OxA-X-2464-12)"
    row[15] = "Sunghir (Vladimir Oblast, Vlaidmir Municipality)"
    row[16] = "Russia"
    row[21] = "Shotgun"
    row[23] = "1.46140188"
    row[26] = "831679"
    row[30] = "M"
    row[32] = "20.797301"
    row[35] = "C1a"
    row[38] = "U8c"
    return row


def test_a_row_as_the_person_a_card_lists() -> None:
    person = person_of(sunghir())
    assert person_row(person) == [
        "Sunghir1",
        "Sunghir, Russia",
        "multiple elements (molar; long bone)",
        "32326-30080 calBCE (28890±430 BP, OxA-X-2464-12)",
        "radiocarbon on the remains",
        "male",
        "C1a",
        "U8c",
        "shotgun",
        1.5,
        831679,
        None,
        20.8,
        "PRJEB22592",
        None,
    ]


def test_blanks_are_left_out_and_a_manual_y_call_wins() -> None:
    row = sunghir()
    row[4] = "unknown"
    row[23] = "0"
    row[26] = "n/a"
    row[32] = "n/a (<300K SNPs)"
    row[36] = "C1a2"
    row[13] = "adult;  30-38 yrs"
    person = person_of(row)
    assert person.element is None
    assert person.coverage is None
    assert person.snps is None
    assert person.roh is None
    assert person.y == "C1a2"
    assert person.age == "adult; 30-38 yrs"


def test_places_drop_the_districts() -> None:
    assert place_of("Wartau (St  Gallen, Sankt Gallen)", "Switzerland") == "Wartau, Switzerland"
    assert place_of("..", "Italy") == "Italy"
    assert place_of("..", "..") == "Unknown place"


def test_how_a_date_was_got() -> None:
    assert dated_by("Direct (WARNING MISSING LAB CODE)") == "radiocarbon on the remains"
    assert dated_by("Context: Archaeological") == "archaeological context"
    assert dated_by("Method: genetic") == "Method: genetic"
    assert dated_by("..") is None


def test_genetic_sex() -> None:
    assert sex_of("F (XXX)") == "female"
    assert sex_of("M") == "male"
    assert sex_of("U") is None


def test_kinds_of_data() -> None:
    assert data_of("1240k") == "1240k capture"
    assert data_of("Shotgun pulled down only on 1240k autosomal targets") == "shotgun"
    assert data_of("1240k sequenced so deeply it is effectively also Shotgun") == "1240k capture"
    assert data_of("ExomeCapture") == "ExomeCapture"
    assert data_of("..") is None


def test_relatives_first_degree_by_name_then_how_many_more() -> None:
    family = (
        "1.0d siblings:MGS036:MGS471,1.0d mother-daughter(orderUnknown):MGS037:MGS471,"
        "1.0d:MGS353:MGS471,3.0d:LEO056:MGS471,garbled,1.0d:MGS471"
    )
    assert kin_of("MGS471", family) == (
        "siblings MGS036; mother-daughter MGS037; first-degree MGS353; 1 more relative"
    )
    assert kin_of("A", "2.0d:A:B,3.0d:C:A") == "2 relatives, second-degree or further"
    assert kin_of("A", "..") is None
    many = ",".join(f"1.0d brothers:A:B{index}" for index in range(6))
    assert kin_of("A", many) == (
        "brothers B0; brothers B1; brothers B2; brothers B3; 2 more relatives"
    )


def test_the_archive_accession() -> None:
    assert repository_of("SRA:the BioProject PRJNA645054") == "PRJNA645054"
    assert repository_of("EMBL-EBI:PRJEB55077") == "PRJEB55077"
    assert repository_of("..") is None


def test_people_in_files_of_a_chunk_each() -> None:
    people = [person_of(sunghir())] * (CHUNK + 1)
    files = people_files(people)
    assert [file["first"] for file in files] == [0, CHUNK]
    assert files[1]["people"] == [person_row(people[0])]
