import shutil
from typing import TYPE_CHECKING

import pytest

from histeclipse_pipeline import cli
from histeclipse_pipeline.delta_t import epoch_year_jd
from histeclipse_pipeline.vectors import sample_times, sun_vectors, write_vectors
from tests.json_values import read_json
from tests.kernels import ANCIENT, MODERN

if TYPE_CHECKING:
    from pathlib import Path

# 2025 Mar 20 09:01 UT, the March equinox: the Sun is overhead on the equator.
EQUINOX_2025 = 2_460_754.876


def test_sample_times_are_spread_and_reproducible() -> None:
    times = sample_times(-1000, 1000, 5, seed=1)
    assert times == sample_times(-1000, 1000, 5, seed=1)
    assert times != sample_times(-1000, 1000, 5, seed=2)
    for index, jd in enumerate(times):
        year = -1000 + index * 500
        assert epoch_year_jd(year) <= jd < epoch_year_jd(year + 1)


def test_sun_is_over_the_equator_at_the_equinox() -> None:
    [vector] = sun_vectors([MODERN], [EQUINOX_2025])
    assert vector["subsolarLatitude"] == pytest.approx(0, abs=0.01)
    assert (vector["jdTT"] - vector["jdUT"]) * 86_400 == pytest.approx(69.2, abs=0.5)
    assert 0 <= vector["gmstHours"] < 24
    # The equation of the equinoxes is at most about a second of time.
    assert abs(vector["gastHours"] - vector["gmstHours"]) < 1.5 / 3600


def test_picks_the_kernel_covering_each_time() -> None:
    vectors = sun_vectors([ANCIENT, MODERN], [1_494_714.5, EQUINOX_2025])
    # 621 BCE April 22 (Julian), about a month after the March equinox: the Sun is north.
    assert 8 < vectors[0]["subsolarLatitude"] < 13
    assert vectors[1]["subsolarLatitude"] == pytest.approx(0, abs=0.01)


def test_rejects_times_no_kernel_covers() -> None:
    with pytest.raises(ValueError, match="No kernel covers"):
        _ = sun_vectors([MODERN], [2_451_545.0])


def test_writes_one_vector_per_line(tmp_path: Path) -> None:
    vectors = sun_vectors([MODERN], [EQUINOX_2025, EQUINOX_2025 + 1])
    path = tmp_path / "sun.json"
    write_vectors(vectors, path, "test vectors")
    assert read_json(path) == {"description": "test vectors", "vectors": vectors}
    assert len(path.read_text().splitlines()) == 7


def test_cli_writes_vectors(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    def one_time(_start: int, _end: int, _count: int, _seed: int) -> list[float]:
        return [EQUINOX_2025]

    monkeypatch.setattr(cli, "sample_times", one_time)
    _ = shutil.copy(MODERN, tmp_path)
    out = tmp_path / "sun.json"
    assert cli.main(["sun-vectors", "--kernels", str(tmp_path), "--out", str(out)]) == 0
    assert "wrote 1 Sun vectors" in capsys.readouterr().out


def test_cli_reports_uncovered_range(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    _ = shutil.copy(MODERN, tmp_path)
    args = ["sun-vectors", "--kernels", str(tmp_path), "--out", str(tmp_path / "x.json")]
    assert cli.main([*args, "--count", "3"]) == 1
    assert "do not cover the range" in capsys.readouterr().err
