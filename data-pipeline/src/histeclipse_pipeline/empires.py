"""Borders of past states and empires for the globe's optional layer, from Cliopatria.

Cliopatria (Seshat Global History Databank, CC BY 4.0) gives each polity's territory as
polygons over ranges of years, 3400 BCE to 2024 CE. Here the borders are simplified for
globe scale (Douglas-Peucker in degrees), coordinates rounded to hundredths of a degree, and
the rows split into one file per century so the app loads only the years on screen.

Cliopatria writes BCE years as negative numbers with no year zero (-550 is 550 BCE); the
files here use astronomical years like the rest of the app (550 BCE is -549).
"""

import io
import json
import math
import zipfile
from dataclasses import dataclass
from typing import TYPE_CHECKING, cast

from histeclipse_pipeline.sky import Json, as_json, parse_json, verified

if TYPE_CHECKING:
    from pathlib import Path

CLIOPATRIA_VERSION = "v0.2.1"
CLIOPATRIA_URL = (
    "https://github.com/Seshat-Global-History-Databank/cliopatria/raw/"
    f"{CLIOPATRIA_VERSION}/cliopatria.geojson.zip"
)
CLIOPATRIA_SHA256 = "e10a4e429fca708788ff9e7572a95fce801fae55852d217cffabc1c59cd4eed4"
CREDIT = (
    "Cliopatria (Seshat Global History Databank), CC BY 4.0; "
    "borders simplified and split by century for this site"
)
#: Douglas-Peucker tolerance and rounding, degrees: about 10 km and 1 km.
TOLERANCE = 0.1
ROUNDING = 100
#: Rings smaller than this (square degrees, about 30 km across) are dropped.
MIN_RING_AREA = 0.08
CENTURY = 100

Point = tuple[float, float]


@dataclass(frozen=True)
class Polity:
    """One row of Cliopatria: a polity's territory over a range of years."""

    name: str
    wikipedia: str
    start: int
    end: int
    rings: list[list[Point]]


def astronomical(year: int) -> int:
    """Cliopatria's year (negative for BCE, no year zero) as an astronomical year."""
    return year + 1 if year < 0 else year


def _segment_distance(point: Point, start: Point, end: Point) -> float:
    (px, py), (ax, ay), (bx, by) = point, start, end
    dx, dy = bx - ax, by - ay
    length = dx * dx + dy * dy
    if length == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def simplify(points: list[Point], tolerance: float) -> list[Point]:
    """Douglas-Peucker: keep the points that stray more than ``tolerance`` from the line."""
    if len(points) < 3:  # noqa: PLR2004
        return list(points)
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        first, last = stack.pop()
        farthest, distance = first, 0.0
        for index in range(first + 1, last):
            d = _segment_distance(points[index], points[first], points[last])
            if d > distance:
                farthest, distance = index, d
        if distance > tolerance:
            keep[farthest] = True
            stack.extend([(first, farthest), (farthest, last)])
    return [point for point, kept in zip(points, keep, strict=True) if kept]


def ring_area(ring: list[Point]) -> float:
    """Absolute shoelace area in square degrees."""
    total = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1], strict=True):
        total += x1 * y2 - x2 * y1
    return abs(total) / 2


def simplify_ring(ring: list[Point]) -> list[Point] | None:
    """Simplify a ring for globe scale; None when it is too small to see."""
    if ring_area(ring) < MIN_RING_AREA:
        return None
    simplified = simplify(ring, TOLERANCE)
    # A closed ring needs at least a triangle plus the closing point.
    return simplified if len(simplified) >= 4 else None  # noqa: PLR2004


def _point(value: Json) -> Point:
    pair = cast("list[float]", value)
    return (float(pair[0]), float(pair[1]))


def _outer_rings(geometry: dict[str, Json]) -> list[list[Point]]:
    """Each polygon's outer ring; holes are left out at this scale."""
    kind, coordinates = geometry.get("type"), cast("list[Json]", geometry.get("coordinates"))
    polygons = coordinates if kind == "MultiPolygon" else [coordinates]
    rings: list[list[Point]] = []
    for polygon in polygons:
        outer = cast("list[list[Json]]", polygon)[0]
        rings.append([_point(point) for point in outer])
    return rings


