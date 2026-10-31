"""Stars and constellation figures for the sky view.

Stars come from the Yale Bright Star Catalogue, 5th revised edition (Hoffleit & Warren 1991),
complete to about magnitude 6.5: every star the naked eye can see. Positions are J2000 with
proper motions, parallaxes and radial velocities, so the web app can move each star through
space over millennia.

Constellation figures and names come from d3-celestial (Olaf Frohn, BSD 3-Clause), which draws
the IAU constellations. Its figures are polylines of positions; each vertex is matched to its
catalogue star here, so a figure follows its stars as they move.
"""

import gzip
import hashlib
import json
import math
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING, TypedDict, cast

if TYPE_CHECKING:
    from collections.abc import Iterable, Sequence
    from pathlib import Path

SCHEMA_VERSION = 1

# Sources, pinned by checksum. Harvard serves the catalogue over plain HTTP only, so the
# checksum is what guarantees the file is the one reviewed here.
BSC_URL = "http://tdc-www.harvard.edu/catalogs/ybsc5.gz"
BSC_SHA256 = "3dc44b1e90be8fbe5bcc7656032560f51275f985c7e3f783c9028e1838ec7bed"
D3_CELESTIAL_COMMIT = "7e720a3de062059d4c5400a379146a601d9010e0"
D3_CELESTIAL_URL = (
    f"https://raw.githubusercontent.com/ofrohn/d3-celestial/{D3_CELESTIAL_COMMIT}/data"
)
LINES_SHA256 = "294f66bef5d5cf50b1e17f16d2efa1d97a15131612c68dd935adef6e7373e13c"
NAMES_SHA256 = "ab4ae692027cbc042c0d6791a84456a65eb7c55656107fd00c58ff6e55d4d8b2"

SOURCES = (
    "Stars: Yale Bright Star Catalogue, 5th revised ed. (Hoffleit & Warren 1991, NASA ADC), "
    "J2000 positions and FK5 proper motions. Constellation figures and names: d3-celestial "
    f"(Olaf Frohn, BSD 3-Clause), commit {D3_CELESTIAL_COMMIT[:7]}."
)

# A figure vertex further than this from every catalogue star is an error in the inputs.
MAX_MATCH_ARCMIN = 1.0


@dataclass(frozen=True)
class Star:
    """One catalogue star at epoch and equinox J2000."""

    hr: int
    ra: float  # degrees
    dec: float  # degrees
    pm_ra: float  # mas/yr along the great circle (μα cos δ)
    pm_dec: float  # mas/yr
    parallax: float | None  # mas
    radial_velocity: float | None  # km/s
    vmag: float
    bv: float | None


def _number(field: str) -> float | None:
    text = field.strip()
    return float(text) if text else None


def parse_bright_star_catalogue(lines: Iterable[str]) -> list[Star]:
    """Parse the fixed-width ASCII catalogue (ybsc5), skipping entries kept only for numbering.

    Byte positions follow the catalogue's ReadMe (1-based there, 0-based here).
    """
    stars: list[Star] = []
    for raw in lines:
        line = raw.rstrip("\n").ljust(197)
        vmag = _number(line[102:107])
        if not line[75:77].strip() or vmag is None:
            continue
        ra = (int(line[75:77]) + int(line[77:79]) / 60 + float(line[79:83]) / 3600) * 15
        sign = -1 if line[83] == "-" else 1
        dec = sign * (int(line[84:86]) + int(line[86:88]) / 60 + int(line[88:90]) / 3600)
        # Parallaxes flagged "D" are dynamical estimates; they still place the star in space.
        parallax = _number(line[161:166])
        stars.append(
            Star(
                hr=int(line[0:4]),
                ra=ra,
                dec=dec,
                pm_ra=(_number(line[148:154]) or 0.0) * 1000,
                pm_dec=(_number(line[154:160]) or 0.0) * 1000,
                parallax=None if parallax is None else parallax * 1000,
                radial_velocity=_number(line[166:170]),
                vmag=vmag,
                bv=_number(line[109:114]),
            )
        )
    return stars


