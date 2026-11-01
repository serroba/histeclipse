import json
from typing import TYPE_CHECKING

from histeclipse_pipeline.ohm import (
    OPEN_END,
    OPEN_START,
    Border,
    Label,
    by_century,
    century_file,
    read_tile,
    write_ohm,
)
from histeclipse_pipeline.vector_tiles import Feature, Layer

if TYPE_CHECKING:
    from pathlib import Path

LINES = Layer(
    "land_ohm_lines",
    4096,
    [
        # A dated country border.
        Feature(
            {"admin_level": 2, "start_decdate": -858.5, "end_decdate": -744.2},
            2,
            [[(0, 0), (4096, 0)]],
        ),
        # An undated one, as a string level: open at both ends.
        Feature({"admin_level": "2"}, 2, [[(0, 0), (0, 4096)]]),
        # A province border, a point, and a line too short to keep.
        Feature({"admin_level": 4}, 2, [[(0, 0), (10, 10)]]),
        Feature({"admin_level": 2}, 1, [[(0, 0)]]),
        Feature({"admin_level": 2}, 2, [[(5, 5)]]),
    ],
)
LABELS = Layer(
    "land_ohm_centroids",
    4096,
    [
        Feature(
            {
                "admin_level": 2,
                "name": "Assur",
                "name_en": "Neo-Assyrian Empire",
                "start_decdate": -858.0,
                "end_decdate": -743.9,
            },
            1,
            [[(2048, 2048)]],
        ),
        Feature({"admin_level": 2, "name": "Kemet"}, 1, [[(0, 0)]]),
        Feature({"admin_level": 4, "name": "Province"}, 1, [[(0, 0)]]),
        Feature({"admin_level": 2}, 1, [[(0, 0)]]),
        Feature({"admin_level": 2, "name": "Nowhere"}, 1, []),
        Feature(
            {"admin_level": 2, "name": "Undated", "start_decdate": "", "end_decdate": True},
            1,
            [[(1, 1)]],
        ),
        Feature(
            {"admin_level": 2, "name": "Iso", "start_decdate": "-0858-03", "end_decdate": "1231"},
            1,
            [[(1, 1)]],
        ),
    ],
)


def test_reads_country_borders_and_names_with_their_years() -> None:
    borders, labels = read_tile([LINES, LABELS, Layer("water", 4096, [])], 2, 1)
    assert [(b.start, b.end) for b in borders] == [(-859, -745), (OPEN_START, OPEN_END)]
    assert borders[0].points[0] == (0.0, borders[0].points[0][1])
    assert [label.name for label in labels] == ["Neo-Assyrian Empire", "Kemet", "Undated", "Iso"]
    # ISO 8601 dates in astronomical years read the same way.
    assert (labels[3].start, labels[3].end) == (-858, 1231)
    assert (labels[0].start, labels[0].end) == (-858, -744)
    assert (labels[2].start, labels[2].end) == (OPEN_START, OPEN_END)


def test_files_borders_by_century_once_each() -> None:
    border = Border(-858, -744, [(10.0, 20.0), (11.5, 21.25)])
    label = Label("Neo-Assyrian Empire", -858, -744, 43.1, 36.4)
    centuries = by_century([border, border], [label, label])
    assert sorted(centuries) == [-900, -800]
    assert centuries[-900] == ([border], [label])
    file = century_file(-800, *centuries[-800])
    assert file["borders"] == [{"from": -858, "to": -744, "points": [1000, 2000, 1150, 2125]}]
    assert file["labels"] == [
        {
            "name": "Neo-Assyrian Empire",
            "from": -858,
            "to": -744,
            "longitude": 43.1,
            "latitude": 36.4,
        }
    ]


def test_writes_files_and_an_index(tmp_path: Path) -> None:
    centuries = by_century([Border(0, 50, [(0.0, 0.0), (1.0, 1.0)])], [])
    assert write_ohm(centuries, tmp_path, "2026-11-01") == 1
    index = json.loads((tmp_path / "index.json").read_text())  # pyright: ignore[reportAny]
    assert index == {
        "schemaVersion": 1,
        "credit": "© OpenHistoricalMap contributors, CC0; borders simplified and split by century",
        "source": "OpenHistoricalMap vector tiles, zoom 2, fetched 2026-11-01",
        "centuries": [0],
    }
    assert (tmp_path / "0.json").exists()
