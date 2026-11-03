"""Tests for the Paleobiology Database's fossil occurrences."""

from histeclipse_pipeline.fossils import (
    Occurrence,
    counts,
    fossils_file,
    genera,
    parse_occurrences,
)

CSV = """"occurrence_no","accepted_name","max_ma","min_ma","paleomodel","paleolng","paleolat"
"1","Tyrannosaurus rex","72.1","66","scotese","-80.2","51.3"
"2","Triceratops","68","66","scotese","-79.0","50.1"
"3","Undated","","","scotese","10","10"
"4","Unplaced","70","66","scotese","",""
"""

# With the accepted name and rank, as the site's query asks for them.
NAMED = """"occurrence_no","accepted_name","accepted_rank","max_ma","min_ma","paleolng","paleolat"
"1","Tyrannosaurus rex","species","72.1","66","-80.2","51.3"
"2","Tyrannosaurus","genus","70","66","-80.2","51.3"
"3","Triceratops horridus","species","68","66","-81.0","51.1"
"4","Tyrannosauridae","family","70","66","-80.2","51.3"
"""


def test_reads_occurrences_with_an_age_range_and_a_place() -> None:
    assert parse_occurrences(CSV) == [
        Occurrence(max_ma=72.1, min_ma=66.0, paleolat=51.3, paleolng=-80.2),
        Occurrence(max_ma=68.0, min_ma=66.0, paleolat=50.1, paleolng=-79.0),
    ]


def test_keeps_the_genus_of_a_find_named_to_a_genus_or_finer() -> None:
    assert [occurrence.genus for occurrence in parse_occurrences(NAMED)] == [
        "Tyrannosaurus",
        "Tyrannosaurus",
        "Triceratops",
        None,
    ]


def test_lists_each_cells_most_found_genera() -> None:
    found = parse_occurrences(NAMED)
    assert genera(found) == {(65, 50, -85): [("Tyrannosaurus", 2), ("Triceratops", 1)]}
    assert counts(found) == {(65, 50, -85): 4}


def test_counts_each_at_its_middle_age_by_step_and_cell() -> None:
    counted = counts(
        [
            *parse_occurrences(CSV),
            Occurrence(max_ma=200.0, min_ma=150.0, paleolat=0.0, paleolng=0.0),  # too vague
            Occurrence(max_ma=5.0, min_ma=4.0, paleolat=90.0, paleolng=180.0),
        ]
    )
    # 69.05 Ma and 67 Ma both fall in the step from 65 Ma; cells by south-west corner.
    assert counted == {(65, 50, -85): 1, (65, 50, -80): 1, (0, 85, 175): 1}


def test_the_site_file_lists_each_group_with_its_counts_and_genera() -> None:
    found = parse_occurrences(CSV) + parse_occurrences(NAMED)
    data = fossils_file(
        [("dinosaurs", "Non-avian dinosaurs", 6, counts(found), genera(found))], "2026-11-03"
    )
    assert data["schemaVersion"] == 2
    assert data["accessed"] == "2026-11-03"
    assert data["genera"] == ["Triceratops", "Tyrannosaurus"]
    # Tyrannosaurus leads one cell only: fewer than it takes to be looked up for a picture.
    assert data["wikipedia"] == []
    assert data["groups"] == [
        {
            "id": "dinosaurs",
            "name": "Non-avian dinosaurs",
            "occurrences": 6,
            "counts": [[65, 50, -85, 5, [[1, 2], [0, 1]]], [65, 50, -80, 1, []]],
        }
    ]
