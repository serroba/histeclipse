"""Solar eclipses from DE441: search, Besselian elements, and circumstances of greatest eclipse.

Besselian elements describe the Moon's shadow in the *fundamental plane*: the plane through
Earth's center perpendicular to the shadow axis. With them, the shadow on the ground at any
instant reduces to a few lines of trigonometry, which the web app runs on the GPU.

Method and constants follow the Explanatory Supplement to the Astronomical Almanac (ch. 11)
and NASA's Five Millennium Canon of Solar Eclipses (Espenak & Meeus 2006): apparent positions
of Sun and Moon referred to the true equator and equinox of date; lunar radius k = 0.272488
for the penumbra and 0.272281 for the umbra; elements fitted as cubics in hours from t0, the
whole TT hour nearest greatest eclipse.
"""

import itertools
import math
from dataclasses import dataclass
from enum import StrEnum
from typing import TYPE_CHECKING

import numpy as np
from skyfield.api import load
from skyfield.searchlib import find_minima

from histeclipse_pipeline.arrays import FloatArray, as_array, as_floats
from histeclipse_pipeline.kernels import KernelLibrary

if TYPE_CHECKING:
    from collections.abc import Callable, Sequence
    from pathlib import Path

    from skyfield.timelib import Time, Timescale

    from histeclipse_pipeline.ephemeris import Ephemeris, RoutedSegment

EARTH_RADIUS_KM = 6378.137
EARTH_ECCENTRICITY_SQUARED = 0.00669438
SUN_RADIUS_KM = 696_000.0
# NASA's published constants (e.g. https://eclipse.gsfc.nasa.gov/SEsearch/SEdata.php?Ecl=+20240408):
# k1 = 0.272488 (IAU) for the penumbra, k2 = 0.272281 for the umbra, which accounts for valleys
# on the lunar limb.
MOON_RADIUS_PENUMBRA = 0.272488
MOON_RADIUS_UMBRA = 0.272281

# How fast the hour angle grows per second of UT: 360° * 1.002737909 per 86,400 s.
SIDEREAL_DEGREES_PER_SECOND = 360 * 1.002737909 / 86_400

# Geocentric Sun-Moon separation beyond which no solar eclipse is possible (about 1.58°).
CANDIDATE_SEPARATION_DEGREES = 1.8
FIT_HALF_SPAN_HOURS = 3
FIT_DEGREE = 3
# Skyfield samples up to one search step (5 days) outside the requested window.
SEARCH_MARGIN_DAYS = 6.0
_DAYS_PER_HOUR = 1 / 24


class SolarEclipseKind(StrEnum):
    """How the Moon covers the Sun at greatest eclipse."""

    PARTIAL = "partial"
    ANNULAR = "annular"
    TOTAL = "total"
    HYBRID = "hybrid"


@dataclass(frozen=True, slots=True)
class BesselianElements:
    """Cubic polynomials in hours ``h`` from ``t0_jd_tt``; coefficients lowest power first.

    ``x``, ``y``: shadow axis in the fundamental plane, Earth radii. ``d``: declination of the
    axis, degrees. ``mu``: ephemeris hour angle of the axis, degrees, as NASA tabulates it;
    the Greenwich hour angle is ``mu - delta_t * SIDEREAL_DEGREES_PER_SECOND``.
    ``l1``, ``l2``: penumbra and umbra radii in the fundamental plane, Earth radii (``l2`` < 0
    means the umbra reaches beyond the plane: a total eclipse).
    """

    t0_jd_tt: float
    delta_t: float
    x: tuple[float, ...]
    y: tuple[float, ...]
    d: tuple[float, ...]
    mu: tuple[float, ...]
    l1: tuple[float, ...]
    l2: tuple[float, ...]
    tan_f1: float
    tan_f2: float


@dataclass(frozen=True, slots=True)
class SolarEclipse:
    """A solar eclipse, with its elements and the circumstances at greatest eclipse."""

    greatest_jd_tt: float
    kind: SolarEclipseKind
    gamma: float
    magnitude: float
    delta_t_seconds: float
    greatest_latitude: float
    greatest_longitude: float
    elements: BesselianElements


