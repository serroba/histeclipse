"""Where the craft beyond Earth orbit went, as JPL Horizons gives it (#350).

Horizons holds trajectories for some 110 of the craft in the record (`spacecraft.py`): nearly
every one since the late 1990s, and before that Mariner 2, the Pioneers and the Voyagers. For
each, the pipeline asks Horizons for its positions over its record's phases, as far as
Horizons covers it, and keeps them in as few points as draw the path within a set distance:

- about the Sun, for a craft between the planets: a day apart, thinned to 75,000 km (a
  twentieth of a planet's width at the scale they are seen at);
- about the planet it passes, an hour apart, while it flies by (a phase of a month at most),
  thinned to 1,000 km, so a flyby bends where it did;
- about Earth, for a craft near Earth and the Moon (on its way to the Moon, in a month or so
  about Earth or the Moon): six hours apart, hourly for the days about each change of phase,
  thinned to 500 km;
- about Earth, for a craft at the Sun-Earth L1 or L2 point (SOHO, JWST): a day apart, thinned
  to 50,000 km, which keeps the shape of its loops about the point, a million km across.

A long stay in orbit (Cassini's 13 years about Saturn, the Lunar Reconnaissance Orbiter's about
the Moon, a craft's years in a high orbit about Earth) is kept as that span only, not as its
thousands of loops: the site draws the craft at its world then. Paths stop at the start of 2030, as
Horizons's positions for the Pioneers and Voyagers run on long past contact, as predictions.

Thinning keeps the fewest points such that, at every sampled moment, the path drawn between
them (straight, at the same moment's share of the way) is within the set distance of where
the craft was: the Douglas-Peucker method, measured in time as well as space.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

from histeclipse_pipeline.planets import HORIZONS_API

if TYPE_CHECKING:
    from pathlib import Path

#: Where the paths stop: Horizons's positions run on as predictions.
END = "2030-01-01"
#: A stay about another world longer than this, days, is kept as a span, not a path.
LONGEST_FLYBY = 30
#: Days about each change of phase near Earth sampled hourly (leaving, arriving).
CLOSE_DAYS = 5
#: Thinning tolerances, km: about the Sun, during a flyby, about Earth.
SUN_TOLERANCE = 75_000.0
FLYBY_TOLERANCE = 1_000.0
EARTH_TOLERANCE = 500.0
POINT_TOLERANCE = 50_000.0
#: Bodies whose phases are drawn about Earth: its own, the Moon's, the L points'.
NEAR_EARTH = {"Earth", "Luna", "SEL1", "SEL2", "EML1", "EML2"}
#: Moons a craft met while in orbit about their planet (Cassini's Titan flybys): a stay at
#: the planet, not flybys of their own.
MOON_OF = {
    "Titan": "Saturn",
    "Enceladus": "Saturn",
    "Dione": "Saturn",
    "Rhea": "Saturn",
    "Tethys": "Saturn",
    "Hyperion": "Saturn",
    "Iapetus": "Saturn",
    "Phoebe": "Saturn",
    "Europa": "Jupiter",
    "Io": "Jupiter",
    "Callisto": "Jupiter",
    "Ganymede": "Jupiter",
}
#: Of those, the L points, about which a craft may loop for years.
L_POINTS = {"SEL1", "SEL2", "EML1", "EML2"}
#: Julian Days kept relative to this, to keep the file small: 2400000 is the Modified JD's.
JD_BASE = 2_400_000.0

type Sample = tuple[float, float, float, float]


@dataclass(frozen=True)
class Span:
    """A stretch of a craft's path to ask Horizons for: about which centre, and how often."""

    start: str
    stop: str
    #: "Sun" or "Earth": the frame the positions are in.
    centre: str
    #: Horizons's step: "1 d", "6 h", "1 h".
    step: str
    tolerance: float


@dataclass(frozen=True)
class Stay:
    """A long stay about another world, kept as a span: the craft is drawn at the world."""

    start: str
    stop: str | None
    world: str


def day(text: str | None) -> str | None:
    """Give a phase's date to the day (ISO), its doubt dropped."""
    if text is None:
        return None
    return text.rstrip("?")[:10] if len(text.rstrip("?")) >= len("2000-01-01") else None


def shifted(iso: str, days: float) -> str:
    """Give an ISO date (and time) moved by some days, to the minute."""
    moment = datetime.fromisoformat(iso).replace(tzinfo=UTC) + timedelta(days=days)
    return moment.strftime("%Y-%m-%dT%H:%M")


