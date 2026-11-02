"""Month tables for lunisolar calendars, from DE441: Babylon's first crescents and China's months.

Babylonian months began on the evening the new crescent was first seen at Babylon. Which evening
that was is computed here with Yallop's (1997) q-test (NAO Technical Note 69): the crescent counts
as seen on the first evening after conjunction with q above -0.014 ("visible under perfect
conditions"). Where the call is close (q below +0.216 that evening, or above -0.160 the evening
before) the month is flagged: weather or a sharp-eyed scribe may have moved it a day. The tables
hold months only; which months were intercalary is the web app's business.

Chinese months follow the rules in use since 1645 (Reingold & Dershowitz, *Calendrical
Calculations*): a month begins on the day of the new moon, in Beijing's local time before 1929
and China's standard time (120° E) after; the month holding the winter solstice is the 11th; in a
year of 13 months from one 11th month to the next, the first month without a major solar term is
the leap month. Earlier courts used other rules, so before 1645 these months are approximate.

Times are TT from DE441 and converted to UT with Skyfield's ΔT model, the same as the eclipse
catalogs. Longitudes are of date; the Sun's is moved back by its aberration, the Moon's light time
(about a second) is left out.
"""

import itertools
import json
import math
from dataclasses import dataclass
from typing import TYPE_CHECKING, TypedDict

import numpy as np
from skyfield.api import load
from skyfield.framelib import ecliptic_frame, itrs

from histeclipse_pipeline.arrays import as_array, as_floats, as_ints

if TYPE_CHECKING:
    from pathlib import Path

    from histeclipse_pipeline.ephemeris import Ephemeris

type FloatArray = np.typing.NDArray[np.float64]
type IntArray = np.typing.NDArray[np.int64]

SCHEMA_VERSION = 1
MEAN_SYNODIC_MONTH = 29.530588861
#: A mean new moon (Meeus eq. 49.1, k = 0), JDE.
NEW_MOON_EPOCH = 2_451_550.09766
J2000 = 2_451_545.0
SECONDS_PER_DAY = 86_400.0
MOON_RADIUS_KM = 1737.4
EARTH_EQUATORIAL_KM = 6378.137
EARTH_FLATTENING = 1 / 298.257223563
#: Standard altitude of the Sun's upper limb at sunset, refraction included (degrees).
SUNSET_ALTITUDE = -0.8333
#: The Sun's apparent lag behind its geometric longitude, degrees.
SUN_ABERRATION = 20.4898 / 3600

#: Yallop's q thresholds: easily visible (A), visible in perfect conditions (B), and the lower
#: edge of "may need optical aid" (C).
Q_EASY = 0.216
Q_PERFECT = -0.014
Q_MAYBE = -0.160

#: Babylon, the ruins by Hillah.
BABYLON_LATITUDE = 32.5355
BABYLON_LONGITUDE = 44.4275
#: Beijing's meridian (116° 25' E) before 1929; China's standard time (UTC+8) from then.
BEIJING_LONGITUDE = 116 + 25 / 60
CHINA_STANDARD_LONGITUDE = 120.0
CHINA_STANDARD_FROM_JD = 2_425_611.5  # 1929-01-01 00:00 UT
WINTER_SOLSTICE_TERM = 9  # the major term at 270°: term n is at 30n degrees
MONTHS_IN_LEAP_YEAR = 13

BABYLON_CREDIT = (
    "Computed for this site from JPL DE441 with Skyfield's ΔT; first visibility by Yallop's q-test "
    "(1997) at Babylon"
)
CHINESE_CREDIT = (
    "Computed for this site from JPL DE441 with Skyfield's ΔT, by the rules in use since 1645 "
    "(Reingold & Dershowitz, Calendrical Calculations)"
)


def _wrap180(degrees: FloatArray) -> FloatArray:
    return np.asarray((degrees + 180.0) % 360.0 - 180.0, dtype=np.float64)


def _segment_km(ephemeris: Ephemeris, jd_tt: FloatArray) -> tuple[FloatArray, FloatArray]:
    """Geocentric Moon and Sun, km, ICRF; TDB taken as TT (they differ by under 2 ms)."""
    whole = np.floor(jd_tt)
    fraction = jd_tt - whole
    earth = ephemeris.segment(3, 399).compute(whole, fraction)
    moon = ephemeris.segment(3, 301).compute(whole, fraction) - earth
    sun = (
        ephemeris.segment(0, 10).compute(whole, fraction)
        - ephemeris.segment(0, 3).compute(whole, fraction)
        - earth
    )
    return np.atleast_2d(moon.T).T, np.atleast_2d(sun.T).T


