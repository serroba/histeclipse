import io
import json
import struct
import zipfile
from typing import TYPE_CHECKING

import h5py
import numpy as np
import numpy.typing as npt
import pytest
from PIL import Image

from histeclipse_pipeline.icesheets import (
    METRES_PER_STEP,
    Frame,
    _zip64,  # pyright: ignore[reportPrivateUsage]
    encode,
    file_name,
    find_member,
    ice_share,
    read_frames,
    read_member,
    write_icesheets,
)

if TYPE_CHECKING:
    from pathlib import Path


def archive(members: dict[str, bytes], *, compress: bool = True) -> bytes:
    out = io.BytesIO()
    method = zipfile.ZIP_DEFLATED if compress else zipfile.ZIP_STORED
    with zipfile.ZipFile(out, "w", compression=method) as built:
        for name, data in members.items():
            built.writestr(name, data)
    return out.getvalue()


def test_reads_one_member_by_ranges() -> None:
    wanted = b"ice " * 5000
    for compress in (True, False):
        data = archive({"a/readme.txt": b"hello", "a/grid.nc": wanted}, compress=compress)
        asked: list[tuple[int, int]] = []

        def fetch(
            start: int, length: int, data: bytes = data, asked: list[tuple[int, int]] = asked
        ) -> bytes:
            asked.append((start, length))
            return data[start : start + length]

        assert read_member(fetch, len(data), "a/grid.nc") == wanted
        # The tail, the local header, then the member itself.
        assert len(asked) == 3


def test_says_when_a_member_is_missing_or_the_archive_is_not_a_zip() -> None:
    data = archive({"a/readme.txt": b"hello"})
    with pytest.raises(ValueError, match="not in the archive"):
        _ = find_member(data, 0, "a/grid.nc")
    with pytest.raises(ValueError, match="no end of central directory"):
        _ = find_member(b"not a zip", 0, "a/grid.nc")
    with pytest.raises(ValueError, match="starts before the tail"):
        _ = find_member(data[-30:], len(data) - 30, "a/readme.txt")


def test_rejects_a_member_whose_header_or_size_is_wrong() -> None:
    data = archive({"grid.nc": b"x" * 100}, compress=False)
    member = find_member(data, 0, "grid.nc")
    broken = data[: member.offset] + b"XXXX" + data[member.offset + 4 :]
    with pytest.raises(ValueError, match="no local header"):
        _ = read_member(
            lambda start, length: broken[start : start + length], len(broken), "grid.nc"
        )
    short = archive({"grid.nc": b"x" * 100}, compress=False)
    cut = find_member(short, 0, "grid.nc")
    lying = bytearray(short)
    # The central directory's entry says 100 bytes; make it claim 101.
    entry = short.rfind(b"PK\x01\x02")
    lying[entry + 24 : entry + 28] = struct.pack("<I", 101)
    assert cut.size == 100
    with pytest.raises(ValueError, match="expected 101 bytes"):
        _ = read_member(
            lambda start, length: bytes(lying[start : start + length]), len(lying), "grid.nc"
        )


def test_finds_the_central_directory_through_a_zip64_record() -> None:
    data = archive({"grid.nc": b"x" * 10})
    end = data.rfind(b"PK\x05\x06")
    directory: int = struct.unpack("<I", data[end + 16 : end + 20])[0]
    marked = data[: end + 16] + struct.pack("<I", 0xFFFFFFFF) + data[end + 20 :]
    record = struct.pack("<4sQHHIIQQQQ", b"PK\x06\x06", 44, 45, 45, 0, 0, 1, 1, 0, directory)
    zip64 = marked[:end] + record + marked[end:]
    assert find_member(zip64, 0, "grid.nc").size == 10


def test_reads_zip64_sizes() -> None:
    extra = (
        struct.pack("<HH", 0x7075, 2)
        + b"xx"
        + struct.pack("<HHQQQ", 1, 24, 5_000_000_000, 4_000_000_000, 7)
    )
    assert _zip64(extra, [0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF]) == [5_000_000_000, 4_000_000_000, 7]
    assert _zip64(b"", [1, 2, 3]) == [1, 2, 3]


def netcdf(years: list[float], thickness: npt.NDArray[np.float64], rows: int) -> bytes:
    out = io.BytesIO()
    with h5py.File(out, "w") as file:
        _ = file.create_dataset("time", data=np.array(years, dtype=np.float32))
        _ = file.create_dataset("lat", data=np.linspace(-90, 90, rows).astype(np.float32))
        _ = file.create_dataset("ice_thickness", data=thickness.astype(np.float32))
    return out.getvalue()


def test_reads_time_steps_youngest_first_with_north_at_the_top() -> None:
    grid = np.full((2, 5, 9), np.nan)
    grid[0, -1, :] = 2000.0  # 20 ka: ice along the north edge (last row in the file)
    grid[1, 0, :] = 3000.0  # today: ice along the south edge
    frames = list(read_frames(netcdf([-20000.0, 0.0], grid, rows=5)))
    assert [frame.ka for frame in frames] == [0.0, 20.0]
    assert frames[0].thickness[-1, 0] == 3000.0
    assert frames[1].thickness[0, 0] == 2000.0
    assert frames[1].thickness[2, 2] == 0.0


def test_packs_thickness_into_a_byte_with_zero_for_no_ice() -> None:
    samples = np.array([0.0, 0.5, METRES_PER_STEP, 2000.0, 10_000.0], dtype=np.float64)
    assert encode(samples).tolist() == [0, 1, 1, 125, 255]


def test_weights_ice_by_area_and_names_files_in_years() -> None:
    thickness = np.zeros((181, 361))
    thickness[:90] = 100.0
    assert ice_share(thickness) == pytest.approx(0.5, abs=0.01)
    assert file_name(22.5) == "22500.png"
    assert file_name(0.0) == "0.png"


def test_writes_images_and_an_index(tmp_path: Path) -> None:
    frames = [Frame(0.0, np.zeros((5, 9))), Frame(2.5, np.full((5, 9), 1000.0))]
    assert write_icesheets(iter(frames), tmp_path) == 2
    index = json.loads((tmp_path / "index.json").read_text())  # pyright: ignore[reportAny]
    assert (index["rows"], index["columns"], index["metresPerStep"]) == (5, 9, METRES_PER_STEP)
    assert index["frames"][1] == {"ka": 2.5, "file": "2500.png", "ice": 1.0}
    with Image.open(tmp_path / "2500.png") as image:
        assert image.getpixel((0, 0)) == 63
