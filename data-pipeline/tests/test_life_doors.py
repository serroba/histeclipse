"""Tests for the doors between the continents, read from the elevation maps."""

import numpy as np
import numpy.typing as npt

from histeclipse_pipeline.life_doors import (
    APART,
    LAND,
    LANDS,
    NEAR_CELLS,
    PLACES,
    SHELF,
    SHELF_BYTE,
    cell_of,
    doors_file,
    joined,
    nearest_open,
    touching,
)
from histeclipse_pipeline.paleodem import SEA_LEVEL_BYTE

ROWS, COLUMNS = 19, 37
DEEP = 0


def cells(*rows: str) -> npt.NDArray[np.bool_]:
    """Draw a map's open cells (#), its first column repeated as its last."""
    return np.array([[cell == "#" for cell in row + row[0]] for row in rows], dtype=np.bool_)


def heights(*spans: tuple[int, int, int]) -> npt.NDArray[np.uint8]:
    """A deep sea with, along the equator, each span of columns (from, to, byte) raised."""
    grid = np.full((ROWS, COLUMNS), DEEP, dtype=np.uint8)
    for start, end, byte in spans:
        grid[9, start : end + 1] = byte
    return grid


SEEDS = {"Africa": [(0.0, -60.0)], "Asia": [(0.0, 60.0)], "Oceania": [(80.0, 0.0)]}


def test_every_land_has_places_of_its_own() -> None:
    assert set(PLACES) == set(LANDS)
    assert LANDS[-1] == "India"


def test_finds_the_cell_at_a_place() -> None:
    assert cell_of(90.0, -180.0, 901, 1801) == (0, 0)
    assert cell_of(0.0, 0.0, 901, 1801) == (450, 900)
    assert cell_of(-90.0, 179.8, 901, 1801) == (900, 1799)
    # 180° E is 180° W: the last column repeats the first.
    assert cell_of(-90.0, 180.0, 901, 1801) == (900, 0)
    assert cell_of(95.0, 0.0, 901, 1801) == (0, 900)
    assert cell_of(-95.0, 0.0, 901, 1801) == (900, 900)


def test_two_owners_touch_where_their_ground_meets() -> None:
    open_cells = cells("......", "#####.", "......")
    assert touching(open_cells, [(1, 0), (1, 4)], [0, 2]) == {(0, 2)}
    assert touching(open_cells, [(1, 4), (1, 0)], [2, 0]) == {(0, 2)}


def test_owners_with_sea_between_them_do_not_touch() -> None:
    open_cells = cells("......", "##.##.", "......")
    assert touching(open_cells, [(1, 0), (1, 3)], [0, 1]) == set()


def test_ground_touches_across_the_seam_between_east_and_west() -> None:
    open_cells = cells("......", "#....#", "......")
    assert touching(open_cells, [(1, 0), (1, 5)], [0, 1]) == {(0, 1)}


def test_ground_touches_at_a_corner() -> None:
    open_cells = cells(".#....", "..#...", "......")
    assert touching(open_cells, [(0, 1), (1, 2)], [3, 4]) == {(3, 4)}


def test_a_door_is_between_two_lands_themselves_not_by_way_of_a_third() -> None:
    open_cells = cells("#########...")
    assert touching(open_cells, [(0, 0), (0, 4), (0, 8)], [0, 1, 2]) == {(0, 1), (1, 2)}


def test_a_start_under_water_or_on_ground_already_taken_is_left_out() -> None:
    open_cells = cells("......", "####..", "......")
    # The second start is the first's own cell, the third is in the sea, the fourth the
    # first owner's again: no one is left for it to touch.
    assert touching(open_cells, [(1, 0), (1, 0), (2, 2), (1, 3)], [0, 1, 2, 0]) == set()


def test_moves_a_cell_to_the_nearest_open_one() -> None:
    open_cells = np.zeros((12, 13), dtype=np.bool_)
    open_cells[5, 5] = True
    assert nearest_open(open_cells, (5, 5)) == (5, 5)
    assert nearest_open(open_cells, (5, 7)) == (5, 5)
    assert nearest_open(open_cells, (0, 0)) == (5, 5)
    assert nearest_open(open_cells, (5, 5 + NEAR_CELLS + 1)) is None


def test_the_nearest_open_cell_may_lie_across_the_seam() -> None:
    open_cells = np.zeros((12, 13), dtype=np.bool_)
    open_cells[0, 0] = True
    assert nearest_open(open_cells, (0, 11)) == (0, 0)
    assert nearest_open(open_cells, (11, 6)) is None


def test_lands_with_ground_above_the_sea_between_them_are_joined_by_land() -> None:
    assert joined(heights((12, 24, SEA_LEVEL_BYTE)), SEEDS) == {("Africa", "Asia"): LAND}


def test_lands_with_only_a_shelf_between_them_are_joined_by_a_shallow_sea() -> None:
    grid = heights((12, 24, 200), (18, 19, SHELF_BYTE))
    assert joined(grid, SEEDS) == {("Africa", "Asia"): SHELF}


def test_lands_with_deeper_sea_between_them_stand_apart() -> None:
    grid = heights((12, 24, 200), (18, 19, SHELF_BYTE - 1))
    assert joined(grid, SEEDS) == {}
    assert joined(heights(), SEEDS) == {}


def test_a_place_just_off_the_shore_is_moved_onto_it() -> None:
    # Africa's place lies two cells west of the land's edge.
    assert joined(heights((14, 24, 255)), SEEDS) == {("Africa", "Asia"): LAND}


def test_the_site_file_has_each_pair_ever_joined_and_its_state_at_each_step() -> None:
    built = doors_file(
        {
            5: {("Africa", "Asia"): SHELF, ("North America", "Asia"): LAND},
            0: {("Africa", "Asia"): LAND},
            10: {},
        },
        "2026-11-28",
    )
    assert built["schemaVersion"] == 1
    assert (built["accessed"], built["stepMa"], built["shelfMetres"]) == ("2026-11-28", 5, 130)
    assert built["source"] == "https://zenodo.org/records/5460860"
    assert "PaleoDEM" in str(built["credit"])
    assert built["lands"] == list(LANDS)
    assert built["steps"] == [0, 5, 10]
    assert built["doors"] == [
        {"a": 0, "b": 4, "states": [APART, LAND, APART]},
        {"a": 3, "b": 4, "states": [LAND, SHELF, APART]},
    ]


def test_no_steps_make_a_file_with_no_doors() -> None:
    built = doors_file({}, "2026-11-28")
    assert (built["steps"], built["doors"]) == ([], [])
