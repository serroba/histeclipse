import io
import json
import struct
import zipfile
from typing import TYPE_CHECKING

import numpy as np
import numpy.typing as npt
import pytest
from PIL import Image

from histeclipse_pipeline.cesm import (
    MEMBER,
    build,
    control_maps,
    read_netcdf3,
    regrid,
    write_cesm,
)
from histeclipse_pipeline.paleotemp import COLUMNS, ROWS

if TYPE_CHECKING:
    from pathlib import Path


def padded(raw: bytes) -> bytes:
    return raw + b"\0" * (-len(raw) % 4)


def name(text: str) -> bytes:
    return struct.pack(">I", len(text)) + padded(text.encode())


def netcdf3(
    dimensions: dict[str, int],
    variables: dict[str, tuple[tuple[str, ...], npt.NDArray[np.float64] | bytes]],
) -> bytes:
    """Write a classic NetCDF-3 file: doubles, or text, each with one text attribute."""
    header = b"CDF\x01" + struct.pack(">I", 0)
    header += struct.pack(">II", 10, len(dimensions))
    for dimension, size in dimensions.items():
        header += name(dimension) + struct.pack(">I", size)
    header += struct.pack(">II", 0, 0)
    order = list(dimensions)
    blocks: list[tuple[bytes, bytes]] = []
    for variable, (dims, values) in variables.items():
        text = isinstance(values, bytes)
        data = padded(values) if isinstance(values, bytes) else values.astype(">f8").tobytes()
        attribute = name("long_name") + struct.pack(">II", 2, 4) + b"test"
        entry = name(variable) + struct.pack(">I", len(dims))
        entry += b"".join(struct.pack(">I", order.index(dim)) for dim in dims)
        entry += struct.pack(">II", 12, 1) + attribute
        entry += struct.pack(">II", 2 if text else 6, len(data))
        blocks.append((entry, data))
    header += struct.pack(">II", 11, len(variables))
    size = len(header) + sum(len(entry) + 4 for entry, _ in blocks)
    body = b""
    for entry, data in blocks:
        header += entry + struct.pack(">I", size + len(body))
        body += data
    return header + body


def model(latitudes: int = 4, longitudes: int = 8) -> bytes:
    lat = np.linspace(-80, 80, latitudes)
    lon = np.linspace(0, 360, longitudes, endpoint=False)
    surface = np.zeros((3, 2, latitudes, longitudes))
    surface[0, 0] = 30.0  # 250 Ma in the Control group
    surface[0, 1] = 10.0  # 240 Ma
    surface[1] = -50.0  # another group, not read
    means = np.array([[25.0, 20.0], [0.0, 0.0], [0.0, 0.0]], dtype=np.float64)
    return netcdf3(
        {"group": 3, "simulation": 2, "lat": latitudes, "lon": longitudes},
        {
            "lat": (("lat",), lat),
            "lon": (("lon",), lon),
            "title": (("group",), b"abc"),
            "TS": (("group", "simulation", "lat", "lon"), surface),
            "t_glob": (("group", "simulation"), means),
        },
    )


def test_reads_fixed_size_variables_and_skips_text() -> None:
    variables = read_netcdf3(model())
    assert sorted(variables) == ["TS", "lat", "lon", "t_glob"]
    assert variables["TS"].shape == (3, 2, 4, 8)
    assert variables["lat"][0] == -80.0


def test_rejects_what_it_cannot_read() -> None:
    with pytest.raises(ValueError, match="not a classic NetCDF-3"):
        _ = read_netcdf3(b"\x89HDF\r\n")
    data = bytearray(model())
    data[8:12] = struct.pack(">I", 99)
    with pytest.raises(ValueError, match="expected dimensions"):
        _ = read_netcdf3(bytes(data))
    record = netcdf3({"time": 0}, {"t": (("time",), np.zeros(0))})
    with pytest.raises(ValueError, match="record variable"):
        _ = read_netcdf3(record)


def test_rejects_a_header_out_of_order() -> None:
    data = model()
    # The variables' tag, 11, swapped for an attribute's.
    at = data.index(struct.pack(">II", 11, 5))
    broken = data[:at] + struct.pack(">II", 99, 5) + data[at + 8 :]
    with pytest.raises(ValueError, match="expected variables"):
        _ = read_netcdf3(broken)
    at = data.index(struct.pack(">II", 12, 1))
    broken = data[:at] + struct.pack(">II", 99, 1) + data[at + 8 :]
    with pytest.raises(ValueError, match="expected attributes"):
        _ = read_netcdf3(broken)


def test_regrids_onto_the_1_degree_grid_with_longitude_wrapping() -> None:
    lat = np.linspace(-80, 80, 5)
    lon = np.linspace(0, 360, 8, endpoint=False)
    field = np.tile(lon, (5, 1))  # east of 0° rising to 315 at 315° E
    out = regrid(field, lat, lon)
    assert out.shape == (ROWS, COLUMNS)
    middle = COLUMNS // 2  # 0°
    assert out[90, middle] == pytest.approx(0.0)
    assert out[90, middle + 45] == pytest.approx(45.0)
    # 180° W and 180° E are the same meridian.
    assert out[90, 0] == pytest.approx(out[90, -1])
    # Between 315° E and 360° the field falls back towards 0.
    assert out[90, middle - 20] == pytest.approx(315 * (20 / 45))
    flat = regrid(np.full((5, 8), 7.0), lat, lon)
    assert np.allclose(flat, 7.0)


def test_takes_the_control_group_youngest_first() -> None:
    maps = control_maps(read_netcdf3(model()))
    assert [ma for ma, _ in maps] == [240, 250]
    assert maps[0][1][90, 180] == pytest.approx(10.0)
    assert maps[1][1][90, 180] == pytest.approx(30.0)


def test_writes_images_and_an_index(tmp_path: Path) -> None:
    field = np.full((ROWS, COLUMNS), 0.0)
    assert write_cesm([(0, field), (10, field)], [13.2, 15.8], tmp_path) == 2
    index = json.loads((tmp_path / "index.json").read_text())  # pyright: ignore[reportAny]
    assert index["frames"] == [
        {"ma": 0, "file": "0.png", "mean": 13.2},
        {"ma": 10, "file": "10.png", "mean": 15.8},
    ]
    with Image.open(tmp_path / "0.png") as image:
        assert image.size == (COLUMNS, ROWS)


def test_builds_from_the_archive(tmp_path: Path) -> None:
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as archive:
        archive.writestr(MEMBER, model())
    assert build(out.getvalue(), tmp_path) == 2
    index = json.loads((tmp_path / "index.json").read_text())  # pyright: ignore[reportAny]
    # The model's own means, turned youngest first.
    assert (index["frames"][0]["mean"], index["frames"][1]["mean"]) == (20.0, 25.0)
