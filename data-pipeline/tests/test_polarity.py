"""The polarity time scale, read from PmagPy's source without running it."""

from __future__ import annotations

import pytest

from histeclipse_pipeline.polarity import PolarityScale, checked, polarity_file, read_scale

SOURCE = '''
import os


def get_ts(ts):
    """returns GPTS timescales."""
    if ts == 'ck95':
        TS = [0, 0.78]
        Labels = [['C1n', 0]]
        return TS, Labels
    if ts == 'gts20':
        TS = [0., 0.773, 0.99,
              1.07]
        Labels = [['C1n', 0.0], ['C1r', 0.773]]
        return TS, Labels
    raise ValueError(ts)


def get_ts_but_not_this():
    os.system("never run")
'''


def test_reads_the_scale_asked_for_from_the_syntax_tree() -> None:
    scale = read_scale(SOURCE)
    assert scale.boundaries == (0.0, 0.773, 0.99, 1.07)
    assert scale.chrons == (("C1n", 0.0), ("C1r", 0.773))
    assert read_scale(SOURCE, "ck95").boundaries == (0.0, 0.78)


def test_a_missing_scale_or_function_is_an_error() -> None:
    with pytest.raises(ValueError, match="no gts99"):
        _ = read_scale(SOURCE, "gts99")
    with pytest.raises(ValueError, match="no get_ts"):
        _ = read_scale("x = 1\n")


def test_ages_must_start_at_today_and_rise() -> None:
    with pytest.raises(ValueError, match="start at 0"):
        _ = checked([0.5, 1.0], [])
    with pytest.raises(ValueError, match="rise"):
        _ = checked([0, 2.0, 1.0], [])
    with pytest.raises(TypeError, match="lists"):
        _ = checked("0, 1", [])
    with pytest.raises(TypeError, match="a name and an age"):
        _ = checked([0, 1], [[1, "C1n"]])


def test_the_file_credits_the_scale_and_its_carrier() -> None:
    made = polarity_file(PolarityScale((0.0, 0.773), (("C1n", 0.0),)), "2026-11-07")
    assert made["boundaries"] == [0.0, 0.773]
    assert made["chrons"] == [{"name": "C1n", "young": 0.0}]
    assert "GTS 2020" in str(made["credit"])
    assert str(made["source"]).startswith("https://github.com/PmagPy/PmagPy/blob/")
