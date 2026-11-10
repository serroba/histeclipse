"""The asteroid belt (#372): its large asteroids, and where each is, fitted to JPL Horizons.

The site draws the main belt's asteroids at least 100 km across, as JPL's Small-Body Database
(SBDB) lists them: their names and diameters from its query API, the main belt (class MBA)
and the outer main belt (OMB). The inner main belt has none so large.

SBDB's elements are osculating, at one epoch: carried with Kepler's laws alone they stray
fast, as Jupiter pulls the asteroids along and back. Ceres, so carried, is 8 degrees off along
its orbit by 1950 and 46 by 1600; Hygiea 25 and 95. So each asteroid's orbit is fitted as the
moons' are (`moon_orbits`): mean elements whose angles turn steadily, with up to two swings,
fitted to its positions from Horizons. Here the orbits go round the Sun, on the ecliptic of
J2000, with the Sun's own GM, across the years Horizons gives small bodies: 1600 to 2500.
Outside them the orbits are carried on at the same rates, and where an asteroid is along its
orbit is only roughly known. Each fit's worst error at other moments, seen from the Sun, is
kept with it; reference positions of the four largest are kept for the site's tests.
"""

from __future__ import annotations

import json
import math
import random
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING, cast

from histeclipse_pipeline.moon_orbits import (
    J2000,
    angle_off,
    fetch_states,
    fit_orbit,
    orbit_json,
    position,
    sample_times,
)

if TYPE_CHECKING:
    from pathlib import Path

#: Diameter, km, at and above which an asteroid is drawn.
SMALLEST_KM = 100
SBDB = "https://ssd-api.jpl.nasa.gov/sbdb_query.api?" + urllib.parse.urlencode(
    {
        "fields": "pdes,name,full_name,diameter,class",
        "sb-kind": "a",
        "sb-class": "MBA,OMB",
        "sb-cdata": json.dumps({"AND": [f"diameter|GE|{SMALLEST_KM}"]}),
    }
)
#: The Sun's GM, km³/s² (JPL DE440).
GM_SUN = 1.327_124_400_41e11
#: The ecliptic of J2000's pole: right ascension and declination, ICRF, degrees (obliquity
#: 23.4392911 degrees, IAU 1976, as Horizons uses).
ECLIPTIC_POLE = (270.0, 90 - 23.439_291_1)
#: The span fitted (TT): Horizons gives small bodies from 1600 to 2500.
START = 2305448.5  # 1600 January 2
STOP = 2634166.5  # 2500 January 1
#: Moments sampled across the span, besides those near J2000.
UNIFORM = 240
#: Moments each fit is checked at; and the asteroids whose positions there the site's tests use.
CHECKS = 24
CHECK_SEED = 372
TESTED = ("1", "2", "4", "10")


@dataclass(frozen=True)
class Asteroid:
    """An asteroid drawn: its number (its designation), its name and its diameter, km."""

    number: str
    name: str
    diameter: float


def asteroid_list(text: str) -> list[Asteroid]:
    """Read SBDB's answer: each asteroid's number, name and diameter, largest first."""
    data = cast("dict[str, object]", json.loads(text))
    fields = cast("list[str]", data["fields"])
    rows = cast("list[list[str | None]]", data["data"])
    found: list[Asteroid] = []
    for row in rows:
        record = dict(zip(fields, row, strict=True))
        number, name, diameter = record["pdes"], record["name"], record["diameter"]
        if number is None or diameter is None:
            continue
        found.append(Asteroid(number, name or number, float(diameter)))
    return sorted(found, key=lambda asteroid: -asteroid.diameter)


def fetch_text(url: str) -> str:  # pragma: no cover - needs network access
    """Download a small text answer."""
    with urllib.request.urlopen(url, timeout=120) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = "expected bytes"
        raise TypeError(msg)
    return body.decode()


def fetch_asteroids(  # pragma: no cover - needs network access
    path: Path, checks: Path, cache: Path
) -> list[str]:
    """Fit every large asteroid's orbit, write them to ``path`` and test positions to ``checks``.

    Returns a line an asteroid: how far its fit strays from Horizons at other moments.
    """
    listing = cache / "sbdb.json"
    if not listing.exists():
        cache.mkdir(parents=True, exist_ok=True)
        _ = listing.write_text(fetch_text(SBDB))
    picker = random.Random(CHECK_SEED)  # noqa: S311 - reproducible sampling, not security
    moments = sorted(round(picker.uniform(START, STOP), 6) for _ in range(CHECKS))
    asteroids: dict[str, object] = {}
    vectors: dict[str, object] = {}
    report: list[str] = []
    for seed, asteroid in enumerate(asteroid_list(listing.read_text())):
        command = f"{asteroid.number};"
        first = fetch_states(command, "500@10", [J2000], cache, csv=False)[0]
        r = math.dist(first.r, (0, 0, 0))
        period = 2 * math.pi * math.sqrt(r**3 / GM_SUN) / 86400
        times = sample_times(period, seed, (START, STOP), UNIFORM)
        orbit = fit_orbit(
            "sun", ECLIPTIC_POLE, fetch_states(command, "500@10", times, cache, csv=False), GM_SUN
        )
        truth = fetch_states(command, "500@10", moments, cache, csv=False)
        worst = max(angle_off(position(orbit, s.jd), s.r) for s in truth)
        written = orbit_json(orbit)
        del written["planet"]
        asteroids[asteroid.number] = {
            "name": asteroid.name,
            "diameterKm": round(asteroid.diameter, 1),
            "offDegrees": round(worst, 2),
            **written,
            "axisKm": round(orbit.axis),
        }
        if asteroid.number in TESTED:
            vectors[asteroid.number] = [
                {"jdTT": s.jd, "x": round(s.r[0]), "y": round(s.r[1]), "z": round(s.r[2])}
                for s in truth
            ]
        report.append(f"{asteroid.number} {asteroid.name}: at most {worst:.2f} degrees off")
    data = {
        "schemaVersion": 1,
        "source": "https://ssd.jpl.nasa.gov/horizons/",
        "list": "https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html",
        "smallestKm": SMALLEST_KM,
        "fittedJdTT": [START, STOP],
        "epochJdTT": J2000,
        "asteroids": asteroids,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_text(json.dumps(data, separators=(",", ":")) + "\n")
    body = {
        "description": (
            "Positions of Ceres, Pallas, Vesta and Hygiea from the Sun's centre, ICRF, km, "
            "geometric, from JPL Horizons."
        ),
        "asteroids": vectors,
    }
    _ = checks.write_text(json.dumps(body, indent=2) + "\n")
    return report
