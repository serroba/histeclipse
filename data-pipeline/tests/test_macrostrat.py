"""Tests for decoding Macrostrat's world map tile."""

import struct

import pytest

from histeclipse_pipeline.macrostrat import decode_units, fields, rings_of, rocks_file


def varint(value: int) -> bytes:
    out = b""
    while True:
        byte = value & 0x7F
        value >>= 7
        if value:
            out += bytes([byte | 0x80])
        else:
            return out + bytes([byte])


def field(number: int, payload: bytes | int) -> bytes:
    if isinstance(payload, int):
        return varint(number << 3) + varint(payload)
    return varint(number << 3 | 2) + varint(len(payload)) + payload


def zigzag(value: int) -> int:
    return (value << 1) ^ (value >> 31)


def square(extent: int) -> list[int]:
    """Commands for a square from a quarter to three quarters of the tile."""
    a, b = extent // 4, extent // 2
    return [9, zigzag(a), zigzag(a), 3 << 3 | 2, zigzag(b), 0, 0, zigzag(b), zigzag(-b), 0, 15]


def packed(values: list[int]) -> bytes:
    return b"".join(varint(value) for value in values)


def value_text(text: str) -> bytes:
    return field(1, text.encode())


def value_double(number: float) -> bytes:
    return varint(3 << 3 | 1) + struct.pack("<d", number)


def tile() -> bytes:
    keys = ["name", "best_age_top", "best_age_bottom", "color", "lith"]
    values = [
        value_text("Ordovician sedimentary"),
        value_double(470.0),
        value_double(485.4),
        value_text("#1A9D6F"),
        value_text("sedimentary"),
    ]
    feature = (
        field(2, packed([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]))
        + field(3, 3)
        + field(4, packed(square(4096)))
    )
    point = field(3, 1) + field(4, packed([9, 2, 2]))
    layer = field(1, b"units") + field(2, feature) + field(2, point)
    layer += (
        b"".join(field(3, key.encode()) for key in keys)
        + b"".join(field(4, value) for value in values)
        + field(5, 4096)
    )
    other = field(1, b"lines")
    return field(3, layer) + field(3, other)


def test_reads_protocol_buffer_fields() -> None:
    assert fields(field(1, 150) + field(2, b"ab")) == [(1, 150), (2, b"ab")]


def test_draws_rings_from_commands_in_degrees() -> None:
    [ring] = rings_of(square(4096), 4096)
    assert ring[0] == pytest.approx((-90.0, 66.513), abs=1e-3)
    assert ring[1] == pytest.approx((90.0, 66.513), abs=1e-3)
    assert ring[-1] == ring[0]


def test_decodes_polygon_units_with_their_ages_and_colour() -> None:
    [unit] = decode_units(tile())
    assert (unit.name, unit.lith, unit.top_ma, unit.bottom_ma, unit.colour) == (
        "Ordovician sedimentary",
        "sedimentary",
        470.0,
        485.4,
        "#1A9D6F",
    )
    data = rocks_file([unit], "2026-11-03")
    assert data["accessed"] == "2026-11-03"
    units = data["units"]
    assert isinstance(units, list)
    first = units[0]
    assert isinstance(first, dict)
    assert (first["topMa"], first["bottomMa"]) == (470.0, 485.4)
