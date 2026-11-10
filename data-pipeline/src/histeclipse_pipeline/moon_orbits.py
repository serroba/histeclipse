"""The orbits of the moons of Mars, Jupiter and Saturn (#335), fitted to JPL Horizons.

The site draws Phobos and Deimos, the four Galilean moons, and Saturn's eight largest moons
going round their planets, at any moment it can show. Each moon's orbit is kept as mean
elements that drift steadily: a size, an eccentricity and an inclination, and three angles that
turn at fixed rates: where the moon is along its orbit (its mean longitude), where its orbit
comes closest to the planet (its longitude of pericentre), and where it crosses the plane it
precesses about (its node). Phobos is spiralling in, so its mean longitude also gains a
steady acceleration.

JPL publishes such elements, but with periods to four or five figures: too few to say where a
moon is a century away. So they are fitted here to JPL's own ephemerides, as Horizons gives
them (positions and velocities relative to the planet's centre, in ICRF), from 1750 to 2200:

- the plane each orbit precesses about (its Laplace plane) is JPL's, from its table of mean
  elements (https://ssd.jpl.nasa.gov/sats/elem/), its pole to a tenth of a degree;
- each sample's osculating elements are referred to that plane;
- each angle is unwrapped from J2000 outwards, each sample by the fit to those nearer, and the
  rates fitted by least squares.

Some moons are held in resonance with another, which swings them to and fro along their
orbits: Mimas by some 44 degrees every 70 years (with Tethys), Hyperion by several degrees
(with Titan). Up to two such swings are fitted to each moon's mean longitude, each found by
searching the periods for the one that best accounts for what the steady motion leaves. What
remains is a fraction of a degree for all but Hyperion, whose swing itself waxes and wanes:
it can be some 4 degrees off.
The fit's errors, measured against Horizons at other moments, are what the site's tests hold
it to.
"""

from __future__ import annotations

import hashlib
import json
import math
import random
import re
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

from histeclipse_pipeline.planets import horizons_url

if TYPE_CHECKING:
    from pathlib import Path

J2000 = 2451545.0
#: The span fitted (TT): Horizons has Saturn's moons from the last day of 1749.
START = 2360235.5
STOP = 2524593.5
#: Moments sampled across the span for each moon, besides those near J2000.
UNIFORM = 1000
#: Moments a Horizons request asks for.
BATCH = 50
#: Each moon: its Horizons code, its planet's centre, its planet, and its Laplace plane's pole
#: (right ascension and declination, ICRF, degrees), from JPL's table.
MOONS = {
    "phobos": ("401", "500@499", "mars", (317.7, 52.9)),
    "deimos": ("402", "500@499", "mars", (316.6, 53.5)),
    "io": ("501", "500@599", "jupiter", (268.1, 64.5)),
    "europa": ("502", "500@599", "jupiter", (268.1, 64.5)),
    "ganymede": ("503", "500@599", "jupiter", (268.2, 64.6)),
    "callisto": ("504", "500@599", "jupiter", (268.7, 64.8)),
    "mimas": ("601", "500@699", "saturn", (40.6, 83.5)),
    "enceladus": ("602", "500@699", "saturn", (40.6, 83.5)),
    "tethys": ("603", "500@699", "saturn", (40.6, 83.5)),
    "dione": ("604", "500@699", "saturn", (40.6, 83.5)),
    "rhea": ("605", "500@699", "saturn", (40.6, 83.5)),
    "titan": ("606", "500@699", "saturn", (36.4, 84.0)),
    "hyperion": ("607", "500@699", "saturn", (40.2, 83.6)),
    "iapetus": ("608", "500@699", "saturn", (288.7, 78.9)),
}
#: Moments for the web tests' reference positions, a moon.
CHECKS = 24
CHECK_SEED = 3355

type Vector = tuple[float, float, float]


