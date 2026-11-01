"""Ice sheets over the last 80,000 years, from PaleoMIST 1.0.

Gowan et al. (2021), *A new global ice sheet reconstruction for the past 80 000 years*, Nature
Communications 12, 1199; data on PANGAEA (doi:10.1594/PANGAEA.905800, CC BY 4.0): ice thickness
every 2,500 years, built from ice-margin positions and a model of how ice flows, without tuning
to far-field sea level.

The archive is a 3.7 GB zip; only its global 0.25° grid is needed, so that one member is read
out of it with HTTP range requests (the zip's central directory, then the member) and checked
against a pinned checksum.

Each time step becomes a greyscale PNG of ice thickness, 16 m a step (0 is no ice, 255 is
4,080 m or more), north at the top, node-registered from 180° W to 180° E like the other
deep-time maps.
"""

import io
import json
import struct
import urllib.request
import zlib
from dataclasses import dataclass
from typing import TYPE_CHECKING

import h5py
import numpy as np
import numpy.typing as npt
from PIL import Image

from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from collections.abc import Callable, Iterator
    from pathlib import Path

type Thickness = npt.NDArray[np.float64]
#: Read `length` bytes of the archive from `start`.
type Fetch = Callable[[int, int], bytes]

ARCHIVE_URL = "https://hs.pangaea.de/Maps/Global_Ice_Sheets/Gowan_ice_reconstruction.zip"
MEMBER = "ice_reconstruction/global_grid/reconstruction_0.25_degree.nc"
MEMBER_SHA256 = "b062ca18cf87dd86f1d266bc453c0e719eb42798cc3a87edeb4d98df82c68db1"
SOURCE = "https://doi.org/10.1594/PANGAEA.905800"
CREDIT = (
    "PaleoMIST 1.0, Gowan et al. (2021), Nature Communications 12, 1199; PANGAEA, CC BY 4.0; "
    "ice thickness from the 0.25° global grid, packed into 8-bit images for this site"
)
METRES_PER_STEP = 16
#: The zip's end lies within this many bytes of its end (its central directory included).
_TAIL = 1 << 20
#: A 32-bit field at its largest means the real value is in the zip64 records.
_ZIP64_MARK = 0xFFFFFFFF
_LOCAL_HEADER = 30
_DEFLATE = 8


@dataclass(frozen=True)
class Member:
    """Where a file sits in a zip archive."""

    method: int
    compressed: int
    size: int
    offset: int


def _zip64(extra: bytes, sizes: list[int]) -> list[int]:
    """Fill in the 0xFFFFFFFF fields of a central-directory entry from its zip64 extra field."""
    position = 0
    while position + 4 <= len(extra):
        tag, length = struct.unpack("<HH", extra[position : position + 4])
        if tag == 1:
            values = iter(
                struct.unpack(f"<{length // 8}Q", extra[position + 4 : position + 4 + length])
            )
            return [next(values) if value == _ZIP64_MARK else value for value in sizes]
        position += 4 + length
    return sizes


def find_member(tail: bytes, tail_start: int, name: str) -> Member:
    """Find `name` in a zip's central directory, read from the archive's last bytes."""
    end = tail.rfind(b"PK\x05\x06")
    if end < 0:
        msg = "no end of central directory in the archive's tail"
        raise ValueError(msg)
    directory_offset: int = struct.unpack("<I", tail[end + 16 : end + 20])[0]
    if directory_offset == _ZIP64_MARK:
        end64 = tail.rfind(b"PK\x06\x06")
        directory_offset = struct.unpack("<Q", tail[end64 + 48 : end64 + 56])[0]
    position = directory_offset - tail_start
    if position < 0:
        msg = "the central directory starts before the tail read"
        raise ValueError(msg)
    while tail[position : position + 4] == b"PK\x01\x02":
        method: int = struct.unpack("<H", tail[position + 10 : position + 12])[0]
        compressed, size = struct.unpack("<II", tail[position + 20 : position + 28])
        name_length, extra_length, comment_length = struct.unpack(
            "<HHH", tail[position + 28 : position + 34]
        )
        offset: int = struct.unpack("<I", tail[position + 42 : position + 46])[0]
        start = position + 46
        found = tail[start : start + name_length].decode()
        extra = tail[start + name_length : start + name_length + extra_length]
        if found == name:
            size, compressed, offset = _zip64(extra, [size, compressed, offset])
            return Member(method, compressed, size, offset)
        position = start + name_length + extra_length + comment_length
    msg = f"{name} is not in the archive"
    raise ValueError(msg)


