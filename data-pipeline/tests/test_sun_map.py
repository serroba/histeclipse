import math

import numpy as np
import pytest

from histeclipse_pipeline.arrays import FloatArray, as_floats
from histeclipse_pipeline.sun_map import (
    CARRINGTON_RATE,
    PROFILE_BINS,
    Composite,
    Frame,
    blur,
    composite,
    detail_strength,
    disc_radii,
    disk_centre,
    drift,
    fill_unseen,
    flatten,
    flatten_all,
    grid,
    julian_day,
    linear_from_srgb,
    project,
    radial_profile,
    sample,
    smoothstep,
    solar_longitude,
    sphere_noise,
    srgb_from_linear,
    usable,
)

# Meeus, Astronomical Algorithms, examples 25.a and 29.a: 1992 October 13.0 TD.
MEEUS_JD = 2448908.5
NEWEST = julian_day("2024-05-08T12:00:00Z")


def disc(size: int, brightness: float, darkening: float = 0, radius: float = 0.4) -> FloatArray:
    """A full-disk frame of a uniform Sun, limb-darkened by 1 - u(1 - mu), black around it."""
    frame = Frame(np.zeros((size, size, 3)), 0, radius)
    r = disc_radii(frame)
    mu = np.sqrt(np.clip(1 - r * r, 0, 1))
    level = np.where(r < 1, brightness * (1 - darkening * (1 - mu)), 0)
    return np.repeat(level[..., np.newaxis], 3, axis=2)


def test_reads_iso_moments_as_julian_days() -> None:
    assert julian_day("2000-01-01T12:00:00Z") == pytest.approx(2451545.0)
    assert julian_day("2024-05-08T00:00:00+00:00") == pytest.approx(2460438.5)


def test_finds_the_suns_longitude_and_the_disc_centre_as_meeus_does() -> None:
    assert solar_longitude(MEEUS_JD) == pytest.approx(199.909, abs=0.002)
    centre = disk_centre(MEEUS_JD)
    assert centre.latitude == pytest.approx(5.99, abs=0.01)
    assert centre.longitude == pytest.approx(238.63, abs=0.05)


def test_the_disc_centre_turns_back_once_a_synodic_rotation() -> None:
    start = disk_centre(NEWEST).longitude
    later = disk_centre(NEWEST + 1).longitude
    # About 13.2 degrees a day, backward.
    assert (start - later) % 360 == pytest.approx(13.2, abs=0.1)


def test_the_equator_outruns_the_carrington_frame_and_high_latitudes_lag() -> None:
    latitudes = np.radians(np.array([0.0, 60.0]))
    equator, high = as_floats(drift(latitudes, 10))
    assert equator == pytest.approx((14.713 - CARRINGTON_RATE) * 10)
    assert high < -20


def test_lays_out_a_two_by_one_grid_with_the_central_meridian_in_the_middle() -> None:
    lon, lat = grid(8)
    assert lon.shape == lat.shape == (4, 8)
    assert as_floats(lon[0, :])[0] == pytest.approx(-math.pi + math.pi / 8)
    assert as_floats(lat[:, 0]) == pytest.approx(np.radians([67.5, 22.5, -22.5, -67.5]))


def test_projects_the_point_facing_earth_to_the_middle_of_the_frame() -> None:
    frame = Frame(np.zeros((100, 100, 3)), NEWEST, 0.4)
    b0 = math.radians(disk_centre(NEWEST).latitude)
    where = project(np.array([0.0, math.pi / 2]), np.array([b0, 0.0]), frame, NEWEST)
    x, y, mu = as_floats(where.x), as_floats(where.y), as_floats(where.mu)
    assert (x[0], y[0], mu[0]) == pytest.approx((50, 50, 1))
    # 90 degrees west is on the right-hand limb, at the edge of sight.
    assert x[1] == pytest.approx(90, abs=0.01)
    assert mu[1] == pytest.approx(0, abs=1e-9)


def test_carries_features_forward_with_the_suns_rotation() -> None:
    # A week before, the equator at today's central meridian was 92 degrees (the turn seen
    # from Earth) and 3.7 more (the equator outrunning the Carrington frame) east of centre.
    frame = Frame(np.zeros((100, 100, 3)), NEWEST - 7, 0.4)
    where = project(np.array([0.0]), np.array([0.0]), frame, NEWEST)
    assert as_floats(where.x)[0] < 15
    assert as_floats(where.mu)[0] == pytest.approx(math.cos(math.radians(96.1)), abs=0.005)


def test_samples_between_pixels_bilinearly_and_holds_the_edges() -> None:
    pixels = np.arange(16, dtype=np.float64).reshape(4, 4, 1)
    values = as_floats(sample(pixels, np.array([1.0, 0.0, 9.0]), np.array([0.5, 0.5, 3.5]))[:, 0])
    assert values == pytest.approx([0.5, 0, 15])


def test_smoothstep_eases_from_zero_to_one() -> None:
    assert as_floats(smoothstep(0, 1, np.array([-1.0, 0.5, 2.0]))) == pytest.approx([0, 0.5, 1])


