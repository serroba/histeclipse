"""The rocks at Earth's surface today and how old they are, from Macrostrat.

Peters, S.E. et al., *Macrostrat: a platform for geological data integration and deep-time
research*, https://macrostrat.org, CC BY 4.0 ("All data are licensed under Creative Commons BY
4.0 International"), accessed on the date the file records. Its world geologic map at the
smallest scale, as one vector tile (Mapbox Vector Tile, zoom 0), is decoded here: each map
unit's outline, name, rock type, best age range (millions of years) and colour. The tiles are
rebuilt as the map improves, so a download is not pinned by checksum.
"""

import datetime as dt
import json
import math
import struct
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

from histeclipse_pipeline.empires import simplify

if TYPE_CHECKING:
    from pathlib import Path

    from histeclipse_pipeline.sky import Json

TILE_URL = "https://tiles.macrostrat.org/carto/0/0/0.mvt"
SOURCE = "https://macrostrat.org"
CREDIT = (
    "Macrostrat (Peters et al., macrostrat.org), CC BY 4.0; world map units, simplified for "
    "this site"
)
TOLERANCE = 0.1
MIN_RING_AREA = 0.02

type Message = list[tuple[int, int | bytes]]
type Value = str | float | int | bool


@dataclass(frozen=True)
class Unit:
    """A map unit: its rings in degrees, name, rock type, age range (Ma) and colour."""

    rings: list[list[tuple[float, float]]]
    name: str
    lith: str
    top_ma: float
    bottom_ma: float
    colour: str


def _varint(data: bytes, at: int) -> tuple[int, int]:
    result = 0
    shift = 0
    while True:
        byte = data[at]
        at += 1
        result |= (byte & 0x7F) << shift
        shift += 7
        if byte < 0x80:  # noqa: PLR2004
            return result, at


def fields(data: bytes) -> Message:
    """Read a protocol-buffer message's fields, in order: (number, varint or bytes)."""
    out: Message = []
    at = 0
    while at < len(data):
        key, at = _varint(data, at)
        number, wire = key >> 3, key & 7
        if wire == 0:
            value, at = _varint(data, at)
            out.append((number, value))
        elif wire == 2:  # noqa: PLR2004
            length, at = _varint(data, at)
            out.append((number, data[at : at + length]))
            at += length
        elif wire == 1:
            out.append((number, data[at : at + 8]))
            at += 8
        elif wire == 5:  # noqa: PLR2004
            out.append((number, data[at : at + 4]))
            at += 4
        else:
            msg = f"unsupported wire type {wire}"
            raise ValueError(msg)
    return out


def _packed(data: bytes) -> list[int]:
    values: list[int] = []
    at = 0
    while at < len(data):
        value, at = _varint(data, at)
        values.append(value)
    return values


def _zigzag(value: int) -> int:
    return (value >> 1) ^ -(value & 1)


def _floating(raw: bytes, layout: str) -> float:
    (number,) = struct.unpack(layout, raw)  # pyright: ignore[reportAny]
    return float(number)  # pyright: ignore[reportAny]


def _value(message: bytes) -> Value:
    """Read a tile's value: text, a float, a double, an integer or a flag."""
    for number, raw in fields(message):
        value: Value | None = None
        if isinstance(raw, bytes):
            value = (
                raw.decode("utf-8")
                if number == 1
                else _floating(raw, "<f" if number == 2 else "<d")  # noqa: PLR2004
            )
        elif number in {4, 5}:
            value = raw
        elif number == 6:  # noqa: PLR2004
            value = _zigzag(raw)
        elif number == 7:  # noqa: PLR2004
            value = bool(raw)
        if value is not None:
            return value
    return ""


def rings_of(commands: list[int], extent: int) -> list[list[tuple[float, float]]]:
    """Draw a polygon's rings from its geometry commands, in degrees (zoom 0, Web Mercator)."""
    rings: list[list[tuple[float, float]]] = []
    ring: list[tuple[float, float]] = []
    x = y = 0
    at = 0
    while at < len(commands):
        command, count = commands[at] & 7, commands[at] >> 3
        at += 1
        if command == 7:  # noqa: PLR2004
            if ring:
                rings.append([*ring, ring[0]])
            ring = []
            continue
        for _ in range(count):
            x += _zigzag(commands[at])
            y += _zigzag(commands[at + 1])
            at += 2
            if command == 1:
                ring = []
            ring.append(_degrees(x / extent, y / extent))
    return rings


