"""Reference values from Skyfield + DE441 that the web app's own astronomy is tested against.

The browser uses fast analytic formulas (Meeus) instead of a 600 MB ephemeris. These vectors
pin down how far those formulas drift from DE441 over the whole supported range.
"""

import json
import random
from typing import TYPE_CHECKING, TypedDict

from skyfield.api import load, wgs84

from histeclipse_pipeline.arrays import as_floats
from histeclipse_pipeline.delta_t import epoch_year_jd
from histeclipse_pipeline.kernels import KernelLibrary

if TYPE_CHECKING:
    from collections.abc import Sequence
    from pathlib import Path

    from histeclipse_pipeline.ephemeris import Ephemeris


class SunVector(TypedDict):
    """The Sun as seen from Earth's center at one instant. Mirrors the web app's tests."""

    jdUT: float
    jdTT: float
    subsolarLatitude: float
    subsolarLongitude: float
    gmstHours: float
    gastHours: float


def sample_times(start_year: int, end_year: int, count: int, seed: int) -> list[float]:
    """Spread ``count`` UT Julian Days evenly over the years, at random times of year and day."""
    rng = random.Random(seed)  # noqa: S311 - reproducible sampling, not security
    step = (end_year - start_year) / (count - 1)
    return [
        epoch_year_jd(start_year + index * step + rng.random() * min(step, 1.0) * 0.999)
        for index in range(count)
    ]


def sun_vectors(kernel_paths: Sequence[Path], jds_ut: Sequence[float]) -> list[SunVector]:
    """Compute the apparent geocentric Sun and Earth's sidereal angle at each UT Julian Day."""
    timescale = load.timescale(builtin=True)
    vectors: list[SunVector] = []
    with KernelLibrary(kernel_paths) as library:
        for jd_ut in jds_ut:
            time = timescale.ut1_jd(jd_ut)
            jd_tt = as_floats(time.tt)[0]
            kernel = library.covering(jd_tt, jd_tt)
            # Light deflection by the Sun itself is zero for the Sun; planets are negligible here.
            sun = kernel["earth"].at(time).observe(kernel["sun"]).apparent(deflectors=())
            subsolar = wgs84.subpoint_of(sun)
            vectors.append(
                {
                    "jdUT": round(jd_ut, 6),
                    "jdTT": round(jd_tt, 6),
                    "subsolarLatitude": round(as_floats(subsolar.latitude.degrees)[0], 6),
                    "subsolarLongitude": round(as_floats(subsolar.longitude.degrees)[0], 6),
                    "gmstHours": round(as_floats(time.gmst)[0], 9),
                    "gastHours": round(as_floats(time.gast)[0], 9),
                }
            )
    return vectors


class MoonVector(TypedDict):
    """The Moon's geometric geocentric position in ICRF (J2000 equator), km. Mirrors web tests."""

    jdTT: float
    x: float
    y: float
    z: float


def moon_vectors(ephemeris: Ephemeris, jds_tt: Sequence[float]) -> list[MoonVector]:
    """Geocentric Moon at each TT Julian Day (TDB and TT differ by under 2 ms)."""
    earth = ephemeris.segment(3, 399)
    moon = ephemeris.segment(3, 301)
    vectors: list[MoonVector] = []
    for jd in jds_tt:
        x, y, z = as_floats(moon.compute(jd) - earth.compute(jd))
        vectors.append({"jdTT": round(jd, 6), "x": round(x, 3), "y": round(y, 3), "z": round(z, 3)})
    return vectors


def write_vectors(
    vectors: Sequence[SunVector] | Sequence[MoonVector], path: Path, description: str
) -> None:
    """Write vectors as readable JSON, one per line."""
    lines = ",\n".join(f"    {json.dumps(vector)}" for vector in vectors)
    body = f'{{\n  "description": {json.dumps(description)},\n  "vectors": [\n{lines}\n  ]\n}}\n'
    _ = path.write_text(body)