def evaluate(coefficients: Sequence[float], hours: float) -> float:
    """Value of a lowest-power-first polynomial at ``hours`` (Horner's method)."""
    value = 0.0
    for coefficient in reversed(coefficients):
        value = value * hours + coefficient
    return value


class _SunMoonCosine:
    """Negative cosine of the geocentric Sun-Moon angle, from raw segments (fast, for searching).

    Its minima are the minima of the angle; comparing cosines avoids an inverse trig call.
    """

    step_days: float = 5.0

    def __init__(self, ephemeris: Ephemeris) -> None:
        self._sun: RoutedSegment = ephemeris.segment(0, 10)
        self._barycenter: RoutedSegment = ephemeris.segment(0, 3)
        self._earth: RoutedSegment = ephemeris.segment(3, 399)
        self._moon: RoutedSegment = ephemeris.segment(3, 301)

    def __call__(self, t: Time, /) -> FloatArray:
        whole, fraction = as_array(t.whole), as_array(t.tdb_fraction)
        earth = self._earth.compute(whole, fraction)
        sun = self._sun.compute(whole, fraction) - self._barycenter.compute(whole, fraction) - earth
        moon = self._moon.compute(whole, fraction) - earth
        cosine = np.sum(sun * moon, axis=0) / (
            np.linalg.norm(sun, axis=0) * np.linalg.norm(moon, axis=0)
        )
        return np.asarray(-cosine, dtype=np.float64)


def new_moon_candidates(ephemeris: Ephemeris, start_jd_tt: float, end_jd_tt: float) -> list[float]:
    """TT Julian Days of new moons close enough to a node for a solar eclipse to be possible."""
    if not (
        ephemeris.start_jd + SEARCH_MARGIN_DAYS
        <= start_jd_tt
        < end_jd_tt
        <= ephemeris.end_jd - SEARCH_MARGIN_DAYS
    ):
        msg = (
            f"Search range [{start_jd_tt}, {end_jd_tt}) must sit at least {SEARCH_MARGIN_DAYS} "
            f"days inside the ephemeris [{ephemeris.start_jd}, {ephemeris.end_jd}]"
        )
        raise ValueError(msg)
    timescale = load.timescale(builtin=True)
    times, negative_cosines = find_minima(
        timescale.tt_jd(start_jd_tt), timescale.tt_jd(end_jd_tt), _SunMoonCosine(ephemeris)
    )
    limit = -math.cos(math.radians(CANDIDATE_SEPARATION_DEGREES))
    return [
        jd
        for jd, value in zip(as_floats(times.tt), as_floats(negative_cosines), strict=True)
        if value < limit and start_jd_tt <= jd < end_jd_tt
    ]


@dataclass(frozen=True, slots=True)
class _Sample:
    """The shadow geometry at one instant, before fitting."""

    x: float
    y: float
    d: float
    mu: float
    l1: float
    l2: float
    tan_f1: float
    tan_f2: float


def _cartesian(ra: float, dec: float, distance: float) -> tuple[float, float, float]:
    return (
        distance * math.cos(dec) * math.cos(ra),
        distance * math.cos(dec) * math.sin(ra),
        distance * math.sin(dec),
    )


def _sample(
    sun: tuple[float, float, float], moon: tuple[float, float, float], gast_degrees: float
) -> _Sample:
    """Shadow geometry from apparent (RA, Dec, distance in Earth radii) of Sun and Moon."""
    sun_ra, sun_dec, sun_r = sun
    moon_ra, moon_dec, moon_r = moon
    # The shadow axis points from the Moon toward the Sun.
    sx, sy, sz = _cartesian(sun_ra, sun_dec, sun_r)
    mx, my, mz = _cartesian(moon_ra, moon_dec, moon_r)
    gx, gy, gz = sx - mx, sy - my, sz - mz
    axis_length = math.sqrt(gx * gx + gy * gy + gz * gz)
    a = math.atan2(gy, gx)
    d = math.asin(gz / axis_length)

    # The Moon's coordinates in the fundamental-plane frame.
    delta_ra = moon_ra - a
    x = moon_r * math.cos(moon_dec) * math.sin(delta_ra)
    y = moon_r * (
        math.sin(moon_dec) * math.cos(d) - math.cos(moon_dec) * math.sin(d) * math.cos(delta_ra)
    )
    z = moon_r * (
        math.sin(moon_dec) * math.sin(d) + math.cos(moon_dec) * math.cos(d) * math.cos(delta_ra)
    )

    sun_radius = SUN_RADIUS_KM / EARTH_RADIUS_KM
    sin_f1 = (sun_radius + MOON_RADIUS_PENUMBRA) / axis_length
    sin_f2 = (sun_radius - MOON_RADIUS_UMBRA) / axis_length
    tan_f1 = sin_f1 / math.sqrt(1 - sin_f1 * sin_f1)
    tan_f2 = sin_f2 / math.sqrt(1 - sin_f2 * sin_f2)
    return _Sample(
        x=x,
        y=y,
        d=math.degrees(d),
        mu=(gast_degrees - math.degrees(a)) % 360,
        l1=(z + MOON_RADIUS_PENUMBRA / sin_f1) * tan_f1,
        l2=(z - MOON_RADIUS_UMBRA / sin_f2) * tan_f2,
        tan_f1=tan_f1,
        tan_f2=tan_f2,
    )


