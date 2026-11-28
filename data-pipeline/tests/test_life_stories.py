"""Tests for the animals' stories: PBDB finds with their region and temperature."""

import json
from typing import TYPE_CHECKING

import numpy as np
import pytest
from PIL import Image

from histeclipse_pipeline import life_stories
from histeclipse_pipeline.life_stories import (
    AFRICA,
    ANTARCTICA,
    ASIA,
    EUROPE,
    NORTH_AMERICA,
    OCEANIA,
    REGIONS,
    SOUTH_AMERICA,
    Placed,
    Temperatures,
    parse_common,
    parse_living,
    parse_placed,
    region_of,
    sites,
    story_file,
    write_life_stories,
)
from histeclipse_pipeline.time_tree import Taxon, middle_of
from tests.json_values import read_json

if TYPE_CHECKING:
    from pathlib import Path

    from histeclipse_pipeline.life_stories import Site

TAXA_HEADER = (
    '"orig_no","flags","taxon_name","accepted_no","accepted_rank","accepted_name","parent_no",'
    '"common_name","is_extant","firstapp_max_ma","lastapp_min_ma"\n'
)
MAMMALS = (
    TAXA_HEADER
    + """\
"1","","Mammalia","1","class","Mammalia","0","mammal","extant","237","0"
"2","","Felidae","2","family","Felidae","1","cat","extant","30","0"
"3","","Panthera","3","genus","Panthera","2"," big cat ","extant","6","0"
"4","","Smilodon","4","genus","Smilodon","2","","extinct","2.6","0.012"
"5","","Leo","3","genus","Panthera","2","lion","extant","6","0"
"6","","Panthera leo","6","species","Panthera leo","3","lion","extant","2","0"
"","","Nameless","","genus","Nameless","2","nothing","extant","1","0"
"""
)
DINOSAURS = (
    TAXA_HEADER
    + """\
"10","","Dinosauria","10","unranked clade","Dinosauria","0","dinosaur","extant","252","0"
"11","","Tyrannosaurus","11","genus","Tyrannosaurus","10","","extant","72","66"
"""
)
FINDS_HEADER = '"accepted_no","max_ma","min_ma","paleolat","paleolng","lat","lng"\n'
TAXA = {
    1: Taxon(1, "Mammalia", "class", None, 237.0, 0.0),
    2: Taxon(2, "Felidae", "family", 1, 30.0, 0.0),
    3: Taxon(3, "Panthera", "genus", 2, 6.0, 0.0),
    4: Taxon(4, "Smilodon", "genus", 2, 2.6, 0.012),
    6: Taxon(6, "Panthera leo", "species", 3, 2.0, 0.0),
}


def maps(folder: Path, byte: int = 128) -> Temperatures:
    """Write an index of three ages and one even map (of 0 Ma), and read them."""
    frames = [
        {"ma": 0, "file": "0.png", "mean": 14.6},
        {"ma": 5, "file": "5.png", "mean": 15.4},
        {"ma": 65, "file": "65.png", "mean": 8.1},
    ]
    folder.mkdir(parents=True, exist_ok=True)
    _ = (folder / "index.json").write_text(json.dumps({"frames": frames}))
    grid = np.full((181, 361), byte, dtype=np.uint8)
    grid[60, 190] = 255
    grid[0, :] = 0
    for ma in (0, 65):
        Image.fromarray(grid, mode="L").save(folder / f"{ma}.png")
    return Temperatures(folder)


@pytest.mark.parametrize(
    ("latitude", "longitude", "region"),
    [
        (40.0, -100.0, NORTH_AMERICA),
        (-10.0, -55.0, SOUTH_AMERICA),
        (50.0, 10.0, EUROPE),
        (0.0, 20.0, AFRICA),
        (35.0, 105.0, ASIA),
        (-25.0, 135.0, OCEANIA),
        (-75.0, 0.0, ANTARCTICA),
    ],
)
def test_a_place_well_inside_a_land_is_in_its_region(
    latitude: float, longitude: float, region: int
) -> None:
    assert region_of(latitude, longitude) == region
    assert REGIONS[region] == REGIONS[region_of(latitude, longitude)]


def test_the_americas_join_at_panama() -> None:
    assert region_of(9.0, -79.5) == SOUTH_AMERICA
    assert region_of(10.0, -84.0) == NORTH_AMERICA
    # The Caribbean's islands, north of the join, are the north's.
    assert region_of(18.0, -77.0) == NORTH_AMERICA


