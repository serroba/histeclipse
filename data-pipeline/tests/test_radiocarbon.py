"""The radiocarbon calibration curves, read from the IntCal group's text files."""

from __future__ import annotations

import pytest

from histeclipse_pipeline.radiocarbon import CURVES, parse_curve, radiocarbon_file
from tests.json_values import json_round_trip

TEXT = """##Atmospheric data from Reimer et al (2020)
# Radiocarbon 62. doi: 10.1017/RDC.2020.41.
# CAL BP, 14C age,Sigma,Delta 14C,Sigma
2,195,11,-23.8,1.4
1,197,11,-24.1,1.4
0,199,11,-24.5,1.4
"""


def test_reads_the_rows_youngest_first() -> None:
    curve = parse_curve(TEXT)
    assert curve.cal_bp == (0, 1, 2)
    assert curve.age == (199, 197, 195)
    assert curve.sigma == (11, 11, 11)
    assert curve.delta == (-24.5, -24.1, -23.8)
    assert curve.delta_sigma == (1.4, 1.4, 1.4)


def test_writes_a_negative_zero_as_zero() -> None:
    assert str(parse_curve("0,199,11,-0.0,1.4\n").delta[0]) == "0.0"


def test_refuses_a_row_of_the_wrong_shape_an_empty_file_and_a_repeated_age() -> None:
    with pytest.raises(ValueError, match="not 5"):
        _ = parse_curve("0,199,11\n")
    with pytest.raises(ValueError, match="no rows"):
        _ = parse_curve("# only comments\n")
    with pytest.raises(ValueError, match="twice"):
        _ = parse_curve("0,199,11,-24.5,1.4\n0,199,11,-24.5,1.4\n")


def test_the_file_cites_each_curve_and_keeps_its_columns() -> None:
    [north, south] = CURVES
    assert north.key == "intcal20"
    assert south.key == "shcal20"
    made = json_round_trip(radiocarbon_file({"intcal20": (north, parse_curve(TEXT))}, "2026-11-07"))
    assert isinstance(made, dict)
    curves = made["curves"]
    assert isinstance(curves, dict)
    curve = curves["intcal20"]
    assert isinstance(curve, dict)
    assert curve["doi"] == "10.1017/RDC.2020.41"
    assert curve["calBP"] == [0, 1, 2]
    assert curve["deltaSigma"] == [1.4, 1.4, 1.4]
