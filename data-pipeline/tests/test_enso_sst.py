"""Tests for the monthly sea surface temperature anomalies (NOAA OISST v2.1, #886)."""

import datetime as dt
import io
from typing import TYPE_CHECKING

import h5py
import numpy as np
import pytest
from PIL import Image

from histeclipse_pipeline.enso_sst import (
    BOUND,
    Months,
    anomalies,
    cleaned,
    climatology,
    month_of,
    months_after,
    png,
    read_months,
    sha256_of,
    write_enso_sst,
)
from histeclipse_pipeline.paleotemp import COLUMNS, ROWS
from tests.json_values import read_json

if TYPE_CHECKING:
    from pathlib import Path

#: Days from 1 January 1800 to 1 January 1991.
DAYS_TO_1991 = 69761


def _days(first_year: int, count: int) -> list[float]:
    """The first day of each of ``count`` months from January of ``first_year``."""
    return [
        float((dt.date(year, month, 1) - dt.date(1800, 1, 1)).days)
        for year, month in months_after((first_year, 1), count)
    ]


def _file(days: list[float], fields: list[float]) -> h5py.File:
    """A small PSL-like file: a 2° grid, the given value everywhere but one land cell."""
    latitude = np.arange(-89.0, 90.0, 2.0)
    longitude = np.arange(1.0, 360.0, 2.0)
    sst = np.empty((len(days), latitude.size, longitude.size), dtype=np.float32)
    for at, value in enumerate(fields):
        sst[at] = value
    sst[:, 0, 0] = -9.96921e36
    opened = h5py.File(io.BytesIO(), "w")
    _ = opened.create_dataset("time", data=np.asarray(days))
    _ = opened.create_dataset("lat", data=latitude)
    _ = opened.create_dataset("lon", data=longitude)
    _ = opened.create_dataset("sst", data=sst)
    return opened


def test_reads_psls_time_axis() -> None:
    assert month_of(DAYS_TO_1991) == (1991, 1)
    assert months_after((1991, 11), 3) == [(1991, 11), (1991, 12), (1992, 1)]


def test_turns_fill_values_into_nan() -> None:
    assert np.isnan(cleaned(np.asarray([-9.96921e36]))).all()
    assert cleaned(np.asarray([28.5])).tolist() == [28.5]


def test_reads_every_month_onto_the_nodes_and_refuses_a_gap() -> None:
    days = _days(1991, 2)
    with _file(days, [20.0, 21.0]) as opened:
        months = read_months(opened)
    assert months.first == (1991, 1)
    assert months.fields.shape == (2, ROWS, COLUMNS)
    assert float(np.nanmax(months.fields[1:])) == pytest.approx(21.0)
    with (
        _file([days[0], days[0] + 70], [20.0, 21.0]) as opened,
        pytest.raises(ValueError, match="run on"),
    ):
        _ = read_months(opened)


def test_measures_each_month_against_its_own_base_mean() -> None:
    # Thirty years, each month's value its month number plus a tenth of the year's offset; then
    # one more January, 3 °C over its mean.
    values = [month + (year - 1991) * 0.1 for year in range(1991, 2021) for month in range(1, 13)]
    fields = np.asarray([*values, 1 + 1.45 + 3.0]).reshape((-1, 1, 1))
    months = Months((1991, 1), fields)
    normal = climatology(months)
    assert normal[:, 0, 0].tolist() == pytest.approx([month + 1.45 for month in range(1, 13)])
    *_, (month, last) = anomalies(months)
    assert month == (2021, 1)
    assert float(np.max(last)) == pytest.approx(3.0)


def test_refuses_a_base_it_does_not_cover() -> None:
    with pytest.raises(ValueError, match="1991-2020"):
        _ = climatology(Months((1991, 1), np.zeros((12, 1, 1))))


def test_packs_the_anomaly_clipped_with_sea_and_land() -> None:
    anomaly = np.full((ROWS, COLUMNS), np.nan)
    anomaly[:10] = BOUND * 2
    anomaly[10:20] = -BOUND
    pixels = np.asarray(Image.open(io.BytesIO(png(anomaly))), dtype=np.uint8)
    assert pixels.shape == (ROWS, COLUMNS, 4)
    assert np.array_equal(pixels[0:1, 0:1], [[[255, 128, 255, 255]]])
    assert np.array_equal(pixels[15:16, 0:1], [[[0, 128, 255, 255]]])
    assert pixels[-1, 0, 3] == 0


def test_writes_a_map_a_month_and_its_index(tmp_path: Path) -> None:
    fields = np.zeros((361, ROWS, COLUMNS))
    count = write_enso_sst(Months((1991, 1), fields), tmp_path / "maps", "2026-11-19")
    assert count == 361
    assert (tmp_path / "maps" / "1991-01.png").exists()
    assert (tmp_path / "maps" / "2021-01.png").exists()
    index = read_json(tmp_path / "maps" / "index.json")
    assert isinstance(index, dict)
    assert index["first"] == "1991-01"
    assert index["last"] == "2021-01"
    assert index["bound"] == BOUND
    assert index["accessed"] == "2026-11-19"
    assert (index["columns"], index["rows"]) == (COLUMNS, ROWS)


def test_hashes_a_file_in_pieces(tmp_path: Path) -> None:
    path = tmp_path / "file"
    _ = path.write_bytes(b"abc")
    assert sha256_of(path) == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
