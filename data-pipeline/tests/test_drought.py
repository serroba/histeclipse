import io
from datetime import UTC, datetime
from typing import TYPE_CHECKING

import h5py
import numpy as np
import pytest

from histeclipse_pipeline.drought import build, read_decembers
from histeclipse_pipeline.paleotemp import COLUMNS, ROWS
from histeclipse_pipeline.water_cycle import decode, to_nodes
from tests.manifests import by_id, manifest, number, numbers, pixel

if TYPE_CHECKING:
    from pathlib import Path

#: A coarse stand-in for SPEIbase's grid: south first, -180 to 180.
LATITUDE = np.array([-45.0, 45.0])
LONGITUDE = np.array([-135.0, -45.0, 45.0, 135.0])


def node(latitude: int, longitude: int) -> tuple[int, int]:
    return 90 - latitude, longitude + 180


def spei_file() -> bytes:
    """Monthly SPEI, 1901-2023: 0, but drying by 0.05 a year from 1951 at 45° N 45° E.

    Non-December months are 9, so reading any of them would show; 45° S 135° W is sea.
    """
    months = [(year, month) for year in range(1901, 2024) for month in range(1, 13)]
    days = [
        (datetime(year, month, 16, tzinfo=UTC) - datetime(1900, 1, 1, tzinfo=UTC)).days
        for year, month in months
    ]
    spei = np.full((len(months), 2, 4), 9.0, dtype=np.float32)
    for row, (year, month) in enumerate(months):
        if month == 12:
            spei[row] = 0.0
            spei[row, 1, 2] = -0.05 * max(0, year - 1951)
    spei[:, 0, 0] = 1e30
    out = io.BytesIO()
    with h5py.File(out, "w") as opened:
        time = opened.create_dataset("time", data=np.array(days, dtype=np.float64))
        time.attrs["units"] = "days since 1900-1-1"
        _ = opened.create_dataset("lat", data=LATITUDE)
        _ = opened.create_dataset("lon", data=LONGITUDE)
        _ = opened.create_dataset("spei", data=spei)
    return out.getvalue()


def test_reads_each_december() -> None:
    years, fields, latitude, longitude = read_decembers(spei_file())
    assert (years[0], years[-1], len(years)) == (1901, 2023, 123)
    assert float(np.nanmax(fields)) == 0.0
    assert np.isnan(fields.item(0, 0, 0))
    assert fields.item(-1, 1, 2) == pytest.approx(-3.6)
    assert (latitude.tolist(), longitude.tolist()) == (LATITUDE.tolist(), LONGITUDE.tolist())


def test_writes_the_trend_and_dry_share(tmp_path: Path) -> None:
    years, fields, latitude, longitude = read_decembers(spei_file())
    nodes = to_nodes(fields, latitude, longitude)
    assert nodes.shape == (123, ROWS, COLUMNS)
    out = tmp_path / "drought"
    assert build(years, nodes, out) == 1
    index = manifest(out)
    assert index["licence"] == "ODbL 1.0"
    layer = by_id(index["maps"])["spei12"]
    assert layer["period"] == [1951, 2023]
    bound = number(layer["bound"])
    image = out / "spei12.png"
    red, green, blue, alpha = pixel(image, node(45, 45))
    assert decode(red, bound) - decode(green, bound) == pytest.approx(-0.5, abs=bound / 100)
    assert (blue, alpha) == (255, 255)
    assert pixel(image, node(-45, -135))[3] == 0
    spei = by_id(index["curves"])["spei12"]
    assert numbers(spei["years"])[0] == 1901
    values, dry = numbers(spei["values"]), numbers(spei["dryShare"])
    assert (values[0], dry[0]) == (0.0, 0.0)
    # From 1971 (-1.0) on, the drying cell counts as dry.
    assert dry[-1] > 0.0
    assert values[-1] < 0.0