def _rotate(matrices: FloatArray, vectors: FloatArray) -> FloatArray:
    """Apply (3, 3, N) rotations to (3, N) vectors."""
    return np.asarray(np.sum(matrices * vectors[np.newaxis, :, :], axis=1), dtype=np.float64)


def _row(vectors: FloatArray, index: int) -> FloatArray:
    """One component of (3, N) vectors."""
    return np.asarray(np.squeeze(vectors[index : index + 1], axis=0), dtype=np.float64)


def _longitude(vectors: FloatArray) -> FloatArray:
    return np.asarray(np.degrees(np.arctan2(_row(vectors, 1), _row(vectors, 0))), dtype=np.float64)


def ecliptic_longitudes(ephemeris: Ephemeris, jd_tt: FloatArray) -> tuple[FloatArray, FloatArray]:
    """Return the Moon's and the Sun's longitudes on the ecliptic and equinox of date, degrees."""
    timescale = load.timescale(builtin=True)
    rotation = ecliptic_frame.rotation_at(timescale.tt_jd(jd_tt))
    rotation = rotation.reshape(3, 3, -1)
    moon, sun = _segment_km(ephemeris, jd_tt)
    moon_ecl, sun_ecl = _rotate(rotation, moon), _rotate(rotation, sun)
    # The Sun is seen where it was 8.3 minutes before, and aberration shifts it: together
    # 20.4898″ back along the ecliptic (Meeus ch. 25), which moves solar terms by 8 minutes.
    return _longitude(moon_ecl) % 360.0, (_longitude(sun_ecl) - SUN_ABERRATION) % 360.0


def new_moons(ephemeris: Ephemeris, start_jd_tt: float, end_jd_tt: float) -> FloatArray:
    """Every new moon (the Moon's and Sun's longitudes equal) in the range, TT Julian Days."""
    first = math.floor((start_jd_tt - NEW_MOON_EPOCH) / MEAN_SYNODIC_MONTH) - 1
    last = math.ceil((end_jd_tt - NEW_MOON_EPOCH) / MEAN_SYNODIC_MONTH) + 1
    jd = NEW_MOON_EPOCH + MEAN_SYNODIC_MONTH * np.arange(first, last + 1, dtype=np.float64)
    for _ in range(12):
        jd = np.clip(jd, ephemeris.start_jd, ephemeris.end_jd)
        moon, sun = ecliptic_longitudes(ephemeris, jd)
        # The Moon gains on the Sun 10 to 15 degrees a day: a fixed slope converges.
        jd = jd - _wrap180(moon - sun) / 12.19
    return jd[(jd >= start_jd_tt) & (jd < end_jd_tt)]


def major_terms(
    ephemeris: Ephemeris, start_jd_tt: float, end_jd_tt: float
) -> tuple[FloatArray, IntArray]:
    """Every major solar term (the Sun at a multiple of 30°): TT Julian Days and term (0-11)."""
    rate = 360.0 / 365.242189
    mean_at_j2000 = 280.46646
    first = math.floor((mean_at_j2000 + (start_jd_tt - J2000) * rate) / 30.0) - 1
    last = math.ceil((mean_at_j2000 + (end_jd_tt - J2000) * rate) / 30.0) + 1
    targets = 30.0 * np.arange(first, last + 1, dtype=np.float64)
    jd = J2000 + (targets - mean_at_j2000) / rate
    for _ in range(8):
        jd = np.clip(jd, ephemeris.start_jd, ephemeris.end_jd)
        _, sun = ecliptic_longitudes(ephemeris, jd)
        jd = jd - _wrap180(sun - targets) / rate
    terms = np.asarray(np.mod(np.arange(first, last + 1), 12), dtype=np.int64)
    keep = (jd >= start_jd_tt) & (jd < end_jd_tt)
    return jd[keep], terms[keep]


def ut_of(jd_tt: FloatArray) -> FloatArray:
    """UT Julian Days for TT ones, by Skyfield's ΔT model."""
    timescale = load.timescale(builtin=True)
    return jd_tt - as_array(timescale.tt_jd(jd_tt).delta_t) / SECONDS_PER_DAY


def local_day(jd_ut: FloatArray, longitude: float | FloatArray) -> IntArray:
    """Return the Julian Day Number of the local mean-time civil date at each instant."""
    return np.asarray(np.floor(jd_ut + 0.5 + np.asarray(longitude) / 360.0), dtype=np.int64)


# --- Babylon: first visibility of the crescent ------------------------------------------------


