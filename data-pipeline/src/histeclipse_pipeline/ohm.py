"""Borders of past states from OpenHistoricalMap, a second source beside Cliopatria.

OpenHistoricalMap (CC0, https://www.openhistoricalmap.org) is a community map of the past.
Its vector tiles carry country-level (admin_level 2) borders as dated lines, and a label point
for each country, with ISO 8601 dates in astronomical years (-0858 is 859 BCE). This reads the
whole world at zoom 2, keeps those borders and labels, simplifies them for globe scale and
splits them by century, like the Cliopatria files.

The map is edited every day, so the files record when they were fetched rather than a checksum.
"""

import json
import urllib.request
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from histeclipse_pipeline.empires import CENTURY, ROUNDING, century_of, simplify
from histeclipse_pipeline.sky import Json
from histeclipse_pipeline.vector_tiles import Layer, Value, decode, tile_to_lon_lat

if TYPE_CHECKING:
    from pathlib import Path

TILE_URL = "https://vtiles.openhistoricalmap.org/maps/ohm/{z}/{x}/{y}.pbf"
ZOOM = 2
CREDIT = "© OpenHistoricalMap contributors, CC0; borders simplified and split by century"
#: Lines are simplified to about 5 km: they are drawn as lines, so they can stay finer.
LINE_TOLERANCE = 0.05
#: Undated ends: an open start is taken as the dawn of the record, an open end as today.
OPEN_START = -4000
OPEN_END = 2100


@dataclass(frozen=True)
class Border:
    """A stretch of country border, in use from ``start`` to ``end`` (astronomical years)."""

    start: int
    end: int
    points: list[tuple[float, float]]


@dataclass(frozen=True)
class Label:
    """A country's name and where to write it, over the years it existed."""

    name: str
    start: int
    end: int
    longitude: float
    latitude: float


