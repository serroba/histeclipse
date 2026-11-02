"""Sea ice: NSIDC's polar grids, climate-model grids, and the maps written from them."""

from __future__ import annotations

import io
import json
import math
import struct
from typing import TYPE_CHECKING

import h5py
import numpy as np
import pytest
from PIL import Image

from histeclipse_pipeline.arrays import as_floats
from histeclipse_pipeline.paleotemp import COLUMNS, ROWS
from histeclipse_pipeline.seaice import (
    CMIP6_BASE,
    MODELS,
    NORTH,
    POLE_HOLE,
    SOUTH,
    area_share,
    build,
    from_polar,
    mean_concentration,
    model_months,
    most_and_least,
    polar_xy,
    read_concentration,
    regrid,
    to_png,
)

if TYPE_CHECKING:
    from pathlib import Path


def tiff(values: np.typing.NDArray[np.uint16]) -> bytes:
    """A little-endian, uncompressed, 16-bit TIFF in two strips, as NSIDC writes them."""
    height = len(values)
    width = values.size // height
    half = height // 2
    strips = [values[:half].tobytes(), values[half:].tobytes()]
    entries = 8
    ifd = 8
    offsets_at = ifd + 2 + 12 * entries + 4
    counts_at = offsets_at + 8
    data_at = counts_at + 8
    tags = [
        (256, 3, 1, width),
        (257, 3, 1, height),
        (258, 3, 1, 16),
        (259, 3, 1, 1),
        (262, 3, 1, 1),
        (273, 4, 2, offsets_at),
        (277, 3, 1, 1),
        (279, 4, 2, counts_at),
    ]
    out = b"II*\x00" + struct.pack("<I", ifd) + struct.pack("<H", entries)
    out += b"".join(struct.pack("<HHII", *tag) for tag in tags) + struct.pack("<I", 0)
    out += struct.pack("<II", data_at, data_at + len(strips[0]))
    out += struct.pack("<II", len(strips[0]), len(strips[1]))
    return out + strips[0] + strips[1]


def test_reads_nsidc_concentration_tiffs() -> None:
    values = np.arange(12, dtype=np.uint16).reshape(4, 3)
    assert np.array_equal(read_concentration(tiff(values)), values)
    with pytest.raises(ValueError, match="little-endian"):
        _ = read_concentration(b"MM\x00*")
    broken = bytearray(tiff(values))
    broken[8 + 2 + 12 * 2 + 8 : 8 + 2 + 12 * 2 + 12] = struct.pack("<I", 8)
    with pytest.raises(ValueError, match="16-bit"):
        _ = read_concentration(bytes(broken))


def test_averages_years_with_the_pole_hole_full_and_land_empty() -> None:
    years = [
        np.array([[1000, 0, 2540, POLE_HOLE]], dtype=np.uint16),
        np.array([[500, 0, 2540, POLE_HOLE]], dtype=np.uint16),
    ]
    mean = mean_concentration(years)
    assert mean[0, :2].tolist() == [75.0, 0.0]
    assert math.isnan(as_floats(mean.ravel())[2])
    assert mean[0, 3] == 100.0


def test_projects_onto_nsidc_polar_grids() -> None:
    x, y = polar_xy(NORTH, np.array([90.0, 70.0]), np.array([0.0, -45.0]))
    assert x[0] == pytest.approx(0.0, abs=1e-6)
    assert y[0] == pytest.approx(0.0, abs=1e-6)
    # Down the grid from the pole runs 45° W; true scale at 70°: about 2,200 km out.
    assert x[1] == pytest.approx(0.0, abs=1e-6)
    assert -y[1] == pytest.approx(2.2e6, rel=0.02)
    x, y = polar_xy(SOUTH, np.array([-70.0]), np.array([0.0]))
    assert x[0] == pytest.approx(0.0, abs=1e-6)
    assert y[0] == pytest.approx(2.2e6, rel=0.02)


