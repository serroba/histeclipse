"""Lunar eclipse search on top of Skyfield and a DE441 `Ephemeris`."""

from dataclasses import dataclass
from enum import StrEnum
from typing import TYPE_CHECKING

import numpy as np
from skyfield import eclipselib
from skyfield.api import load, wgs84
from skyfield.constants import AU_KM
from skyfield.positionlib import build_position

if TYPE_CHECKING:
    from histeclipse_pipeline.ephemeris import Ephemeris

# Earth's equatorial radius in km (IERS 2010), the unit NASA uses for gamma.
EARTH_EQUATORIAL_RADIUS_KM = 6378.1366

DELTA_T_MODEL = (
    "Skyfield: Morrison, Stephenson, Hohenkerk & Zawilski (2021) splines for 720 BCE-2015 CE; "
    "Stephenson, Morrison & Hohenkerk (2016) long-term parabola outside that range"
)

# Skyfield samples up to one search step (5 days) outside the requested window.
SEARCH_MARGIN_DAYS = 6.0


class LunarEclipseKind(StrEnum):
    """How deep the Moon goes into Earth's shadow."""

    PENUMBRAL = "penumbral"
    PARTIAL = "partial"
    TOTAL = "total"


_KINDS = {
    "Penumbral": LunarEclipseKind.PENUMBRAL,
    "Partial": LunarEclipseKind.PARTIAL,
    "Total": LunarEclipseKind.TOTAL,
}


@dataclass(frozen=True, slots=True)
class LunarEclipse:
    """A lunar eclipse, described at the instant of greatest eclipse."""

    greatest_jd_tt: float
    kind: LunarEclipseKind
    umbral_magnitude: float
    penumbral_magnitude: float
    gamma: float
    delta_t_seconds: float
    sublunar_latitude: float
    sublunar_longitude: float


def find_lunar_eclipses(
    ephemeris: Ephemeris, start_jd_tt: float, end_jd_tt: float
) -> list[LunarEclipse]:
    """Return every lunar eclipse with greatest eclipse in ``[start_jd_tt, end_jd_tt)``."""
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
    times, codes, details = eclipselib.lunar_eclipses(
        timescale.tt_jd(start_jd_tt), timescale.tt_jd(end_jd_tt), ephemeris
    )
    if len(codes) == 0:
        return []
    keep = (_array(times.tt) >= start_jd_tt) & (_array(times.tt) < end_jd_tt)
    times, codes = times[keep], codes[keep]

    whole, fraction = _array(times.whole), _array(times.tdb_fraction)
    earth = ephemeris.segment(3, 399)
    moon_km = ephemeris.segment(3, 301).compute(whole, fraction) - earth.compute(whole, fraction)
    sun_km = (
        ephemeris.segment(0, 10).compute(whole, fraction)
        - ephemeris.segment(0, 3).compute(whole, fraction)
        - earth.compute(whole, fraction)
    )
    sublunar = wgs84.subpoint_of(build_position(moon_km / AU_KM, center=399, t=times))

    kinds = [_KINDS[eclipselib.LUNAR_ECLIPSES[code]] for code in map(int, codes)]
    jds = _floats(times.tt)
    umbral = _floats(details["umbral_magnitude"][keep])
    penumbral = _floats(details["penumbral_magnitude"][keep])
    gammas = _floats(_gamma(moon_km, sun_km))
    delta_ts = _floats(times.delta_t)
    latitudes = _floats(sublunar.latitude.degrees)
    longitudes = _floats(sublunar.longitude.degrees)
    return [
        LunarEclipse(
            greatest_jd_tt=jds[index],
            kind=kind,
            umbral_magnitude=umbral[index],
            penumbral_magnitude=penumbral[index],
            gamma=gammas[index],
            delta_t_seconds=delta_ts[index],
            sublunar_latitude=latitudes[index],
            sublunar_longitude=longitudes[index],
        )
        for index, kind in enumerate(kinds)
    ]


def _floats(value: float | np.typing.NDArray[np.float64]) -> list[float]:
    """Plain Python floats from a Skyfield or numpy value, so downstream code is fully typed."""
    return list(map(float, _array(value)))


def _array(value: float | np.typing.NDArray[np.float64]) -> np.typing.NDArray[np.float64]:
    """Skyfield returns a float for a single time and an array for many; always use an array."""
    return np.atleast_1d(np.asarray(value, dtype=np.float64))


def _gamma(
    moon_km: np.typing.NDArray[np.float64], sun_km: np.typing.NDArray[np.float64]
) -> np.typing.NDArray[np.float64]:
    """Distance of the Moon's center from the shadow axis, in Earth equatorial radii.

    Positive when the Moon passes north of the axis, measured toward the celestial north pole.
    """
    axis = -sun_km / np.linalg.norm(sun_km, axis=0)
    offset = moon_km - np.sum(moon_km * axis, axis=0) * axis
    northward = np.sum(offset * _CELESTIAL_NORTH, axis=0)
    distance = np.linalg.norm(offset, axis=0) / EARTH_EQUATORIAL_RADIUS_KM
    return np.asarray(np.where(northward >= 0, distance, -distance), dtype=np.float64)


_CELESTIAL_NORTH = np.array([[0.0], [0.0], [1.0]], dtype=np.float64)