def _year(value: Value | None, default: int) -> int:
    """Read a decimal year (OHM's start_decdate) or ISO date as a whole astronomical year."""
    if isinstance(value, bool) or value is None:
        return default
    if isinstance(value, int | float):
        return int(value // 1)
    text = value.strip()
    if not text:
        return default
    negative = text.startswith("-")
    digits = text.lstrip("-").split("-")[0]
    return -int(digits) if negative else int(digits)


def _admin_level_two(properties: dict[str, Value]) -> bool:
    level = properties.get("admin_level")
    return level in {2, "2"}


def _borders(layer: Layer, tile_x: int, tile_y: int) -> list[Border]:
    borders: list[Border] = []
    for feature in layer.features:
        if not _admin_level_two(feature.properties) or feature.kind != 2:  # noqa: PLR2004
            continue
        start = _year(feature.properties.get("start_decdate"), OPEN_START)
        end = _year(feature.properties.get("end_decdate"), OPEN_END)
        for part in feature.parts:
            points = [tile_to_lon_lat(ZOOM, tile_x, tile_y, layer.extent, p) for p in part]
            kept = simplify(points, LINE_TOLERANCE)
            if len(kept) >= 2:  # noqa: PLR2004
                borders.append(Border(start, end, kept))
    return borders


def _labels(layer: Layer, tile_x: int, tile_y: int) -> list[Label]:
    labels: list[Label] = []
    for feature in layer.features:
        name = feature.properties.get("name_en") or feature.properties.get("name")
        if not _admin_level_two(feature.properties) or not isinstance(name, str):
            continue
        if not feature.parts or not feature.parts[0]:
            continue
        lon, lat = tile_to_lon_lat(ZOOM, tile_x, tile_y, layer.extent, feature.parts[0][0])
        start = _year(feature.properties.get("start_decdate"), OPEN_START)
        end = _year(feature.properties.get("end_decdate"), OPEN_END)
        labels.append(Label(name, start, end, lon, lat))
    return labels


def read_tile(layers: list[Layer], tile_x: int, tile_y: int) -> tuple[list[Border], list[Label]]:
    """Country borders and labels from one decoded zoom-2 tile."""
    borders: list[Border] = []
    labels: list[Label] = []
    for layer in layers:
        if layer.name == "land_ohm_lines":
            borders += _borders(layer, tile_x, tile_y)
        elif layer.name == "land_ohm_centroids":
            labels += _labels(layer, tile_x, tile_y)
    return borders, labels


def _rounded(points: list[tuple[float, float]]) -> list[int]:
    return [round(value * ROUNDING) for point in points for value in point]


def by_century(
    borders: list[Border], labels: list[Label]
) -> dict[int, tuple[list[Border], list[Label]]]:
    """Each border and label under every century its years touch; tiles' overlaps removed."""
    centuries: dict[int, tuple[list[Border], list[Label]]] = {}
    seen: set[tuple[int, int, tuple[int, ...]]] = set()
    for border in borders:
        key = (border.start, border.end, tuple(_rounded(border.points)))
        if key in seen:
            continue
        seen.add(key)
        for start in range(century_of(max(border.start, OPEN_START)), border.end + 1, CENTURY):
            centuries.setdefault(start, ([], []))[0].append(border)
    named: set[tuple[str, int, int]] = set()
    for label in labels:
        if (label.name, label.start, label.end) in named:
            continue
        named.add((label.name, label.start, label.end))
        for start in range(century_of(max(label.start, OPEN_START)), label.end + 1, CENTURY):
            centuries.setdefault(start, ([], []))[1].append(label)
    return centuries


def century_file(start: int, borders: list[Border], labels: list[Label]) -> dict[str, Json]:
    """One century's file: borders as flat [lon, lat, …] in hundredths, and labels."""
    return {
        "schemaVersion": 1,
        "century": start,
        "scale": ROUNDING,
        "borders": [
            {"from": b.start, "to": b.end, "points": list[Json](_rounded(b.points))}
            for b in borders
        ],
        "labels": [
            {
                "name": label.name,
                "from": label.start,
                "to": label.end,
                "longitude": round(label.longitude, 2),
                "latitude": round(label.latitude, 2),
            }
            for label in labels
        ],
    }


def write_ohm(
    centuries: dict[int, tuple[list[Border], list[Label]]], folder: Path, fetched: str
) -> int:
    """Write one file per century and an index; return the number of century files."""
    folder.mkdir(parents=True, exist_ok=True)
    for start, (borders, labels) in centuries.items():
        body = json.dumps(century_file(start, borders, labels), separators=(",", ":"))
        _ = (folder / f"{start}.json").write_text(body + "\n")
    index: dict[str, Json] = {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": f"OpenHistoricalMap vector tiles, zoom {ZOOM}, fetched {fetched}",
        "centuries": list[Json](sorted(centuries)),
    }
    _ = (folder / "index.json").write_text(json.dumps(index, separators=(",", ":")) + "\n")
    return len(centuries)


def fetch_ohm(folder: Path) -> tuple[int, int, int]:  # pragma: no cover - needs network access
    """Read every zoom-2 tile and write the century files; return border, label, file counts."""
    borders: list[Border] = []
    labels: list[Label] = []
    for tile_x in range(2**ZOOM):
        for tile_y in range(2**ZOOM):
            url = TILE_URL.format(z=ZOOM, x=tile_x, y=tile_y)
            request = urllib.request.Request(url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
            with urllib.request.urlopen(request, timeout=300) as response:  # noqa: S310  # pyright: ignore[reportAny]
                body: object = response.read()  # pyright: ignore[reportAny]
            if not isinstance(body, bytes):
                msg = f"{url}: expected bytes"
                raise TypeError(msg)
            tile_borders, tile_labels = read_tile(decode(body), tile_x, tile_y)
            borders += tile_borders
            labels += tile_labels
    fetched = datetime.now(UTC).date().isoformat()
    count = write_ohm(by_century(borders, labels), folder, fetched)
    return len(borders), len(labels), count
