import io
import json
import math
from typing import TYPE_CHECKING

import h5py
import numpy as np
import pytest
from PIL import Image

from histeclipse_pipeline.krapp import decode
from histeclipse_pipeline.measured_warming import (
    annual_mean,
    build,
    frame_years,
    frames,
    mean_of,
)
from histeclipse_pipeline.paleotemp import COLUMNS, ROWS

if TYPE_CHECKING:
    from pathlib import Path

#: The source's 1° cell centres.
LATITUDE = np.arange(-89.5, 90.0, 1.0)
LONGITUDE = np.arange(-179.5, 180.0, 1.0)
SHAPE = (len(LATITUDE), len(LONGITUDE))


def node(latitude: int, longitude: int) -> tuple[int, int]:
    return 90 - latitude, longitude + 180


def test_averages_a_year_only_where_every_month_has_data() -> None:
    months = np.ones((12, 2, 2))
    months[:, 0, 0] = np.arange(12.0)
    months[5, 1, 1] = np.nan
    year = annual_mean(months)
    assert year[0, 0] == pytest.approx(5.5)
    assert year[0, 1] == pytest.approx(1.0)
    assert math.isnan(year.item(1, 1))
    with pytest.raises(ValueError, match="12 months"):
        _ = annual_mean(np.ones((11, 2, 2)))


def test_averages_years_where_enough_have_data() -> None:
    years = [np.array([1.0, np.nan]), np.array([3.0, np.nan]), np.array([np.nan, 5.0])]
    mean = mean_of(years, 2)
    assert mean[0] == pytest.approx(2.0)
    assert math.isnan(mean.item(1))


def test_takes_every_five_years_from_1850_and_the_last() -> None:
    assert frame_years(1862) == [1850, 1855, 1860, 1862]
    assert frame_years(1860) == [1850, 1855, 1860]


def test_measures_land_from_1850_1900_with_five_year_means() -> None:
    land = np.array([1.0, 1.0, 0.2])
    # A cell 0.5 °C warmer from 1950; one with no baseline; one at sea.
    annual = {
        year: np.array([0.5 if year >= 1950 else 0.0, np.nan if year <= 1900 else 1.0, 2.0])
        for year in range(1846, 1953)
    }
    zero, measured = frames(annual, land)
    assert zero[0] == pytest.approx(0.0)
    assert math.isnan(zero.item(1))
    assert math.isnan(zero.item(2))
    by_year = dict(measured)
    assert list(by_year)[-1] == 1952
    assert by_year[1900][0] == pytest.approx(0.0)
    # 1948-1952: three of the five years warmer; no baseline, or sea, stays without data.
    assert by_year[1952][0] == pytest.approx(0.3)
    assert math.isnan(by_year[1952].item(1))
    assert math.isnan(by_year[1952].item(2))


def months_file(last_year: int) -> bytes:
    """A small field like Berkeley Earth's: 0 until 1950, then +1, round 45.5° N 10.5° E."""
    times = np.array(
        [year + (month + 0.5) / 12 for year in range(1846, last_year + 1) for month in range(12)]
        # And a year still in progress, as the file's last may be.
        + [last_year + 1 + 1 / 24]
    )
    temperature = np.full((len(times), *SHAPE), np.nan, dtype=np.float32)
    land = np.zeros(SHAPE)
    lat = int(np.argmin(np.abs(LATITUDE - 45.5)))
    lon = int(np.argmin(np.abs(LONGITUDE - 10.5)))
    box = (slice(lat - 1, lat + 1), slice(lon - 1, lon + 1))
    temperature[:, box[0], box[1]] = 0.0
    temperature[times >= 1950, box[0], box[1]] = 1.0
    land[box] = 1.0
    out = io.BytesIO()
    with h5py.File(out, "w") as opened:
        _ = opened.create_dataset("time", data=times)
        _ = opened.create_dataset("latitude", data=LATITUDE)
        _ = opened.create_dataset("longitude", data=LONGITUDE)
        _ = opened.create_dataset("land_mask", data=land)
        _ = opened.create_dataset("temperature", data=temperature)
    return out.getvalue()


def test_writes_images_the_globe_reads_as_the_change_from_1850_1900(tmp_path: Path) -> None:
    out = tmp_path / "warming"
    assert build(months_file(1955), out) == 22
    index = json.loads((out / "index.json").read_text())  # pyright: ignore[reportAny]
    assert index["baseline"] == "1850\u20131900"
    assert index["licence"] == "CC BY-NC 4.0"
    assert (index["columns"], index["rows"]) == (COLUMNS, ROWS)
    assert index["frames"][-1] == {"year": 1955, "file": "1955.png", "mean": 1.0}
    coldest: float = index["coldest"]  # pyright: ignore[reportAny]
    warmest: float = index["warmest"]  # pyright: ignore[reportAny]
    pixels = np.asarray(Image.open(io.BytesIO((out / "1955.png").read_bytes())), dtype=np.int64)
    at = node(45, 10)
    then = decode(pixels.item(*at, 0), coldest, warmest)
    baseline = decode(pixels.item(*at, 1), coldest, warmest)
    assert then - baseline == pytest.approx(1.0, abs=0.05)
    assert (pixels.item(*at, 2), pixels.item(*at, 3)) == (255, 255)
    # Away from the land: no data, then or in the baseline.
    far = node(-45, -100)
    assert (pixels.item(*far, 2), pixels.item(*far, 3)) == (0, 0)