def test_the_lands_around_the_mediterranean_fall_to_their_own_side() -> None:
    assert region_of(24.0, 45.0) == ASIA  # Arabia
    assert region_of(40.0, -4.0) == EUROPE  # Spain
    assert region_of(36.8, 10.2) == AFRICA  # Tunisia
    assert region_of(35.2, 25.0) == EUROPE  # Crete
    assert region_of(55.7, 37.6) == EUROPE  # Moscow
    assert region_of(39.0, 33.0) == ASIA  # Anatolia


def test_new_guinea_is_oceania_and_borneo_is_asia() -> None:
    assert region_of(-5.0, 141.0) == OCEANIA
    assert region_of(0.5, 114.0) == ASIA


def test_reads_the_common_names_of_valid_names() -> None:
    # A synonym's row, a name with none, and a row with no number are left out.
    assert parse_common(MAMMALS) == {1: "mammal", 2: "cat", 3: "big cat", 6: "lion"}


def test_reads_which_names_pbdb_marks_as_living() -> None:
    assert parse_living(MAMMALS) == {1, 2, 3, 5, 6}


def test_reads_the_finds_with_a_genus_an_age_and_both_places() -> None:
    text = (
        FINDS_HEADER
        + """\
"6","12","8","-10.5","20.5","-12","25"
"3","4","2","1","2","3","4"
"3","","2","1","2","3","4"
"3","4","2","","2","3","4"
"3","4","2","1","2","3","inf"
"3","40","10","1","2","3","4"
"2","4","2","1","2","3","4"
"99","4","2","1","2","3","4"
"","4","2","1","2","3","4"
"""
    )
    assert parse_placed(text, TAXA) == [
        Placed(3, 10, (-10.5, 20.5), (-12.0, 25.0)),
        Placed(3, 5, (1.0, 2.0), (3.0, 4.0)),
    ]


def test_reads_a_temperature_at_a_place_on_the_map_of_its_age(tmp_path: Path) -> None:
    temperatures = maps(tmp_path)
    assert temperatures.means == {0: 14.6, 5: 15.4, 65: 8.1}
    assert temperatures.at(0, 30.0, 10.0) == 60.0
    assert temperatures.at(0, 0.0, 0.0) == 0.2
    # Beyond the map's edge is its edge.
    assert temperatures.at(0, 95.0, 200.0) == -60.0
    assert temperatures.at(0, -95.0, -200.0) == 0.2


def test_a_step_with_no_map_or_a_map_that_stands_out_has_no_temperature(tmp_path: Path) -> None:
    temperatures = maps(tmp_path)
    assert temperatures.at(65, 0.0, 0.0) is None
    assert temperatures.at(300, 0.0, 0.0) is None
    # In the index, but its image is not there; asked twice, looked for once.
    assert temperatures.at(5, 0.0, 0.0) is None
    assert temperatures.at(5, 0.0, 0.0) is None


def test_finds_near_each_other_are_one_site_in_the_region_most_are_in(tmp_path: Path) -> None:
    temperatures = maps(tmp_path)
    placed = [
        Placed(3, 0, (0.0, 0.0), (0.0, 20.0)),
        Placed(3, 0, (0.0, 3.0), (5.0, 20.0)),
        Placed(3, 0, (1.0, 1.0), (35.0, 105.0)),
        Placed(3, 0, (0.0, 50.0), (-25.0, 135.0)),
        Placed(3, 65, (10.0, 10.0), (40.0, -100.0)),
        Placed(4, 5, (30.0, 10.0), (50.0, 10.0)),
    ]
    found = sites(placed, temperatures)
    middle = middle_of([(0.0, 0.0), (0.0, 3.0), (1.0, 1.0)])
    assert found == {
        3: [
            (0, *middle, 3, AFRICA, 0.2),
            (0, 0.0, 50.0, 1, OCEANIA, 0.2),
            (65, 10.0, 10.0, 1, NORTH_AMERICA, None),
        ],
        4: [(5, 30.0, 10.0, 1, EUROPE, None)],
    }