@dataclass(frozen=True)
class State:
    """Where a moon is and how it moves, relative to its planet: TT Julian Day, km, km/s."""

    jd: float
    r: Vector
    v: Vector


@dataclass(frozen=True)
class Osculating:
    """A sample's elements on the Laplace plane: degrees, km."""

    t: float
    longitude: float
    pericentre: float
    node: float
    eccentricity: float
    inclination: float
    axis: float


@dataclass(frozen=True)
class Orbit:
    """A moon's mean orbit: angles in degrees, rates per day from J2000 (TT), km."""

    planet: str
    axis: float
    eccentricity: float
    inclination: float
    #: Mean longitude: at J2000, a day's motion, and half its gain a day squared.
    longitude: tuple[float, float, float]
    #: Swings of the mean longitude: period (days), and the sine's and cosine's amplitudes.
    swings: tuple[tuple[float, float, float], ...]
    #: Longitude of pericentre and of the node: at J2000, and a day's motion.
    pericentre: tuple[float, float]
    node: tuple[float, float]
    #: The Laplace plane's pole, right ascension and declination (ICRF).
    pole: tuple[float, float]


def dot(a: Vector, b: Vector) -> float:
    """Give the dot product."""
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def cross(a: Vector, b: Vector) -> Vector:
    """Give the cross product."""
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def unit(a: Vector) -> Vector:
    """Scale to length 1."""
    length = math.sqrt(dot(a, a))
    return (a[0] / length, a[1] / length, a[2] / length)


def wrap(degrees: float) -> float:
    """Bring an angle within half a turn of 0."""
    return (degrees + 180) % 360 - 180


#: A state in Horizons' plain layout: the JD, then each of X, Y, Z, VX, VY, VZ as ``X =value``.
PLAIN_STATE = re.compile(
    r"^(?P<jd>\d+\.\d+) = .*?"
    + "".join(rf"{axis} ?=\s*(?P<{axis.lower()}>\S+)\s*" for axis in ("X", "Y", "Z"))
    + "".join(rf"V{axis} ?=\s*(?P<v{axis.lower()}>\S+)\s*" for axis in ("X", "Y", "Z")),
    re.MULTILINE | re.DOTALL,
)


def parse_states(text: str) -> list[State]:
    """Rows between Horizons' $$SOE and $$EOE markers: JD, date, x, y, z, vx, vy, vz.

    Read from its comma-separated rows, or from its plain layout, a state a few lines.
    """
    if "$$SOE" not in text or "$$EOE" not in text:
        msg = "Horizons answer has no data block"
        raise ValueError(msg)
    block = text.split("$$SOE", 1)[1].split("$$EOE", 1)[0]
    if " X =" in block:
        return [
            State(
                float(match["jd"]),
                (float(match["x"]), float(match["y"]), float(match["z"])),
                (float(match["vx"]), float(match["vy"]), float(match["vz"])),
            )
            for match in PLAIN_STATE.finditer(block)
        ]
    states: list[State] = []
    for line in block.strip().splitlines():
        fields = [float(field) for field in line.split(",")[2:8]]
        jd = float(line.split(",")[0])
        states.append(
            State(jd, (fields[0], fields[1], fields[2]), (fields[3], fields[4], fields[5]))
        )
    return states


def gravity(states: list[State]) -> float:
    """Estimate the planet's GM, km³/s², as the mean of r v² (a near-circular orbit's GM)."""
    return sum(math.sqrt(dot(s.r, s.r)) * dot(s.v, s.v) for s in states) / len(states)


def pole_vector(pole: tuple[float, float]) -> Vector:
    """Turn a right ascension and declination (degrees) into a direction."""
    ra, dec = (math.radians(angle) for angle in pole)
    return (math.cos(dec) * math.cos(ra), math.cos(dec) * math.sin(ra), math.sin(dec))


def laplace_frame(pole: Vector) -> tuple[Vector, Vector, Vector]:
    """Axes on the Laplace plane: x to its node on the ICRF equator, z to its pole."""
    x = unit(cross((0.0, 0.0, 1.0), pole))
    return x, cross(pole, x), pole


