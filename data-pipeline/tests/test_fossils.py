"""Tests for the Paleobiology Database's fossil occurrences."""

from histeclipse_pipeline.fossils import Occurrence, counts, fossils_file, parse_occurrences

CSV = """"occurrence_no","accepted_name","max_ma","min_ma","paleomodel","paleolng","paleolat"
"1","Tyrannosaurus rex","72.1","66","scotese","-80.2","51.3"
"2","Triceratops","68","66","scotese","-79.0","50.1"
"3","Undated","","","scotese","10","10"
"4","Unplaced","70","66","scotese","",""
"""


def test_reads_occurrences_with_an_age_range_and_a_place() -> None:
    assert parse_occurrences(CSV) == [
        Occurrence(max_ma=72.1, min_ma=66.0, paleolat=51.3, paleolng=-80.2),
        Occurrence(max_ma=68.0, min_ma=66.0, paleolat=50.1, paleolng=-79.0),
    ]


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


def test_the_site_file_lists_each_group_with_its_counts() -> None:
    data = fossils_file(
        [("dinosaurs", "Non-avian dinosaurs", 2, counts(parse_occurrences(CSV)))], "2026-11-03"
    )
    assert data["accessed"] == "2026-11-03"
    assert data["groups"] == [
        {
            "id": "dinosaurs",
            "name": "Non-avian dinosaurs",
            "occurrences": 2,
            "counts": [[65, 50, -85, 1], [65, 50, -80, 1]],
        }
    ]
