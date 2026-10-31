"""Delta T (TT - UT) as a table the web app interpolates, from the same model as the catalogs.

Samples are taken at Julian epoch years: year ``y`` is JD (TT) ``2451545.0 + (y - 2000) * 365.25``.
"""

import json
from typing import TYPE_CHECKING, TypedDict

import numpy as np
from skyfield.api import load

from histeclipse_pipeline.arrays import as_floats

if TYPE_CHECKING:
    from pathlib import Path

DELTA_T_MODEL = (
    "Skyfield: Morrison, Stephenson, Hohenkerk & Zawilski (2021) splines for 720 BCE-2015 CE; "
    "Stephenson, Morrison & Hohenkerk (2016) long-term parabola outside that range"
)
UNCERTAINTY_MODEL = (
    "Approximate standard error 0.8 t^2 seconds, t in centuries from 1820 "
    "(Morrison & Stephenson 2004); at least 1 s"
)
SCHEMA_VERSION = 1

_J2000 = 2_451_545.0
_DAYS_PER_JULIAN_YEAR = 365.25
_UNCERTAINTY_EPOCH = 1820.0


class DeltaTTable(TypedDict):
    """Contents of ``delta-t.json``. Mirrors the web app's runtime schema."""

    schemaVersion: int
    model: str
    uncertaintyModel: str
    startYear: int
    stepYears: int
    seconds: list[float]
    uncertaintySeconds: list[float]


def epoch_year_jd(year: float) -> float:
    """Julian Day (TT) of Julian epoch year ``year``."""
    return _J2000 + (year - 2000) * _DAYS_PER_JULIAN_YEAR


def uncertainty_seconds(year: float) -> float:
    """Approximate one-sigma uncertainty of ΔT for ``year``."""
    centuries = (year - _UNCERTAINTY_EPOCH) / 100
    return max(1.0, 0.8 * centuries * centuries)


def delta_t_table(start_year: int, end_year: int, step_years: int = 1) -> DeltaTTable:
    """Sample ΔT for every ``step_years`` from ``start_year`` through ``end_year``."""
    if step_years < 1 or start_year > end_year or (end_year - start_year) % step_years != 0:
        msg = f"Bad range {start_year}..{end_year} with step {step_years}"
        raise ValueError(msg)
    years = list(range(start_year, end_year + 1, step_years))
    timescale = load.timescale(builtin=True)
    jds = np.array([epoch_year_jd(year) for year in years], dtype=np.float64)
    seconds = as_floats(timescale.tt_jd(jds).delta_t)
    return {
        "schemaVersion": SCHEMA_VERSION,
        "model": DELTA_T_MODEL,
        "uncertaintyModel": UNCERTAINTY_MODEL,
        "startYear": start_year,
        "stepYears": step_years,
        "seconds": [round(value, 2) for value in seconds],
        "uncertaintySeconds": [round(uncertainty_seconds(year)) for year in years],
    }


def write_delta_t_table(table: DeltaTTable, path: Path) -> None:
    """Write the table as compact JSON."""
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_text(json.dumps(table, separators=(",", ":"), allow_nan=False) + "\n")