def osculating(state: State, gm: float, frame: tuple[Vector, Vector, Vector]) -> Osculating:
    """Give a sample's elements, its angles measured along the Laplace plane then the orbit."""
    x, y, z = frame
    r = (dot(state.r, x), dot(state.r, y), dot(state.r, z))
    v = (dot(state.v, x), dot(state.v, y), dot(state.v, z))
    h = cross(r, v)
    distance = math.sqrt(dot(r, r))
    inclination = math.acos(h[2] / math.sqrt(dot(h, h)))
    node = math.atan2(h[0], -h[1])
    vh = cross(v, h)
    e = (vh[0] / gm - r[0] / distance, vh[1] / gm - r[1] / distance, vh[2] / gm - r[2] / distance)
    eccentricity = math.sqrt(dot(e, e))

    def along(a: Vector) -> float:
        # Turned back by the node, then by the inclination: the angle in the orbit's plane.
        cn, sn = math.cos(node), math.sin(node)
        ax, ay = a[0] * cn + a[1] * sn, -a[0] * sn + a[1] * cn
        ci, si = math.cos(inclination), math.sin(inclination)
        return node + math.atan2(ay * ci + a[2] * si, ax)

    true_longitude = along(r)
    pericentre = along(e)
    f = true_longitude - pericentre
    anomaly = 2 * math.atan2(
        math.sqrt(1 - eccentricity) * math.sin(f / 2), math.sqrt(1 + eccentricity) * math.cos(f / 2)
    )
    mean_anomaly = anomaly - eccentricity * math.sin(anomaly)
    return Osculating(
        t=state.jd - J2000,
        longitude=math.degrees(pericentre + mean_anomaly),
        pericentre=math.degrees(pericentre),
        node=math.degrees(node),
        eccentricity=eccentricity,
        inclination=math.degrees(inclination),
        axis=1 / (2 / distance - dot(v, v) / gm),
    )


def solve(matrix: list[list[float]], vector: list[float]) -> list[float]:
    """Solve a small linear system by Gaussian elimination with partial pivoting."""
    size = len(vector)
    rows = [[*row, value] for row, value in zip(matrix, vector, strict=True)]
    for column in range(size):
        pivot = max(range(column, size), key=lambda row: abs(rows[row][column]))
        rows[column], rows[pivot] = rows[pivot], rows[column]
        for row in range(column + 1, size):
            factor = rows[row][column] / rows[column][column]
            rows[row] = [a - factor * b for a, b in zip(rows[row], rows[column], strict=True)]
    solution = [0.0] * size
    for row in reversed(range(size)):
        known = sum(rows[row][k] * solution[k] for k in range(row + 1, size))
        solution[row] = (rows[row][size] - known) / rows[row][row]
    return solution


def fit_polynomial(ts: list[float], ys: list[float], degree: int) -> list[float]:
    """Least-squares coefficients, constant first, of a polynomial in t (days)."""
    # In centuries, so the normal equations stay well conditioned.
    scale = 36525.0
    powers = [[(t / scale) ** k for k in range(degree + 1)] for t in ts]
    matrix = [
        [sum(p[j] * p[k] for p in powers) for k in range(degree + 1)] for j in range(degree + 1)
    ]
    vector = [sum(p[j] * y for p, y in zip(powers, ys, strict=True)) for j in range(degree + 1)]
    return [c / scale**k for k, c in enumerate(solve(matrix, vector))]


def evaluate(coefficients: list[float], t: float) -> float:
    """Give a polynomial's value at t."""
    return sum(c * t**k for k, c in enumerate(coefficients))


#: Periods searched for swings, days: from 50 days to 300 years, each 0.2% longer than the last.
SWING_PERIODS = [50 * 1.002**k for k in range(int(math.log(300 * 365.25 / 50) / math.log(1.002)))]
#: A swing smaller than this, degrees, is not worth its terms.
SMALLEST_SWING = 0.05
SWINGS = 2


