import json
import urllib.parse
from typing import TYPE_CHECKING

import pytest

from histeclipse_pipeline.planets import (
    APPARENT,
    HELIOCENTRIC,
    PLANETS,
    horizons_url,
    parse_vectors,
    write_planet_vectors,
)
from histeclipse_pipeline.sky import parse_json

if TYPE_CHECKING:
    from pathlib import Path

ROWS = [
    (
        " 260500.500000000, B.C. 4000-Mar-19 00:00:00.0000, -5.176386540822967E+08,"
        "  5.607882556537875E+08,  2.613644711451311E+08,"
    ),
    (
        "2451545.000000000, A.D. 2000-Jan-01 12:00:00.0000,  6.250666172737675E+08,"
        "  2.766289327771038E+08,  1.033376286519766E+08,"
    ),
]
ANSWER = "\n".join(
    ["Target body name: Jupiter Barycenter (5)          {source: DE441}", "$$SOE", *ROWS, "$$EOE"]
)


def test_reads_horizons_vectors() -> None:
    vectors = parse_vectors(ANSWER)
    assert vectors == [
        {"jdTT": 260500.5, "x": -517638654.1, "y": 560788255.7, "z": 261364471.1},
        {"jdTT": 2451545.0, "x": 625066617.3, "y": 276628932.8, "z": 103337628.7},
    ]


def test_rejects_an_answer_without_data() -> None:
    with pytest.raises(ValueError, match="no data block"):
        _ = parse_vectors("No ephemeris for target")


def test_asks_for_geometric_icrf_vectors_at_julian_days() -> None:
    query = urllib.parse.parse_qs(urllib.parse.urlparse(horizons_url("5", [260500.5])).query)
    assert query["COMMAND"] == ["'5'"]
    assert query["CENTER"] == ["'500@399'"]
    assert query["VEC_CORR"] == ["'NONE'"]
    assert query["REF_SYSTEM"] == ["'ICRF'"]
    # Small Julian Days must not be read as Modified Julian Days.
    assert query["TLIST_TYPE"] == ["'JD'"]
    assert query["TLIST"] == ["'260500.500000'"]


def test_can_ask_from_the_suns_centre() -> None:
    url = horizons_url("6", [2451545.0], HELIOCENTRIC)
    assert urllib.parse.parse_qs(urllib.parse.urlparse(url).query)["CENTER"] == ["'500@10'"]


def test_can_ask_for_light_time_and_aberration() -> None:
    url = horizons_url("2", [2451545.0], corrections=APPARENT)
    assert urllib.parse.parse_qs(urllib.parse.urlparse(url).query)["VEC_CORR"] == ["'LT+S'"]


def test_covers_the_naked_eye_planets() -> None:
    assert sorted(PLANETS) == ["jupiter", "mars", "mercury", "saturn", "venus"]


def test_writes_readable_json(tmp_path: Path) -> None:
    path = tmp_path / "planets.json"
    write_planet_vectors({"mars": parse_vectors(ANSWER)}, path)
    body = parse_json(path.read_bytes())
    assert isinstance(body, dict)
    assert "DE441" in str(body["description"])
    assert "260500.5" in json.dumps(body["planets"])
