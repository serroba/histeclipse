"""Tests for El Niño and La Niña before 1950, from ERSST and HadISST (#894)."""

import io
import math
from typing import TYPE_CHECKING

import h5py
import numpy as np
import pytest
from PIL import Image

from histeclipse_pipeline.enso import Index, months_from
from histeclipse_pipeline.enso_early import (
    COLUMNS,
    ERSST,
    ROWS,
    Record,
    anomalies,
    box_mean,
    cleaned,
    early_file,
    early_json,
    on_nodes,
    read_classic,
    read_record,
    relative_index,
    sea_maps,
    until,
)
from tests.json_values import read_json
from tests.netcdf3_files import Var, netcdf3

if TYPE_CHECKING:
    from pathlib import Path

#: A 2° grid of cell centres on even degrees, as ERSST's.
LATITUDE = np.arange(88.0, -89.0, -2.0)
LONGITUDE = np.arange(0.0, 360.0, 2.0)


def _record(first_year: int, last_year: int, nino: list[float] | None = None) -> Record:
    """A record warm in Niño 3.4 by ``nino`` (one value a month), the tropics still elsewhere."""
    dates = [(year, month) for year in range(first_year, last_year + 1) for month in range(1, 13)]
    fields = np.full((len(dates), LATITUDE.size, LONGITUDE.size), 20.0)
    fields[:, 0, 0] = np.nan  # a land cell
    rows = (LATITUDE <= 5) & (LATITUDE >= -5)
    columns = (LONGITUDE >= 190) & (LONGITUDE <= 240)
    rng = np.random.default_rng(1)
    for at in range(len(dates)):
        warm = nino[at] if nino is not None else float(rng.normal(0, 0.5))
        fields[at][np.ix_(rows, columns)] += warm
    return Record(dates, fields, LATITUDE, LONGITUDE)


def test_cleans_fill_values_and_sea_ice() -> None:
    values: list[float] = cleaned(np.array([1.0, -1000.0, -1e30])).tolist()  # pyright: ignore[reportAny]
    assert values[0] == 1.0
    assert all(math.isnan(each) for each in values[1:])


def test_reads_either_reconstruction() -> None:
    for names in (("lat", "lon"), ("latitude", "longitude")):
        opened = h5py.File(io.BytesIO(), "w")
        time = opened.create_dataset("time", data=np.array([0.0, 31.0]))
        time.attrs["units"] = "days since 1870-1-1 0:0:0"
        _ = opened.create_dataset(names[0], data=np.array([0.5, -0.5]))
        _ = opened.create_dataset(names[1], data=np.array([-0.5, 0.5]))
        _ = opened.create_dataset("sst", data=np.full((2, 2, 2), -1000.0, dtype=np.float32))
        record = read_record(opened)
        assert record.dates == [(1870, 1), (1870, 2)]
        assert bool(np.isnan(record.fields).all())


def test_reads_hadissts_classic_file() -> None:
    data = netcdf3(
        {"time": 2, "latitude": 2, "longitude": 2},
        {
            "time": Var(
                ("time",),
                np.array([15.5, 45.0]),
                attributes={"units": "days since 1870-1-1 0:0:0"},
            ),
            "latitude": Var(("latitude",), np.array([0.5, -0.5])),
            "longitude": Var(("longitude",), np.array([-179.5, 179.5])),
            "sst": Var(
                ("time", "latitude", "longitude"),
                np.array([[[25.0, -1000.0], [-1e30, 26.0]]] * 2),
            ),
        },
    )
    record = read_classic(data)
    assert record.dates == [(1870, 1), (1870, 2)]
    values: list[float] = record.fields[0].ravel().tolist()  # pyright: ignore[reportAny]
    assert values[0] == 25.0
    assert math.isnan(values[1])
    assert math.isnan(values[2])
    no_units = netcdf3({"time": 1}, {"time": Var(("time",), np.array([1.0]))})
    with pytest.raises(TypeError, match="no units"):
        _ = read_classic(no_units)


