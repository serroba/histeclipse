"""Saturn's rings: Voyager's opacity and Cassini's colour, baked into one strip."""

from __future__ import annotations

import io
from typing import TYPE_CHECKING

import numpy as np
from PIL import Image

from histeclipse_pipeline.saturn_rings import (
    A_OUTER_KM,
    B_INNER_KM,
    INNER_KM,
    OPAQUE_TAU,
    OUTER_KM,
    ROW,
    SMOOTH,
    WIDTH,
    edges,
    png,
    profile,
    ring_texture,
)

if TYPE_CHECKING:
    from histeclipse_pipeline.arrays import FloatArray


def test_the_occultation_profile_is_read_its_hidden_star_made_opaque() -> None:
    radius, tau = profile(
        " 72000.00, 55.4, 0.7,-0.02,-0.03,-0.01\n 100000.00, 0.0, 0.0, 99.0, 9, 99\n"
    )
    assert list(radius) == [72_000.0, 100_000.0]
    # A small negative depth is noise, none; the flag 99 is opaque.
    assert list(tau) == [0.0, OPAQUE_TAU]


def made_up_panorama() -> FloatArray:
    """A row like the panorama's: dim C ring, bright B ring, a dark gap, a lit A ring, space."""
    width = 6000
    row = np.full(width, 40.0)
    row[1500:3900] = 200.0
    row[3900:4200] = 20.0
    row[4200:5700] = 140.0
    row[5700:] = 0.0
    picture: FloatArray = np.repeat(np.repeat(row[None, :, None], 3, axis=2), 1000, axis=0)
    picture[ROW, 2000] = 0.0  # A dark ringlet in the B ring, smoothed away.
    return picture


def test_the_panorama_s_ring_edges_are_found_past_its_ringlets() -> None:
    picture = made_up_panorama()
    brightness: FloatArray = np.mean(picture[ROW : ROW + 1], axis=(0, 2))
    found = edges(brightness)
    # Each within the smoothing of where it is: the ringlet at 2000 is not taken for an edge.
    for edge, true in zip(found, (1500, 3900, 4200, 5700), strict=True):
        assert abs(edge - true) <= SMOOTH


def test_the_strip_is_coloured_by_the_panorama_and_as_opaque_as_voyager_measured() -> None:
    # Given the B ring opaque and nothing beyond the A ring, in the profile.
    radius = np.array([INNER_KM, B_INNER_KM - 1, B_INNER_KM, A_OUTER_KM, A_OUTER_KM + 1, OUTER_KM])
    tau = np.array([0.1, 0.1, OPAQUE_TAU, OPAQUE_TAU, 0.0, 0.0])
    strip = ring_texture((radius, tau), made_up_panorama())
    assert strip.shape == (WIDTH, 4)
    middle = WIDTH * 2 // 5  # About 101,000 km: in the B ring.
    assert strip[middle, 3] > 0.99
    assert strip[middle, 0] > 0.7
    # Beyond the A ring: clear.
    assert strip[-1, 3] < 0.01


def test_the_strip_is_written_as_a_one_row_rgba_png() -> None:
    texture = np.zeros((8, 4))
    texture[:, 3] = 1.0
    with Image.open(io.BytesIO(png(texture))) as image:
        assert image.size == (8, 1)
        assert image.mode == "RGBA"
