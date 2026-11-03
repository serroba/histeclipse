"""Tests for how far the plates have moved."""

import pytest

from histeclipse_plates.motion import PLATES, STEP_MA, bearing, distance_km, motion_file


def test_distance_along_a_meridian() -> None:
    # One degree of latitude is about 111 km.
    assert distance_km((0.0, 0.0), (1.0, 0.0)) == pytest.approx(111.19, abs=0.01)
    assert distance_km((10.0, 20.0), (10.0, 20.0)) == 0


def test_bearings_point_the_way_moved() -> None:
    assert bearing((0.0, 0.0), (1.0, 0.0)) == pytest.approx(0)
    assert bearing((0.0, 0.0), (0.0, 1.0)) == pytest.approx(90)
    assert bearing((0.0, 0.0), (-1.0, 0.0)) == pytest.approx(180)
    assert bearing((0.0, 1.0), (0.0, 0.0)) == pytest.approx(270)


def test_the_file_gives_each_plate_its_motion_from_each_step_to_today() -> None:
    # A made-up model: every plate was 1° south for each million years back.
    data = motion_file(lambda latitude, longitude, ma: (latitude - ma, longitude))
    assert data["frame"] == "paleomagnetic"
    assert data["stepMa"] == STEP_MA
    plates = data["plates"]
    assert isinstance(plates, list)
    assert len(plates) == len(PLATES)
    first = plates[0]
    assert isinstance(first, dict)
    moved = first["moved"]
    assert isinstance(moved, list)
    assert len(moved) == 53
    assert moved[0] == [0, 0]
    # From 1 Ma: 1° south of today, so 111 km, moving north.
    assert moved[20] == [111, 0]