def sinusoid(ts: list[float], ys: list[float], period: float) -> tuple[float, float, float]:
    """Fit a sine and cosine of ``period`` to ``ys``: their amplitudes, and what is left (rms)."""
    w = 2 * math.pi / period
    ss = sc = cc = sy = cy = 0.0
    for t, y in zip(ts, ys, strict=True):
        sine, cosine = math.sin(w * t), math.cos(w * t)
        ss += sine * sine
        sc += sine * cosine
        cc += cosine * cosine
        sy += sine * y
        cy += cosine * y
    a, b = solve([[ss, sc], [sc, cc]], [sy, cy])
    left = sum(
        (y - a * math.sin(w * t) - b * math.cos(w * t)) ** 2 for t, y in zip(ts, ys, strict=True)
    )
    return a, b, math.sqrt(left / len(ts))


def swings(ts: list[float], residuals: list[float]) -> list[tuple[float, float, float]]:
    """Find up to ``SWINGS`` periodic swings in what a steady motion leaves, largest first."""
    found: list[tuple[float, float, float]] = []
    left = list(residuals)
    for _ in range(SWINGS):
        rough = min(SWING_PERIODS, key=lambda period: sinusoid(ts, left, period)[2])
        # Then finer, within a step of it.
        best = min(
            (rough * (1 + k * 1e-4) for k in range(-20, 21)),
            key=lambda period: sinusoid(ts, left, period)[2],
        )
        a, b, _rms = sinusoid(ts, left, best)
        if math.hypot(a, b) < SMALLEST_SWING:
            break
        found.append((best, a, b))
        w = 2 * math.pi / best
        left = [
            y - a * math.sin(w * t) - b * math.cos(w * t) for t, y in zip(ts, left, strict=True)
        ]
    return found


def swing(terms: tuple[tuple[float, float, float], ...], t: float) -> float:
    """Give the swings' sum at t, degrees."""
    return sum(
        a * math.sin(2 * math.pi * t / period) + b * math.cos(2 * math.pi * t / period)
        for period, a, b in terms
    )


def unwrapped(ts: list[float], angles: list[float], rate: float, degree: int) -> list[float]:
    """Unwrap angles outwards from the moment nearest J2000, each by the fit to those nearer.

    ``rate`` (degrees a day) starts the prediction; the fit is redone each time the span
    covered grows by a tenth.
    """
    order = sorted(range(len(ts)), key=lambda index: abs(ts[index]))
    first = order[0]
    model = [angles[first] - rate * ts[first], rate]
    done_t: list[float] = []
    done_y: list[float] = []
    out = [0.0] * len(ts)
    fitted_span = 0.0
    for index in order:
        t = ts[index]
        span = abs(t)
        if len(done_t) >= 3 and span > 1.1 * fitted_span:  # noqa: PLR2004
            # Curvature only over centuries, where it can show.
            model = fit_polynomial(done_t, done_y, degree if span > 3650 else 1)  # noqa: PLR2004
            fitted_span = span
        predicted = evaluate(model, t)
        value = predicted + wrap(angles[index] - predicted)
        out[index] = value
        done_t.append(t)
        done_y.append(value)
    return out


def sample_times(
    period: float,
    seed: int,
    span: tuple[float, float] = (START, STOP),
    uniform: int = UNIFORM,
) -> list[float]:
    """Moments to sample (TT JD): closely about J2000, then ever further, then across the span."""
    start, stop = span
    times: list[float] = []
    step = period / 20
    while J2000 + step < stop or J2000 - step > start:
        times.extend(t for t in (J2000 + step, J2000 - step) if start <= t <= stop)
        step *= 1.3
    generator = random.Random(seed)  # noqa: S311 - reproducible sampling, not security
    times.extend(generator.uniform(start, stop) for _ in range(uniform))
    return [J2000, *times]