def _observer_itrs(latitude: float, longitude: float) -> tuple[FloatArray, FloatArray]:
    """Place a site on the WGS84 ellipsoid at sea level: position (km) and zenith, Earth-fixed."""
    phi, lam = math.radians(latitude), math.radians(longitude)
    e2 = EARTH_FLATTENING * (2 - EARTH_FLATTENING)
    n = EARTH_EQUATORIAL_KM / math.sqrt(1 - e2 * math.sin(phi) ** 2)
    up = np.array(
        [math.cos(phi) * math.cos(lam), math.cos(phi) * math.sin(lam), math.sin(phi)],
        dtype=np.float64,
    )
    position = np.array([n * up[0], n * up[1], n * (1 - e2) * up[2]], dtype=np.float64)
    return position, up


@dataclass(frozen=True, slots=True)
class Sky:
    """The Sun and Moon above a site at many instants (degrees; km for distances)."""

    sun_altitude: FloatArray
    moon_altitude: FloatArray
    #: Altitudes as seen from Earth's center, against the site's horizon: Yallop's ARCV uses them.
    sun_geocentric_altitude: FloatArray
    moon_geocentric_altitude: FloatArray
    elongation: FloatArray
    moon_distance: FloatArray
    moon_parallax: FloatArray


def sky_at(ephemeris: Ephemeris, jd_ut: FloatArray, latitude: float, longitude: float) -> Sky:
    """Airless altitudes, topocentric and geocentric, and the Moon's topocentric elongation."""
    timescale = load.timescale(builtin=True)
    times = timescale.ut1_jd(jd_ut)
    jd_tt = as_array(times.tt)
    to_earth = itrs.rotation_at(times).reshape(3, 3, -1)
    position, up = _observer_itrs(latitude, longitude)
    count = len(jd_tt)
    # Earth-fixed to celestial: the transpose of the frame's rotation.
    to_sky = np.swapaxes(to_earth, 0, 1)
    observer = _rotate(to_sky, np.repeat(position[:, np.newaxis], count, axis=1))
    zenith = _rotate(to_sky, np.repeat(up[:, np.newaxis], count, axis=1))
    moon, sun = _segment_km(ephemeris, jd_tt)

    def altitude(vector: FloatArray) -> FloatArray:
        unit = vector / np.linalg.norm(vector, axis=0)
        return np.asarray(np.degrees(np.arcsin(np.sum(unit * zenith, axis=0))), dtype=np.float64)

    moon_topo, sun_topo = moon - observer, sun - observer
    cosine = np.sum(moon_topo * sun_topo, axis=0) / (
        np.linalg.norm(moon_topo, axis=0) * np.linalg.norm(sun_topo, axis=0)
    )
    distance = np.asarray(np.linalg.norm(moon, axis=0), dtype=np.float64)
    return Sky(
        sun_altitude=altitude(sun_topo),
        moon_altitude=altitude(moon_topo),
        sun_geocentric_altitude=altitude(sun),
        moon_geocentric_altitude=altitude(moon),
        elongation=np.asarray(np.degrees(np.arccos(np.clip(cosine, -1, 1))), dtype=np.float64),
        moon_distance=np.asarray(np.linalg.norm(moon_topo, axis=0), dtype=np.float64),
        moon_parallax=np.asarray(
            np.degrees(np.arcsin(EARTH_EQUATORIAL_KM / distance)), dtype=np.float64
        ),
    )


def _crossing(
    ephemeris: Ephemeris,
    guess_ut: FloatArray,
    target: FloatArray | float,
    site: tuple[float, float],
    *,
    moon: bool,
) -> FloatArray:
    """Find when the Sun (or Moon) sets through ``target`` altitude, by Newton from ``guess_ut``."""
    latitude, longitude = site
    step = 1 / 1440
    jd = guess_ut.copy()
    for _ in range(8):
        here = sky_at(ephemeris, jd, latitude, longitude)
        later = sky_at(ephemeris, jd + step, latitude, longitude)
        now = here.moon_altitude if moon else here.sun_altitude
        then = later.moon_altitude if moon else later.sun_altitude
        slope = np.minimum((then - now) / step, -1.0)  # setting: always falling; at least 1°/day
        jd = jd - np.clip((now - target) / slope, -0.25, 0.25)
    return jd


def yallop_q(sky: Sky) -> FloatArray:
    """Yallop's q at the best time: ARCV against the topocentric crescent width W'."""
    arcv = sky.moon_geocentric_altitude - sky.sun_geocentric_altitude
    semidiameter = np.degrees(np.arcsin(MOON_RADIUS_KM / sky.moon_distance)) * 60.0
    width = semidiameter * (1 - np.cos(np.radians(sky.elongation)))
    curve = 11.8371 - 6.3226 * width + 0.7319 * width**2 - 0.1018 * width**3
    return np.asarray((arcv - curve) / 10.0, dtype=np.float64)


