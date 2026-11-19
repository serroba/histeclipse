"""Tests for the El Niño and La Niña composites of rain and temperature (#891, #892)."""

import datetime as dt
import io
import math
from typing import TYPE_CHECKING

import h5py
import numpy as np
import pytest
from PIL import Image

from histeclipse_pipeline.enso_composites import (
    RAIN,
    TEMPERATURE,
    Monthly,
    Variable,
    berkeley_record,
    composite,
    composites,
    detrended,
    file_name,
    gpcp_record,
    months_in,
    phase_years,
    seasonal,
    write_composites,
)
from histeclipse_pipeline.paleotemp import COLUMNS, ROWS
from tests.json_values import read_json

if TYPE_CHECKING:
    from pathlib import Path

    from histeclipse_pipeline.krapp import Grid
    from histeclipse_pipeline.sky import Json

EPISODES: list[dict[str, Json]] = [
    {"phase": "elNino", "first": "1990-11", "last": "1991-02"},
    {"phase": "laNina", "first": "1991-06", "last": "1991-08"},
    {"phase": "elNino", "first": "1992-12", "last": "1993-01"},
    {"phase": "elNino", "first": "1995-01", "last": "1995-01"},
]


#: The same episodes as the index file holds them.
LISTED: list[Json] = [*EPISODES]


def _dates(first: int, last: int) -> list[tuple[int, int]]:
    return [(year, month) for year in range(first, last + 1) for month in range(1, 13)]


def _record(values: dict[tuple[int, int], float], dates: list[tuple[int, int]]) -> Monthly:
    """A record on a 2-row, 3-column 30° grid, the month's value everywhere."""

    def month(row: int) -> Grid:
        return np.full((2, 3), values.get(dates[row], 0.0))

    return Monthly(dates, month, np.array([-15.0, 15.0]), np.array([0.0, 120.0, 240.0]))


def test_seasons_average_their_months_and_drop_years_missing_one() -> None:
    dates = _dates(1990, 1991)
    record = _record({(1990, 12): 3.0, (1991, 1): 6.0, (1991, 2): 9.0, (1990, 7): 1.0}, dates)
    winters = seasonal(record, "djf", (1990, 1991))
    assert list(winters) == [1991]  # December 1989 is not in the file
    assert winters[1991][0, 0] == pytest.approx(6.0)
    summers = seasonal(record, "jja", (1990, 1991))
    assert summers[1990][1, 2] == pytest.approx(1 / 3)


def test_detrending_takes_each_nodes_line_away_and_keeps_gaps() -> None:
    years = [2000, 2001, 2002, 2003]
    fields = np.array([[1.0, 5.0], [2.0, np.nan], [3.0, 5.0], [5.0, 5.0]])
    rows: list[list[float]] = detrended(years, fields).tolist()  # pyright: ignore[reportAny]
    assert math.isnan(rows[1][1])
    assert [row[1] for row in rows if not math.isnan(row[1])] == [0.0, 0.0, 0.0]
    # 1, 2, 3, 5 less its least-squares line (slope 1.3): the residuals sum to none.
    assert sum(row[0] for row in rows) == pytest.approx(0.0)
    assert rows[3][0] == pytest.approx(0.3)


def test_months_and_years_follow_each_season_s_middle_month() -> None:
    warm = months_in(EPISODES, "elNino")
    assert (1990, 12) in warm
    assert (1991, 6) not in warm
    assert len(warm) == 7
    years = list(range(1990, 1996))
    assert phase_years(EPISODES, "elNino", "djf", years) == [1991, 1993, 1995]
    assert phase_years(EPISODES, "laNina", "jja", years) == [1991]
    assert phase_years(EPISODES, "laNina", "djf", years) == []


def test_a_composite_needs_three_seasons_and_is_significant_where_they_agree() -> None:
    fields = np.array([[1.0, 1.0, np.nan], [1.1, -2.0, 1.0], [0.9, 1.5, 1.0], [5.0, 5.0, 5.0]])
    found = composite(fields, [0, 1, 2])
    slope: list[float] = found.slope.tolist()  # pyright: ignore[reportAny]
    significant: list[bool] = found.significant.tolist()  # pyright: ignore[reportAny]
    assert slope[0] == pytest.approx(1.0)
    assert significant[:2] == [True, False]
    assert math.isnan(slope[2])  # two seasons only
    nothing = composite(fields, [])
    assert np.isnan(nothing.slope).all()
    assert not nothing.significant.any()


