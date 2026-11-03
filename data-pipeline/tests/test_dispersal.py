"""Tests for the human dispersal model's arrival times (Timmermann & Friedrich 2016)."""

import io

import numpy as np
import pytest
from PIL import Image

from histeclipse_pipeline.dispersal import (
    COLUMNS,
    LICENSE_NOTE,
    ROWS,
    encode,
    index_file,
    parse_ascii,
    site_layout,
)


def ascii_grid(fill: float, cells: dict[tuple[int, int], float]) -> str:
    """The server's ASCII form of a grid, rows south to north."""
    lines = ["arrivaltime_a, [1][180][360]"]
    for row in range(ROWS):
        values = [cells.get((row, column), fill) for column in range(COLUMNS)]
        lines.append(f"[0][{row}], " + ", ".join(str(value) for value in values))
    lines += ["", "arrivaltime_a.lat, [180]", "-89.5, -88.5"]
    return "\n".join(lines)


def test_reads_the_grid_with_gaps_where_the_model_never_settles() -> None:
    grid = parse_ascii(ascii_grid(-1.0e34, {(0, 0): 62.0, (179, 359): 4.0}))
    assert grid.shape == (ROWS, COLUMNS)
    assert grid[0, 0] == 62.0
    assert grid[179, 359] == 4.0
    assert np.isnan(grid[1:2, 1:2]).all()


def test_refuses_a_row_of_the_wrong_length() -> None:
    with pytest.raises(ValueError, match="values, not 360"):
        _ = parse_ascii("[0][0], 1.0, 2.0")


def test_turns_the_grid_north_up_from_179_5_west() -> None:
    grid = np.zeros((ROWS, COLUMNS))
    # The model's southernmost row, at 179.5° W (its column 200: 19.5° W + 200° = 180.5°).
    grid[0, 200] = 7.0
    laid = site_layout(grid)
    assert laid[ROWS - 1, 0] == 7.0


def test_packs_arrival_times_into_bytes_zero_for_never() -> None:
    grid = np.full((ROWS, COLUMNS), np.nan)
    grid[10, 20] = 61.6
    grid[11, 20] = 300.0
    image = np.asarray(Image.open(io.BytesIO(encode(grid))))
    assert image.shape == (ROWS, COLUMNS)
    assert (image[10, 20], image[11, 20], image[0, 0]) == (62, 255, 0)


def test_the_index_and_licence_say_whose_and_on_what_terms() -> None:
    index = index_file()
    assert index["license"] == "CC BY-NC 4.0"
    assert index["scenarios"] == [
        {"id": "a", "name": "early exit from Africa (scenario A)", "file": "arrival-a.png"},
        {"id": "b", "name": "late exit from Africa (scenario B)", "file": "arrival-b.png"},
    ]
    assert "non-commercial purposes only" in LICENSE_NOTE
    assert "MIT" in LICENSE_NOTE