def _direction(ra: float, dec: float) -> tuple[float, float, float]:
    r, d = math.radians(ra), math.radians(dec)
    return (math.cos(d) * math.cos(r), math.cos(d) * math.sin(r), math.sin(d))


class StarIndex:
    """Finds the catalogue star nearest a position, by brute force over unit vectors."""

    def __init__(self, stars: Sequence[Star]) -> None:
        """Index ``stars``."""
        self._directions: list[tuple[float, float, float]] = [
            _direction(star.ra, star.dec) for star in stars
        ]

    def nearest(self, ra: float, dec: float) -> tuple[int, float]:
        """Index of the nearest star and its distance in arcminutes."""
        target = _direction(ra, dec)
        best, best_dot = 0, -2.0
        for index, (x, y, z) in enumerate(self._directions):
            dot = x * target[0] + y * target[1] + z * target[2]
            if dot > best_dot:
                best, best_dot = index, dot
        return best, math.degrees(math.acos(min(1.0, best_dot))) * 60


@dataclass(frozen=True)
class Constellation:
    """An IAU constellation: its figure as runs of star indices, and where to put its name."""

    id: str
    name: str
    rank: int  # 1 for the best-known figures, 3 for the faintest
    label: tuple[float, float]  # ra, dec in degrees
    lines: tuple[tuple[int, ...], ...]


type Json = bool | int | float | str | list[Json] | dict[str, Json] | None


def _object(value: Json, what: str) -> dict[str, Json]:
    if not isinstance(value, dict):
        msg = f"{what}: expected an object"
        raise TypeError(msg)
    return value


def _list(value: Json, what: str) -> list[Json]:
    if not isinstance(value, list):
        msg = f"{what}: expected a list"
        raise TypeError(msg)
    return value


def _float(value: Json, what: str) -> float:
    if isinstance(value, bool) or not isinstance(value, int | float):
        msg = f"{what}: expected a number"
        raise TypeError(msg)
    return float(value)


def _str(value: Json, what: str) -> str:
    if not isinstance(value, str):
        msg = f"{what}: expected a string"
        raise TypeError(msg)
    return value


def _features(collection: Json, what: str) -> list[dict[str, Json]]:
    features = _list(_object(collection, what).get("features"), f"{what} features")
    return [_object(feature, what) for feature in features]


def constellations(names: Json, lines: Json, stars: Sequence[Star]) -> list[Constellation]:
    """Join d3-celestial's names and figures, matching every figure vertex to a star."""
    index = StarIndex(stars)
    figures: dict[str, tuple[tuple[int, ...], ...]] = {}
    for feature in _features(lines, "figures"):
        name = _str(feature.get("id"), "figure id")
        geometry = _object(feature.get("geometry"), f"{name} geometry")
        runs: list[tuple[int, ...]] = []
        for run in _list(geometry.get("coordinates"), f"{name} coordinates"):
            matched: list[int] = []
            for vertex in _list(run, f"{name} run"):
                lon, lat = (_float(v, f"{name} vertex") for v in _list(vertex, f"{name} vertex"))
                star, arcmin = index.nearest(lon % 360, lat)
                if arcmin > MAX_MATCH_ARCMIN:
                    msg = f"{name}: no catalogue star within {arcmin:.1f} arcmin of ({lon}, {lat})"
                    raise ValueError(msg)
                matched.append(star)
            runs.append(tuple(matched))
        figures[name] = tuple(runs)

    result: list[Constellation] = []
    for feature in _features(names, "names"):
        name = _str(feature.get("id"), "name id")
        properties = _object(feature.get("properties"), f"{name} properties")
        geometry = _object(feature.get("geometry"), f"{name} geometry")
        lon, lat = (
            _float(v, f"{name} label") for v in _list(geometry.get("coordinates"), f"{name} label")
        )
        result.append(
            Constellation(
                id=name,
                name=_str(properties.get("name"), f"{name} name"),
                rank=int(_str(properties.get("rank"), f"{name} rank")),
                label=(lon % 360, lat),
                # Serpens is named twice (Head and Tail) but drawn as one figure: draw it once.
                lines=figures.pop(name, ()),
            )
        )
    return result