def test_stitches_each_point_from_the_frame_that_saw_it_most_face_on() -> None:
    # A week before the newest frame, the Sun showed Earth what is now at the west limb.
    old = Frame(disc(128, 0.2), NEWEST - 6.82, 0.4)
    new = Frame(disc(128, 0.8), NEWEST, 0.4)
    lon, lat = np.radians(np.array([0.0, 90.0, 45.0])), np.zeros(3)
    stitched = composite([old, new], lon, lat)
    facing, west, between = as_floats(stitched.pixels[:, 0])
    assert facing == pytest.approx(0.8)
    assert west == pytest.approx(0.2)
    # Halfway, both frames saw it from the side and share it.
    assert 0.2 < between < 0.8
    assert as_floats(stitched.trust) == pytest.approx([1, 1, 1], abs=0.01)


def test_trusts_nothing_where_no_frame_looked() -> None:
    stitched = composite([Frame(disc(64, 0.5), NEWEST, 0.4)], np.array([math.pi]), np.zeros(1))
    assert as_floats(stitched.trust) == [0]


def test_blurs_on_the_sphere_keeping_a_flat_field_flat() -> None:
    flat = np.full((32, 64, 2), 0.25)
    assert np.allclose(blur(flat, 10), 0.25)
    # Next to the pole a row is spread over its whole ring.
    rows = np.zeros((32, 64, 1))
    rows[0, :8, 0] = 1
    assert float(np.ptp(blur(rows, 24)[:1])) < 1e-9


def test_fills_the_unseen_from_the_seen_without_edges() -> None:
    _, lat = grid(128)
    seen = np.abs(lat) < math.radians(60)
    pixels = np.where(seen, 0.6, 0.0)[..., np.newaxis] * np.ones(3)
    trust = smoothstep(0, 1, seen.astype(np.float64))
    plain = fill_unseen(Composite(pixels, trust), mottled=False)
    assert np.allclose(plain, 0.6)
    # A flat surface has no detail to copy, so the mottled fill is flat as well.
    assert np.allclose(fill_unseen(Composite(pixels, trust)), 0.6)


def test_mottles_the_fill_as_much_as_the_seen_surface_varies() -> None:
    lon, lat = grid(128)
    texture = 0.5 * (1 + 0.1 * sphere_noise(lon, lat, seed=7))
    pixels = texture[..., np.newaxis] * np.ones(3)
    trust = np.where(np.abs(lat) < math.radians(60), 1.0, 0.0)
    strength = detail_strength(Composite(pixels, trust))
    assert 0 < strength < 0.1
    filled = fill_unseen(Composite(pixels, trust))
    cap = filled[np.abs(lat) > math.radians(80)]
    assert float(np.std(cap)) > 0


def test_makes_smooth_unit_noise_that_meets_itself_across_the_far_side() -> None:
    lon, lat = grid(256)
    assert float(np.std(sphere_noise(lon, lat))) == pytest.approx(1)
    # The same place, reached from either side of the map.
    west, east = as_floats(sphere_noise(np.array([math.pi, -math.pi]), np.array([0.3, 0.3])))
    assert west == pytest.approx(east)


def test_measures_how_a_frame_darkens_toward_the_limb() -> None:
    frame = Frame(disc(256, 0.5, darkening=0.6), NEWEST, 0.4)
    profile = as_floats(radial_profile(frame))
    assert len(profile) == PROFILE_BINS
    # Three channels summed: 1.5 at the centre, 0.6 of the way down at the limb.
    assert profile[0] == pytest.approx(1.5, abs=0.01)
    assert profile[-1] == pytest.approx(1.5 * 0.4, abs=0.1)


def test_flattens_frames_to_a_face_on_view_at_the_newest_level() -> None:
    old = Frame(disc(256, 0.3, darkening=0.6), NEWEST - 7, 0.4)
    new = Frame(disc(256, 0.5, darkening=0.6), NEWEST, 0.4)
    flat_old, flat_new = flatten_all([old, new])
    inside = disc_radii(new) < 0.97
    # Evenly bright, at the level of the inner half of the newest disc.
    assert float(np.ptp(flat_new.pixels[inside])) < 0.01
    assert np.allclose(flat_new.pixels[inside], 0.49, atol=0.01)
    assert np.allclose(flat_old.pixels[inside], 0.49, atol=0.01)
    assert flatten(new, 3).jd == NEWEST


def test_rejects_blank_frames() -> None:
    assert usable(disc(64, 0.5), 0.4)
    assert not usable(np.zeros((64, 64, 3)), 0.4)


def test_converts_between_srgb_and_linear_light() -> None:
    values = np.array([0.0, 0.02, 0.5, 1.0])
    assert as_floats(srgb_from_linear(linear_from_srgb(values))) == pytest.approx(as_floats(values))
    assert as_floats(linear_from_srgb(np.array([188 / 255]))) == pytest.approx([0.5], abs=0.01)