@dataclass(frozen=True, slots=True)
class Evenings:
    """For each new moon, Yallop's q on the evenings after it at a site (-inf if none to see)."""

    #: Local civil date (Julian Day Number) of each evening, shape (months, evenings).
    days: IntArray
    q: FloatArray


EVENINGS = 4


def evenings_after(
    ephemeris: Ephemeris, conjunctions_tt: FloatArray, latitude: float, longitude: float
) -> Evenings:
    """Yallop's q at the best time on each of the evenings after each conjunction."""
    conjunctions = ut_of(conjunctions_tt)
    first = local_day(conjunctions, longitude)
    days = first[:, np.newaxis] + np.arange(EVENINGS)[np.newaxis, :]
    flat_days = days.ravel().astype(np.float64)
    midnight = flat_days - 0.5 - longitude / 360.0
    site = (latitude, longitude)
    sunset = _crossing(ephemeris, midnight + 18 / 24, SUNSET_ALTITUDE, site, moon=False)
    at_sunset = sky_at(ephemeris, sunset, latitude, longitude)
    # The Moon's upper limb at the horizon, refraction and parallax allowed for (Meeus 15.1).
    moon_target = 0.7275 * at_sunset.moon_parallax - 0.5667
    moonset = _crossing(ephemeris, sunset + 1 / 48, moon_target, site, moon=True)
    lag = moonset - sunset
    best = sky_at(ephemeris, sunset + 4 / 9 * np.maximum(lag, 0.0), latitude, longitude)
    q = yallop_q(best)
    after = sunset > np.repeat(conjunctions, EVENINGS)
    above = at_sunset.moon_altitude > moon_target
    q = np.where(after & above & (lag > 0), q, -np.inf)
    return Evenings(days=days, q=np.asarray(q.reshape(days.shape), dtype=np.float64))


@dataclass(frozen=True, slots=True)
class CrescentMonths:
    """Month beginnings: the civil day (JDN) after the evening of first visibility."""

    first_days: IntArray
    uncertain: np.typing.NDArray[np.bool_]


def crescent_months(evenings: Evenings) -> CrescentMonths:
    """Find the first evening each crescent is seen, and whether that call is close."""
    q_rows = [
        as_floats(np.squeeze(evenings.q[row : row + 1], axis=0)) for row in range(len(evenings.q))
    ]
    day_rows = [as_ints(evenings.days[row : row + 1]) for row in range(len(evenings.days))]
    first_days: list[int] = []
    uncertain: list[bool] = []
    for q, days in zip(q_rows, day_rows, strict=True):
        index = next((i for i, value in enumerate(q) if value > Q_PERFECT), None)
        if index is None:
            msg = f"A crescent not seen within {EVENINGS} evenings of conjunction"
            raise ValueError(msg)
        before = q[index - 1] if index > 0 else -math.inf
        # The Babylonian day began at that sunset: day 1 is the civil date that follows.
        day = days[index] + 1
        close = q[index] < Q_EASY or before > Q_MAYBE
        if first_days:
            # A month had 29 or 30 days: unseen on the 30th evening, the next began anyway.
            held = min(max(day, first_days[-1] + 29), first_days[-1] + 30)
            close = close or held != day
            day = held
        first_days.append(day)
        uncertain.append(close)
    return CrescentMonths(
        first_days=np.array(first_days, dtype=np.int64),
        uncertain=np.array(uncertain, dtype=np.bool_),
    )


class CrescentTable(TypedDict):
    """Contents of ``calendars/babylon.json``. Mirrors the web app's schema."""

    schemaVersion: int
    credit: str
    site: list[float]
    firstDay: int
    lengths: str
    uncertain: list[int]


def crescent_table(months: CrescentMonths) -> CrescentTable:
    """Months as their first day and a string of lengths: "0" for 29 days, "1" for 30."""
    days = as_ints(months.first_days)
    lengths = [after - before for before, after in itertools.pairwise(days)]
    odd = sorted({length for length in lengths if length not in {29, 30}})
    if odd:
        msg = f"Month lengths outside 29-30 days: {odd}"
        raise ValueError(msg)
    flags = as_ints(months.uncertain.astype(np.int64))
    return {
        "schemaVersion": SCHEMA_VERSION,
        "credit": BABYLON_CREDIT,
        "site": [BABYLON_LATITUDE, BABYLON_LONGITUDE],
        "firstDay": days[0],
        "lengths": "".join("1" if length == 30 else "0" for length in lengths),  # noqa: PLR2004
        "uncertain": [index for index, flag in enumerate(flags[:-1]) if flag],
    }


