"""A small reader for classic NetCDF-3 files, record variables and attributes included.

``h5py`` reads NetCDF-4, which is HDF5 underneath; some sources still publish the older
classic format (GPCC's monthly fields among them). Its layout is simple and fully specified
(https://docs.unidata.ucar.edu/netcdf-c/current/file_format_specifications.html): a big-endian
header listing dimensions, attributes and variables, then each fixed-size variable's values,
then the records, where every record variable's slice for one step follows the others'.

This reads every numeric variable whole, as float64, with its numeric and text attributes.
Packing (``scale_factor``, ``add_offset``) and missing values are left to the caller, who
knows which the source uses.
"""

import math
from dataclasses import dataclass, field

import numpy as np
import numpy.typing as npt

type Grid = npt.NDArray[np.float64]
type Attribute = str | tuple[float, ...]

# Header tags and type codes.
_DIMENSION, _VARIABLE, _ATTRIBUTE = 10, 11, 12
_CHAR = 2
_TYPES: dict[int, tuple[str, int]] = {
    1: (">i1", 1),
    2: (">S1", 1),
    3: (">i2", 2),
    4: (">i4", 4),
    5: (">f4", 4),
    6: (">f8", 8),
}
#: The record count of a file still being written ("streaming"), which this does not read.
_STREAMING = 0xFFFFFFFF


@dataclass(frozen=True)
class Variable:
    """A variable's values, indexed as the file declares its dimensions, and its attributes."""

    values: Grid
    attributes: dict[str, Attribute] = field(default_factory=dict[str, Attribute])

    def number(self, name: str) -> float | None:
        """Return the attribute's first value, if it is numeric."""
        value = self.attributes.get(name)
        return value[0] if isinstance(value, tuple) and value else None


@dataclass(frozen=True)
class _Declared:
    name: str
    shape: tuple[int, ...]
    dtype: str
    vsize: int
    begin: int
    attributes: dict[str, Attribute]

    @property
    def is_record(self) -> bool:
        return bool(self.shape) and self.shape[0] == 0


class _Reader:
    """Walk the header, big-endian, every block padded to four bytes."""

    def __init__(self, data: bytes) -> None:
        self.data: bytes = data
        self.position: int = 0

    def integer(self, size: int = 4) -> int:
        value = int.from_bytes(self.data[self.position : self.position + size], "big")
        self.position += size
        return value

    def name(self) -> str:
        length = self.integer()
        text = self.data[self.position : self.position + length].decode()
        self.position += (length + 3) // 4 * 4
        return text

    def tagged(self, expected: int, what: str) -> int:
        tag, count = self.integer(), self.integer()
        if tag not in {0, expected}:
            msg = f"expected {what}, found tag {tag}"
            raise ValueError(msg)
        return count

    def attributes(self) -> dict[str, Attribute]:
        out: dict[str, Attribute] = {}
        for _ in range(self.tagged(_ATTRIBUTE, "attributes")):
            name = self.name()
            kind, count = self.integer(), self.integer()
            dtype, width = _type(kind)
            raw = self.data[self.position : self.position + width * count]
            self.position += (width * count + 3) // 4 * 4
            if kind == _CHAR:
                out[name] = raw.decode("latin-1").rstrip("\0")
            else:
                values: list[float] = np.frombuffer(raw, dtype=dtype).astype(np.float64).tolist()
                out[name] = tuple(values)
        return out


def _type(kind: int) -> tuple[str, int]:
    if kind not in _TYPES:
        msg = f"unsupported NetCDF type {kind}"
        raise ValueError(msg)
    return _TYPES[kind]


def _declare(reader: _Reader, sizes: list[int], offset_size: int) -> _Declared:
    name = reader.name()
    shape = tuple(sizes[reader.integer()] for _ in range(reader.integer()))
    attributes = reader.attributes()
    dtype, _width = _type(reader.integer())
    vsize = reader.integer()
    begin = reader.integer(offset_size)
    return _Declared(name, shape, dtype, vsize, begin, attributes)


def read_netcdf3(data: bytes) -> tuple[dict[str, Variable], dict[str, Attribute]]:
    """Read every numeric variable of a classic (or 64-bit offset) file, and its global attributes.

    Text (char) variables are skipped.
    """
    if data[:3] != b"CDF" or data[3] not in {1, 2}:
        msg = "not a classic NetCDF-3 file"
        raise ValueError(msg)
    offset_size = 4 if data[3] == 1 else 8
    reader = _Reader(data)
    reader.position = 4
    records = reader.integer()
    if records == _STREAMING:
        msg = "the file's record count is unknown (still being written)"
        raise ValueError(msg)
    sizes: list[int] = []
    for _ in range(reader.tagged(_DIMENSION, "dimensions")):
        _ = reader.name()
        sizes.append(reader.integer())
    globals_ = reader.attributes()
    declared = [
        _declare(reader, sizes, offset_size) for _ in range(reader.tagged(_VARIABLE, "variables"))
    ]
    in_records = [each for each in declared if each.is_record]
    # One record variable alone is not padded; several are, each to four bytes (its vsize).
    stride = (
        math.prod(in_records[0].shape[1:]) * _type_width(in_records[0].dtype)
        if len(in_records) == 1
        else sum(each.vsize for each in in_records)
    )
    variables: dict[str, Variable] = {}
    for each in declared:
        if each.dtype == ">S1":
            continue
        if each.is_record:
            values = _records(data, each, records, stride)
        else:
            count = math.prod(each.shape)
            values = np.frombuffer(data, dtype=each.dtype, count=count, offset=each.begin)
            values = values.astype(np.float64).reshape(each.shape)
        variables[each.name] = Variable(values, each.attributes)
    return variables, globals_


def _type_width(dtype: str) -> int:
    return np.dtype(dtype).itemsize


def _records(data: bytes, declared: _Declared, records: int, stride: int) -> Grid:
    """Gather a record variable's slices, one per record, into one array."""
    inner = declared.shape[1:]
    count = math.prod(inner)
    width = _type_width(declared.dtype)
    if stride == count * width:  # contiguous: one read
        flat = np.frombuffer(
            data, dtype=declared.dtype, count=count * records, offset=declared.begin
        )
        return flat.astype(np.float64).reshape((records, *inner))
    out = np.empty((records, *inner), dtype=np.float64)
    for record in range(records):
        offset = declared.begin + record * stride
        out[record] = np.frombuffer(data, dtype=declared.dtype, count=count, offset=offset).reshape(
            inner
        )
    return out
