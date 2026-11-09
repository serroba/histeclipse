"""The height views' colour keys: measured against altimetry, or read off a published legend."""

from __future__ import annotations

import numpy as np

from histeclipse_pipeline.planet_keys import (
    GRID,
    GRIDS,
    SWATCH_KEYS,
    VENUS_KM,
    VENUS_ROWS,
    VENUS_TICKS,
    Swatch,
    heights_km,
    hex_colour,
    key,
    legend_stops,
    measured_stops,
    patch_colour,
    swatch_key,
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


def test_the_enhanced_colour_maps_are_keyed_by_kinds_of_rock_at_named_places() -> None:
    assert [(entry.body, entry.texture) for entry in SWATCH_KEYS] == [
        ("moon", "moon-minerals-2048.jpg"),
        ("mercury", "planets/mercury-colour-2048.jpg"),
    ]
    tranquillitatis = SWATCH_KEYS[0].swatches[1]
    assert tranquillitatis.place == "Mare Tranquillitatis"
    assert tranquillitatis.kind == "Seas richest in titanium"


def test_a_swatch_is_the_median_colour_about_its_place_gaps_left_out() -> None:
    # Given a grey map, blue within 10° of 0° N 90° E, with a black gap in the blue.
    image = np.full((180, 360, 3), 128.0)
    image[80:100, 260:280] = [0, 0, 255]
    image[88:92, 268:272] = 0
    # When the swatch at 0° N 90° E is read, 5° about.
    colour = patch_colour(image, Swatch("Blue", "here", 0, 90, 5))
    # Then it is the blue, the gap not counted.
    assert colour == "#0000ff"


def test_a_young_crater_is_its_brightest_pixels() -> None:
    # Given a dark crater floor with a bright tenth of fresh rock.
    image = np.full((180, 360, 3), 60.0)
    image[89:91, 180:182] = 250
    # When it is read, brightest only.
    colour = patch_colour(image, Swatch("Fresh", "crater", 0, 0.9, 3, brightest=True))
    # Then it is the fresh rock.
    assert colour == "#fafafa"


def test_a_swatch_key_names_each_kind_and_its_place() -> None:
    image = np.full((180, 360, 3), 128.0)
    data = swatch_key(image, SWATCH_KEYS[1])
    assert data["swatches"] == [
        {"kind": "Smooth volcanic plains", "place": "Borealis Planitia", "colour": "#808080"},
        {"kind": "Dark, low-reflectance material", "place": "about Tolstoj", "colour": "#808080"},
        {"kind": "Young craters and their rays", "place": "Hokusai", "colour": "#808080"},
    ]