def fit_orbit(
    planet: str, pole: tuple[float, float], states: list[State], gm: float | None = None
) -> Orbit:
    """Fit a moon's mean orbit, on the Laplace plane of ``pole``, to its states.

    ``gm`` is the central body's, km³/s²; if not given, it is estimated from the states, which
    suits the moons' near-circular orbits.
    """
    gm = gravity(states) if gm is None else gm
    frame = laplace_frame(pole_vector(pole))
    samples = [osculating(state, gm, frame) for state in states]
    ts = [s.t for s in samples]
    first = min(samples, key=lambda s: abs(s.t))
    distance = first.axis
    rate = math.degrees(math.sqrt(gm / distance**3)) * 86400
    unwrapped_longitude = unwrapped(ts, [s.longitude for s in samples], rate, 2)
    longitude = fit_polynomial(ts, unwrapped_longitude, 2)
    residuals = [y - evaluate(longitude, t) for t, y in zip(ts, unwrapped_longitude, strict=True)]
    terms = tuple(swings(ts, residuals))
    if terms:
        # Fitted again with the swings taken out, so they do not tilt the steady motion.
        steady = [y - swing(terms, t) for t, y in zip(ts, unwrapped_longitude, strict=True)]
        longitude = fit_polynomial(ts, steady, 2)
    pericentre = fit_polynomial(ts, unwrapped(ts, [s.pericentre for s in samples], 0, 1), 1)
    node = fit_polynomial(ts, unwrapped(ts, [s.node for s in samples], 0, 1), 1)
    eccentricity = sum(s.eccentricity for s in samples) / len(samples)
    return Orbit(
        planet=planet,
        axis=sum(s.axis for s in samples) / len(samples),
        eccentricity=eccentricity,
        inclination=sum(s.inclination for s in samples) / len(samples),
        longitude=(longitude[0] % 360, longitude[1], longitude[2]),
        swings=terms,
        pericentre=(pericentre[0] % 360, pericentre[1]),
        node=(node[0] % 360, node[1]),
        pole=pole,
    )


def position(orbit: Orbit, jd: float) -> Vector:
    """Where the mean orbit puts the moon, km from its planet, ICRF (as the site works it)."""
    t = jd - J2000
    lam = math.radians(evaluate(list(orbit.longitude), t) + swing(orbit.swings, t))
    peri = math.radians(evaluate(list(orbit.pericentre), t))
    node = math.radians(evaluate(list(orbit.node), t))
    e = orbit.eccentricity
    mean_anomaly = lam - peri
    anomaly = mean_anomaly
    for _ in range(8):
        anomaly -= (anomaly - e * math.sin(anomaly) - mean_anomaly) / (1 - e * math.cos(anomaly))
    distance = orbit.axis * (1 - e * math.cos(anomaly))
    f = 2 * math.atan2(
        math.sqrt(1 + e) * math.sin(anomaly / 2), math.sqrt(1 - e) * math.cos(anomaly / 2)
    )
    u = peri - node + f
    i = math.radians(orbit.inclination)
    px = distance * (math.cos(node) * math.cos(u) - math.sin(node) * math.sin(u) * math.cos(i))
    py = distance * (math.sin(node) * math.cos(u) + math.cos(node) * math.sin(u) * math.cos(i))
    pz = distance * math.sin(u) * math.sin(i)
    x, y, z = laplace_frame(pole_vector(orbit.pole))
    return (
        px * x[0] + py * y[0] + pz * z[0],
        px * x[1] + py * y[1] + pz * z[1],
        px * x[2] + py * y[2] + pz * z[2],
    )


def angle_off(a: Vector, b: Vector) -> float:
    """Give the angle between two directions from the planet, degrees."""
    return math.degrees(math.acos(max(-1.0, min(1.0, dot(unit(a), unit(b))))))


