import io
import json
import math
from typing import TYPE_CHECKING

import h5py
import numpy as np
import pytest
from PIL import Image

from histeclipse_pipeline.krapp import Grid, decode
from histeclipse_pipeline.measured_warming import (
    annual_mean,
    baseline,
    build,
    frame_years,
    frames,
    mean_of,
)
from histeclipse_pipeline.paleotemp import COLUMNS, ROWS

if TYPE_CHECKING:
    from pathlib import Path


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


def year_grid(year: int) -> Grid:
    """Two bands of latitude (rows: 50.5° N, 10.5° N), three cells each.

    50.5° N: a cell with records throughout, 0.5 °C warmer in 1951-1980 and 1 °C after; one
    without early records, the same since; one like the first. 10.5° N: a cell without early
    records, 2 °C in 1951-1980 and 3 °C after; one at sea, with records throughout, 0.2 °C
    warmer in 1951-1980; one at sea with no records at all.
    """
    later = 1951 <= year <= 1980
    after = year > 1980
    whole = 1.0 if after else 0.5 if later else 0.0
    north = [whole, np.nan if year <= 1900 else whole, whole]
    sea = 5.2 if later or after else 5.0
    south = [np.nan if year <= 1900 else 3.0 if after else 2.0, sea, np.nan]
    return np.array([north, south])


LAND = np.array([[1.0, 1.0, 1.0], [1.0, 0.2, 0.0]])
ROWS_AT = np.array([50.5, 10.5])
ANNUAL = {year: year_grid(year) for year in range(1846, 1986)}


def test_estimates_a_baseline_where_the_early_records_are_too_few() -> None:
    base = baseline(ANNUAL, LAND, ROWS_AT)
    # Its own; estimated from 1951-1980 less its band's shift (0.5); less the land's (0.5),
    # its band having no land with both; the sea's own; with no records, none.
    assert base.values[0, 0] == pytest.approx(0.0)
    assert base.values[0, 1] == pytest.approx(0.0)
    assert base.values[1, 0] == pytest.approx(1.5)
    assert base.values[1, 1] == pytest.approx(5.0)
    assert math.isnan(base.values.item(1, 2))
    assert base.estimated.tolist() == [[False, True, False], [True, False, False]]
    land, sea = base.shifts
    assert (land.surface, land.bands, land.overall) == ("land", [(45, 0.5)], 0.5)
    # The sea's shift is its own, not the land's.
    assert (sea.surface, sea.bands, sea.overall) == ("sea", [(0, 0.2)], 0.2)


def test_needs_some_land_and_some_sea_with_both_periods() -> None:
    sparse = {year: np.where(year <= 1900, np.nan, grid) for year, grid in ANNUAL.items()}
    with pytest.raises(ValueError, match="no land cell"):
        _ = baseline(sparse, LAND, ROWS_AT)
    with pytest.raises(ValueError, match="no sea cell"):
        _ = baseline(ANNUAL, np.ones_like(LAND), ROWS_AT)


def test_starts_the_frames_where_the_file_fills_one() -> None:
    late = {year: grid for year, grid in ANNUAL.items() if year >= 1850}
    _, measured = frames(late, baseline(late, LAND, ROWS_AT))
    # 1850's frame would hold 1850 alone; 1855's holds 1851-1855.
    assert [year for year, _ in measured][:2] == [1855, 1860]


def test_measures_land_and_sea_from_1850_1900_with_five_year_means() -> None:
    zero, measured = frames(ANNUAL, baseline(ANNUAL, LAND, ROWS_AT))
    assert zero[0, 0] == pytest.approx(0.0)
    assert math.isnan(zero.item(1, 2))
    by_year = dict(measured)
    assert list(by_year)[-1] == 1985
    assert by_year[1900][0, 0] == pytest.approx(0.0)
    # 1981-1985 against each baseline, measured or estimated: all warmer, none unchanged.
    assert by_year[1985][0, 0] == pytest.approx(1.0)
    assert by_year[1985][0, 1] == pytest.approx(1.0)
    assert by_year[1985][1, 0] == pytest.approx(1.5)
    assert by_year[1985][1, 1] == pytest.approx(0.2)
    assert math.isnan(by_year[1985].item(1, 2))


#: The test field's cells: a small patch, 40-50° N and 0-20° E.
PATCH_LATITUDE = np.arange(40.5, 51.0, 1.0)
PATCH_LONGITUDE = np.arange(0.5, 21.0, 1.0)