class StarColumns(TypedDict):
    """Stars as parallel arrays, the compact shape the web app reads."""

    hr: list[int]
    ra: list[float]
    dec: list[float]
    pmRa: list[float]
    pmDec: list[float]
    parallax: list[float | None]
    radialVelocity: list[float | None]
    vmag: list[float]
    bv: list[float | None]


class ConstellationJson(TypedDict):
    """One constellation in ``sky.json``."""

    id: str
    name: str
    rank: int
    label: list[float]
    lines: list[list[int]]


class SkyFile(TypedDict):
    """Contents of ``sky.json``. Mirrors the web app's runtime schema."""

    schemaVersion: int
    sources: str
    epoch: float
    stars: StarColumns
    constellations: list[ConstellationJson]


def _rounded(value: float | None, digits: int) -> float | None:
    return None if value is None else round(value, digits)


def sky_file(stars: Sequence[Star], figures: Sequence[Constellation]) -> SkyFile:
    """Assemble ``sky.json``. Positions keep 0.04″ (1e-5°), plenty for the eye."""
    return {
        "schemaVersion": SCHEMA_VERSION,
        "sources": SOURCES,
        "epoch": 2000.0,
        "stars": {
            "hr": [star.hr for star in stars],
            "ra": [round(star.ra, 5) for star in stars],
            "dec": [round(star.dec, 5) for star in stars],
            "pmRa": [round(star.pm_ra) for star in stars],
            "pmDec": [round(star.pm_dec) for star in stars],
            "parallax": [_rounded(star.parallax, 0) for star in stars],
            "radialVelocity": [star.radial_velocity for star in stars],
            "vmag": [star.vmag for star in stars],
            "bv": [star.bv for star in stars],
        },
        "constellations": [
            {
                "id": figure.id,
                "name": figure.name,
                "rank": figure.rank,
                "label": [round(figure.label[0], 3), round(figure.label[1], 3)],
                "lines": [list(run) for run in figure.lines],
            }
            for figure in figures
        ],
    }


def write_sky_file(sky: SkyFile, path: Path) -> None:
    """Write ``sky.json`` as compact JSON."""
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_text(json.dumps(sky, separators=(",", ":"), allow_nan=False) + "\n")


def verified(data: bytes, sha256: str, what: str) -> bytes:
    """Return ``data`` if its SHA-256 matches, so a changed upstream file is never used unseen."""
    digest = hashlib.sha256(data).hexdigest()
    if digest != sha256:
        msg = f"{what}: SHA-256 {digest} does not match the pinned {sha256}"
        raise ValueError(msg)
    return data


def _download(url: str) -> bytes:  # pragma: no cover - needs network access
    # urlopen is typed loosely; the body is checked below.
    with urllib.request.urlopen(url, timeout=60) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
        if not isinstance(body, bytes):
            msg = f"{url}: expected bytes"
            raise TypeError(msg)
        return body


def fetch_sources() -> tuple[list[str], Json, Json]:  # pragma: no cover - needs network access
    """Download the catalogue and figures, checking each against its pinned checksum."""
    catalogue = verified(_download(BSC_URL), BSC_SHA256, "Bright Star Catalogue")
    names = verified(
        _download(f"{D3_CELESTIAL_URL}/constellations.json"), NAMES_SHA256, "constellation names"
    )
    lines = verified(
        _download(f"{D3_CELESTIAL_URL}/constellations.lines.json"), LINES_SHA256, "figures"
    )
    text = gzip.decompress(catalogue).decode("latin-1")
    return text.splitlines(), parse_json(names), parse_json(lines)


def parse_json(data: bytes) -> Json:
    """Parse JSON and check at runtime that it holds only JSON values."""
    decoded: object = json.loads(data)  # pyright: ignore[reportAny]
    return as_json(decoded)


def as_json(value: object) -> Json:
    """Check that ``value`` is made only of JSON types and return it with a precise type."""
    if value is None or isinstance(value, bool | int | float | str):
        return value
    if isinstance(value, list):
        return [as_json(item) for item in cast("list[object]", value)]
    if isinstance(value, dict):
        items = cast("dict[object, object]", value).items()
        return {str(key): as_json(item) for key, item in items}
    msg = f"Not a JSON value: {type(value).__name__}"
    raise TypeError(msg)