def test_box_means_weigh_by_latitude_and_skip_land() -> None:
    record = _record(1991, 2020)
    tropics: list[float] = box_mean(record, 20, -20, 0, 360).tolist()  # pyright: ignore[reportAny]
    assert tropics[0] > 20.0  # Niño 3.4 lies inside the tropics
    polar: list[float] = box_mean(record, 90, 85, 0, 10).tolist()  # pyright: ignore[reportAny]
    assert polar[0] == pytest.approx(20.0)


def test_anomalies_need_the_whole_base() -> None:
    dates = [(year, month) for year in range(1991, 2021) for month in range(1, 13)]
    series = np.arange(360.0)
    out: list[float] = anomalies(dates, series).tolist()  # pyright: ignore[reportAny]
    # January 1991 against the mean of thirty Januaries, 0 to 348 by twelves.
    assert out[0] == pytest.approx(-174.0)
    with pytest.raises(ValueError, match="does not cover 1991-2020"):
        _ = anomalies(dates[:-1], series[:-1])


def test_the_relative_index_follows_nino_less_the_tropics_rescaled() -> None:
    months = (2020 - 1940 + 1) * 12
    swing = [math.sin(at / 9) for at in range(months)]
    index = relative_index(_record(1940, 2020, swing))
    assert index.first == (1940, 2)
    assert len(index.values) == months - 2
    # Rescaled, its spread since 1950 is Niño 3.4's own; the season follows the swing.
    assert np.std(index.values[119:]) == pytest.approx(np.std(swing[120:]), rel=0.05)
    assert np.corrcoef(index.values, swing[1:-1])[0, 1] > 0.99


def test_early_indices_end_in_1949_with_episodes_cut_there() -> None:
    values = [0.0] * 6 + [1.0] * 8 + [0.0] * 6 + [-0.8] * 10 + [0.0] * 6
    whole = Index((1948, 1), values)
    kept = until(whole, (1949, 12), 1948)
    assert kept.first == (1948, 1)
    assert len(kept.values) == 24
    described = early_json(ERSST, whole, 1948)
    assert described["first"] == "1948-01"
    episodes = described["episodes"]
    assert isinstance(episodes, list)
    assert episodes[0] == {
        "phase": "elNino",
        "first": "1948-07",
        "last": "1949-02",
        "peak": 1.0,
        "peakAt": "1948-07",
    }
    assert episodes[1] == {
        "phase": "laNina",
        "first": "1949-09",
        "last": "1949-12",
        "peak": -0.8,
        "peakAt": "1949-09",
        "cut": True,
    }
    # An episode wholly before the years shown is left out.
    earlier = early_json(ERSST, Index((1947, 1), [1.0] * 6 + [0.0] * 30), 1948)
    assert earlier["episodes"] == []
    months = months_from((1948, 1), len(values))
    assert months[-1] == (1950, 12)
    assert early_file([described], "2026-11-19")["provisionalMonths"] == 0


def test_two_degree_cells_sit_on_the_two_degree_nodes() -> None:
    field = np.arange(LATITUDE.size * LONGITUDE.size, dtype=np.float64).reshape(
        LATITUDE.size, LONGITUDE.size
    )
    grid = on_nodes(field, LATITUDE, LONGITUDE)
    assert grid.shape == (ROWS, COLUMNS)
    rows: list[list[float]] = grid.tolist()  # pyright: ignore[reportAny]
    assert all(math.isnan(each) for each in rows[0])  # 90°N
    # 88°N, 0°E is the node at row 1, column 90; 180°W (180°E) is column 0 and repeats last.
    assert rows[1][90] == 0.0
    assert rows[1][0] == 90.0
    assert rows[1][-1] == rows[1][0]


def test_writes_a_map_a_month_to_august_1981(tmp_path: Path) -> None:
    record = _record(1979, 2020)
    count = sea_maps(Record(record.dates, record.fields, LATITUDE, LONGITUDE), tmp_path, "x")
    assert count == 32  # January 1979 to August 1981
    with Image.open(tmp_path / "1981-08.png") as image:
        assert image.size == (COLUMNS, ROWS)
    index = read_json(tmp_path / "index.json")
    assert isinstance(index, dict)
    assert (index["first"], index["last"], index["columns"]) == ("1979-01", "1981-08", 181)
    assert not (tmp_path / "1981-09.png").exists()