def months_file(last_year: int) -> bytes:
    """A small field like Berkeley Earth's: 0 until 1950, then +1 °C.

    Round 45° N 10° E with records throughout; round 45° N 5° E none before 1901: land. Round
    45° N 15° E, sea with records throughout, +0.5 °C from 1950.
    """
    times = np.array(
        [year + (month + 0.5) / 12 for year in range(1846, last_year + 1) for month in range(12)]
        # And a year still in progress, as the file's last may be.
        + [last_year + 1 + 1 / 24]
    )
    shape = (len(PATCH_LATITUDE), len(PATCH_LONGITUDE))
    temperature = np.full((len(times), *shape), np.nan, dtype=np.float32)
    land = np.zeros(shape)
    lat = int(np.argmin(np.abs(PATCH_LATITUDE - 45.5)))
    for lon_at, first, warmer, fraction in (
        (10.5, 1846, 1.0, 1.0),
        (5.5, 1901, 1.0, 1.0),
        (15.5, 1846, 0.5, 0.0),
    ):
        lon = int(np.argmin(np.abs(PATCH_LONGITUDE - lon_at)))
        box = (slice(lat - 1, lat + 1), slice(lon - 1, lon + 1))
        temperature[times >= first, box[0], box[1]] = 0.0
        temperature[times >= 1950, box[0], box[1]] = warmer
        land[box] = fraction
    out = io.BytesIO()
    with h5py.File(out, "w") as opened:
        _ = opened.create_dataset("time", data=times)
        _ = opened.create_dataset("latitude", data=PATCH_LATITUDE)
        _ = opened.create_dataset("longitude", data=PATCH_LONGITUDE)
        _ = opened.create_dataset("land_mask", data=land)
        _ = opened.create_dataset("temperature", data=temperature)
    return out.getvalue()


def test_writes_images_the_globe_reads_as_the_change_from_1850_1900(tmp_path: Path) -> None:
    out = tmp_path / "warming"
    assert build(months_file(1985), out) == 28
    index = json.loads((out / "index.json").read_text())  # pyright: ignore[reportAny]
    assert index["baseline"] == "1850\u20131900"
    assert index["licence"] == "CC BY-NC 4.0"
    # Half the land measured from 1951-1980, shifted back by its band's +1 °C (it spans two);
    # the sea all its own. Of all the cells with a baseline, a third estimated.
    assert index["coverage"] == "land and sea"
    assert index["estimated"] == {
        "from": "1951\u20131980",
        "share": 0.33,
        "surfaces": [
            {
                "surface": "land",
                "share": 0.5,
                "bands": [{"south": 30, "shift": 1.0}, {"south": 45, "shift": 1.0}],
                "shift": 1.0,
            },
            {
                "surface": "sea",
                "share": 0.0,
                "bands": [{"south": 30, "shift": 0.5}, {"south": 45, "shift": 0.5}],
                "shift": 0.5,
            },
        ],
    }
    assert (index["columns"], index["rows"]) == (COLUMNS, ROWS)
    # Over land and sea: two land patches at +1 °C, one sea patch at +0.5 °C.
    frame = index["frames"][-1]  # pyright: ignore[reportAny]
    assert (frame["year"], frame["file"]) == (1985, "1985.png")
    assert frame["mean"] == pytest.approx(0.83, abs=0.01)
    coldest: float = index["coldest"]  # pyright: ignore[reportAny]
    warmest: float = index["warmest"]  # pyright: ignore[reportAny]
    pixels = np.asarray(Image.open(io.BytesIO((out / "1985.png").read_bytes())), dtype=np.int64)
    # Both the measured and the estimated cell show the warming; neither as unchanged.
    for at, warmer in ((node(45, 10), 1.0), (node(45, 5), 1.0), (node(45, 15), 0.5)):
        then = decode(pixels.item(*at, 0), coldest, warmest)
        zero = decode(pixels.item(*at, 1), coldest, warmest)
        assert then - zero == pytest.approx(warmer, abs=0.05)
        assert (pixels.item(*at, 2), pixels.item(*at, 3)) == (255, 255)
    # Away from the records: no data, then or in the baseline.
    far = node(-45, -100)
    assert (pixels.item(*far, 2), pixels.item(*far, 3)) == (0, 0)