def test_composites_by_index_phase_and_season() -> None:
    dates = _dates(1989, 1996)
    # El Niño winters are warm, everything else is still.
    warm = {(year, month): 2.0 for year in (1991, 1993, 1995) for month in (1, 2)}
    warm |= {(year - 1, 12): 2.0 for year in (1991, 1993, 1995)}
    record = _record(warm, dates)
    variable = Variable(
        id="t",
        label="T",
        units="°C",
        step=0.25,
        years=(1990, 1996),
        source_id="s",
        credit="c",
        source="https://example.org/",
        licence="l",
    )
    made = composites(variable, record, [{"id": "roni", "episodes": LISTED}])
    assert [(each.phase, each.season) for each in made] == [
        ("elNino", "djf"),
        ("laNina", "djf"),
        ("elNino", "jja"),
        ("laNina", "jja"),
    ]
    winter = made[0]
    assert winter.years == [1991, 1993, 1995]
    assert winter.found.slope.shape == (ROWS, COLUMNS)
    assert np.nanmin(winter.found.slope) > 0.5
    assert file_name(winter) == "t-roni-elNino-djf.png"
    with pytest.raises(TypeError, match="without episodes"):
        _ = composites(variable, record, [{"id": "oni", "episodes": "none"}])


def test_writes_an_image_a_composite_and_the_index(tmp_path: Path) -> None:
    dates = _dates(1989, 1996)
    record = _record({(1990, 12): 1.0, (1991, 1): 1.0, (1991, 2): 1.0}, dates)
    variable = Variable(
        id="rain",
        label="Rain",
        units="mm a day",
        step=0.5,
        years=(1990, 1996),
        source_id="gpcp",
        credit="c",
        source="https://example.org/",
        licence="l",
    )
    made = composites(variable, record, [{"id": "roni", "episodes": LISTED}])
    count = write_composites({"rain": made}, [variable], tmp_path, "2026-11-19")
    assert count == 4
    with Image.open(tmp_path / "rain-roni-elNino-djf.png") as image:
        assert image.size == (COLUMNS, ROWS)
    index = read_json(tmp_path / "index.json")
    assert isinstance(index, dict)
    variables = index["variables"]
    assert isinstance(variables, list)
    assert variables[0] == {
        "id": "rain",
        "label": "Rain",
        "units": "mm a day",
        "bound": 0.5,
        "years": [1990, 1996],
        "sourceId": "gpcp",
        "credit": "c",
        "source": "https://example.org/",
        "licence": "l",
    }
    maps = index["maps"]
    assert isinstance(maps, list)
    first = maps[0]
    assert isinstance(first, dict)
    assert first["years"] == [1991, 1993, 1995]
    assert first["seasons"] == 3
    empty = maps[1]
    assert isinstance(empty, dict)
    assert empty["significantShare"] is None


def _days_since_1800(dates: list[tuple[int, int]]) -> list[float]:
    return [float((dt.date(year, month, 1) - dt.date(1800, 1, 1)).days) for year, month in dates]


def test_reads_gpcp_with_missing_values_as_nan() -> None:
    dates = _dates(1979, 1979)
    opened = h5py.File(io.BytesIO(), "w")
    time = opened.create_dataset("time", data=np.asarray(_days_since_1800(dates)))
    time.attrs["units"] = b"days since 1800-01-01 00:00:0.0"
    _ = opened.create_dataset("lat", data=np.array([-1.25, 1.25]))
    _ = opened.create_dataset("lon", data=np.array([1.25, 3.75]))
    precip = np.full((12, 2, 2), 2.5, dtype=np.float32)
    precip[3, 0, 0] = -9.96921e36
    _ = opened.create_dataset("precip", data=precip)
    record = gpcp_record(opened)
    assert record.dates[0] == (1979, 1)
    assert record.dates[-1] == (1979, 12)
    april: list[list[float]] = record.month(3).tolist()  # pyright: ignore[reportAny]
    january: list[list[float]] = record.month(0).tolist()  # pyright: ignore[reportAny]
    assert math.isnan(april[0][0])
    assert january[1][1] == pytest.approx(2.5)
    del opened["time"].attrs["units"]
    opened["time"].attrs["units"] = "weeks since 1800-01-01"
    with pytest.raises(ValueError, match="unsupported time units"):
        _ = gpcp_record(opened)


def test_reads_berkeleys_decimal_years() -> None:
    opened = h5py.File(io.BytesIO(), "w")
    times = [1950 + (month + 0.5) / 12 for month in range(12)]
    _ = opened.create_dataset("time", data=np.asarray(times))
    _ = opened.create_dataset("latitude", data=np.array([-0.5, 0.5]))
    _ = opened.create_dataset("longitude", data=np.array([0.5, 1.5]))
    _ = opened.create_dataset("temperature", data=np.full((12, 2, 2), 0.3, dtype=np.float32))
    record = berkeley_record(opened)
    assert record.dates == [(1950, month) for month in range(1, 13)]
    assert record.month(5)[0, 1] == pytest.approx(0.3)


def test_the_records_are_described() -> None:
    assert RAIN.source_id == "gpcp"
    assert TEMPERATURE.licence == "CC BY-NC 4.0"
    assert TEMPERATURE.years[0] == 1950
