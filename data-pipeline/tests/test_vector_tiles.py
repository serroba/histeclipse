import struct

import pytest

from histeclipse_pipeline.vector_tiles import decode, tile_to_lon_lat


def varint(value: int) -> bytes:
    out = bytearray()
    while True:
        byte = value & 0x7F
        value >>= 7
        if value:
            out.append(byte | 0x80)
        else:
            out.append(byte)
            return bytes(out)


def field(number: int, payload: bytes | int) -> bytes:
    if isinstance(payload, int):
        return varint(number << 3) + varint(payload)
    return varint(number << 3 | 2) + varint(len(payload)) + payload


def packed(values: list[int]) -> bytes:
    return b"".join(varint(value) for value in values)


def zigzag(value: int) -> int:
    return (value << 1) ^ (value >> 63)


def command(kind: int, count: int) -> int:
    return kind | count << 3


VALUES = [
    field(1, b"Babylonia"),  # string
    varint(2 << 3 | 5) + struct.pack("<f", 1.5),  # float
    varint(3 << 3 | 1) + struct.pack("<d", -1879.25),  # double
    field(4, 2),  # int
    field(5, 7),  # uint
    field(6, zigzag(-3)),  # sint
    field(7, 1),  # bool
]
# A line from (10, 20) to (13, 16), then a closed triangle.
LINE = [command(1, 1), zigzag(10), zigzag(20), command(2, 1), zigzag(3), zigzag(-4)]
RING = [command(1, 1), zigzag(0), zigzag(0), command(2, 2), zigzag(4), 0, 0, zigzag(4), 7]
FEATURE = field(2, packed([0, 0, 1, 2, 2, 3, 3, 1, 4, 4, 5, 5, 6, 6])) + field(3, 2)
LAYER = (
    field(1, b"land_ohm_lines")
    + field(2, FEATURE + field(4, packed(LINE)))
    + field(2, field(3, 3) + field(4, packed(RING)))
    + b"".join(field(3, key) for key in [b"name", b"admin_level", b"start", b"n", b"u", b"s", b"b"])
    + b"".join(field(4, value) for value in VALUES)
    + field(5, 512)
)


def test_decodes_layers_properties_and_lines() -> None:
    [layer] = decode(field(3, LAYER) + field(1, b"ignored"))
    assert layer.name == "land_ohm_lines"
    assert layer.extent == 512
    line, ring = layer.features
    assert line.kind == 2
    assert line.properties == {
        "name": "Babylonia",
        "admin_level": -1879.25,
        "start": 2,
        "n": 1.5,
        "u": 7,
        "s": -3,
        "b": True,
    }
    assert line.parts == [[(10, 20), (13, 16)]]
    # ClosePath returns to the start.
    assert ring.parts == [[(0, 0), (4, 0), (4, 4), (0, 0)]]


def test_skips_fields_it_does_not_know() -> None:
    feature = field(1, 9) + field(9, b"?") + field(3, 2)
    layer = field(1, b"x") + field(2, feature) + field(9, b"?") + field(15, 2)
    [decoded] = decode(field(3, layer))
    assert decoded.features[0].kind == 2
    assert decoded.extent == 4096
    value_layer = field(1, b"y") + field(2, field(2, packed([0, 0]))) + field(3, b"k")
    value_layer += field(4, field(9, b"?") + field(1, b"v"))
    [with_value] = decode(field(3, value_layer))
    assert with_value.features[0].properties == {"k": "v"}


def test_reads_large_unsigned_values_as_signed_64_bit() -> None:
    layer = field(1, b"x") + field(2, field(2, packed([0, 0]))) + field(3, b"k")
    layer += field(4, field(5, 2**64 - 5))
    [decoded] = decode(field(3, layer))
    assert decoded.features[0].properties == {"k": -5}


def test_rejects_what_it_cannot_read() -> None:
    with pytest.raises(ValueError, match="wire type"):
        _ = decode(varint(3 << 3 | 3))
    with pytest.raises(ValueError, match="Empty value"):
        _ = decode(field(3, field(1, b"x") + field(4, b"")))


def test_places_tile_corners_on_the_globe() -> None:
    assert tile_to_lon_lat(2, 0, 0, 4096, (0, 0)) == pytest.approx((-180, 85.0511), abs=1e-4)
    assert tile_to_lon_lat(2, 2, 2, 4096, (0, 0)) == pytest.approx((0, 0), abs=1e-9)
    assert tile_to_lon_lat(2, 3, 3, 4096, (4096, 4096)) == pytest.approx((180, -85.0511), abs=1e-4)
