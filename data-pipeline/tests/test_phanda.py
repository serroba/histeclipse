"""Tests for PhanDA's GMST percentiles by stage."""

import json
from typing import TYPE_CHECKING

import pytest

from histeclipse_pipeline.phanda import (
    CREDIT,
    SOURCE,
    Stage,
    phanda_file,
    read_percentiles,
    write_phanda,
)

if TYPE_CHECKING:
    from pathlib import Path

HEADING = (
    "Period,Epoch,Stage,UpperAge,LowerAge,AverageAge,GMST_05,GMST_16,GMST_50,GMST_84,GMST_95,"
    "CO2_05,CO2_16,CO2_50,CO2_84,CO2_95"
)
# Oldest first, to check the reader puts the youngest first.
LINES = (
    HEADING,
    "Ordovician,Lower,Tremadocian,477.08,486.85,481.965,22.56866,23.9,32.1,35.7,36.86,1,2,3,4,5",
    "Quaternary,Holocene,Holocene,0,0.0117,0.00585,12.97,13.58,13.99,14.35,14.54,1,2,3,4,5",
    "",
)
TEXT = "\n".join(LINES)


def test_reads_each_stage_youngest_first() -> None:
    stages = read_percentiles(TEXT)
    assert [each.stage for each in stages] == ["Holocene", "Tremadocian"]
    assert stages[0] == Stage(
        period="Quaternary",
        epoch="Holocene",
        stage="Holocene",
        top=0.0,
        base=0.0117,
        mid=0.00585,
        gmst=(12.97, 13.58, 13.99, 14.35, 14.54),
    )


def test_refuses_percentiles_out_of_order() -> None:
    with pytest.raises(ValueError, match="Holocene"):
        _ = read_percentiles(TEXT.replace("13.58,13.99", "13.99,13.58"))


def test_builds_one_row_per_stage_with_names_beside() -> None:
    data = phanda_file(read_percentiles(TEXT))
    assert data["schemaVersion"] == 1
    assert data["credit"] == CREDIT
    assert data["source"] == SOURCE
    assert data["units"] == {"gmst": "°C"}
    assert data["percentiles"] == [5, 16, 50, 84, 95]
    assert data["names"] == [
        ["Quaternary", "Holocene", "Holocene"],
        ["Ordovician", "Lower", "Tremadocian"],
    ]
    assert data["stages"] == [
        [0.00585, 0.0, 0.0117, 12.97, 13.58, 13.99, 14.35, 14.54],
        [481.965, 477.08, 486.85, 22.57, 23.9, 32.1, 35.7, 36.86],
    ]


def test_writes_compact_json(tmp_path: Path) -> None:
    path = tmp_path / "data" / "phanda" / "index.json"
    assert write_phanda(read_percentiles(TEXT), path) == 2
    text = path.read_text()
    assert json.loads(text) == phanda_file(read_percentiles(TEXT))
    assert text.endswith("]]}\n")
    assert "Montañez" in text
