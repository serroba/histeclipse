"""The height views' colour keys: measured against altimetry, or read off a published legend."""

from __future__ import annotations

import numpy as np

from histeclipse_pipeline.planet_keys import (
    GRID,
    GRIDS,
    VENUS_KM,
    VENUS_ROWS,
    VENUS_TICKS,
    heights_km,
    hex_colour,
    key,
    legend_stops,
    measured_stops,
)


def test_each_grid_is_pinned_and_read_against_the_map_the_site_shows() -> None:
    assert [(grid.body, grid.texture) for grid in GRIDS] == [
        ("mars", "planets/mars-height-2048.jpg"),
        ("moon", "moon-height-2048.jpg"),
    ]
    assert all(len(grid.sha256) == 64 and grid.url.startswith("https://") for grid in GRIDS)


def test_a_colour_is_written_as_hex() -> None:
    assert hex_colour(np.array([255.0, 0.4, 16.6])) == "#ff0011"


def test_a_grid_is_scaled_to_km_and_turned_so_0_degrees_is_in_the_middle() -> None:
    # Given a big-endian grid whose first column (0° east) alone is 2000 steps of 0.5 m.
    grid = np.zeros(GRID, dtype=">i2")
    grid[:, 0] = 2000
    # When it is read.
    heights = heights_km(grid.tobytes(), ">i2", 0.5)
    # Then 0° east is in the middle column, at 1 km.
    assert heights[0, GRID[1] // 2] == 1.0
    assert heights[0, 0] == 0.0


def test_each_kilometre_takes_the_colour_of_its_lit_half() -> None:
    # Given an equator band 0.2 km high in blue, half shaded dark, and 1.7 km high in red; poles
    # beyond 70° at 5 km in green, which must not count.
    rows, columns = 18, 40
    heights = np.zeros((rows, columns))
    colours = np.zeros((rows, columns, 3))
    heights[1:9] = 0.2
    colours[1:9, :20] = [0, 0, 200]
    colours[1:9, 20:] = [0, 0, 50]
    heights[9:17] = 1.7
    colours[9:17] = [200, 0, 0]
    for pole in (0, rows - 1):
        heights[pole] = 5.0
        colours[pole] = [0, 200, 0]
    # When the key is measured.
    stops = measured_stops(heights, colours)
    # Then a stop sits in the middle of each kilometre, in the lit colour; the poles are left out.
    assert stops == [(0.5, "#0000c8"), (1.5, "#c80000")]


def test_a_kilometre_with_too_few_pixels_is_left_out() -> None:
    heights = np.zeros((18, 40))
    heights[8, :10] = 3.2
    colours = np.full((18, 40, 3), 100.0)
    assert [km for km, _ in measured_stops(heights, colours)] == [0.5]


def test_venus_key_is_read_off_its_legend_at_each_kilometre_tick() -> None:
    # Given a legend whose bar is red left of +4 km and blue from there on.
    legend = np.full((250, 796, 3), 255.0)
    (left, right), (low, high), (top, bottom) = VENUS_TICKS, VENUS_KM, VENUS_ROWS
    four = round(left + (4 - low) * (right - left) / (high - low))
    legend[top:bottom, left:four] = [255, 0, 0]
    legend[top:bottom, four:right] = [0, 0, 255]
    # When it is read.
    stops = legend_stops(legend)
    # Then each kilometre from -3 to +11 has a stop; -3 is red and +11 blue.
    assert [km for km, _ in stops] == [float(km) for km in range(-3, 12)]
    assert stops[0] == (-3.0, "#ff0000")
    assert stops[-1] == (11.0, "#0000ff")


def test_a_key_carries_its_datum_and_where_it_comes_from() -> None:
    assert key([(0.5, "#000000")], "above the areoid", "measured", "https://pds") == {
        "datum": "above the areoid",
        "credit": "measured",
        "source": "https://pds",
        "stops": [[0.5, "#000000"]],
    }
