"""A small decoder for Mapbox Vector Tiles (protocol buffers).

It reads what the pipeline needs: layers, features, their properties and their geometry.

The format: https://github.com/mapbox/vector-tile-spec (version 2.1). Written here rather
than taken from a library so it stays fully typed and dependency-free.
"""

import math
import struct
from dataclasses import dataclass

Value = str | float | int | bool
Point = tuple[float, float]

_VARINT = 0
_FIXED64 = 1
_LENGTH = 2
_FIXED32 = 5


@dataclass(frozen=True)
class Feature:
    """One feature: its properties, geometry type (2 = line) and parts in tile coordinates."""

    properties: dict[str, Value]
    kind: int
    parts: list[list[tuple[int, int]]]


@dataclass(frozen=True)
class Layer:
    """A named layer and its features; coordinates run from 0 to ``extent``."""

    name: str
    extent: int
    features: list[Feature]


def _varint(data: bytes, at: int) -> tuple[int, int]:
    result = 0
    shift = 0
    while True:
        byte = data[at]
        at += 1
        result |= (byte & 0x7F) << shift
        if byte < 0x80:  # noqa: PLR2004
            return result, at
        shift += 7


def _fields(data: bytes) -> list[tuple[int, int, int | bytes]]:
    """(field number, wire type, value) for each field of a message."""
    fields: list[tuple[int, int, int | bytes]] = []
    at = 0
    while at < len(data):
        key, at = _varint(data, at)
        number, wire = key >> 3, key & 7
        if wire == _VARINT:
            value, at = _varint(data, at)
            fields.append((number, wire, value))
        elif wire == _LENGTH:
            length, at = _varint(data, at)
            fields.append((number, wire, data[at : at + length]))
            at += length
        elif wire == _FIXED64:
            fields.append((number, wire, data[at : at + 8]))
            at += 8
        elif wire == _FIXED32:
            fields.append((number, wire, data[at : at + 4]))
            at += 4
        else:
            msg = f"Unsupported wire type {wire}"
            raise ValueError(msg)
    return fields


def _packed(data: bytes) -> list[int]:
    values: list[int] = []
    at = 0
    while at < len(data):
        value, at = _varint(data, at)
        values.append(value)
    return values


def _zigzag(value: int) -> int:
    return (value >> 1) ^ -(value & 1)


def _value(data: bytes) -> Value:
    for number, _, raw in _fields(data):
        if number == 1 and isinstance(raw, bytes):
            return raw.decode()
        if number in {2, 3} and isinstance(raw, bytes):
            unpacked: tuple[float] = struct.unpack("<f" if number == 2 else "<d", raw)  # noqa: PLR2004
            return unpacked[0]
        if number in {4, 5} and isinstance(raw, int):
            return raw if raw < 2**63 else raw - 2**64
        if number == 6 and isinstance(raw, int):  # noqa: PLR2004
            return _zigzag(raw)
        if number == 7 and isinstance(raw, int):  # noqa: PLR2004
            return bool(raw)
    msg = "Empty value"
    raise ValueError(msg)


def _geometry(commands: list[int]) -> list[list[tuple[int, int]]]:
    """Turn MoveTo/LineTo/ClosePath commands into parts of absolute points."""
    parts: list[list[tuple[int, int]]] = []
    x = y = 0
    at = 0
    while at < len(commands):
        command, count = commands[at] & 7, commands[at] >> 3
        at += 1
        if command == 7:  # noqa: PLR2004 - ClosePath
            if parts and parts[-1]:
                parts[-1].append(parts[-1][0])
            continue
        for _ in range(count):
            x += _zigzag(commands[at])
            y += _zigzag(commands[at + 1])
            at += 2
            if command == 1:  # MoveTo starts a new part
                parts.append([(x, y)])
            else:
                parts[-1].append((x, y))
    return parts


def _feature(data: bytes, keys: list[str], values: list[Value]) -> Feature:
    tags: list[int] = []
    kind = 0
    commands: list[int] = []
    for field, _, part in _fields(data):
        if field == 2 and isinstance(part, bytes):  # noqa: PLR2004
            tags = _packed(part)
        elif field == 3 and isinstance(part, int):  # noqa: PLR2004
            kind = part
        elif field == 4 and isinstance(part, bytes):  # noqa: PLR2004
            commands = _packed(part)
    properties = {keys[tags[i]]: values[tags[i + 1]] for i in range(0, len(tags) - 1, 2)}
    return Feature(properties, kind, _geometry(commands))


def _layer(data: bytes) -> Layer:
    name = ""
    extent = 4096
    keys: list[str] = []
    values: list[Value] = []
    encoded: list[bytes] = []
    for field, _, item in _fields(data):
        if field == 1 and isinstance(item, bytes):
            name = item.decode()
        elif field == 2 and isinstance(item, bytes):  # noqa: PLR2004
            encoded.append(item)
        elif field == 3 and isinstance(item, bytes):  # noqa: PLR2004
            keys.append(item.decode())
        elif field == 4 and isinstance(item, bytes):  # noqa: PLR2004
            values.append(_value(item))
        elif field == 5 and isinstance(item, int):  # noqa: PLR2004
            extent = item
    return Layer(name, extent, [_feature(item, keys, values) for item in encoded])


def decode(tile: bytes) -> list[Layer]:
    """Read every layer in a tile."""
    return [
        _layer(raw)
        for number, _, raw in _fields(tile)
        if number == 3 and isinstance(raw, bytes)  # noqa: PLR2004
    ]


def tile_to_lon_lat(
    zoom: int, tile_x: int, tile_y: int, extent: int, point: tuple[int, int]
) -> Point:
    """Convert a tile coordinate to longitude and latitude (Web Mercator), degrees."""
    scale = 1 << zoom
    x = (tile_x + point[0] / extent) / scale
    y = (tile_y + point[1] / extent) / scale
    longitude = x * 360 - 180
    latitude = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y))))
    return longitude, latitude
