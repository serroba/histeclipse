"""The asteroids and dwarf planets (#372, #1329): which are drawn, and where each is.

The site draws the Sun's small bodies that are large or that matter, group by group, out to
the edge of its reach:

- the main belt's asteroids at least 100 km across, and Jupiter's Trojans of that size, as
  JPL's Small-Body Database (SBDB) lists them: their names and diameters from its query API
  (classes MBA and OMB; TJN). The inner main belt has none so large;
- a chosen few besides (``CHOSEN``): near-Earth asteroids, the centaurs between Jupiter and
  Neptune, and the largest bodies beyond Neptune, the dwarf planets among them. SBDB gives no
  size for most of those beyond Neptune, so each chosen body's diameter is kept here with the
  source it is from.

SBDB's elements are osculating, at one epoch: carried with Kepler's laws alone they stray
fast, as Jupiter pulls the asteroids along and back. Ceres, so carried, is 8 degrees off along
its orbit by 1950 and 46 by 1600; Hygiea 25 and 95. So each body's orbit is fitted as the
moons' are (`moon_orbits`): mean elements whose angles turn steadily, with up to two swings,
fitted to its positions from Horizons, on the ecliptic of J2000.

Not every body can be fitted the same way:

- the main belt and the Trojans go round the Sun, with the Sun's own GM, across the years
  Horizons gives small bodies: 1600 to 2500;
- a body beyond Neptune is fitted about the Solar System's centre of mass, with the GM of the
  Sun and its planets. About the Sun itself its elements wobble as the Sun is swung by Jupiter
  (Sedna's fit is 10 degrees off so, a hundredth of a degree about the centre of mass). The
  site then draws it about the Sun, which is never more than a hundredth of an AU from that
  centre: under a minute of arc at such distances;
- the centaurs pass close to the giant planets and the near-Earth asteroids close to Earth and
  Mars, and each pass turns their orbits: fitted to fewer years (1800 to 2100, or 1900 to
  2100), they hold within a few degrees; across all nine centuries Chiron's would be 40 off.

Outside its years a body's orbit is carried on at the same rates, and where it is along it is
only roughly known. Each fit's worst error at other moments within them, seen from the Sun,
is kept with it; reference positions of some are kept for the site's tests.

Left out: bodies that pass so close to Earth that no steady orbit holds them for even a
century (Apophis, Bennu and Ryugu are 10 to 80 degrees off within 1900 to 2100), and the comets,
whose orbits change at each return: both want a model of their own.
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
    Orbit,
    State,
    angle_off,
    fetch_states,
    fit_orbit,
    orbit_json,
    position,
    sample_times,
)

if TYPE_CHECKING:
    from pathlib import Path

#: Diameter, km, at and above which a main-belt asteroid or a Trojan is drawn.
SMALLEST_KM = 100


def sbdb_query(classes: str) -> str:
    """Build SBDB's query for the asteroids of some classes ``SMALLEST_KM`` across or more."""
    return "https://ssd-api.jpl.nasa.gov/sbdb_query.api?" + urllib.parse.urlencode(
        {
            "fields": "pdes,name,full_name,diameter,class",
            "sb-kind": "a",
            "sb-class": classes,
            "sb-cdata": json.dumps({"AND": [f"diameter|GE|{SMALLEST_KM}"]}),
        }
    )


SBDB = sbdb_query("MBA,OMB")
SBDB_TROJANS = sbdb_query("TJN")
#: The Sun's GM, km³/s² (JPL DE440).
GM_SUN = 1.327_124_400_41e11
#: The GM of the Sun and its planets' systems, km³/s² (JPL DE440): what a body far beyond them
#: goes round.
GM_SYSTEM = GM_SUN + 1.780_786_30e8
#: The ecliptic of J2000's pole: right ascension and declination, ICRF, degrees (obliquity
#: 23.4392911 degrees, IAU 1976, as Horizons uses).
ECLIPTIC_POLE = (270.0, 90 - 23.439_291_1)
#: The span fitted (TT): Horizons gives small bodies from 1600 to 2500.
START = 2305448.5  # 1600 January 2
STOP = 2634166.5  # 2500 January 1
#: The fewer years a centaur's orbit is fitted to, and a near-Earth asteroid's (TT).
CENTAUR_YEARS = (2378496.5, 2488069.5)  # 1800 January 1 to 2100 January 1
NEAR_EARTH_YEARS = (2415020.5, 2488069.5)  # 1900 January 1 to 2100 January 1
#: Moments sampled across the span, besides those near J2000.
UNIFORM = 240
#: Moments each fit is checked at; and the bodies whose positions there the site's tests use:
#: Ceres, Pallas, Vesta, Hygiea; Eros, Hektor, Chiron, Pluto, Eris, Sedna.
CHECKS = 24
CHECK_SEED = 372
TESTED = ("1", "2", "4", "10", "433", "624", "2060", "134340", "136199", "90377")
#: The groups a body is drawn in, from the Sun outwards.
GROUPS = (
    "near-earth",
    "main-belt",
    "trojan",
    "centaur",
    "kuiper-belt",
    "scattered-disc",
    "detached",
)
#: The groups fitted about the Solar System's centre of mass.
BEYOND_NEPTUNE = frozenset({"kuiper-belt", "scattered-disc", "detached"})
#: The five the IAU names dwarf planets: Ceres, Pluto, Eris, Haumea, Makemake.
DWARF_PLANETS = frozenset({"1", "134340", "136199", "136108", "136472"})
#: Where SBDB's own sizes are from, as the site's sources name it.
SBDB_SIZES = "jplSbdb"