def _fit(hours: Sequence[float], values: Sequence[float]) -> tuple[float, ...]:
    coefficients = np.polynomial.polynomial.polyfit(
        np.asarray(hours, dtype=np.float64), np.asarray(values, dtype=np.float64), FIT_DEGREE
    )
    return tuple(as_floats(np.asarray(coefficients, dtype=np.float64)))


def _unwrap_degrees(values: Sequence[float]) -> list[float]:
    """Remove 360° jumps so an angle that crosses 0° can be fitted smoothly."""
    unwrapped = [values[0]]
    for value in values[1:]:
        previous = unwrapped[-1]
        unwrapped.append(value + 360 * round((previous - value) / 360))
    return unwrapped


def besselian_elements(
    library: KernelLibrary, timescale: Timescale, t0_jd_tt: float
) -> BesselianElements:
    """Fit Besselian elements around ``t0_jd_tt`` from apparent positions in DE441."""
    hours = [float(h) for h in range(-FIT_HALF_SPAN_HOURS, FIT_HALF_SPAN_HOURS + 1)]
    jds = [t0_jd_tt + h * _DAYS_PER_HOUR for h in hours]
    kernel = library.covering(jds[0], jds[-1])
    t = timescale.tt_jd(np.asarray(jds, dtype=np.float64))
    earth = kernel["earth"].at(t)

    def apparent(body: str) -> list[tuple[float, float, float]]:
        ra, dec, distance = earth.observe(kernel[body]).apparent(deflectors=()).radec(epoch="date")
        return list(
            zip(
                as_floats(ra.radians),
                as_floats(dec.radians),
                (km / EARTH_RADIUS_KM for km in as_floats(distance.km)),
                strict=True,
            )
        )

    samples = [
        # Ephemeris hour angle, as NASA tabulates it: Greenwich sidereal time as if UT were TT.
        # Observers then subtract ΔT * 0.00417807°/s, so ΔT can be varied after the fact.
        _sample(sun, moon, gast * 15 + delta_t * SIDEREAL_DEGREES_PER_SECOND)
        for sun, moon, gast, delta_t in zip(
            apparent("sun"),
            apparent("moon"),
            as_floats(t.gast),
            as_floats(t.delta_t),
            strict=True,
        )
    ]
    return BesselianElements(
        t0_jd_tt=t0_jd_tt,
        delta_t=as_floats(t.delta_t)[FIT_HALF_SPAN_HOURS],
        x=_fit(hours, [s.x for s in samples]),
        y=_fit(hours, [s.y for s in samples]),
        d=_fit(hours, [s.d for s in samples]),
        mu=_fit(hours, _unwrap_degrees([s.mu for s in samples])),
        l1=_fit(hours, [s.l1 for s in samples]),
        l2=_fit(hours, [s.l2 for s in samples]),
        tan_f1=sum(s.tan_f1 for s in samples) / len(samples),
        tan_f2=sum(s.tan_f2 for s in samples) / len(samples),
    )