def parse_polities(collection: Json) -> list[Polity]:
    """Polities from Cliopatria's GeoJSON, simplified; alliances (in parentheses) are skipped."""
    features = cast("list[dict[str, Json]]", cast("dict[str, Json]", collection)["features"])
    polities: list[Polity] = []
    for feature in features:
        properties = cast("dict[str, Json]", feature["properties"])
        name = str(properties["Name"])
        geometry = feature.get("geometry")
        if name.startswith("(") or not isinstance(geometry, dict):
            continue
        rings = [kept for ring in _outer_rings(geometry) if (kept := simplify_ring(ring))]
        if not rings:
            continue
        polities.append(
            Polity(
                name=name,
                wikipedia=str(properties.get("Wikipedia") or ""),
                start=astronomical(int(cast("int", properties["FromYear"]))),
                end=astronomical(int(cast("int", properties["ToYear"]))),
                rings=rings,
            )
        )
    return polities


def merge_unchanged(polities: list[Polity]) -> list[Polity]:
    """Join a polity's consecutive rows whose simplified borders are the same."""
    merged: list[Polity] = []
    for polity in sorted(polities, key=lambda row: (row.name, row.start)):
        last = merged[-1] if merged else None
        if (
            last is not None
            and last.name == polity.name
            and last.end + 1 >= polity.start
            and _rounded(last.rings) == _rounded(polity.rings)
        ):
            merged[-1] = Polity(last.name, last.wikipedia, last.start, polity.end, last.rings)
        else:
            merged.append(polity)
    return merged


def _rounded(rings: list[list[Point]]) -> list[list[int]]:
    return [[round(value * ROUNDING) for point in ring for value in point] for ring in rings]


def century_of(year: int) -> int:
    """Return the first year of the century (astronomical) containing ``year``."""
    return (year // CENTURY) * CENTURY


def by_century(polities: list[Polity]) -> dict[int, list[Polity]]:
    """Each polity row under every century its years touch."""
    centuries: dict[int, list[Polity]] = {}
    for polity in polities:
        for start in range(century_of(polity.start), polity.end + 1, CENTURY):
            centuries.setdefault(start, []).append(polity)
    return centuries


def _flat(ring: list[Point]) -> Json:
    """Write a ring as flat [lon, lat, lon, lat, …] in hundredths of a degree."""
    return [round(value * ROUNDING) for point in ring for value in point]


def encode(polity: Polity) -> dict[str, Json]:
    """Write a polity as compact JSON."""
    return {
        "name": polity.name,
        "wikipedia": polity.wikipedia,
        "from": polity.start,
        "to": polity.end,
        "rings": [_flat(ring) for ring in polity.rings],
    }


def century_file(start: int, polities: list[Polity]) -> dict[str, Json]:
    """One century's file."""
    return {
        "schemaVersion": 1,
        "century": start,
        "scale": ROUNDING,
        "polities": [encode(polity) for polity in polities],
    }


def index_file(centuries: dict[int, list[Polity]]) -> dict[str, Json]:
    """Which centuries have files, and the credit."""
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": f"Cliopatria {CLIOPATRIA_VERSION}",
        "centuries": as_json(sorted(centuries)),
    }


def write_empires(polities: list[Polity], folder: Path) -> int:
    """Write ``index.json`` and one file per century under ``folder``; return the file count."""
    folder.mkdir(parents=True, exist_ok=True)
    centuries = by_century(polities)
    for start, rows in centuries.items():
        path = folder / f"{start}.json"
        _ = path.write_text(json.dumps(century_file(start, rows), separators=(",", ":")) + "\n")
    index = json.dumps(index_file(centuries), separators=(",", ":"))
    _ = (folder / "index.json").write_text(index + "\n")
    return len(centuries)


def unpack(archive: bytes) -> Json:
    """Read the GeoJSON inside Cliopatria's release zip."""
    with zipfile.ZipFile(io.BytesIO(archive)) as zipped:
        name = next(name for name in zipped.namelist() if name.endswith(".geojson"))
        return parse_json(zipped.read(name))


def fetch_cliopatria() -> Json:  # pragma: no cover - needs network access
    """Download the pinned Cliopatria release, checking its checksum."""
    from histeclipse_pipeline.sky import _download  # noqa: PLC0415  # pyright: ignore[reportPrivateUsage]

    return unpack(verified(_download(CLIOPATRIA_URL), CLIOPATRIA_SHA256, "Cliopatria"))