@dataclass(frozen=True)
class Asteroid:
    """A body drawn: its number (its designation), its name, its diameter (km) and its group.

    ``sized`` names the source of its diameter, as the site's sources do; ``command`` is what
    Horizons knows it by, if not its number; ``years`` the span fitted, if not Horizons' own.
    """

    number: str
    name: str
    diameter: float
    group: str = "main-belt"
    sized: str = SBDB_SIZES
    command: str | None = None
    years: tuple[float, float] = (START, STOP)


#: The bodies drawn besides the main belt's and the Trojans' largest. A diameter from SBDB is
#: as it gave it on 2026-11-28; the others' are from the papers their ``sized`` names: Haumea's
#: the sphere of its volume (it is 2,322 km long), Makemake's the shorter of the two axes its
#: occultation gave (1,430 by 1,502 km), Arrokoth's its length. SBDB's own 900 km for Varuna
#: is a 2001 estimate; Herschel's later one is kept.
CHOSEN = (
    # Near-Earth asteroids: the two largest, and two that craft went to. Eros keeps to its
    # orbit across all Horizons' years; the others pass too near the planets to.
    Asteroid("433", "Eros", 16.84, "near-earth"),
    Asteroid("1036", "Ganymed", 37.675, "near-earth", years=NEAR_EARTH_YEARS),
    Asteroid("25143", "Itokawa", 0.33, "near-earth", years=NEAR_EARTH_YEARS),
    Asteroid("65803", "Didymos", 0.78, "near-earth", years=NEAR_EARTH_YEARS),
    # Centaurs, between Jupiter and Neptune: the named ones SBDB gives as 100 km across or more.
    Asteroid("2060", "Chiron", 166, "centaur", years=CENTAUR_YEARS),
    Asteroid("5145", "Pholus", 190, "centaur", years=CENTAUR_YEARS),
    Asteroid("10199", "Chariklo", 302, "centaur", years=CENTAUR_YEARS),
    Asteroid("54598", "Bienor", 187.5, "centaur", years=CENTAUR_YEARS),
    # Beyond Neptune. Pluto is asked of Horizons as its system's centre of mass (9), which its
    # planetary ephemeris carries across all the years; Pluto itself only from 1800.
    Asteroid("134340", "Pluto", 2376.6, "kuiper-belt", "nimmo2017", "9"),
    Asteroid("136108", "Haumea", 1595, "kuiper-belt", "ortiz2017"),
    Asteroid("136472", "Makemake", 1430, "kuiper-belt", "ortiz2012"),
    Asteroid("50000", "Quaoar", 1110, "kuiper-belt", "bragaRibas2013"),
    Asteroid("90482", "Orcus", 910, "kuiper-belt", "brown2018"),
    Asteroid("20000", "Varuna", 668, "kuiper-belt", "lellouch2013"),
    Asteroid("486958", "Arrokoth", 36, "kuiper-belt", "spencer2020"),
    Asteroid("136199", "Eris", 2326, "scattered-disc", "sicardy2011"),
    Asteroid("225088", "Gonggong", 1230, "scattered-disc", "kiss2019"),
    Asteroid("90377", "Sedna", 995, "detached", "pal2012"),
)


def asteroid_list(text: str, group: str = "main-belt") -> list[Asteroid]:
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
        found.append(Asteroid(number, name or number, float(diameter), group))
    return sorted(found, key=lambda asteroid: -asteroid.diameter)


def about(group: str) -> tuple[str, str, float]:
    """Give what a group's orbits are fitted about: its name, Horizons' centre, its GM."""
    if group in BEYOND_NEPTUNE:
        return "barycentre", "500@0", GM_SYSTEM
    return "sun", "500@10", GM_SUN


def check_moments(years: tuple[float, float]) -> list[float]:
    """Give the moments a fit is checked at within its years: the same for the same years."""
    picker = random.Random(CHECK_SEED)  # noqa: S311 - reproducible sampling, not security
    return sorted(round(picker.uniform(*years), 6) for _ in range(CHECKS))


