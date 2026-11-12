"""Global sea level over the last 3,000 years: Kopp et al. (2016)'s reconstruction (#528).

Kopp et al. (2016), "Temperature-driven global sea-level variability in the Common Era", PNAS
113, E1434 (doi:10.1073/pnas.1517056113), fitted a spatio-temporal Gaussian-process model to a
global database of proxy relative sea-level records and tide gauges, and read global sea level
(GSL) from it every 20 years from 1000 BCE to 1800 CE, then every 10 years to 2010, in mm with
a 1-sigma uncertainty. Their preferred model is the one the paper calls ML₂,₁.

NOAA archives only the proxy database, and the curve's PNAS supplement cannot be downloaded by
script. The same curve is the sea-level input of the authors' semi-empirical model code,
``bobkopp/SESL`` on GitHub (Bittermann's code released by Kopp, 5 December 2016, to accompany
the paper): ``Data/GLMW-1ts.mat``, where ``GLMW-1ts`` is the model the paper calls ML₂,₁
(the label mapping is in ``runSetupHoloceneCovariance.m`` of the authors' CESL-STEHM-GP code,
Zenodo 59867). The file holds ``sl`` (year CE, GSL in mm, 1 sigma in mm) and ``C``, the
covariance of GSL between the years (mm²). The repository is licensed GPL-3.0 (its readme);
the series written here is derived from it and shared under the same licence.

The zero is the model's own: GSL is 3 mm at 2000 CE, so roughly "today" in the paper's sense,
but not the 1995-2014 mean that ``sealevel_modern`` uses. Each point is a value of a smooth
curve, not an average over its 20 years.

The file is read with a small MAT-file (level 5) reader for numeric matrices, so no MATLAB
library is needed. It is fetched from a pinned commit and its checksum is pinned.
"""

import json
import struct
import urllib.request
import zlib
from dataclasses import dataclass
from typing import TYPE_CHECKING

from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from pathlib import Path

#: The commit of bobkopp/SESL that holds the file (6 December 2016, the latest).
COMMIT = "2480e56bdb15b49aaf0e3ca42b310e0c6160e62c"
URL = f"https://raw.githubusercontent.com/bobkopp/SESL/{COMMIT}/Data/GLMW-1ts.mat"
SHA256 = "dcbc6219ab2c310029cff314f3c9805ac24f76d58987d125c741fab7693050e5"
SOURCE = "https://doi.org/10.1073/pnas.1517056113"
REPOSITORY = f"https://github.com/bobkopp/SESL/tree/{COMMIT}"
LICENCE = "GPL-3.0 (the SESL repository's licence); this derived series is shared under it too"
CREDIT = (
    "Kopp, R. E., Kemp, A. C., Bittermann, K., Horton, B. P., Donnelly, J. P., Gehrels, W. R., "
    "Hay, C. C., Mitrovica, J. X., Morrow, E. D., Rahmstorf, S. (2016), Temperature-driven "
    "global sea-level variability in the Common Era, PNAS 113, E1434-E1441: global sea level "
    "from their preferred model (ML2,1), as published with the authors' SESL code "
    "(github.com/bobkopp/SESL, Data/GLMW-1ts.mat, GPL-3.0)"
)

# MAT-file level 5 data types (MATLAB's "MAT-File Format", table 1-1).
_MI_MATRIX = 14
_MI_COMPRESSED = 15
_NUMERIC: dict[int, str] = {
    1: "b",  # miINT8
    2: "B",  # miUINT8
    3: "h",  # miINT16
    4: "H",  # miUINT16
    5: "i",  # miINT32
    6: "I",  # miUINT32
    7: "f",  # miSINGLE
    9: "d",  # miDOUBLE
    12: "q",  # miINT64
    13: "Q",  # miUINT64
}
_HEADER = 128


@dataclass(frozen=True)
class Matrix:
    """A real numeric MATLAB matrix: its shape (rows, columns) and values in column order."""

    rows: int
    columns: int
    values: list[float]

    def column(self, index: int) -> list[float]:
        """One column of the matrix."""
        start = index * self.rows
        return self.values[start : start + self.rows]


def _elements(data: bytes) -> list[tuple[int, bytes]]:
    """Split a run of data elements into (type, body), unpacking compressed ones."""
    out: list[tuple[int, bytes]] = []
    at = 0
    while at + 8 <= len(data):
        kind, size = struct.unpack_from("<II", data, at)
        if kind >> 16:  # small data element: size in the upper half, body in the next 4 bytes
            size, kind = kind >> 16, kind & 0xFFFF
            out.append((kind, data[at + 4 : at + 4 + size]))
            at += 8
            continue
        body = data[at + 8 : at + 8 + size]
        if kind == _MI_COMPRESSED:
            out.extend(_elements(zlib.decompress(body)))
            at += 8 + size
        else:
            out.append((kind, body))
            at += 8 + size + (-size % 8)
    return out