def greatest_eclipse_hours(elements: BesselianElements) -> float:
    """Hours from t0 when the shadow axis passes closest to Earth's center."""

    def distance_squared(h: float) -> float:
        return evaluate(elements.x, h) ** 2 + evaluate(elements.y, h) ** 2

    # Coarse scan, then golden-section refinement to well under a second.
    steps = 600
    span = 2 * FIT_HALF_SPAN_HOURS
    grid = [-FIT_HALF_SPAN_HOURS + span * i / steps for i in range(steps + 1)]
    best = min(grid, key=distance_squared)
    low = max(best - span / steps, -FIT_HALF_SPAN_HOURS)
    high = min(best + span / steps, FIT_HALF_SPAN_HOURS)
    ratio = (math.sqrt(5) - 1) / 2
    for _ in range(40):
        left = high - ratio * (high - low)
        right = low + ratio * (high - low)
        if distance_squared(left) < distance_squared(right):
            high = right
        else:
            low = left
    return (low + high) / 2


def _rho1(d_degrees: float) -> float:
    return math.sqrt(1 - EARTH_ECCENTRICITY_SQUARED * math.cos(math.radians(d_degrees)) ** 2)


def _surface_zeta(eta1: float, zeta1: float, d_degrees: float) -> float:
    """Height above the fundamental plane of a surface point, for an oblate Earth.

    ``zeta1`` is the height on the auxiliary unit sphere; the true value needs Earth's
    flattening (Explanatory Supplement; Meeus, *Elements of Solar Eclipses*):
    zeta = rho2 * (zeta1 cos(d1 - d2) - eta1 sin(d1 - d2)).
    """
    e2 = EARTH_ECCENTRICITY_SQUARED
    d = math.radians(d_degrees)
    rho1 = _rho1(d_degrees)
    rho2 = math.sqrt(1 - e2 * math.sin(d) ** 2)
    d1 = math.atan2(math.sin(d) / rho1, math.sqrt(1 - e2) * math.cos(d) / rho1)
    d2 = math.atan2(math.sqrt(1 - e2) * math.sin(d) / rho2, math.cos(d) / rho2)
    return rho2 * (zeta1 * math.cos(d1 - d2) - eta1 * math.sin(d1 - d2))


def _point_on_earth(
    xi: float, eta1: float, zeta1: float, d_degrees: float, mu_degrees: float
) -> tuple[float, float]:
    """Geodetic latitude and east longitude of a point given in fundamental-plane coordinates."""
    e2 = EARTH_ECCENTRICITY_SQUARED
    d = math.radians(d_degrees)
    rho1 = _rho1(d_degrees)
    sin_d1 = math.sin(d) / rho1
    cos_d1 = math.sqrt(1 - e2) * math.cos(d) / rho1
    sin_phi1 = max(-1.0, min(1.0, eta1 * cos_d1 + zeta1 * sin_d1))
    phi1 = math.asin(sin_phi1)
    hour_angle = math.degrees(math.atan2(xi, zeta1 * cos_d1 - eta1 * sin_d1))
    latitude = math.degrees(math.atan(math.tan(phi1) / math.sqrt(1 - e2)))
    longitude = (hour_angle - mu_degrees + 180) % 360 - 180
    return latitude, longitude


def circumstances(elements: BesselianElements) -> SolarEclipse | None:
    """Kind, gamma, magnitude and place of greatest eclipse; None if the shadow misses Earth."""
    h = greatest_eclipse_hours(elements)
    x, y = evaluate(elements.x, h), evaluate(elements.y, h)
    d = evaluate(elements.d, h)
    # Greenwich hour angle of the axis, from the ephemeris hour angle and ΔT.
    mu = evaluate(elements.mu, h) - elements.delta_t * SIDEREAL_DEGREES_PER_SECOND
    l1, l2 = evaluate(elements.l1, h), evaluate(elements.l2, h)
    y1 = y / _rho1(d)
    distance = math.hypot(x, y1)
    if distance - 1 > l1:
        return None

    if distance < 1:
        zeta1 = math.sqrt(1 - distance * distance)
        zeta = _surface_zeta(y1, zeta1, d)
        big_l1 = l1 - zeta * elements.tan_f1
        big_l2 = l2 - zeta * elements.tan_f2
        magnitude = (big_l1 - big_l2) / (big_l1 + big_l2)
        kind = _central_kind(elements)
        latitude, longitude = _point_on_earth(x, y1, zeta1, d, mu)
    else:
        # The axis misses Earth: greatest eclipse is on the limb, nearest the axis.
        magnitude = (l1 - (distance - 1)) / (l1 + l2)
        if distance - 1 < abs(l2):
            kind = SolarEclipseKind.TOTAL if l2 < 0 else SolarEclipseKind.ANNULAR
        else:
            kind = SolarEclipseKind.PARTIAL
        latitude, longitude = _point_on_earth(x / distance, y1 / distance, 0.0, d, mu)

    return SolarEclipse(
        greatest_jd_tt=elements.t0_jd_tt + h * _DAYS_PER_HOUR,
        kind=kind,
        gamma=math.copysign(math.hypot(x, y), y),
        magnitude=magnitude,
        delta_t_seconds=elements.delta_t,
        greatest_latitude=latitude,
        greatest_longitude=longitude,
        elements=elements,
    )