def body_json(asteroid: Asteroid, orbit: Orbit, worst: float) -> dict[str, object]:
    """Write a body as the site reads it: what it is, how well it is placed, and its orbit."""
    written = orbit_json(orbit)
    del written["planet"]
    return {
        "name": asteroid.name,
        "group": asteroid.group,
        **({"dwarfPlanet": True} if asteroid.number in DWARF_PLANETS else {}),
        # To a tenth of a kilometre; the smallest, under ten across, to ten metres.
        "diameterKm": round(asteroid.diameter, 1 if asteroid.diameter >= 10 else 2),  # noqa: PLR2004
        "sized": asteroid.sized,
        "about": about(asteroid.group)[0],
        "fittedJdTT": list(asteroid.years),
        "offDegrees": round(worst, 2),
        **written,
        "axisKm": round(orbit.axis),
    }


def fetch_text(url: str) -> str:  # pragma: no cover - needs network access
    """Download a small text answer."""
    with urllib.request.urlopen(url, timeout=120) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = "expected bytes"
        raise TypeError(msg)
    return body.decode()


def listed(cache: Path) -> list[Asteroid]:  # pragma: no cover - needs network access
    """Every body drawn: SBDB's main belt, then its Trojans, then the chosen, in that order."""
    found: list[Asteroid] = []
    for file, url, group in (
        ("sbdb.json", SBDB, "main-belt"),
        ("sbdb-trojans.json", SBDB_TROJANS, "trojan"),
    ):
        listing = cache / file
        if not listing.exists():
            cache.mkdir(parents=True, exist_ok=True)
            _ = listing.write_text(fetch_text(url))
        found.extend(asteroid_list(listing.read_text(), group))
    return [*found, *CHOSEN]


def fit_body(  # pragma: no cover - needs network access
    asteroid: Asteroid, seed: int, cache: Path
) -> tuple[dict[str, object], list[State]]:
    """Fit a body's orbit to Horizons: as the site reads it, and where Horizons has it.

    ``seed`` picks the moments sampled: a body's place in the whole list, so its fit is the
    same whenever it is run.
    """
    command = asteroid.command or f"{asteroid.number};"
    # Horizons leaves a small body's comma-separated rows empty.
    csv = asteroid.command is not None
    _name, centre, gm = about(asteroid.group)
    first = fetch_states(command, centre, [J2000], cache, csv=csv)[0]
    r = math.dist(first.r, (0, 0, 0))
    period = 2 * math.pi * math.sqrt(r**3 / gm) / 86400
    times = sample_times(period, seed, asteroid.years, UNIFORM)
    orbit = fit_orbit(
        "sun", ECLIPTIC_POLE, fetch_states(command, centre, times, cache, csv=csv), gm
    )
    # Checked against where it is from the Sun, as the site draws it.
    truth = fetch_states(command, "500@10", check_moments(asteroid.years), cache, csv=csv)
    worst = max(angle_off(position(orbit, s.jd), s.r) for s in truth)
    return body_json(asteroid, orbit, worst), truth


def fetch_asteroids(  # pragma: no cover - needs network access
    path: Path, checks: Path, cache: Path
) -> list[str]:
    """Fit every body's orbit, write them to ``path`` and test positions to ``checks``.

    Returns a line a body: how far its fit strays from Horizons at other moments.
    """
    asteroids: dict[str, object] = {}
    vectors: dict[str, object] = {}
    report: list[str] = []
    for seed, asteroid in enumerate(listed(cache)):
        written, truth = fit_body(asteroid, seed, cache)
        asteroids[asteroid.number] = written
        if asteroid.number in TESTED:
            vectors[asteroid.number] = [
                {"jdTT": s.jd, "x": round(s.r[0]), "y": round(s.r[1]), "z": round(s.r[2])}
                for s in truth
            ]
        off = written["offDegrees"]
        report.append(f"{asteroid.number} {asteroid.name} ({asteroid.group}): {off} degrees off")
    data = {
        "schemaVersion": 2,
        "source": "https://ssd.jpl.nasa.gov/horizons/",
        "list": "https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html",
        "smallestKm": SMALLEST_KM,
        "epochJdTT": J2000,
        "asteroids": asteroids,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_text(json.dumps(data, separators=(",", ":")) + "\n")
    body = {
        "description": (
            "Positions of Ceres, Pallas, Vesta, Hygiea, Eros, Hektor, Chiron, Pluto (its "
            "system's centre of mass), Eris and Sedna from the Sun's centre, ICRF, km, "
            "geometric, from JPL Horizons."
        ),
        "asteroids": vectors,
    }
    _ = checks.write_text(json.dumps(body, indent=2) + "\n")
    return report