def _numbers(kind: int, body: bytes) -> list[float]:
    code = _NUMERIC.get(kind)
    if code is None:
        msg = f"MAT-file: unsupported numeric type {kind}"
        raise ValueError(msg)
    count = len(body) // struct.calcsize(code)
    return [float(value) for value in struct.unpack(f"<{count}{code}", body)]  # pyright: ignore[reportAny]


def _matrix(body: bytes) -> tuple[str, Matrix]:
    parts = _elements(body)
    if len(parts) < 4:  # noqa: PLR2004 - flags, dimensions, name, real part
        msg = "MAT-file: a matrix element is too short"
        raise ValueError(msg)
    (_, flags), (_, dims), (_, name), (kind, real) = parts[:4]
    if struct.unpack_from("<I", flags)[0] & 0x800:
        msg = "MAT-file: complex matrices are not supported"
        raise ValueError(msg)
    shape = [int(size) for size in _numbers(5, dims)]
    if len(shape) != 2:  # noqa: PLR2004
        msg = f"MAT-file: expected a 2-D matrix, got {len(shape)} dimensions"
        raise ValueError(msg)
    values = _numbers(kind, real)
    if len(values) != shape[0] * shape[1]:
        msg = "MAT-file: the matrix's size does not match its dimensions"
        raise ValueError(msg)
    return name.decode("ascii"), Matrix(shape[0], shape[1], values)


def read_mat(data: bytes) -> dict[str, Matrix]:
    """Read the real numeric matrices of a MAT-file (level 5), by variable name."""
    if len(data) < _HEADER or data[126:128] != b"IM":
        msg = "not a little-endian level 5 MAT-file"
        raise ValueError(msg)
    return dict(_matrix(body) for kind, body in _elements(data[_HEADER:]) if kind == _MI_MATRIX)


@dataclass(frozen=True)
class Curve:
    """Global sea level by year (CE; negative is BCE), mm, with its 1-sigma uncertainty."""

    years: list[int]
    level: list[float]
    sigma: list[float]


def _mm(value: float) -> float:
    return round(value, 1) + 0.0  # + 0.0 turns -0.0 into 0.0


def curve(variables: dict[str, Matrix]) -> Curve:
    """Read the ``sl`` matrix: year, GSL (mm) and 1 sigma (mm), one row per year."""
    sl = variables.get("sl")
    if sl is None or sl.columns != 3:  # noqa: PLR2004
        msg = "expected a variable 'sl' with three columns: year, GSL, 1 sigma"
        raise ValueError(msg)
    years = [round(year) for year in sl.column(0)]
    if years != sorted(set(years)):
        msg = "the years of 'sl' are not increasing"
        raise ValueError(msg)
    return Curve(years, [_mm(v) for v in sl.column(1)], [_mm(v) for v in sl.column(2)])


def curve_json(series: Curve) -> dict[str, Json]:
    """Give the curve as the web app reads it, with its 1-sigma range."""
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "url": REPOSITORY,
        "licence": LICENCE,
        "model": "ML2,1 (GLMW-1ts in the authors' code)",
        "units": "mm",
        "baseline": "the model's own zero (about 0 mm at 2000 CE)",
        "note": (
            "Global sea level from a Gaussian-process model of proxy and tide-gauge records: "
            "every 20 years to 1800 CE, then every 10 years. Years CE; negative is BCE."
        ),
        "range": "1 sigma",
        "years": list[Json](series.years),
        "level": list[Json](series.level),
        "low": [
            _mm(level - sigma) for level, sigma in zip(series.level, series.sigma, strict=True)
        ],
        "high": [
            _mm(level + sigma) for level, sigma in zip(series.level, series.sigma, strict=True)
        ],
    }


def write_curve(series: Curve, folder: Path) -> int:
    """Write the curve to ``index.json`` in ``folder``; returns how many points it holds."""
    folder.mkdir(parents=True, exist_ok=True)
    body = json.dumps(curve_json(series), separators=(",", ":")) + "\n"
    _ = (folder / "index.json").write_text(body)
    return len(series.years)


def _download() -> bytes:  # pragma: no cover - needs network access
    # URL is the pinned https constant above.
    request = urllib.request.Request(URL, headers={"User-Agent": "histeclipse-pipeline"})
    with urllib.request.urlopen(request, timeout=300) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{URL}: expected bytes"
        raise TypeError(msg)
    return verified(body, SHA256, "Kopp et al. 2016 global sea level (GLMW-1ts.mat)")


def fetch_common_era(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download Kopp et al.'s curve (checked against its pinned checksum) and write it."""
    return write_curve(curve(read_mat(_download())), folder)
