"""Reference values from Skyfield + DE441 that the web app's own astronomy is tested against.

The browser uses fast analytic formulas (Meeus) instead of a 600 MB ephemeris. These vectors
pin down how far those formulas drift from DE441 over the whole supported range.
"""

import json
import random
from typing import TYPE_CHECKING, TypedDict

from jplephem.spk import SPK
from skyfield.api import load, wgs84

from histeclipse_pipeline.arrays import as_floats
from histeclipse_pipeline.delta_t import epoch_year_jd

if TYPE_CHECKING:
    from collections.abc import Sequence
    from pathlib import Path

    from skyfield.jpllib import SpiceKernel


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
    kernels = [(_coverage(path), load(str(path))) for path in kernel_paths]
    vectors: list[SunVector] = []
    try:
        for jd_ut in jds_ut:
            time = timescale.ut1_jd(jd_ut)
            jd_tt = as_floats(time.tt)[0]
            kernel = _kernel_for(kernels, jd_tt)
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
    finally:
        for _, kernel in kernels:
            kernel.close()
    return vectors


def write_vectors(vectors: Sequence[SunVector], path: Path, description: str) -> None:
    """Write vectors as readable JSON, one per line."""
    lines = ",\n".join(f"    {json.dumps(vector)}" for vector in vectors)
    body = f'{{\n  "description": {json.dumps(description)},\n  "vectors": [\n{lines}\n  ]\n}}\n'
    _ = path.write_text(body)


def _coverage(path: Path) -> tuple[float, float]:
    spk = SPK.open(str(path))
    try:
        return (
            max(segment.start_jd for segment in spk.segments),
            min(segment.end_jd for segment in spk.segments),
        )
    finally:
        spk.close()


def _kernel_for(
    kernels: Sequence[tuple[tuple[float, float], SpiceKernel]], jd_tt: float
) -> SpiceKernel:
    for (start, end), kernel in kernels:
        if start <= jd_tt < end:
            return kernel
    msg = f"No kernel covers JD {jd_tt} (TT)"
    raise ValueError(msg)