def _central_kind(elements: BesselianElements) -> SolarEclipseKind:
    """Total, annular or hybrid, from the umbra's sign along the whole central line.

    The ends of the central line need exact treatment: there the shadow axis grazes Earth's
    limb (zeta = 0), the umbra's size is just ``l2``, and in many hybrid eclipses the annular
    stretch lasts only seconds right at sunrise or sunset. The ends are solved for exactly
    rather than sampled.
    """

    def off_earth(h: float) -> float:
        x = evaluate(elements.x, h)
        y1 = evaluate(elements.y, h) / _rho1(evaluate(elements.d, h))
        return x * x + y1 * y1 - 1

    def umbra_is_total(h: float) -> bool:
        x = evaluate(elements.x, h)
        d = evaluate(elements.d, h)
        y1 = evaluate(elements.y, h) / _rho1(d)
        zeta = _surface_zeta(y1, math.sqrt(max(0.0, 1 - x * x - y1 * y1)), d)
        return evaluate(elements.l2, h) - zeta * elements.tan_f2 < 0

    steps = 720
    grid = [-FIT_HALF_SPAN_HOURS + 2 * FIT_HALF_SPAN_HOURS * i / steps for i in range(steps + 1)]
    signs = [umbra_is_total(h) for h in grid if off_earth(h) < 0]
    # Exact ends of the central line, wherever the axis enters or leaves Earth between samples.
    for before, after in itertools.pairwise(grid):
        if (off_earth(before) < 0) != (off_earth(after) < 0):
            signs.append(umbra_is_total(_bisect(off_earth, before, after)))
    if all(signs):
        return SolarEclipseKind.TOTAL
    if not any(signs):
        return SolarEclipseKind.ANNULAR
    return SolarEclipseKind.HYBRID


def _bisect(function: Callable[[float], float], low: float, high: float) -> float:
    """Find a root of ``function`` between ``low`` and ``high``, where it changes sign."""
    low_sign = function(low) < 0
    for _ in range(50):
        middle = (low + high) / 2
        if (function(middle) < 0) == low_sign:
            low = middle
        else:
            high = middle
    return (low + high) / 2


def find_solar_eclipses(
    ephemeris: Ephemeris, kernel_paths: Sequence[Path], start_jd_tt: float, end_jd_tt: float
) -> list[SolarEclipse]:
    """Every solar eclipse with greatest eclipse in ``[start_jd_tt, end_jd_tt)``."""
    timescale = load.timescale(builtin=True)
    eclipses: list[SolarEclipse] = []
    with KernelLibrary(kernel_paths) as library:
        for candidate in new_moon_candidates(ephemeris, start_jd_tt, end_jd_tt):
            t0 = _nearest_hour(candidate)
            elements = besselian_elements(library, timescale, t0)
            # Re-centre on the TT hour nearest greatest eclipse, as NASA does.
            better = _nearest_hour(t0 + greatest_eclipse_hours(elements) * _DAYS_PER_HOUR)
            if better != t0:
                elements = besselian_elements(library, timescale, better)
            eclipse = circumstances(elements)
            if eclipse is not None and start_jd_tt <= eclipse.greatest_jd_tt < end_jd_tt:
                eclipses.append(eclipse)
    return eclipses


def _nearest_hour(jd: float) -> float:
    """Return the Julian Day of the whole TT hour nearest ``jd`` (Julian Days start at noon)."""
    return round((jd - 0.5) * 24) / 24 + 0.5