def orbit_json(orbit: Orbit) -> dict[str, object]:
    """Write a moon's orbit as the site reads it, to the digits that matter over centuries."""
    return {
        "planet": orbit.planet,
        "axisKm": round(orbit.axis, 1),
        "eccentricity": round(orbit.eccentricity, 6),
        "inclination": round(orbit.inclination, 5),
        "longitude": [
            round(orbit.longitude[0], 6),
            round(orbit.longitude[1], 10),
            float(f"{orbit.longitude[2]:.6e}"),
        ],
        "swings": [[round(period, 3), round(a, 5), round(b, 5)] for period, a, b in orbit.swings],
        "pericentre": [round(orbit.pericentre[0], 5), round(orbit.pericentre[1], 9)],
        "node": [round(orbit.node[0], 5), round(orbit.node[1], 9)],
        "pole": [round(orbit.pole[0], 5), round(orbit.pole[1], 5)],
    }


def fetch_states(  # pragma: no cover - needs network access
    command: str, center: str, jds: list[float], cache: Path, *, csv: bool = True
) -> list[State]:
    """Ask Horizons for a body's states at the given moments, each answer kept in ``cache``."""
    states: list[State] = []
    cache.mkdir(parents=True, exist_ok=True)
    for start in range(0, len(jds), BATCH):
        url = horizons_url(command, jds[start : start + BATCH], center, table="2", csv=csv)
        file = cache / f"{hashlib.sha256(url.encode()).hexdigest()[:16]}.txt"
        if not file.exists():
            with urllib.request.urlopen(url, timeout=120) as response:  # noqa: S310  # pyright: ignore[reportAny]
                body: object = response.read()  # pyright: ignore[reportAny]
            if not isinstance(body, bytes):
                msg = "Horizons: expected bytes"
                raise TypeError(msg)
            _ = file.write_bytes(body)
        states.extend(parse_states(file.read_text()))
    return states


def fetch_moon_orbits(  # pragma: no cover - needs network access
    path: Path, checks: Path, cache: Path
) -> list[str]:
    """Fit every moon's orbit, write them to ``path`` and reference positions to ``checks``.

    Returns a line a moon: how far the fit strays from Horizons at the reference moments.
    """
    orbits: dict[str, object] = {}
    vectors: dict[str, object] = {}
    report: list[str] = []
    picker = random.Random(CHECK_SEED)  # noqa: S311 - reproducible sampling, not security
    for seed, (name, (command, center, planet, pole)) in enumerate(MOONS.items()):
        first = fetch_states(command, center, [J2000], cache)[0]
        period = 2 * math.pi * math.sqrt(dot(first.r, first.r) / dot(first.v, first.v)) / 86400
        states = fetch_states(command, center, sample_times(period, seed), cache)
        orbit = fit_orbit(planet, pole, states)
        orbits[name] = orbit_json(orbit)
        moments = sorted(round(picker.uniform(START, STOP), 6) for _ in range(CHECKS))
        truth = fetch_states(command, center, moments, cache)
        vectors[name] = [
            {"jdTT": s.jd, "x": round(s.r[0], 1), "y": round(s.r[1], 1), "z": round(s.r[2], 1)}
            for s in truth
        ]
        worst = max(angle_off(position(orbit, s.jd), s.r) for s in truth)
        report.append(f"{name}: at most {worst:.2f} degrees off Horizons")
    data = {
        "schemaVersion": 1,
        "source": "https://ssd.jpl.nasa.gov/horizons/",
        "epochJdTT": J2000,
        "moons": orbits,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_text(json.dumps(data, separators=(",", ":")) + "\n")
    body = {
        "description": (
            "Positions of the moons of Mars, Jupiter and Saturn relative to their planet's "
            "centre, ICRF, km, geometric, from JPL Horizons."
        ),
        "moons": vectors,
    }
    _ = checks.write_text(json.dumps(body, indent=2) + "\n")
    return report
