"""Surface temperature over the last 250 million years from a second climate model, CESM.

Li, Hu et al. (2023), *Climate Variations in the Past 250 Million Years and Contributing
Factors*, Paleoceanography and Paleoclimatology 38 (doi:10.1029/2022PA004503); data on Zenodo
(doi:10.5281/zenodo.7322003, CC BY 4.0). CESM1.2.2 runs every 10 million years from 250 Ma to
the pre-industrial; the "Control" group lets CO2 vary as reconstructed (the other two hold it, or
it and the Sun, fixed, to isolate their effects).

It stands beside Scotese's maps (`paleotemp.py`), not in their place: a different model with
its own geography, on a coarse grid (48 Gaussian latitudes by 96 longitudes, about 3.75°). Each
map is regridded linearly onto the same 1° node-registered grid and packed the same way, so the
globe draws either.

The archive's NetCDF files are classic NetCDF-3 with fixed-size variables only; a small reader
here takes what is needed, without a NetCDF library.
"""

import io
import json
import math
import urllib.request
import zipfile
from typing import TYPE_CHECKING

import numpy as np
import numpy.typing as npt

from histeclipse_pipeline.paleotemp import COLDEST, COLUMNS, ROWS, WARMEST, to_png
from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from pathlib import Path

type Grid = npt.NDArray[np.float64]

ARCHIVE_URL = (
    "https://zenodo.org/api/records/7322003/files/data_climate_250Myr_20221115.zip/content"
)
ARCHIVE_SHA256 = "b9ab82e5ef5ce468e7f1cf66cc9162820cb30961823257e581f3d8d70df55750"
MEMBER = "data_climate_250Myr_20221115/CLIM_DATA_PP.nc"
SOURCE = "https://doi.org/10.5281/zenodo.7322003"
CREDIT = (
    "Li, Hu et al. (2023), Paleoceanography and Paleoclimatology 38, CESM1.2.2 Control runs; "
    "Zenodo, CC BY 4.0; regridded from about 3.75° to 1° and packed into 8-bit images"
)
#: The "Control" group: CO2 as reconstructed.
CONTROL = 0
#: Simulations run from 250 Ma to the pre-industrial, 10 million years apart.
OLDEST_MA = 250
STEP_MA = 10

# NetCDF-3 header tags and type codes.
_DIMENSION, _VARIABLE, _ATTRIBUTE = 10, 11, 12
_TYPES: dict[int, tuple[str, int]] = {
    1: (">i1", 1),
    2: (">S1", 1),
    3: (">i2", 2),
    4: (">i4", 4),
    5: (">f4", 4),
    6: (">f8", 8),
}


class _Reader:
    """Walk a NetCDF-3 header, big-endian, every block padded to four bytes."""

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

    def skip_attributes(self) -> None:
        tag, count = self.integer(), self.integer()
        if tag not in {0, _ATTRIBUTE}:
            msg = f"expected attributes, found tag {tag}"
            raise ValueError(msg)
        for _ in range(count):
            _ = self.name()
            size = _TYPES[self.integer()][1] * self.integer()
            self.position += (size + 3) // 4 * 4


def read_netcdf3(data: bytes) -> dict[str, Grid]:
    """Read every fixed-size numeric variable of a classic (or 64-bit offset) NetCDF-3 file."""
    if data[:3] != b"CDF" or data[3] not in {1, 2}:
        msg = "not a classic NetCDF-3 file"
        raise ValueError(msg)
    offset_size = 4 if data[3] == 1 else 8
    reader = _Reader(data)
    reader.position = 8  # the magic and the record count
    tag, count = reader.integer(), reader.integer()
    if tag not in {0, _DIMENSION}:
        msg = f"expected dimensions, found tag {tag}"
        raise ValueError(msg)
    sizes: list[int] = []
    for _ in range(count):
        _ = reader.name()
        sizes.append(reader.integer())
    reader.skip_attributes()
    tag, count = reader.integer(), reader.integer()
    if tag not in {0, _VARIABLE}:
        msg = f"expected variables, found tag {tag}"
        raise ValueError(msg)
    variables: dict[str, Grid] = {}
    for _ in range(count):
        name = reader.name()
        shape: tuple[int, ...] = tuple(sizes[reader.integer()] for _ in range(reader.integer()))
        reader.skip_attributes()
        dtype, _width = _TYPES[reader.integer()]
        _ = reader.integer()  # vsize
        begin = reader.integer(offset_size)
        if 0 in shape:
            msg = f"{name} is a record variable, which this reader does not read"
            raise ValueError(msg)
        if dtype == ">S1":
            continue
        length = math.prod(shape)
        values = np.frombuffer(data, dtype=dtype, count=length, offset=begin)
        variables[name] = values.astype(np.float64).reshape(shape)
    return variables


