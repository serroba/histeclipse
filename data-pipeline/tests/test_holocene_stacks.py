import io
import math
from typing import TYPE_CHECKING

import h5py
import numpy as np
import pytest
from openpyxl import Workbook

from histeclipse_pipeline.holocene_stacks import (
    BOVA_AGE,
    BOVA_ERROR,
    BOVA_MASST,
    BOVA_SSTSN,
    METHODS,
    bova,
    bova_rows,
    ensemble_points,
    lgmr_holocene,
    temp12k,
    write_holocene_stacks,
)
from tests.json_values import JsonValue, read_json

if TYPE_CHECKING:
    from pathlib import Path


def test_takes_the_median_and_5_95_range_oldest_first_skipping_missing_members() -> None:
    ages = np.asarray([0.0, 100.0, 200.0])
    members = np.asarray(
        [
            [0.0, 1.0, 2.0, 3.0, 4.0],
            [1.0, 1.0, 1.0, math.nan, math.nan],
            [math.nan] * 5,
        ]
    )
    assert ensemble_points(ages, members) == [(1850, 1.0, 1.0, 1.0), (1950, 2.0, 0.2, 3.8)]


def _temp12k_file(ages: list[float], members: dict[str, list[list[float]]]) -> bytes:
    out = io.BytesIO()
    with h5py.File(out, "w") as made:
        _ = made.create_dataset("age", data=np.asarray(ages))
        for key, values in members.items():
            _ = made.create_dataset(f"{key}_globalmean", data=np.asarray(values))
    return out.getvalue()


def test_writes_the_pooled_temp12k_series_then_each_method() -> None:
    # Two bins, two members per method; method k's members are k and k + 1 at the older bin.
    members = {key: [[0.0, 0.0], [float(k), float(k + 1)]] for k, (key, _) in enumerate(METHODS)}
    members["gam"][1] = [math.nan, math.nan]  # GAM has no value at the oldest bins
    series = temp12k(_temp12k_file([0.0, 12_000.0], members))
    assert [each.id for each in series] == [
        "temp12k",
        "temp12k-scc",
        "temp12k-dcc",
        "temp12k-gam",
        "temp12k-cps",
        "temp12k-pai",
    ]
    assert all(each.registry == "kaufman2020" for each in series)
    assert all(each.licence == "CC0 1.0" for each in series)
    assert "1800-1900" in series[0].baseline
    pooled = series[0].points
    assert [point[0] for point in pooled] == [1950 - 12_000, 1950]
    # The older bin pools 0, 1, 1, 2, 3, 4, 4, 5 (GAM left out): median 2.5.
    assert pooled[0][1] == 2.5
    assert pooled[1] == (1950, 0.0, 0.0, 0.0)
    assert series[3].points == [(1950, 0.0, 0.0, 0.0)]
    assert series[1].points[0] == (-10_050, 0.5, 0.05, 0.95)


def _lgmr_file(ages: list[float], gmst: list[list[float]]) -> bytes:
    out = io.BytesIO()
    with h5py.File(out, "w") as made:
        _ = made.create_dataset("age", data=np.asarray(ages, dtype=np.float32))
        _ = made.create_dataset("gmst", data=np.asarray(gmst, dtype=np.float32))
    return out.getvalue()


def test_keeps_only_the_holocene_of_the_reanalysis_against_each_members_1850() -> None:
    data = _lgmr_file([100.0, 11_900.0, 12_100.0], [[14.0, 13.0, 9.0], [15.0, 13.0, 8.0]])
    series = lgmr_holocene(data)
    assert (series.id, series.registry, series.scope) == ("lgmr", "osman2021", "global")
    assert series.points == [(1950 - 11_900, -1.5, -1.95, -1.05), (1850, 0.0, 0.0, 0.0)]


def _bova_sheet(rows: list[list[object]]) -> bytes:
    book = Workbook()
    sheet = book.active
    assert sheet is not None
    for row in rows:
        sheet.append(row)
    out = io.BytesIO()
    book.save(out)
    return out.getvalue()


BOVA_HEADER: list[object] = [
    "Age (ky)",
    "Tropics SSTsn",
    BOVA_AGE,
    BOVA_SSTSN,
    BOVA_ERROR,
    BOVA_MASST,
    BOVA_ERROR,
]


def test_reads_bova_et_al_s_full_stack_and_stops_at_its_last_bin() -> None:
    data = _bova_sheet(
        [
            ["All data referenced to averaged value from 0-1 ka"],
            ["Panel a", None, "Panel d"],
            BOVA_HEADER,
            [0.5, 9.0, 0.5, 0, 0, 0, 0],
            [6.5, 9.0, 6.5, 0.53, 0.21, -0.25, 0.2],
            [7.5, 9.0, None, None, None, None, None],
        ]
    )
    assert bova_rows(data) == [(0.5, 0.0, 0.0, 0.0, 0.0), (6.5, 0.53, 0.21, -0.25, 0.2)]


def test_refuses_a_bova_sheet_whose_columns_moved() -> None:
    moved: list[object] = [BOVA_AGE, BOVA_SSTSN, BOVA_MASST, BOVA_ERROR, BOVA_ERROR]
    with pytest.raises(ValueError, match="unexpected columns"):
        _ = bova_rows(_bova_sheet([moved]))
    other: list[object] = ["Age (ky)", "something else"]
    with pytest.raises(ValueError, match="no column"):
        _ = bova_rows(_bova_sheet([other]))


def test_writes_bova_et_al_s_stack_as_annual_and_as_seasonal_with_one_standard_error() -> None:
    annual, seasonal = bova([(0.5, 0.0, 0.0, 0.0, 0.0), (6.5, 0.53, 0.21, -0.25, 0.2)])
    assert (annual.id, seasonal.id) == ("bova-masst", "bova-sstsn")
    assert annual.scope == "sea surface, 40°S-40°N"
    assert "0-1 ka" in annual.baseline
    assert annual.points == [(-4550, -0.25, -0.45, -0.05), (1450, 0.0, 0.0, 0.0)]
    assert seasonal.points == [(-4550, 0.53, 0.32, 0.74), (1450, 0.0, 0.0, 0.0)]


def test_writes_every_series_with_its_baseline_and_credit(tmp_path: Path) -> None:
    path = tmp_path / "holocene-stacks" / "index.json"
    series = bova([(0.5, 0.0, 0.0, 0.0, 0.0), (1.5, 0.1, 0.1, -0.1, 0.1)])
    assert write_holocene_stacks(series, path) == 4
    body = read_json(path)
    assert isinstance(body, dict)
    assert body["schemaVersion"] == 1
    assert "CC0" in str(body["credit"])
    written = body["series"]
    assert isinstance(written, list)
    first: JsonValue = written[0]
    assert isinstance(first, dict)
    assert first["id"] == "bova-masst"
    assert first["units"] == "°C"
    assert first["registry"] == "bova2021"
    assert first["points"] == [[450, -0.1, -0.2, 0.0], [1450, 0.0, 0.0, 0.0]]
