"""Write small classic NetCDF-3 files for tests: fixed and record variables, with attributes."""

import struct
from dataclasses import dataclass, field

import numpy as np
import numpy.typing as npt

#: Type codes by NumPy big-endian dtype.
_CODES = {">i1": 1, ">i2": 3, ">i4": 4, ">f4": 5, ">f8": 6}

type Attribute = str | float


@dataclass(frozen=True)
class Var:
    """A variable to write: its dimensions, values (or text), dtype and attributes.

    A record variable's values are its records, first axis.
    """

    dimensions: tuple[str, ...]
    values: npt.NDArray[np.float64] | bytes
    dtype: str = ">f4"
    attributes: dict[str, Attribute] = field(default_factory=dict[str, Attribute])

    def whole(self) -> bytes:
        """The variable's bytes, big-endian."""
        if isinstance(self.values, bytes):
            return self.values
        return self.values.astype(self.dtype).tobytes()

    def chunks(self) -> list[bytes]:
        """The bytes of each record (first axis)."""
        if isinstance(self.values, bytes):  # pragma: no cover - text is never a record here
            return [self.values]
        return [np.asarray(part, dtype=self.dtype).tobytes() for part in np.unstack(self.values)]


def _padded(raw: bytes) -> bytes:
    return raw + b"\0" * (-len(raw) % 4)


def _name(text: str) -> bytes:
    return struct.pack(">I", len(text)) + _padded(text.encode())


def _attributes(attributes: dict[str, Attribute]) -> bytes:
    if not attributes:
        return struct.pack(">II", 0, 0)
    out = struct.pack(">II", 12, len(attributes))
    for key, value in attributes.items():
        if isinstance(value, str):
            raw = value.encode()
            out += _name(key) + struct.pack(">II", 2, len(raw)) + _padded(raw)
        else:
            out += _name(key) + struct.pack(">II", 5, 1) + struct.pack(">f", value)
    return out


def _entry(key: str, var: Var, order: list[str], vsize: int) -> bytes:
    entry = _name(key) + struct.pack(">I", len(var.dimensions))
    entry += b"".join(struct.pack(">I", order.index(dim)) for dim in var.dimensions)
    code = 2 if isinstance(var.values, bytes) else _CODES[var.dtype]
    return entry + _attributes(var.attributes) + struct.pack(">II", code, vsize)


def netcdf3(
    dimensions: dict[str, int],
    variables: dict[str, Var],
    *,
    records: int = 0,
    global_attributes: dict[str, Attribute] | None = None,
    version: int = 1,
) -> bytes:
    """Write a file; the dimension of size 0 is the record dimension, ``records`` long.

    Fixed variables are written whole; record variables are written by record, interleaved.
    """
    offset = 4 if version == 1 else 8
    order = list(dimensions)
    in_records = [key for key, var in variables.items() if dimensions[var.dimensions[0]] == 0]
    alone = len(in_records) == 1
    sizes: dict[str, int] = {}
    for key, var in variables.items():
        size = len(var.chunks()[0]) if key in in_records else len(var.whole())
        sizes[key] = size if alone and key in in_records else size + (-size % 4)
    header = b"CDF" + bytes([version]) + struct.pack(">I", records)
    header += struct.pack(">II", 10, len(dimensions))
    header += b"".join(_name(dim) + struct.pack(">I", size) for dim, size in dimensions.items())
    header += _attributes(global_attributes or {}) + struct.pack(">II", 11, len(variables))
    entries = {key: _entry(key, var, order, sizes[key]) for key, var in variables.items()}
    start = len(header) + sum(len(entry) + offset for entry in entries.values())
    begins: dict[str, int] = {}
    fixed = b""
    for key, var in variables.items():
        if key not in in_records:
            begins[key] = start + len(fixed)
            fixed += _padded(var.whole())
    at = start + len(fixed)
    for key in in_records:
        begins[key] = at
        at += sizes[key]
    body = b"".join(
        chunk if alone else _padded(chunk)
        for record in range(records)
        for chunk in (variables[key].chunks()[record] for key in in_records)
    )
    header += b"".join(entries[key] + begins[key].to_bytes(offset, "big") for key in variables)
    return header + fixed + body
