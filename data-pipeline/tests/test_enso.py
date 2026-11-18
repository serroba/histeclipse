"""Tests for NOAA's ENSO indices: CPC's season files, and the episodes each index names."""

from typing import TYPE_CHECKING

import pytest

from histeclipse_pipeline.enso import (
    ONI,
    RONI,
    Index,
    episodes,
    month_text,
    months_from,
    parse_index,
    phase_of,
    write_enso,
)
from tests.json_values import read_json

if TYPE_CHECKING:
    from pathlib import Path

RONI_TEXT = """SEAS   YR  ANOM
DJF  1950 -1.19
JFM  1950 -1.08

"""
ONI_TEXT = """ SEAS  YR   TOTAL   ANOM
  OND 1950  25.01  -1.32
  NDJ 1950  25.36  -1.20
  DJF 1951  25.40  -0.90
"""


def test_reads_a_season_file_at_each_seasons_middle_month() -> None:
    assert parse_index(RONI_TEXT) == Index((1950, 1), [-1.19, -1.08])


def test_reads_the_last_column_and_runs_over_the_new_year() -> None:
    # OND 1950 is November 1950; NDJ 1950 is December 1950; DJF 1951 is January 1951.
    assert parse_index(ONI_TEXT) == Index((1950, 11), [-1.32, -1.2, -0.9])


def test_refuses_a_gap_an_unknown_season_or_no_seasons() -> None:
    with pytest.raises(ValueError, match="expected 1950-02"):
        _ = parse_index("SEAS YR ANOM\nDJF 1950 0.1\nFMA 1950 0.2\n")
    with pytest.raises(ValueError, match="unknown season"):
        _ = parse_index("SEAS YR ANOM\nXYZ 1950 0.1\n")
    with pytest.raises(ValueError, match="no seasons"):
        _ = parse_index("SEAS YR ANOM\n")


def test_counts_a_value_by_its_printed_tenth() -> None:
    # -0.46 prints as -0.5 in CPC's table and counts; 0.44 prints as 0.4 and does not.
    assert phase_of(-0.46) == "laNina"
    assert phase_of(0.45) == "elNino"
    assert phase_of(0.44) is None
    assert phase_of(0.0) is None


def test_lists_months_over_the_new_year() -> None:
    assert [month_text(each) for each in months_from((2025, 11), 3)] == [
        "2025-11",
        "2025-12",
        "2026-01",
    ]


def test_names_runs_of_five_seasons_and_marks_one_that_reaches_the_end() -> None:
    values = [0.6, 0.9, 1.4, 0.8, 0.5, 0.2, -0.5, -0.7, -0.6, -0.5, 0.1, 0.7, 0.9, 1.2, 1.5, 2.0]
    found = episodes(Index((1997, 4), values))
    assert [(each.phase, month_text(each.first), month_text(each.last)) for each in found] == [
        ("elNino", "1997-04", "1997-08"),
        ("elNino", "1998-03", "1998-07"),
    ]
    first, last = found
    assert (first.peak, month_text(first.peak_at), first.ongoing) == (1.4, "1997-06", False)
    assert (last.peak, month_text(last.peak_at), last.ongoing) == (2.0, "1998-07", True)


def test_finds_la_ninas_deepest_value() -> None:
    (found,) = episodes(Index((2020, 8), [-0.5, -0.9, -1.3, -1.2, -1.0]))
    assert (found.phase, found.peak, month_text(found.peak_at)) == ("laNina", -1.3, "2020-10")


def test_writes_both_indices_with_their_episodes(tmp_path: Path) -> None:
    roni = Index((2023, 5), [0.5, 0.8, 1.1, 1.3, 1.6, 1.8, 0.2])
    oni = Index((2023, 5), [0.5, 0.8, 1.1, 0.4, 1.6, 1.8, 1.9, 1.7, 1.5])
    count = write_enso([(RONI, roni), (ONI, oni)], tmp_path, "2026-11-19")
    assert count == 2
    written = read_json(tmp_path / "index.json")
    assert isinstance(written, dict)
    assert written["schemaVersion"] == 1
    assert written["accessed"] == "2026-11-19"
    assert written["threshold"] == 0.5
    assert written["seasons"] == 5
    indices = written["indices"]
    assert isinstance(indices, list)
    relative, classic = indices
    assert isinstance(relative, dict)
    assert isinstance(classic, dict)
    assert relative["id"] == "roni"
    assert relative["first"] == "2023-05"
    assert relative["values"] == [0.5, 0.8, 1.1, 1.3, 1.6, 1.8, 0.2]
    assert relative["episodes"] == [
        {"phase": "elNino", "first": "2023-05", "last": "2023-10", "peak": 1.8, "peakAt": "2023-10"}
    ]
    assert classic["id"] == "oni"
    assert classic["episodes"] == [
        {
            "phase": "elNino",
            "first": "2023-09",
            "last": "2024-01",
            "peak": 1.9,
            "peakAt": "2023-11",
            "ongoing": True,
        }
    ]
