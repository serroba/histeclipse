"""Tests for the CENOGRID reference splice, read and thinned."""

import json
from typing import TYPE_CHECKING

import pytest

from histeclipse_pipeline.cenogrid import (
    CREDIT,
    SOURCE,
    Row,
    binned,
    cenogrid_file,
    read_splice,
    thinned,
    write_cenogrid,
)

if TYPE_CHECKING:
    from pathlib import Path

HEADING_CELLS = (
    "Tuned time [Ma]",
    "Foram benth [#] (ISOBENbinned_d13Ccount)",
    "Foram benth δ13C [‰ PDB] (ISOBENbinned_d13C)",
    "Foram benth δ13C [‰ PDB] (ISOBENd13cLOESSsmooth)",
    "Foram benth δ18O [‰ PDB] (ISOBENd18oLOESSsmooth)",
    "Comment (error)",
    "Foram benth δ13C [‰ PDB] (ISOBENd13cLOESSsmoothLongTerm)",
    "Foram benth δ18O [‰ PDB] (ISOBENd18oLOESSsmoothLongTerm)",
)
HEADING = "\t".join(HEADING_CELLS)
LINES = (
    "/* DATA DESCRIPTION:",
    "Citation:\tWesterhold, Thomas (2020): S34. ...",
    "*/",
    HEADING,
    "0.000\t1\t-0.800\t-0.496\t3.498\t10pts smooth\t-0.606\t4.620",
    "0.002\t1\t0.430\t-0.278\t3.524\t10pts smooth\t-0.605\t4.618",
    # A row missing a smooth is left out.
    "0.004\t2\t-0.645\t\t3.650\t10pts smooth\t-0.604\t4.616",
    "0.010\t2\t-0.805\t-0.595\t4.600\t10pts smooth\t-0.603\t4.611",
    # A short row is left out too.
    "0.012\t2",
    "",
)
TEXT = "\n".join(LINES)


def test_reads_rows_with_every_smooth() -> None:
    rows = read_splice(TEXT)
    assert rows == [
        Row(0.0, 3.498, -0.496, 4.620, -0.606),
        Row(0.002, 3.524, -0.278, 4.618, -0.605),
        Row(0.01, 4.6, -0.595, 4.611, -0.603),
    ]


def test_names_a_missing_column() -> None:
    with pytest.raises(ValueError, match="ISOBENd18oLOESSsmoothLongTerm"):
        _ = read_splice(TEXT.replace("ISOBENd18oLOESSsmoothLongTerm", "something else"))


def test_bins_by_width_youngest_first_with_edges_opening_their_bin() -> None:
    points = [(0.018, 2.0, -1.0), (0.0, 1.0, 1.0), (0.01, 3.0, 0.0), (0.002, 3.0, -1.0)]
    assert binned(points, 0.01) == [[0.001, 2.0, 0.0], [0.014, 2.5, -0.5]]


def test_rounding_turns_negative_zero_into_zero() -> None:
    assert binned([(0.0, -0.0001, 0.0)], 0.01) == [[0.0, 0.0, 0.0]]
    assert str(binned([(0.0, -0.0001, 0.0)], 0.01)[0][1]) == "0.0"


def test_thins_the_smooth_and_the_long_term_separately() -> None:
    rows = read_splice(TEXT)
    short, long = thinned(rows)
    assert short == [[0.001, 3.511, -0.387], [0.01, 4.6, -0.595]]
    assert long == [[0.004, 4.616, -0.605]]


def test_writes_a_compact_file_with_credit_and_units(tmp_path: Path) -> None:
    path = tmp_path / "data" / "cenogrid" / "index.json"
    assert write_cenogrid(read_splice(TEXT), path) == 3
    data = json.loads(path.read_text())  # pyright: ignore[reportAny]
    assert data == cenogrid_file(*thinned(read_splice(TEXT)))
    assert data["schemaVersion"] == 1
    assert data["credit"] == CREDIT
    assert data["source"] == SOURCE
    assert data["units"] == {"d18O": "‰ VPDB", "d13C": "‰ VPDB"}
    assert data["columns"] == ["ma", "d18O", "d13C"]
    assert data["smooth"] == [[0.001, 3.511, -0.387], [0.01, 4.6, -0.595]]
    assert "CC BY 4.0" in CREDIT
    assert " " not in path.read_text().split('"smooth"')[1]