def plan(phases: list[list[object]], start: str, stop: str) -> list[Span | Stay]:
    """Split a craft's phases into spans to ask Horizons for, and long stays at other worlds.

    ``start`` and ``stop`` (ISO) are where Horizons's coverage, and the paths' end, cut them.
    """
    pieces: list[Span | Stay] = []
    for world, began, ended in blocks(phases):
        first = max(day(None if began is None else str(began)) or start, start)
        last = min(day(None if ended is None else str(ended)) or stop, stop)
        if first >= last:
            continue
        lasting = None if ended is None and last == stop else last
        if world in L_POINTS:
            pieces.append(Span(first, last, "Earth", "1 d", POINT_TOLERANCE))
        elif world in NEAR_EARTH and days_between(first, last) > LONGEST_FLYBY:
            pieces.append(Stay(first, lasting, world))
        elif world in NEAR_EARTH:
            # Hourly about each end of the phase, six-hourly between.
            near_first = min(shifted(first, CLOSE_DAYS), last)
            near_last = max(shifted(last, -CLOSE_DAYS), near_first)
            pieces.append(Span(first, near_first, "Earth", "1 h", EARTH_TOLERANCE))
            if near_first < near_last:
                pieces.append(Span(near_first, near_last, "Earth", "6 h", EARTH_TOLERANCE))
            pieces.append(Span(near_last, last, "Earth", "1 h", EARTH_TOLERANCE))
        elif world == "Sun":
            pieces.append(Span(first, last, "Sun", "1 d", SUN_TOLERANCE))
        elif days_between(first, last) <= LONGEST_FLYBY:
            pieces.append(Span(first, last, "Sun", "1 h", FLYBY_TOLERANCE))
        else:
            pieces.append(Stay(first, lasting, world))
    return [p for p in pieces if not isinstance(p, Span) or p.start < p.stop]


def blocks(phases: list[list[object]]) -> list[tuple[str, object, object]]:
    """Join phases one after another at the same world, a moon counted as its planet.

    GCAT splits a stay in orbit at each moon met (Cassini: Saturn, Titan, Saturn…); joined, it
    is one stay at Saturn: (world, start, end).
    """
    out: list[tuple[str, object, object]] = []
    for body, began, ended, *_ in phases:
        world = MOON_OF.get(str(body), str(body))
        if out and out[-1][0] == world:
            out[-1] = (world, out[-1][1], ended)
            continue
        out.append((world, began, ended))
    return out


def days_between(first: str, last: str) -> float:
    """Give the days from one ISO date (and time) to another."""
    return (datetime.fromisoformat(last) - datetime.fromisoformat(first)).total_seconds() / 86400


def off_line(samples: list[Sample], first: int, last: int) -> tuple[int, float]:
    """Find the sample farthest from the straight path between two, at the same moments."""
    t0, x0, y0, z0 = samples[first]
    t1, x1, y1, z1 = samples[last]
    worst, far = first, 0.0
    for index in range(first + 1, last):
        t, x, y, z = samples[index]
        share = 0.0 if t1 == t0 else (t - t0) / (t1 - t0)
        gap = math.dist(
            (x, y, z), (x0 + share * (x1 - x0), y0 + share * (y1 - y0), z0 + share * (z1 - z0))
        )
        if gap > far:
            worst, far = index, gap
    return worst, far


def thinned(samples: list[Sample], tolerance: float) -> list[Sample]:
    """Keep the fewest samples whose straight path is within ``tolerance`` km of every other."""
    if len(samples) <= 2:  # noqa: PLR2004
        return list(samples)
    keep = {0, len(samples) - 1}
    stack = [(0, len(samples) - 1)]
    while stack:
        first, last = stack.pop()
        worst, far = off_line(samples, first, last)
        if far > tolerance:
            keep.add(worst)
            stack.extend([(first, worst), (worst, last)])
    return [samples[index] for index in sorted(keep)]


def range_url(command: str, centre: str, start: str, stop: str, step: str) -> str:
    """Build a Horizons query for geometric vectors over a span, in ICRF, km."""
    query = urllib.parse.urlencode(
        {
            "format": "text",
            "COMMAND": f"'{command}'",
            "EPHEM_TYPE": "'VECTORS'",
            "CENTER": "'500@10'" if centre == "Sun" else "'500@399'",
            "REF_PLANE": "'FRAME'",
            "REF_SYSTEM": "'ICRF'",
            "VEC_TABLE": "'1'",
            "OUT_UNITS": "'KM-S'",
            "VEC_CORR": "'NONE'",
            "CSV_FORMAT": "'YES'",
            "TIME_TYPE": "'TT'",
            "START_TIME": f"'{start}'",
            "STOP_TIME": f"'{stop}'",
            "STEP_SIZE": f"'{step}'",
        }
    )
    return f"{HORIZONS_API}?{query}"


