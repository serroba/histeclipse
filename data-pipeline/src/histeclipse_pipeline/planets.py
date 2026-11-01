"""Reference positions of the naked-eye planets from JPL Horizons (DE441), for the web tests.

The app computes Mercury to Saturn with VSOP87 in the browser. To know how far to trust that
over 4000 BCE to 3000 CE, the tests compare it with DE441, the ephemeris behind the eclipse
catalog. Our DE441 excerpts hold only the Sun, Earth and Moon, so these come from Horizons,
which computes from DE441 directly: geometric geocentric vectors in ICRF, km.

Horizons gives planet *barycentres* over the whole range (a planet's own centre needs its moons'
ephemerides, which start in 1600 for Jupiter). The two are at most a few hundred km apart, far
below what any test here could notice.
"""

import json
import urllib.parse
import urllib.request
from typing import TYPE_CHECKING, TypedDict

if TYPE_CHECKING:
    from pathlib import Path

HORIZONS_API = "https://ssd.jpl.nasa.gov/api/horizons.api"
#: Horizons command for each planet's barycentre.
PLANETS = {"mercury": "1", "venus": "2", "mars": "4", "jupiter": "5", "saturn": "6"}
#: Times per request: Horizons takes a list of times; keep requests modest.
BATCH = 50
PLANET_VECTOR_SEED = 9411
PLANET_VECTOR_DESCRIPTION = (
    "Geometric geocentric positions of planet barycentres, ICRF, km, from JPL Horizons (DE441)."
)


class PlanetVector(TypedDict):
    """One planet at one moment."""

    jdTT: float
    x: float
    y: float
    z: float


#: Where the vectors start: Earth's centre, or the Sun's.
GEOCENTRIC = "500@399"
HELIOCENTRIC = "500@10"


def horizons_url(command: str, jds_tt: list[float], center: str = GEOCENTRIC) -> str:
    """Build a Horizons query for geometric geocentric vectors at the given TT Julian Days."""
    query = urllib.parse.urlencode(
        {
            "format": "text",
            "COMMAND": f"'{command}'",
            "EPHEM_TYPE": "'VECTORS'",
            "CENTER": f"'{center}'",
            "REF_PLANE": "'FRAME'",
            "REF_SYSTEM": "'ICRF'",
            "VEC_TABLE": "'1'",
            "OUT_UNITS": "'KM-S'",
            "VEC_CORR": "'NONE'",
            "CSV_FORMAT": "'YES'",
            "TIME_TYPE": "'TT'",
            # Without this, small Julian Days are read as Modified Julian Days.
            "TLIST_TYPE": "'JD'",
            "TLIST": ",".join(f"'{jd:.6f}'" for jd in jds_tt),
        }
    )
    return f"{HORIZONS_API}?{query}"


def parse_vectors(text: str) -> list[PlanetVector]:
    """Rows between Horizons' $$SOE and $$EOE markers: JD, calendar date, x, y, z."""
    if "$$SOE" not in text or "$$EOE" not in text:
        msg = "Horizons answer has no data block"
        raise ValueError(msg)
    block = text.split("$$SOE", 1)[1].split("$$EOE", 1)[0]
    vectors: list[PlanetVector] = []
    for line in block.strip().splitlines():
        fields = [field.strip() for field in line.split(",")]
        jd, x, y, z = float(fields[0]), float(fields[2]), float(fields[3]), float(fields[4])
        vectors.append({"jdTT": round(jd, 6), "x": round(x, 1), "y": round(y, 1), "z": round(z, 1)})
    return vectors


def write_planet_vectors(
    vectors: dict[str, list[PlanetVector]],
    path: Path,
    description: str = PLANET_VECTOR_DESCRIPTION,
) -> None:
    """Write the reference positions as readable JSON."""
    body = {"description": description, "planets": vectors}
    _ = path.write_text(json.dumps(body, indent=1) + "\n")


def fetch_planet_vectors(  # pragma: no cover - needs network access
    jds_tt: list[float], center: str = GEOCENTRIC
) -> dict[str, list[PlanetVector]]:
    """Ask Horizons for every planet at every time, a batch at a time."""
    vectors: dict[str, list[PlanetVector]] = {}
    for planet, command in PLANETS.items():
        rows: list[PlanetVector] = []
        for start in range(0, len(jds_tt), BATCH):
            url = horizons_url(command, jds_tt[start : start + BATCH], center)
            with urllib.request.urlopen(url, timeout=120) as response:  # noqa: S310  # pyright: ignore[reportAny]
                body: object = response.read()  # pyright: ignore[reportAny]
            if not isinstance(body, bytes):
                msg = "Horizons: expected bytes"
                raise TypeError(msg)
            rows.extend(parse_vectors(body.decode()))
        vectors[planet] = rows
    return vectors