def test_a_groups_file_lines_its_columns_up_with_the_classification(tmp_path: Path) -> None:
    temperatures = maps(tmp_path)
    found: dict[int, list[Site]] = {
        3: [(5, 1.0, 2.0, 2, AFRICA, 20.0), (0, 3.0, 4.0, 1, ASIA, 14.0)],
        4: [(0, 30.0, -100.0, 1, NORTH_AMERICA, None)],
    }
    built = story_file(
        ("mammals", "Mammals", "Mammalia"),
        TAXA,
        {1: "mammal", 3: "big cat"},
        {1, 3},
        found,
        temperatures,
        "2026-11-28",
    )
    assert built["schemaVersion"] == 1
    assert (built["id"], built["name"], built["accessed"]) == ("mammals", "Mammals", "2026-11-28")
    assert built["stepMa"] == 5
    assert built["regions"] == list(REGIONS)
    assert built["pbdb"] == [1, 2, 3, 4]
    assert built["names"] == ["Mammalia", "Felidae", "Panthera", "Smilodon"]
    assert built["common"] == ["mammal", "", "big cat", ""]
    assert built["living"] == [1, 0, 1, 0]
    assert built["parent"] == [-1, 0, 1, 1]
    assert built["first"] == [6.0, 6.0, 6.0, 2.6]
    assert built["last"] == [0.0, 0.0, 0.0, 0.01]
    assert built["sites"] == [
        [],
        [],
        [5, 1.0, 2.0, 2, AFRICA, 20.0, 0, 3.0, 4.0, 1, ASIA, 14.0],
        [0, 30.0, -100.0, 1, NORTH_AMERICA, None],
    ]
    # The map that stands out is left out of the globe's means too.
    assert built["globe"] == [[0, 14.6], [5, 15.4]]
    assert "Scotese (2022)" in str(built["credit"])
    ranks = built["ranks"]
    assert isinstance(ranks, list)
    assert [ranks[index] for index in (0, 8, 12, 12)] == ["class", "family", "genus", "genus"]
    assert built["rank"] == [0, 8, 12, 12]


def test_a_tree_without_an_order_is_an_error(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def no_order(*_: object) -> dict[str, None]:
        return {"pbdb": None}

    monkeypatch.setattr(life_stories, "tree_file", no_order)
    with pytest.raises(TypeError, match="the tree has no order"):
        _ = story_file(("mammals", "Mammals", "Mammalia"), TAXA, {}, set(), {}, maps(tmp_path), "")


def test_writes_each_groups_file_from_the_cached_downloads(tmp_path: Path) -> None:
    cache = tmp_path / "cache"
    cache.mkdir()
    _ = maps(tmp_path / "maps")
    _ = (cache / "taxa-mammals.csv").write_text(MAMMALS)
    _ = (cache / "taxa-dinosaurs.csv").write_text(DINOSAURS)
    _ = (cache / "occs-mammals.csv").write_text(
        FINDS_HEADER + '"6","1","0","-10","20","0","20"\n"4","1","0","30","-100","40","-100"\n'
    )
    _ = (cache / "occs-dinosaurs.csv").write_text(
        FINDS_HEADER + '"11","68","66","30","10","40","-100"\n'
    )
    out = tmp_path / "out" / "life-stories"

    assert write_life_stories(cache, tmp_path / "maps", out) == 3

    assert (out / "mammals.json").read_text().endswith("]}\n")
    mammals = read_json(out / "mammals.json")
    assert isinstance(mammals, dict)
    assert mammals["names"] == ["Mammalia", "Felidae", "Panthera", "Smilodon"]
    assert mammals["common"] == ["mammal", "cat", "big cat", ""]
    assert mammals["living"] == [1, 1, 1, 0]
    assert mammals["sites"] == [
        [],
        [],
        [0, -10.0, 20.0, 1, AFRICA, 0.2],
        [0, 30.0, -100.0, 1, NORTH_AMERICA, 0.2],
    ]
    dinosaurs = read_json(out / "dinosaurs.json")
    assert isinstance(dinosaurs, dict)
    assert dinosaurs["names"] == ["Dinosauria", "Tyrannosaurus"]
    # PBDB's living mark is not read for the non-avian dinosaurs; 65 Ma has no temperature.
    assert dinosaurs["living"] == [0, 0]
    assert dinosaurs["sites"] == [[], [65, 30.0, 10.0, 1, NORTH_AMERICA, None]]
