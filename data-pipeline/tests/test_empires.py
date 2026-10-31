import io
import json
import zipfile
from typing import TYPE_CHECKING

import pytest

from histeclipse_pipeline.empires import (
    MIN_RING_AREA,
    Polity,
    astronomical,
    by_century,
    century_file,
    century_of,
    encode,
    index_file,
    merge_unchanged,
    parse_polities,
    ring_area,
    simplify,
    simplify_ring,
    unpack,
    write_empires,
)
from histeclipse_pipeline.sky import as_json, parse_json

if TYPE_CHECKING:
    from pathlib import Path

    from histeclipse_pipeline.sky import Json

SQUARE = [(0.0, 0.0), (2.0, 0.0), (2.0, 2.0), (0.0, 2.0), (0.0, 0.0)]


def feature(name: str, start: int, end: int, rings: list[list[list[float]]]) -> Json:
    return as_json(
        {
            "type": "Feature",
            "properties": {"Name": name, "FromYear": start, "ToYear": end, "Wikipedia": name},
            "geometry": {"type": "MultiPolygon", "coordinates": [[ring] for ring in rings]},
        }
    )


def test_counts_bce_years_astronomically() -> None:
    # Cliopatria's -550 is 550 BCE, which is astronomical year -549; CE years are unchanged.
    assert astronomical(-550) == -549
    assert astronomical(-1) == 0
    assert astronomical(1) == 1


def test_simplify_drops_points_that_barely_bend_the_line() -> None:
    line = [(0.0, 0.0), (1.0, 0.01), (2.0, 0.0), (3.0, 1.0)]
    assert simplify(line, 0.05) == [(0.0, 0.0), (2.0, 0.0), (3.0, 1.0)]
    assert simplify(line[:2], 0.05) == line[:2]
    # A degenerate segment measures distance to its single point.
    assert simplify([(0.0, 0.0), (5.0, 5.0), (0.0, 0.0)], 1.0) == [
        (0.0, 0.0),
        (5.0, 5.0),
        (0.0, 0.0),
    ]


def test_keeps_rings_large_enough_to_see() -> None:
    assert ring_area(SQUARE) == 4
    assert simplify_ring(SQUARE) == SQUARE
    tiny = [(0.0, 0.0), (0.1, 0.0), (0.1, 0.1), (0.0, 0.1), (0.0, 0.0)]
    assert ring_area(tiny) < MIN_RING_AREA
    assert simplify_ring(tiny) is None
    # Large but collapsing to a line once simplified.
    sliver = [(0.0, 0.0), (10.0, 0.0), (10.0, 0.05), (0.0, 0.0)]
    assert simplify_ring(sliver) is None


def test_reads_polities_and_skips_alliances_and_empty_rows() -> None:
    square = [list(point) for point in SQUARE]
    features: list[object] = [
        feature("Achaemenid Empire", -550, -541, [square]),
        feature("(Alliance between Elam and Babylonia)", -1300, -1241, [square]),
        {"type": "Feature", "properties": {"Name": "Nowhere"}, "geometry": None},
        feature("Specks", 100, 200, [[[0, 0], [0.1, 0], [0.1, 0.1], [0, 0]]]),
        {
            "type": "Feature",
            "properties": {"Name": "Lydia", "FromYear": -600, "ToYear": -547},
            "geometry": {"type": "Polygon", "coordinates": [square]},
        },
    ]
    collection = as_json({"type": "FeatureCollection", "features": features})
    polities = parse_polities(collection)
    assert [(p.name, p.start, p.end) for p in polities] == [
        ("Achaemenid Empire", -549, -540),
        ("Lydia", -599, -546),
    ]
    assert polities[1].wikipedia == ""


def test_merges_rows_whose_borders_did_not_change() -> None:
    a = Polity("A", "A", -100, -51, [SQUARE])
    same = Polity("A", "A", -50, 0, [SQUARE])
    moved = Polity("A", "A", 1, 50, [[(x + 1, y) for x, y in SQUARE]])
    other = Polity("B", "B", -50, 0, [SQUARE])
    merged = merge_unchanged([moved, same, a, other])
    assert [(p.name, p.start, p.end) for p in merged] == [
        ("A", -100, 0),
        ("A", 1, 50),
        ("B", -50, 0),
    ]


def test_files_each_row_under_every_century_it_touches() -> None:
    assert century_of(-549) == -600
    assert century_of(99) == 0
    rows = by_century([Polity("A", "A", -549, -401, [SQUARE])])
    assert sorted(rows) == [-600, -500]


def test_encodes_rings_in_hundredths_of_a_degree() -> None:
    row = encode(Polity("A", "Wiki", -549, -401, [[(1.234, -5.678), (2.0, 3.0)]]))
    assert row == {
        "name": "A",
        "wikipedia": "Wiki",
        "from": -549,
        "to": -401,
        "rings": [[123, -568, 200, 300]],
    }
    file = century_file(-600, [])
    assert file["scale"] == 100
    assert file["century"] == -600


def test_writes_an_index_and_a_file_per_century(tmp_path: Path) -> None:
    polities = [Polity("A", "A", -549, -401, [SQUARE])]
    assert write_empires(polities, tmp_path) == 2
    index = parse_json((tmp_path / "index.json").read_bytes())
    assert index == index_file(by_century(polities))
    assert isinstance(index, dict)
    assert index["centuries"] == [-600, -500]
    assert "CC BY 4.0" in str(index["credit"])
    century = parse_json((tmp_path / "-500.json").read_bytes())
    assert "'name': 'A'" in str(century)


def test_unpacks_the_geojson_from_the_release_zip() -> None:
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w") as zipped:
        zipped.writestr("readme.txt", "hi")
        zipped.writestr("cliopatria_v1.geojson", json.dumps({"features": []}))
    assert unpack(archive.getvalue()) == {"features": []}


@pytest.mark.parametrize("year", [-3400, -1, 1, 2024])
def test_century_contains_its_year(year: int) -> None:
    start = century_of(astronomical(year))
    assert start <= astronomical(year) < start + 100
