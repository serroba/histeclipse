from typing import TYPE_CHECKING

import pytest

from histeclipse_pipeline import cli
from histeclipse_pipeline.delta_t import (
    DELTA_T_MODEL,
    delta_t_table,
    epoch_year_jd,
    uncertainty_seconds,
    write_delta_t_table,
)
from tests.json_values import json_round_trip, read_json

if TYPE_CHECKING:
    from pathlib import Path


def test_samples_every_year() -> None:
    table = delta_t_table(-620, -600)
    assert table["model"] == DELTA_T_MODEL
    assert (table["startYear"], table["stepYears"]) == (-620, 1)
    assert len(table["seconds"]) == len(table["uncertaintySeconds"]) == 21


@pytest.mark.parametrize(
    ("year", "seconds", "tolerance"),
    [
        # The catalog's own ΔT for the 621 BCE and 2025 eclipses (tests/test_lunar.py).
        (-620, 18_781, 10),
        (2025, 69.1, 0.5),
        # Year 0 (1 BCE): about 2.9 hours.
        (0, 10_441, 10),
    ],
)
def test_matches_known_values(year: int, seconds: float, tolerance: float) -> None:
    assert delta_t_table(year, year)["seconds"][0] == pytest.approx(seconds, abs=tolerance)


def test_epoch_year_jd() -> None:
    assert epoch_year_jd(2000) == 2_451_545.0
    assert epoch_year_jd(1900) == 2_415_020.0


@pytest.mark.parametrize(
    ("year", "sigma"),
    [(1820, 1.0), (2020, 3.2), (-620, 476.3), (-4000, 2_709.8)],
)
def test_uncertainty_grows_with_distance_from_1820(year: int, sigma: float) -> None:
    assert uncertainty_seconds(year) == pytest.approx(sigma, abs=0.1)


@pytest.mark.parametrize(("start", "end", "step"), [(10, 0, 1), (0, 10, 0), (0, 10, 3)])
def test_rejects_bad_ranges(start: int, end: int, step: int) -> None:
    with pytest.raises(ValueError, match="Bad range"):
        _ = delta_t_table(start, end, step)


def test_writes_json(tmp_path: Path) -> None:
    table = delta_t_table(2000, 2002)
    path = tmp_path / "nested" / "delta-t.json"
    write_delta_t_table(table, path)
    assert read_json(path) == json_round_trip(table)


def test_cli_writes_table(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    out = tmp_path / "delta-t.json"
    args = ["delta-t", "--out", str(out), "--start-year", "1999", "--end-year", "2001"]
    assert cli.main(args) == 0
    assert "wrote ΔT for 1998..2002" in capsys.readouterr().out
    document = read_json(out)
    assert isinstance(document, dict)
    assert document["startYear"] == 1998
    seconds = document["seconds"]
    assert isinstance(seconds, list)
    assert seconds[1:4] == [63.47, 63.83, 64.09]
