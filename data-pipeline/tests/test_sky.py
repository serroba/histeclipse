import hashlib
from pathlib import Path

import pytest

from histeclipse_pipeline.sky import (
    Json,
    Star,
    as_json,
    constellations,
    parse_bright_star_catalogue,
    parse_json,
    sky_file,
    verified,
    write_sky_file,
)
from tests.json_values import json_round_trip, read_json

# Five real catalogue lines: Nova 1572 (kept for numbering, no position), Bellatrix,
# Betelgeuse, Arcturus and Vega.
SAMPLE = Path(__file__).parent / "fixtures" / "ybsc5-sample.txt"


def sample_stars() -> list[Star]:
    return parse_bright_star_catalogue(SAMPLE.read_text(encoding="latin-1").splitlines())


def test_skips_entries_without_a_position() -> None:
    assert [star.hr for star in sample_stars()] == [1790, 2061, 5340, 7001]


def test_reads_vega() -> None:
    vega = sample_stars()[3]
    # 18h36m56.3s +38°47'01" J2000, as printed in the catalogue.
    assert vega.ra == pytest.approx(279.234583, abs=1e-6)
    assert vega.dec == pytest.approx(38.783611, abs=1e-6)
    assert (vega.pm_ra, vega.pm_dec) == pytest.approx((202, 286))
    assert vega.parallax == pytest.approx(123)
    assert vega.radial_velocity == -14
    assert (vega.vmag, vega.bv) == (0.03, 0.0)


def test_reads_arcturus_fast_proper_motion() -> None:
    arcturus = sample_stars()[2]
    # 2.28″ a year: about 3.2° over 5,000 years.
    assert arcturus.pm_ra == pytest.approx(-1093)
    assert arcturus.pm_dec == pytest.approx(-1998)


def feature(id_: str, geometry: Json, properties: Json = None) -> Json:
    return {"type": "Feature", "id": id_, "properties": properties, "geometry": geometry}


# Orion's shoulders, written as d3-celestial does: degrees, with longitudes above 180 negative.
SHOULDERS: Json = {
    "type": "FeatureCollection",
    "features": [
        feature(
            "Ori",
            {"type": "MultiLineString", "coordinates": [[[81.2828, 6.3497], [88.7929, 7.4071]]]},
        )
    ],
}
NAMES: Json = {
    "type": "FeatureCollection",
    "features": [
        feature("Ori", {"type": "Point", "coordinates": [84, 13]}, {"name": "Orion", "rank": "1"}),
        feature("Lyr", {"type": "Point", "coordinates": [-77, 36]}, {"name": "Lyra", "rank": "2"}),
        # A second name for the same figure, as Serpens Caput and Cauda are.
        feature(
            "Ori", {"type": "Point", "coordinates": [80, 0]}, {"name": "Orion II", "rank": "3"}
        ),
    ],
}


def test_matches_figure_vertices_to_stars() -> None:
    orion, lyra, orion_again = constellations(NAMES, SHOULDERS, sample_stars())
    assert (orion.id, orion.name, orion.rank, orion.label) == ("Ori", "Orion", 1, (84.0, 13.0))
    # Bellatrix then Betelgeuse, as indices into the star list.
    assert orion.lines == ((0, 1),)
    # Longitudes come back in 0..360; a constellation without a figure keeps an empty one.
    assert lyra.label == (283.0, 36.0)
    assert lyra.lines == ()
    # A figure named twice is drawn once.
    assert orion_again.lines == ()


def test_rejects_a_vertex_with_no_star() -> None:
    far: Json = {
        "type": "FeatureCollection",
        "features": [
            feature("Ori", {"type": "MultiLineString", "coordinates": [[[100.0, -50.0]]]})
        ],
    }
    with pytest.raises(ValueError, match="no catalogue star"):
        _ = constellations(NAMES, far, sample_stars())


@pytest.mark.parametrize(
    ("names", "message"),
    [
        ([], "expected an object"),
        ({"features": {}}, "expected a list"),
        ({"features": [feature("Ori", {"coordinates": [1, "x"]}, {})]}, "expected a number"),
        ({"features": [feature("Ori", {"coordinates": [1, True]}, {})]}, "expected a number"),
        ({"features": [feature("Ori", {"coordinates": [1, 2]}, {"name": 3})]}, "a string"),
    ],
)
def test_rejects_malformed_inputs(names: Json, message: str) -> None:
    with pytest.raises(TypeError, match=message):
        _ = constellations(names, SHOULDERS, sample_stars())


def test_writes_compact_columns(tmp_path: Path) -> None:
    stars = sample_stars()
    sky = sky_file(stars, constellations(NAMES, SHOULDERS, stars))
    path = tmp_path / "sky.json"
    write_sky_file(sky, path)
    assert read_json(path) == json_round_trip(sky)
    columns = sky["stars"]
    assert columns["hr"] == [1790, 2061, 5340, 7001]
    assert columns["ra"][3] == 279.23458
    assert columns["parallax"][3] == 123
    assert sky["constellations"][0]["lines"] == [[0, 1]]


def test_checks_downloads_against_their_pinned_checksum() -> None:
    data = b"catalogue"
    assert verified(data, hashlib.sha256(data).hexdigest(), "test") == data
    with pytest.raises(ValueError, match="does not match"):
        _ = verified(b"tampered", hashlib.sha256(data).hexdigest(), "test")


def test_parses_json_values() -> None:
    assert parse_json(b'{"a":[1,2.5,null,true,"x"]}') == {"a": [1, 2.5, None, True, "x"]}


def test_rejects_values_json_cannot_hold() -> None:
    with pytest.raises(TypeError, match="Not a JSON value"):
        _ = as_json({"a": object()})
