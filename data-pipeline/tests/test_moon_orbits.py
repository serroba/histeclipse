"""The moons' orbits: mean elements fitted to Horizons, and where they put each moon."""

from __future__ import annotations

import math
import random

import pytest

from histeclipse_pipeline.moon_orbits import (
    J2000,
    MOONS,
    START,
    STOP,
    Orbit,
    State,
    angle_off,
    fit_orbit,
    fit_polynomial,
    laplace_frame,
    orbit_json,
    parse_states,
    position,
    sample_times,
    swing,
    swings,
    unwrapped,
    wrap,
)

#: A made-up moon: Io's size of orbit, a little eccentric and inclined, everything turning.
GM = 126_686_534.0
AXIS = 421_800.0
RATE = math.degrees(math.sqrt(GM / AXIS**3)) * 86400
MADE_UP = Orbit(
    planet="jupiter",
    axis=AXIS,
    eccentricity=0.01,
    inclination=2.0,
    longitude=(40.0, RATE, 0.0),
    swings=(),
    pericentre=(100.0, 0.1),
    node=(200.0, -0.05),
    pole=(268.0, 64.5),
)


def state(orbit: Orbit, jd: float) -> State:
    """Where the made-up moon is, and its velocity, by differencing its positions."""
    step = 1e-4
    before, after = position(orbit, jd - step), position(orbit, jd + step)
    velocity = tuple((a - b) / (2 * step * 86400) for a, b in zip(after, before, strict=True))
    return State(jd, position(orbit, jd), (velocity[0], velocity[1], velocity[2]))


def test_each_moon_is_asked_of_horizons_about_its_own_planet() -> None:
    assert MOONS["phobos"] == ("401", "500@499", "mars", (317.7, 52.9))
    assert MOONS["titan"] == ("606", "500@699", "saturn", (36.4, 84.0))
    assert len(MOONS) == 14


def test_horizons_states_are_read_from_its_data_block() -> None:
    text = (
        "header\n$$SOE\n"
        "2451545.000000000, A.D. 2000-Jan-01 12:00:00.0000, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0,\n"
        "$$EOE\nfooter"
    )
    assert parse_states(text) == [State(2451545.0, (1.0, 2.0, 3.0), (4.0, 5.0, 6.0))]
    with pytest.raises(ValueError, match="no data block"):
        _ = parse_states("nothing here")


def test_angles_wrap_within_half_a_turn() -> None:
    assert wrap(190) == -170
    assert wrap(-190) == 170


def test_the_laplace_frame_starts_at_its_node_on_the_equator() -> None:
    # Given a pole tipped towards +y.
    x, y, z = laplace_frame((0.0, math.sin(0.1), math.cos(0.1)))
    # Then x is its ascending node on the equator, where it climbs north: at -x, as an orbit
    # whose pole tips to +y crosses the equator northwards there.
    assert x == pytest.approx((-1.0, 0.0, 0.0))
    assert sum(a * b for a, b in zip(y, z, strict=True)) == pytest.approx(0.0)


def test_a_polynomial_is_fitted_by_least_squares() -> None:
    ts = [-36525.0, 0.0, 36525.0, 73050.0]
    coefficients = fit_polynomial(ts, [3 + 2 * t + 1e-9 * t * t for t in ts], 2)
    assert coefficients == pytest.approx([3, 2, 1e-9])


def test_angles_are_unwrapped_outwards_from_j2000() -> None:
    # Given an angle turning 50 degrees a day, sampled ever further from J2000.
    ts = [0.0, 1.0, -1.0, 2.0, -3.0, 5.0, 8.0, -13.0, 21.0]
    wrapped = [wrap(50 * t) for t in ts]
    # When it is unwrapped from a rough rate.
    # Then each sample is its whole turning.
    assert unwrapped(ts, wrapped, 45, 1) == pytest.approx([50 * t for t in ts])


def test_samples_crowd_about_j2000_then_spread_across_the_span() -> None:
    times = sample_times(1.77, seed=1)
    assert times[0] == J2000
    assert min(abs(t - J2000) for t in times[1:]) == pytest.approx(1.77 / 20)
    assert all(START <= t <= STOP for t in times)
    assert len(times) > 1000


def test_a_made_up_moon_s_orbit_is_found_again_from_its_states() -> None:
    # Given the made-up moon's states, across the span.
    generator = random.Random(7)  # noqa: S311 - reproducible, not security
    jds = [J2000 + 0.05 * k for k in range(40)] + [
        generator.uniform(START, STOP) for _ in range(400)
    ]
    states = [state(MADE_UP, jd) for jd in jds]
    # When its orbit is fitted.
    orbit = fit_orbit("jupiter", (268.0, 64.5), states)
    # Then it puts the moon where it was, within a hundredth of a degree, at other moments.
    for jd in (START + 1000.5, J2000 + 123.4, STOP - 77.7):
        assert angle_off(position(orbit, jd), position(MADE_UP, jd)) < 0.01
    assert orbit.axis == pytest.approx(AXIS, rel=1e-3)
    assert orbit.eccentricity == pytest.approx(0.01, abs=1e-3)


def test_an_orbit_is_written_as_the_site_reads_it() -> None:
    data = orbit_json(MADE_UP)
    assert data["planet"] == "jupiter"
    assert data["axisKm"] == AXIS
    assert data["pole"] == [268.0, 64.5]
    assert data["longitude"] == [40.0, round(RATE, 10), 0.0]


def test_a_swing_in_what_the_steady_motion_leaves_is_found() -> None:
    # Given a 5-degree swing every 1000 days, sampled across the span.
    generator = random.Random(3)  # noqa: S311 - reproducible, not security
    ts = [generator.uniform(START, STOP) - J2000 for _ in range(500)]
    left = [5 * math.sin(2 * math.pi * t / 1000) for t in ts]
    # When swings are searched for.
    found = swings(ts, left)
    # Then the one swing is found, its period and size, and nothing else.
    assert len(found) == 1
    period, a, b = found[0]
    assert period == pytest.approx(1000, rel=0.002)
    assert math.hypot(a, b) == pytest.approx(5, rel=0.05)
    assert swing(tuple(found), 250) == pytest.approx(5, abs=0.3)


def test_a_steady_motion_has_no_swing() -> None:
    assert swings([0.0, 100.0, 200.0, 300.0], [0.0, 0.0, 0.0, 0.0]) == []
