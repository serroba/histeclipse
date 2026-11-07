"""Holocene eruptions as the ice cores record them, read from HolVol's netCDF-4 file."""

from __future__ import annotations

import io

import h5py
import numpy as np
import pytest

from histeclipse_pipeline.eruptions import eruptions_file, read_holvol, region_of
from tests.json_values import json_round_trip


def holvol(columns: dict[str, list[float]]) -> bytes:
    """A small HDF5 file shaped like HolVol's: one column per variable."""
    buffer = io.BytesIO()
    with h5py.File(buffer, "w") as file:
        for name, values in columns.items():
            _ = file.create_dataset(name, data=np.asarray(values, dtype=np.float32))
    return buffer.getvalue()


# Values a float32 holds exactly enough to round as the file's float64s do.
COLUMNS = {
    "year": [1815.0, 1258.0, -5229.0, 1258.0],
    "lat": [-8.0, -8.0, 5.0, 48.0],
    "vssi": [36.75, 75.25, 189.5, 1.25],
    "sigma_vssi": [8.0, 13.0, 40.0, 0.25],
}


def test_reads_the_regions_the_placeholder_latitudes_stand_for() -> None:
    assert region_of(5.0) == "tropics"
    assert region_of(48.0) == "north"
    assert region_of(-37.0) == "south"
    assert region_of(64.0) == "iceland"
    assert region_of(-8.0) == "located"


def test_reads_the_eruptions_oldest_first_the_largest_first_in_a_year() -> None:
    rows = read_holvol(holvol(COLUMNS))
    assert [row["year"] for row in rows] == [-5229, 1258, 1258, 1815]
    assert rows[1] == {
        "year": 1258,
        "latitude": -8.0,
        "region": "located",
        "sulfur": 75.25,
        "sigma": 13.0,
    }
    assert rows[2]["sulfur"] == 1.25


def test_refuses_an_empty_file_and_a_missing_column() -> None:
    with pytest.raises(ValueError, match="no eruptions"):
        _ = read_holvol(holvol({name: [] for name in COLUMNS}))
    with pytest.raises(KeyError):
        _ = read_holvol(holvol({"year": [1815.0]}))


def test_writes_columns_with_the_regions_listed_once() -> None:
    built = eruptions_file(read_holvol(holvol(COLUMNS)), "2026-11-08")
    assert json_round_trip(built) == built
    assert built["regions"] == ["located", "north", "tropics"]
    assert built["year"] == [-5229, 1258, 1258, 1815]
    assert built["region"] == [2, 0, 1, 0]
    assert built["sulfur"] == [189.5, 75.25, 1.25, 36.75]
