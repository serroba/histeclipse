"""The dipole moment over the last 100,000 years, read from GGF100k's archive."""

from __future__ import annotations

import io
import zipfile

import pytest

from histeclipse_pipeline.dipole import (
    REACH_KA,
    SERIES_MEMBER,
    dipole_file,
    parse_series,
    series_from_zip,
)
from tests.json_values import json_round_trip

TEXT = """Age [ka BP]  DM [x10^22 Am^2]
100.00\t4.21899
55.05\t5.00000
40.85\t2.46478
0.05\t7.91000
0.00\t7.90000
"""


def test_reads_the_rows_youngest_first() -> None:
    assert parse_series(TEXT) == [
        (0.0, 7.9),
        (0.05, 7.91),
        (40.85, 2.46478),
        (55.05, 5.0),
        (100.0, 4.21899),
    ]


def test_refuses_an_empty_table_and_a_repeated_age() -> None:
    with pytest.raises(ValueError, match="no rows"):
        _ = parse_series("Age [ka BP]  DM [x10^22 Am^2]\n")
    with pytest.raises(ValueError, match="twice"):
        _ = parse_series("1.0 7.0\n1.0 7.1\n")


def test_keeps_the_radiocarbon_reach_as_columns() -> None:
    built = dipole_file(parse_series(TEXT), "2026-11-08")
    assert json_round_trip(built) == built
    assert built["ka"] == [0.0, 0.05, 40.85]
    assert built["dipole"] == [7.9, 7.91, 2.4648]
    assert REACH_KA == 55


def test_reads_the_table_out_of_the_models_zip() -> None:
    packed = io.BytesIO()
    with zipfile.ZipFile(packed, "w") as archive:
        archive.writestr(SERIES_MEMBER, TEXT)
    assert series_from_zip(packed.getvalue()) == TEXT