def _weights(target: Grid, source: Grid) -> tuple[npt.NDArray[np.intp], Grid]:
    """For each target coordinate, the source index before it and how far towards the next."""
    position = np.interp(target, source, np.arange(len(source), dtype=np.float64))
    before = np.minimum(np.floor(position).astype(np.intp), len(source) - 2)
    return before, position - before


def regrid(field: Grid, latitudes: Grid, longitudes: Grid) -> Grid:
    """Interpolate a (lat, lon) field linearly onto the 1° grid: 90° N first, 180° W to 180° E.

    Longitude wraps round; beyond the outermost model latitudes the edge row is kept.
    """
    wrapped_lon = np.concatenate([longitudes, longitudes[:1] + 360])
    wrapped = np.concatenate([field, field[:, :1]], axis=1)
    column, east = _weights(np.mod(np.linspace(-180, 180, COLUMNS), 360), wrapped_lon)
    along = wrapped[:, column] * (1 - east) + wrapped[:, column + 1] * east
    row, north = _weights(np.linspace(90, -90, ROWS), latitudes)
    weight = north[:, np.newaxis]
    return along[row] * (1 - weight) + along[row + 1] * weight


def control_maps(variables: dict[str, Grid]) -> list[tuple[int, Grid]]:
    """Regrid the Control group's surface temperature maps to 1°, youngest first, with Ma."""
    surface = np.squeeze(variables["TS"][CONTROL : CONTROL + 1], axis=0)
    maps = [
        (
            OLDEST_MA - STEP_MA * index,
            regrid(
                np.squeeze(surface[index : index + 1], axis=0),
                variables["lat"],
                variables["lon"],
            ),
        )
        for index in range(len(surface))
    ]
    return sorted(maps, key=lambda pair: pair[0])


def write_cesm(maps: list[tuple[int, Grid]], model_means: list[float], folder: Path) -> int:
    """Write one PNG per map and ``index.json``; return the number of images.

    `model_means` are the model's own area-weighted global means, youngest first.
    """
    folder.mkdir(parents=True, exist_ok=True)
    frames: list[Json] = []
    for (ma, field), mean in zip(maps, model_means, strict=True):
        _ = (folder / f"{ma}.png").write_bytes(to_png(field))
        frames.append({"ma": ma, "file": f"{ma}.png", "mean": round(mean, 1)})
    index: dict[str, Json] = {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "columns": COLUMNS,
        "rows": ROWS,
        "coldest": COLDEST,
        "warmest": WARMEST,
        "frames": frames,
    }
    _ = (folder / "index.json").write_text(json.dumps(index, separators=(",", ":")) + "\n")
    return len(frames)


def build(archive: bytes, folder: Path) -> int:
    """Read the Control maps and the model's global means out of the archive, and write them."""
    with zipfile.ZipFile(io.BytesIO(archive)) as opened:
        variables = read_netcdf3(opened.read(MEMBER))
    maps = control_maps(variables)
    # The model's own global means, oldest first in the file, so turned to youngest first.
    control = np.squeeze(variables["t_glob"][CONTROL : CONTROL + 1], axis=0)
    means: list[float] = control[::-1].tolist()  # pyright: ignore[reportAny]
    return write_cesm(maps, means, folder)


def fetch_cesm(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download the archive (checked against its pinned checksum) and write the images."""
    request = urllib.request.Request(ARCHIVE_URL, headers={"User-Agent": "histeclipse-pipeline"})
    with urllib.request.urlopen(request, timeout=300) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{ARCHIVE_URL}: expected bytes"
        raise TypeError(msg)
    return build(verified(body, ARCHIVE_SHA256, "CESM archive"), folder)