def read_member(fetch: Fetch, total: int, name: str) -> bytes:
    """Read one file out of a zip archive by ranges: its central directory, then the file."""
    tail_start = max(0, total - _TAIL)
    member = find_member(fetch(tail_start, total - tail_start), tail_start, name)
    header = fetch(member.offset, _LOCAL_HEADER)
    if header[:4] != b"PK\x03\x04":
        msg = f"{name}: no local header at {member.offset}"
        raise ValueError(msg)
    name_length, extra_length = struct.unpack("<HH", header[26:30])
    data = fetch(member.offset + _LOCAL_HEADER + name_length + extra_length, member.compressed)
    raw = zlib.decompress(data, -15) if member.method == _DEFLATE else data
    if len(raw) != member.size:
        msg = f"{name}: expected {member.size} bytes, got {len(raw)}"
        raise ValueError(msg)
    return raw


@dataclass(frozen=True)
class Frame:
    """One time step: thousands of years ago, and ice thickness in metres, north row first."""

    ka: float
    thickness: Thickness


def read_frames(data: bytes) -> Iterator[Frame]:
    """Yield every time step of the reconstruction, youngest first."""
    with h5py.File(io.BytesIO(data)) as file:
        years = file["time"][()].astype(np.float64)
        latitude = file["lat"][()].astype(np.float64)
        thickness = file["ice_thickness"][()].astype(np.float64)
    # Rows run south to north in the file; the images run north to south.
    flip = bool(np.all(np.diff(latitude) > 0))
    # Years before present are negative in the file; youngest first is largest first.
    ages: list[float] = (-years / 1000).tolist()  # pyright: ignore[reportAny]
    for index, ka in sorted(enumerate(ages), key=lambda pair: pair[1]):
        grid = np.nan_to_num(np.squeeze(thickness[index : index + 1], axis=0), nan=0.0)
        yield Frame(round(ka, 1) + 0.0, grid[::-1] if flip else grid)


def encode(thickness: Thickness) -> npt.NDArray[np.uint8]:
    """Pack metres of ice into bytes, METRES_PER_STEP a step; 0 is no ice."""
    steps = np.ceil(np.clip(thickness, 0, 255 * METRES_PER_STEP) / METRES_PER_STEP)
    return steps.astype(np.uint8)


def to_png(thickness: Thickness) -> bytes:
    """Write thickness as an optimised 8-bit greyscale PNG."""
    out = io.BytesIO()
    Image.fromarray(encode(thickness), mode="L").save(out, format="PNG", optimize=True)
    return out.getvalue()


def ice_share(thickness: Thickness) -> float:
    """Share of Earth's surface under ice, each row weighted by its area (cos latitude)."""
    weights = np.cos(np.radians(np.linspace(90, -90, len(thickness))))
    covered = (thickness[:, :-1] > 0).mean(axis=1)
    share: np.float64 = np.average(covered, weights=weights)
    return float(share)


def file_name(ka: float) -> str:
    """Name the image for a time step in years, e.g. ``20000.png``."""
    return f"{round(ka * 1000)}.png"


def write_icesheets(frames: Iterator[Frame], folder: Path) -> int:
    """Write one PNG per time step and ``index.json``; return the number of images."""
    folder.mkdir(parents=True, exist_ok=True)
    entries: list[Json] = []
    shape = (0, 0)
    for frame in frames:
        shape = frame.thickness.shape
        _ = (folder / file_name(frame.ka)).write_bytes(to_png(frame.thickness))
        entries.append(
            {
                "ka": frame.ka,
                "file": file_name(frame.ka),
                "ice": round(ice_share(frame.thickness), 4),
            }
        )
    index: dict[str, Json] = {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "rows": shape[0],
        "columns": shape[1],
        "metresPerStep": METRES_PER_STEP,
        "frames": entries,
    }
    _ = (folder / "index.json").write_text(json.dumps(index, separators=(",", ":")) + "\n")
    return len(entries)


def _fetch_range(start: int, length: int) -> bytes:  # pragma: no cover - needs network access
    request = urllib.request.Request(
        ARCHIVE_URL,
        headers={
            "User-Agent": "histeclipse-pipeline",
            "Range": f"bytes={start}-{start + length - 1}",
        },
    )
    with urllib.request.urlopen(request, timeout=900) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes) or len(body) != length:
        msg = f"{ARCHIVE_URL}: expected {length} bytes from {start}"
        raise TypeError(msg)
    return body


def fetch_icesheets(folder: Path) -> int:  # pragma: no cover - needs network access
    """Read the 0.25° grid out of the archive (checked against its checksum); write images."""
    request = urllib.request.Request(
        ARCHIVE_URL, method="HEAD", headers={"User-Agent": "histeclipse-pipeline"}
    )
    with urllib.request.urlopen(request, timeout=60) as response:  # noqa: S310  # pyright: ignore[reportAny]
        total = int(str(response.headers["Content-Length"]))  # pyright: ignore[reportAny]
    data = verified(read_member(_fetch_range, total, MEMBER), MEMBER_SHA256, "PaleoMIST grid")
    return write_icesheets(read_frames(data), folder)
