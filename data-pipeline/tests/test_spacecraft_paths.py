"""The craft's paths: which spans to ask Horizons for, and how few points draw them."""

from __future__ import annotations

from histeclipse_pipeline.spacecraft_paths import (
    EARTH_TOLERANCE,
    FLYBY_TOLERANCE,
    POINT_TOLERANCE,
    SUN_TOLERANCE,
    Span,
    Stay,
    bound,
    day,
    encoded,
    plan,
    range_url,
    samples_of,
    shifted,
    spacecraft_ids,
    thinned,
)


def test_a_phase_date_is_read_to_the_day_its_doubt_dropped() -> None:
    assert day("1979-04-30T18:30?") == "1979-04-30"
    assert day("1979-05?") is None
    assert day(None) is None
    assert shifted("2000-01-30", 5) == "2000-02-04T00:00"


def test_a_flight_past_a_planet_is_asked_for_about_the_sun_hourly_while_it_passes() -> None:
    # Given Voyager-like phases: leaving Earth, cruising, passing Jupiter, cruising on.
    phases: list[list[object]] = [
        ["Earth", "1977-08-20T19:37", "1977-08-22T08:24", "EO", "HCO"],
        ["Sun", "1977-08-22T08:24", "1979-02-20", "EO", "Jupiter"],
        ["Jupiter", "1979-02-20", "1979-03-15", "EN", "HCO"],
        ["Sun", "1979-03-15", None, "O", "HCO"],
    ]
    # When the spans are planned, up to 2030.
    pieces = plan(phases, "1977-08-20", "2030-01-01")
    # Then Earth's days are hourly about Earth, the cruise daily, the flyby hourly.
    assert pieces[0] == Span("1977-08-20", "1977-08-22", "Earth", "1 h", EARTH_TOLERANCE)
    assert Span("1977-08-22", "1979-02-20", "Sun", "1 d", SUN_TOLERANCE) in pieces
    assert Span("1979-02-20", "1979-03-15", "Sun", "1 h", FLYBY_TOLERANCE) in pieces
    assert pieces[-1] == Span("1979-03-15", "2030-01-01", "Sun", "1 d", SUN_TOLERANCE)


def test_a_long_stay_in_orbit_is_kept_as_a_span_at_its_world() -> None:
    # Given an orbiter at Saturn for 13 years, still there when its record ends.
    phases: list[list[object]] = [["Saturn", "2004-07-01", "2017-09-15", "D", "-"]]
    assert plan(phases, "1997-10-15", "2030-01-01") == [Stay("2004-07-01", "2017-09-15", "Saturn")]


def test_a_trip_near_earth_is_hourly_at_each_end_six_hourly_between() -> None:
    # Given three weeks on the way to the Moon.
    phases: list[list[object]] = [["Earth", "2022-11-16", "2022-12-07", "EO", "Luna"]]
    pieces = plan(phases, "2022-11-16", "2030-01-01")
    assert [(p.step, p.start, p.stop) for p in pieces if isinstance(p, Span)] == [
        ("1 h", "2022-11-16", "2022-11-21T00:00"),
        ("6 h", "2022-11-21T00:00", "2022-12-02T00:00"),
        ("1 h", "2022-12-02T00:00", "2022-12-07"),
    ]


def test_years_at_an_l_point_are_daily_and_years_about_the_moon_a_stay() -> None:
    phases: list[list[object]] = [
        ["SEL2", "2022-01-24", None, "O", "-"],
        ["Luna", "2009-06-23", None, "O", "-"],
    ]
    pieces = plan(phases, "2009-06-18", "2030-01-01")
    assert pieces == [
        Span("2022-01-24", "2030-01-01", "Earth", "1 d", POINT_TOLERANCE),
        Stay("2009-06-23", None, "Luna"),
    ]


def test_phases_outside_horizons_s_coverage_are_left_out() -> None:
    phases: list[list[object]] = [["Sun", "1960-01-01", "1961-01-01", "O", "-"]]
    assert plan(phases, "1990-01-01", "2030-01-01") == []


def test_a_straight_steady_path_is_kept_in_two_points() -> None:
    samples = [(float(t), 10.0 * t, 0.0, 0.0) for t in range(10)]
    assert thinned(samples, 1.0) == [samples[0], samples[-1]]


def test_a_turn_is_kept_where_the_path_strays_from_the_straight_line() -> None:
    # Given a path that goes out along x, then back along y.
    samples = [(float(t), float(min(t, 5)), float(max(t - 5, 0)), 0.0) for t in range(11)]
    kept = thinned(samples, 0.1)
    # Then the corner stays, and only it.
    assert [t for t, *_ in kept] == [0.0, 5.0, 10.0]


def test_a_steady_path_drawn_at_the_wrong_pace_is_not_thinned() -> None:
    # Given a craft that waits, then hurries along a straight line.
    samples = [(0.0, 0.0, 0.0, 0.0), (1.0, 0.0, 0.0, 0.0), (2.0, 100.0, 0.0, 0.0)]
    # Then the wait is kept: at t = 1 the straight path would put it 50 km on.
    assert len(thinned(samples, 1.0)) == 3


def test_horizons_is_asked_for_vectors_about_the_sun_or_earth() -> None:
    url = range_url("-31", "Sun", "1979-03-01", "1979-03-10", "1 d")
    assert "CENTER=%27500%4010%27" in url
    assert "STEP_SIZE=%271+d%27" in url
    assert "CENTER=%27500%40399%27" in range_url("-31", "Earth", "a", "b", "1 h")


def test_horizons_answers_are_read_and_written_compactly() -> None:
    text = (
        "$$SOE\n2443933.500000000, A.D. 1979-Mar-01 00:00:00.0000, -4.763603833595244E+08, "
        " 5.700812361199851E+08,  2.561016009503445E+08,\n$$EOE"
    )
    samples = samples_of(text)
    assert samples == [(2443933.5, -476360383.3595244, 570081236.1199851, 256101600.9503445)]
    assert encoded(samples) == [[43933.5, -476360383, 570081236, 256101601]]
    assert samples_of("no data") == []


def test_horizons_coverage_is_read_from_its_refusals() -> None:
    refusal = 'No ephemeris for target "Voyager 1" prior to A.D. 1977-SEP-05 14:01:39.1823 TDB'
    assert bound(refusal, "prior to") == "1977-09-05"
    assert bound("something else", "after") is None


def test_spacecraft_are_found_in_horizons_s_list_by_their_cospar_designation() -> None:
    listing = (
        "      -31  Voyager 1 (spacecraft)             1977-084A                         \n"
        "      -98  New Horizons (spacecraft)          2006-001A    NH New_Horizons      \n"
        "      399  Earth                                           Geocenter            \n"
    )
    assert spacecraft_ids(listing) == {"1977-084A": "-31", "2006-001A": "-98"}


def test_flybys_of_moons_in_orbit_about_their_planet_are_one_stay_at_the_planet() -> None:
    # Given an orbiter at Saturn, a Titan flyby, and Saturn again.
    phases: list[list[object]] = [
        ["Saturn", "2004-07-01", "2005-10-25", "EN", "Titan"],
        ["Titan", "2005-10-25", "2005-10-30", "EN", "Saturn"],
        ["Saturn", "2005-10-30", "2017-09-15", "D", "-"],
    ]
    # Then it is one stay at Saturn.
    assert plan(phases, "1997-10-15", "2030-01-01") == [Stay("2004-07-01", "2017-09-15", "Saturn")]