def _degrees(u: float, v: float) -> tuple[float, float]:
    """Turn a point of a zoom-0 tile (0..1 across and down) into longitude and latitude."""
    lon = u * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * v))))
    return (lon, lat)


def _area(ring: list[tuple[float, float]]) -> float:
    total = 0.0
    for (x1, y1), (x2, y2) in zip(ring, [*ring[1:], ring[0]], strict=True):
        total += x1 * y2 - x2 * y1
    return abs(total) / 2


def _number(value: Value | None) -> float | None:
    if isinstance(value, bool) or value is None or value == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None


def decode_units(tile: bytes, layer_name: str = "units") -> list[Unit]:
    """Every polygon map unit of the tile's layer, with its rings simplified."""
    units: list[Unit] = []
    for number, layer in fields(tile):
        if number != 3 or not isinstance(layer, bytes):  # noqa: PLR2004
            continue
        parts = fields(layer)
        name = next((raw.decode() for n, raw in parts if n == 1 and isinstance(raw, bytes)), "")
        if name != layer_name:
            continue
        keys = [raw.decode() for n, raw in parts if n == 3 and isinstance(raw, bytes)]  # noqa: PLR2004
        values = [_value(raw) for n, raw in parts if n == 4 and isinstance(raw, bytes)]  # noqa: PLR2004
        extent = next((raw for n, raw in parts if n == 5 and isinstance(raw, int)), 4096)  # noqa: PLR2004
        for n, feature in parts:
            if n != 2 or not isinstance(feature, bytes):  # noqa: PLR2004
                continue
            unit = _unit(fields(feature), keys, values, extent)
            if unit is not None:
                units.append(unit)
    return units


def _unit(feature: Message, keys: list[str], values: list[Value], extent: int) -> Unit | None:
    kind = next((raw for n, raw in feature if n == 3 and isinstance(raw, int)), 0)  # noqa: PLR2004
    if kind != 3:  # noqa: PLR2004 - polygons only
        return None
    none: list[int] = []
    tags = next((_packed(raw) for n, raw in feature if n == 2 and isinstance(raw, bytes)), none)  # noqa: PLR2004
    properties = {keys[tags[i]]: values[tags[i + 1]] for i in range(0, len(tags) - 1, 2)}
    geometry = next((_packed(raw) for n, raw in feature if n == 4 and isinstance(raw, bytes)), none)  # noqa: PLR2004
    top, bottom = (
        _number(properties.get("best_age_top")),
        _number(properties.get("best_age_bottom")),
    )
    if top is None or bottom is None:
        return None
    rings = [
        simplify(ring, TOLERANCE)
        for ring in rings_of(geometry, extent)
        if _area(ring) >= MIN_RING_AREA
    ]
    rings = [ring for ring in rings if len(ring) >= 4]  # noqa: PLR2004
    if not rings:
        return None
    return Unit(
        rings=rings,
        name=str(properties.get("name", "")),
        lith=str(properties.get("lith", "")),
        top_ma=top,
        bottom_ma=bottom,
        colour=str(properties.get("color", "#999999")),
    )


def rocks_file(units: list[Unit], accessed: str) -> dict[str, Json]:
    """Build the site's file: each unit with its rings (degrees x 100), name, rock, ages, colour."""
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "accessed": accessed,
        "scale": 100,
        "units": [
            {
                "name": unit.name,
                "lith": unit.lith,
                "topMa": round(unit.top_ma, 3),
                "bottomMa": round(unit.bottom_ma, 3),
                "colour": unit.colour,
                "rings": [
                    [round(value * 100) for point in ring for value in point] for ring in unit.rings
                ],
            }
            for unit in units
        ],
    }


def fetch_rocks(path: Path) -> int:  # pragma: no cover - needs network access
    """Download the world tile and write the site's file."""
    request = urllib.request.Request(TILE_URL, headers={"User-Agent": "histeclipse-pipeline"})
    with urllib.request.urlopen(request, timeout=120) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{TILE_URL}: expected bytes"
        raise TypeError(msg)
    units = decode_units(body)
    accessed = dt.datetime.now(tz=dt.UTC).date().isoformat()
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_text(
        json.dumps(rocks_file(units, accessed), separators=(",", ":"), ensure_ascii=False) + "\n"
    )
    return len(units)