# --- China: months by new moons and major solar terms -----------------------------------------


def china_longitude(jd_ut: FloatArray) -> FloatArray:
    """Return the meridian China kept time by: Beijing's before 1929, 120° E from then."""
    return np.where(jd_ut < CHINA_STANDARD_FROM_JD, BEIJING_LONGITUDE, CHINA_STANDARD_LONGITUDE)


@dataclass(frozen=True, slots=True)
class ChineseMonth:
    """One month: its first day (JDN), number (1-12) and whether it is a leap month."""

    first_day: int
    number: int
    leap: bool


def chinese_months(
    month_starts: IntArray, term_days: IntArray, terms: IntArray
) -> list[ChineseMonth]:
    """Assign numbers to the months between the first and last winter-solstice months.

    ``month_starts`` are the days of consecutive new moons; ``term_days`` and ``terms`` the days
    of the major solar terms and which they are.
    """
    starts = as_ints(month_starts)
    term_list = list(zip(as_ints(term_days), as_ints(terms), strict=True))
    bounds = list(itertools.pairwise(starts))
    held = [[term for day, term in term_list if start <= day < end] for start, end in bounds]
    elevenths = [index for index, terms_in in enumerate(held) if WINTER_SOLSTICE_TERM in terms_in]
    months: list[ChineseMonth] = []
    for start, end in itertools.pairwise(elevenths):
        leap = -1
        if end - start == MONTHS_IN_LEAP_YEAR:
            leap = next(index for index in range(start + 1, end) if not held[index])
        number = 11
        for index in range(start, end):
            if index == leap:
                months.append(ChineseMonth(starts[index], number, leap=True))
                continue
            if index > start:
                number = number % 12 + 1
            months.append(ChineseMonth(starts[index], number, leap=False))
    return months


class ChineseTable(TypedDict):
    """Contents of ``calendars/chinese.json``. Mirrors the web app's schema."""

    schemaVersion: int
    credit: str
    firstYear: int
    #: Per year from its first month: [first day (JDN), month lengths as bits (1 = 30 days, the
    #: first month in the lowest bit), leap month's position (1-13) or 0].
    years: list[list[int]]


def chinese_table(months: list[ChineseMonth], first_year: int) -> ChineseTable:
    """Group months into years from each first month; ``first_year`` is that of the first one."""
    starts = [index for index, month in enumerate(months) if month.number == 1 and not month.leap]
    years: list[list[int]] = []
    for start, end in itertools.pairwise(starts):
        lengths = 0
        leap = 0
        for position, index in enumerate(range(start, end)):
            if months[index + 1].first_day - months[index].first_day == 30:  # noqa: PLR2004
                lengths |= 1 << position
            if months[index].leap:
                leap = position + 1
        years.append([months[start].first_day, lengths, leap])
    return {
        "schemaVersion": SCHEMA_VERSION,
        "credit": CHINESE_CREDIT,
        "firstYear": first_year,
        "years": years,
    }


def write_table(table: CrescentTable | ChineseTable, path: Path) -> None:
    """Write compact JSON with a trailing newline."""
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_text(json.dumps(table, separators=(",", ":")) + "\n")


def babylonian_table(ephemeris: Ephemeris, start_jd_tt: float, end_jd_tt: float) -> CrescentTable:
    """First-crescent months at Babylon for the conjunctions in the range."""
    conjunctions = new_moons(ephemeris, start_jd_tt, end_jd_tt)
    evenings = evenings_after(ephemeris, conjunctions, BABYLON_LATITUDE, BABYLON_LONGITUDE)
    return crescent_table(crescent_months(evenings))


def chinese_year_table(
    ephemeris: Ephemeris, start_jd_tt: float, end_jd_tt: float, first_year: int
) -> ChineseTable:
    """Chinese years whose first months fall in the range; ``first_year`` names the first."""
    conjunctions = ut_of(new_moons(ephemeris, start_jd_tt, end_jd_tt))
    term_times, terms = major_terms(ephemeris, start_jd_tt, end_jd_tt)
    term_ut = ut_of(term_times)
    months = chinese_months(
        local_day(conjunctions, china_longitude(conjunctions)),
        local_day(term_ut, china_longitude(term_ut)),
        terms,
    )
    return chinese_table(months, first_year)