def test_samples_each_hemisphere_from_its_own_grid() -> None:
    cover = np.full((NORTH.rows, NORTH.columns), 50.0)
    sampled = from_polar(NORTH, cover)
    assert sampled.shape == (ROWS, COLUMNS)
    assert sampled[0, 0] == 50.0  # the North Pole
    values = as_floats(sampled.ravel())
    assert math.isnan(values[-COLUMNS])  # the south is not this grid's
    assert math.isnan(values[90 * COLUMNS])  # nor the equator, outside it


def test_regrids_model_cells_and_fills_small_gaps() -> None:
    lat, lon = np.meshgrid(np.arange(60.0, 80.0, 2.0), np.arange(0.0, 360.0, 2.0), indexing="ij")
    values = np.full(lat.shape, 80.0)
    values[0, 0] = np.nan
    out = regrid(lat, lon, values)
    assert out[90 - 70, 180 + 10] == pytest.approx(80.0)
    # Between model cells 2° apart, a node with known neighbours is filled.
    assert out[90 - 71, 180 + 11] == pytest.approx(80.0)
    assert math.isnan(as_floats(out.ravel())[90 * COLUMNS + 180])
    assert out[90 - 70, 0] == out[90 - 70, -1]


def siconc_file(*, curvilinear: bool) -> bytes:
    out = io.BytesIO()
    with h5py.File(out, "w") as written:
        lat = np.array([[70.0, 70.0], [-70.0, -70.0]])
        lon = np.array([[0.0, 90.0], [0.0, 90.0]])
        months = np.zeros((24, 2, 2))
        months[2::12] = 90.0  # March
        months[8::12] = 30.0  # September
        months[:, 1, 1] = 1e20  # land
        if curvilinear:
            _ = written.create_dataset("latitude", data=lat.astype(np.float32))
            _ = written.create_dataset("longitude", data=lon.astype(np.float32))
            _ = written.create_dataset("siconc", data=months.astype(np.float32))
        else:
            _ = written.create_dataset("lat", data=lat.ravel().astype(np.float32))
            _ = written.create_dataset("lon", data=lon.ravel().astype(np.float32))
            _ = written.create_dataset("siconc", data=months.reshape(24, 4).astype(np.float32))
    return out.getvalue()


def test_reads_march_and_september_from_model_files() -> None:
    for curvilinear in (True, False):
        lat, _lon, march, september = model_months(siconc_file(curvilinear=curvilinear))
        assert as_floats(np.ravel(lat))[0] == 70.0
        assert as_floats(np.ravel(march))[0] == 90.0
        assert as_floats(np.ravel(september))[0] == 30.0
        assert math.isnan(as_floats(np.ravel(march))[3])


def test_keeps_the_most_and_the_year_round_ice() -> None:
    most, least = most_and_least(np.array([[90.0, np.nan]]), np.array([[30.0, 10.0]]))
    assert most.tolist() == [[90.0, 10.0]]
    assert least.tolist() == [[30.0, 0.0]]
    with Image.open(io.BytesIO(to_png(np.array([[100.0, 40.0, np.nan]])))) as image:
        assert np.asarray(image).tolist() == [[250, 100, 0]]
    full = np.full((ROWS, COLUMNS), 100.0)
    assert area_share(full) == pytest.approx(1.0)


def test_builds_every_source(tmp_path: Path) -> None:
    north = tiff(np.full((NORTH.rows, NORTH.columns), 800, dtype=np.uint16))
    south = tiff(np.full((SOUTH.rows, SOUTH.columns), 400, dtype=np.uint16))

    def download(url: str) -> bytes:
        if url.startswith(CMIP6_BASE):
            return siconc_file(curvilinear=True)
        return north if "/north/" in url else south

    assert build(tmp_path, download) == 1 + len(MODELS)
    index = json.loads((tmp_path / "index.json").read_text())  # pyright: ignore[reportAny]
    assert [source["id"] for source in index["sources"]][:2] == ["nsidc", "mpi-esm1-2-lr"]  # pyright: ignore[reportAny]
    assert (tmp_path / "nsidc-year-round.png").exists()
    assert MODELS[0].file.startswith("siconc_SImon_MPI-ESM1-2-LR_lgm")
