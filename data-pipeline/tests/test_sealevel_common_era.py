import struct
import zlib
from typing import TYPE_CHECKING

import pytest

from histeclipse_pipeline.sealevel_common_era import (
    Curve,
    Matrix,
    curve,
    curve_json,
    read_mat,
    write_curve,
)
from tests.json_values import read_json

if TYPE_CHECKING:
    from pathlib import Path

DOUBLE = 9
INT16 = 3
INT32 = 5
UINT32 = 6
INT8 = 1
MATRIX = 14
COMPRESSED = 15


def element(kind: int, body: bytes) -> bytes:
    """A data element: tag, body, padding to 8 bytes."""
    return struct.pack("<II", kind, len(body)) + body + b"\0" * (-len(body) % 8)


def small(kind: int, body: bytes) -> bytes:
    """A small data element: up to 4 bytes packed into the tag."""
    return struct.pack("<HH", kind, len(body)) + body.ljust(4, b"\0")


def matrix(  # noqa: PLR0913
    name: str,
    rows: int,
    columns: int,
    values: list[float],
    *,
    code: str = "d",
    kind: int = DOUBLE,
    flags: int = 6,
) -> bytes:
    """A numeric matrix element; ``values`` in column order."""
    name_bytes = name.encode()
    named = small(INT8, name_bytes) if len(name_bytes) <= 4 else element(INT8, name_bytes)
    body = (
        element(UINT32, struct.pack("<II", flags, 0))
        + element(INT32, struct.pack("<ii", rows, columns))
        + named
        + element(kind, struct.pack(f"<{len(values)}{code}", *values))
    )
    return element(MATRIX, body)


def compressed(body: bytes) -> bytes:
    """A compressed element (not padded, as MATLAB writes it)."""
    packed = zlib.compress(body)
    return struct.pack("<II", COMPRESSED, len(packed)) + packed


def mat_file(*elements: bytes) -> bytes:
    text = b"MATLAB 5.0 MAT-file, synthetic".ljust(116, b" ")
    return text + b"\0" * 8 + struct.pack("<H", 0x0100) + b"IM" + b"".join(elements)


SL = [-1000.0, 1800.0, 2010.0, -145.79, -131.55, 21.87, 54.44, 19.36, 3.85]


def test_read_mat_reads_compressed_and_plain_matrices() -> None:
    data = mat_file(
        compressed(matrix("sl", 3, 3, SL)),
        matrix("covariance", 1, 2, [1, 2], code="h", kind=INT16),
    )
    variables = read_mat(data)
    assert variables["sl"] == Matrix(3, 3, SL)
    assert variables["covariance"] == Matrix(1, 2, [1.0, 2.0])
    assert variables["sl"].column(1) == [-145.79, -131.55, 21.87]


def test_read_mat_rejects_other_files() -> None:
    with pytest.raises(ValueError, match="level 5"):
        _ = read_mat(b"not a mat file")


@pytest.mark.parametrize(
    ("body", "message"),
    [
        (element(MATRIX, element(UINT32, b"\0" * 8)), "too short"),
        (matrix("z", 1, 1, [1.0], flags=0x806), "complex"),
        (matrix("x", 1, 1, [1.0], code="d", kind=8), "unsupported numeric type 8"),
        (matrix("x", 2, 2, [1.0]), "does not match"),
    ],
)
def test_read_mat_rejects_what_it_cannot_read(body: bytes, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        _ = read_mat(mat_file(body))


def test_read_mat_rejects_more_than_two_dimensions() -> None:
    body = (
        element(UINT32, struct.pack("<II", 6, 0))
        + element(INT32, struct.pack("<iii", 1, 1, 1))
        + small(INT8, b"x")
        + element(DOUBLE, struct.pack("<d", 1.0))
    )
    with pytest.raises(ValueError, match="3 dimensions"):
        _ = read_mat(mat_file(element(MATRIX, body)))


def test_curve_reads_year_level_and_sigma() -> None:
    series = curve({"sl": Matrix(3, 3, SL)})
    assert series == Curve([-1000, 1800, 2010], [-145.8, -131.6, 21.9], [54.4, 19.4, 3.9])


def test_curve_needs_sl_with_three_columns() -> None:
    with pytest.raises(ValueError, match="three columns"):
        _ = curve({"C": Matrix(1, 1, [1.0])})
    with pytest.raises(ValueError, match="three columns"):
        _ = curve({"sl": Matrix(1, 2, [1.0, 2.0])})


def test_curve_needs_increasing_years() -> None:
    with pytest.raises(ValueError, match="not increasing"):
        _ = curve({"sl": Matrix(2, 3, [2000.0, 1000.0, 0.0, 0.0, 1.0, 1.0])})


def test_curve_json_gives_a_one_sigma_range() -> None:
    body = curve_json(Curve([-1000, 2000], [-145.8, 0.1], [54.4, 0.3]))
    assert body["years"] == [-1000, 2000]
    assert body["level"] == [-145.8, 0.1]
    assert body["low"] == [-200.2, -0.2]
    assert body["high"] == [-91.4, 0.4]
    assert body["range"] == "1 sigma"
    assert body["units"] == "mm"


def test_write_curve(tmp_path: Path) -> None:
    folder = tmp_path / "sealevel-2000y"
    assert write_curve(Curve([0, 20], [1.0, 2.0], [0.5, 0.5]), folder) == 2
    index = read_json(folder / "index.json")
    assert isinstance(index, dict)
    assert index["schemaVersion"] == 1
    assert index["years"] == [0, 20]
    assert index["low"] == [0.5, 1.5]
    assert isinstance(index["licence"], str)
    assert index["licence"].startswith("GPL-3.0")
