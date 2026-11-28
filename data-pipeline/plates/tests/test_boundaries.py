from __future__ import annotations

import json
from typing import TYPE_CHECKING

from histeclipse_plates.boundaries import (
    CREDIT,
    Section,
    flat_line,
    frame,
    kind_of,
    write_boundaries,
)

if TYPE_CHECKING:
    from pathlib import Path

RIDGE: Section = ("MidOceanRidge", [[(0.0, -30.0), (10.0, -30.04)]])
TRENCH: Section = ("SubductionZone", [[(-5.0, 100.0), (5.0, 101.0)], [(6.0, 101.0), (7.0, 102.0)]])


def test_sorts_boundaries_by_kind() -> None:
    assert kind_of("MidOceanRidge") == "ridge"
    assert kind_of("ContinentalRift") == "ridge"
    assert kind_of("SubductionZone") == "subduction"
    assert kind_of("Transform") == "transform"
    assert kind_of("InferredPaleoBoundary") == "other"


def test_keeps_a_line_as_longitude_latitude_pairs_to_a_tenth_of_a_degree() -> None:
    assert flat_line([(10.04, -30.06), (-5.0, 179.99)]) == [-30.1, 10.0, 180.0, -5.0]


def test_a_frame_holds_every_kind_and_leaves_out_lines_of_one_point() -> None:
    lone: Section = ("Transform", [[(1.0, 1.0)]])
    drawn = frame(100, [RIDGE, TRENCH, lone])
    assert drawn == {
        "ma": 100,
        "lines": {
            "ridge": [[-30.0, 0.0, -30.0, 10.0]],
            "subduction": [[100.0, -5.0, 101.0, 5.0], [101.0, 6.0, 102.0, 7.0]],
            "transform": [],
            "other": [],
        },
    }


def test_writes_a_file_per_age_and_an_index(tmp_path: Path) -> None:
    asked: list[int] = []

    def sections_at(ma: int) -> list[Section]:
        asked.append(ma)
        return [RIDGE] if ma == 0 else [TRENCH]

    assert write_boundaries(sections_at, [0, 5], tmp_path) == 2
    assert asked == [0, 5]
    index = json.loads((tmp_path / "index.json").read_text())  # pyright: ignore[reportAny]
    assert index == {
        "schemaVersion": 1,
        "sources": ["cao2024"],
        "credit": CREDIT,
        "source": "https://doi.org/10.5281/zenodo.13628813",
        "licence": "CC BY 4.0",
        "accessed": "2026-11-23",
        "changes": (
            "Plate boundaries resolved with pyGPlates, in the model's paleomagnetic frame; "
            "the day given as accessed is the day this file was last written"
        ),
        "stepMa": 5,
        "oldestMa": 5,
    }
    five = json.loads((tmp_path / "5.json").read_text())  # pyright: ignore[reportAny]
    assert five == frame(5, [TRENCH])
