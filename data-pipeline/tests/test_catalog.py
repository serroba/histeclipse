from typing import TYPE_CHECKING

import pytest

from histeclipse_pipeline.catalog import (
    SCHEMA_VERSION,
    astronomical_year,
    to_record,
    write_lunar_catalog,
)
from histeclipse_pipeline.lunar import DELTA_T_MODEL, LunarEclipse, LunarEclipseKind
from tests.json_values import json_round_trip, read_json

if TYPE_CHECKING:
    from pathlib import Path


def eclipse(jd: float) -> LunarEclipse:
    return LunarEclipse(
        greatest_jd_tt=jd,
        kind=LunarEclipseKind.PARTIAL,
        umbral_magnitude=0.149_123_4,
        penumbral_magnitude=1.218_765_4,
        gamma=0.912_543_21,
        delta_t_seconds=18_776.4,
        sublunar_latitude=-8.912_3,
        sublunar_longitude=-32.104_5,
    )


ECLIPSE_621_BCE = eclipse(1_494_714.805_964_3)  # -620 Apr 22 (Julian)
ECLIPSE_2025 = eclipse(2_460_748.791_61)  # 2025 Mar 14 (Gregorian)


@pytest.mark.parametrize(
    ("jd", "year"),
    [
        (1_494_714.8, -620),
        (2_299_159.5, 1582),  # 1582 Oct 4 (Julian), the last day before the reform
        (2_299_160.5, 1582),  # 1582 Oct 15 (Gregorian)
        (2_451_544.5, 2000),
        (1_721_423.5, 1),  # 1 Jan 1 CE (Julian)
        (1_721_057.5, 0),  # 1 Jan 1 BCE (Julian)
    ],
)
def test_astronomical_year(jd: float, year: int) -> None:
    assert astronomical_year(jd) == year


def test_record_rounds_values_and_uses_json_names() -> None:
    assert to_record(ECLIPSE_621_BCE) == {
        "jdTT": 1_494_714.805_964,
        "kind": "partial",
        "umbralMagnitude": 0.1491,
        "penumbralMagnitude": 1.2188,
        "gamma": 0.9125,
        "deltaT": 18_776,
        "sublunar": (-8.91, -32.1),
    }


def test_writes_index_and_century_chunks(tmp_path: Path) -> None:
    index = write_lunar_catalog([ECLIPSE_2025, ECLIPSE_621_BCE], tmp_path, -700, 2099)

    assert index["schemaVersion"] == SCHEMA_VERSION
    assert index["deltaTModel"] == DELTA_T_MODEL
    assert (index["startYear"], index["endYear"]) == (-700, 2099)
    assert len(index["chunks"]) == 28
    counts = {chunk["startYear"]: chunk["count"] for chunk in index["chunks"]}
    assert counts[-700] == 1  # astronomical year -620 belongs to -700..-601
    assert counts[2000] == 1
    assert sum(counts.values()) == 2

    assert read_json(tmp_path / "index.json") == json_round_trip(index)
    assert read_json(tmp_path / "-700.json") == [json_round_trip(to_record(ECLIPSE_621_BCE))]
    assert read_json(tmp_path / "-600.json") == []


def test_chunk_files_hold_one_record_per_line(tmp_path: Path) -> None:
    _ = write_lunar_catalog([ECLIPSE_2025, eclipse(2_460_926.258_98)], tmp_path, 2025, 2025)
    lines = (tmp_path / "2000.json").read_text().splitlines()
    assert lines[0] == "["
    assert lines[-1] == "]"
    assert len(lines) == 4


def test_partial_centuries_get_their_whole_chunk(tmp_path: Path) -> None:
    index = write_lunar_catalog([], tmp_path, -586, -501)
    assert [chunk["file"] for chunk in index["chunks"]] == ["-600.json"]


def test_rejects_eclipses_outside_the_range(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="outside the range"):
        _ = write_lunar_catalog([ECLIPSE_621_BCE], tmp_path, 2000, 2099)


def test_rejects_empty_range(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="Empty year range"):
        _ = write_lunar_catalog([], tmp_path, 2001, 2000)