def samples_of(text: str) -> list[Sample]:
    """Rows between Horizons's $$SOE and $$EOE: JD, date, x, y, z."""
    if "$$SOE" not in text:
        return []
    block = text.split("$$SOE", 1)[1].split("$$EOE", 1)[0]
    out: list[Sample] = []
    for line in block.strip().splitlines():
        fields = line.split(",")
        out.append((float(fields[0]), float(fields[2]), float(fields[3]), float(fields[4])))
    return out


def bound(text: str, side: str) -> str | None:
    """Read Horizons's coverage bound from its refusal: 'No ephemeris … prior to A.D. …'."""
    match = re.search(rf"{side} A\.D\. (\d{{4}})-([A-Z]{{3}})-(\d{{2}})", text)
    if match is None:
        return None
    year, month, date = match.groups()
    return datetime.strptime(f"{year} {month} {date}", "%Y %b %d").strftime("%Y-%m-%d")  # noqa: DTZ007


def spacecraft_ids(text: str) -> dict[str, str]:
    """Read Horizons's list of major bodies: each spacecraft's COSPAR designation to its ID.

    Spacecraft have negative IDs; the designation column holds the COSPAR one.
    """
    ids: dict[str, str] = {}
    for line in text.splitlines():
        match = re.match(r"\s*(-\d+)\s+.*?\s((?:19|20)\d\d-\d{3}[A-Z]{1,3})\b", line)
        if match is not None:
            _ = ids.setdefault(match.group(2), match.group(1))
    return ids


def encoded(samples: list[Sample]) -> list[list[float]]:
    """Write samples compactly: days since JD 2400000 to the minute, km to the km."""
    return [[round(t - JD_BASE, 4), round(x), round(y), round(z)] for t, x, y, z in samples]


def fetch(url: str, cache: Path) -> str:  # pragma: no cover - needs network access
    """Ask Horizons once for each URL, its answer kept in ``cache``."""
    file = cache / f"{hashlib.sha256(url.encode()).hexdigest()[:20]}.txt"
    if not file.exists():
        with urllib.request.urlopen(url, timeout=180) as response:  # noqa: S310  # pyright: ignore[reportAny]
            body: object = response.read()  # pyright: ignore[reportAny]
        if not isinstance(body, bytes):
            msg = "Horizons: expected bytes"
            raise TypeError(msg)
        _ = file.write_bytes(body)
    return file.read_text()


def coverage(command: str, cache: Path) -> tuple[str, str] | None:  # pragma: no cover - network
    """Find when Horizons has a craft: the bounds its refusals name, before 1950 and after 2290."""
    early = fetch(range_url(command, "Sun", "1950-01-01", "1950-01-02", "1 d"), cache)
    late = fetch(range_url(command, "Sun", "2290-01-01", "2290-01-02", "1 d"), cache)
    first, last = bound(early, "prior to"), bound(late, "after")
    if first is None or last is None:
        return None
    return first, last


def fetch_spacecraft_paths(  # pragma: no cover - needs network access
    record: Path, path: Path, cache: Path
) -> int:
    """Ask Horizons for each craft of ``record`` it has, and write their paths to ``path``."""
    cache.mkdir(parents=True, exist_ok=True)
    listing = urllib.parse.urlencode({"format": "text", "COMMAND": "'MB'"})
    horizons = spacecraft_ids(fetch(f"{HORIZONS_API}?{listing}", cache))
    data = json.loads(record.read_text())  # pyright: ignore[reportAny]
    paths: dict[str, object] = {}
    for craft in data["craft"]:  # pyright: ignore[reportAny]
        command = horizons.get(str(craft["cospar"]))  # pyright: ignore[reportAny]
        if command is None:
            continue
        span = coverage(command, cache)
        if span is None:
            continue
        start = max(span[0], str(craft["launch"])[:10])  # pyright: ignore[reportAny]
        stop = min(span[1], END)
        pieces: list[dict[str, object]] = []
        for piece in plan(craft["phases"], start, stop):  # pyright: ignore[reportAny]
            if isinstance(piece, Stay):
                pieces.append({"at": piece.world, "from": piece.start, "to": piece.stop})
                continue
            samples = samples_of(
                fetch(range_url(command, piece.centre, piece.start, piece.stop, piece.step), cache)
            )
            if samples:
                pieces.append(
                    {"centre": piece.centre, "points": encoded(thinned(samples, piece.tolerance))}
                )
        if pieces:
            paths[str(craft["id"])] = pieces  # pyright: ignore[reportAny]
    out = {"schemaVersion": 1, "source": "https://ssd.jpl.nasa.gov/horizons/", "paths": paths}
    _ = path.write_text(json.dumps(out, separators=(",", ":")) + "\n")
    return len(paths)
