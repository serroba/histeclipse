import shutil
from typing import TYPE_CHECKING

import pytest

from histeclipse_pipeline import cli
from tests.json_values import read_json
from tests.kernels import MODERN, TOTAL_2024

if TYPE_CHECKING:
    from pathlib import Path


def test_lunar_catalog_end_to_end(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    # The fixture only covers 2025 Mar 1 - Sep 20, so search that window instead of whole years.
    starts = {2025: 2_460_745.5, 2026: 2_460_930.5}
    monkeypatch.setattr(cli, "year_start_jd", starts.__getitem__)
    kernels = tmp_path / "kernels"
    kernels.mkdir()
    _ = shutil.copy(MODERN, kernels)

    exit_code = cli.main(
        [
            "lunar-catalog",
            "--kernels",
            str(kernels),
            "--out",
            str(tmp_path / "out"),
            "--start-year",
            "2025",
            "--end-year",
            "2025",
        ]
    )

    assert exit_code == 0
    assert "wrote 2 lunar eclipses in 1 files" in capsys.readouterr().out
    chunk = read_json(tmp_path / "out" / "2000.json")
    assert isinstance(chunk, list)
    assert [record["kind"] for record in chunk if isinstance(record, dict)] == ["total", "total"]


def test_reports_missing_kernels(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    exit_code = cli.main(["lunar-catalog", "--kernels", str(tmp_path), "--out", str(tmp_path)])
    assert exit_code == 1
    assert "run fetch-ephemeris first" in capsys.readouterr().err


def test_reports_kernels_that_do_not_cover_the_range(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    _ = shutil.copy(MODERN, tmp_path)
    exit_code = cli.main(
        [
            "lunar-catalog",
            "--kernels",
            str(tmp_path),
            "--out",
            str(tmp_path / "out"),
            "--start-year",
            "2025",
            "--end-year",
            "2025",
        ]
    )
    assert exit_code == 1
    assert "do not cover the range" in capsys.readouterr().err


@pytest.mark.parametrize(
    ("year", "jd"), [(-620, 1_494_602.5), (1582, 2_298_883.5), (2025, 2_460_676.5)]
)
def test_year_start_uses_the_calendar_in_force(year: int, jd: float) -> None:
    assert cli.year_start_jd(year) == jd


def test_defaults_apply_when_options_are_omitted(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    seen: list[int] = []

    def record(year: int) -> float:
        seen.append(year)
        return 0.0

    monkeypatch.setattr(cli, "year_start_jd", record)
    _ = shutil.copy(MODERN, tmp_path)
    _ = cli.main(["lunar-catalog", "--kernels", str(tmp_path), "--out", str(tmp_path)])
    assert seen == [cli.DEFAULT_START_YEAR, cli.DEFAULT_END_YEAR + 1]


def test_solar_catalog_end_to_end(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    # The fixture covers 2024 March 29 - April 18; search inside it instead of whole years.
    starts = {2024: 2_460_405.5, 2025: 2_460_412.5}
    monkeypatch.setattr(cli, "year_start_jd", starts.__getitem__)
    kernels = tmp_path / "kernels"
    kernels.mkdir()
    _ = shutil.copy(TOTAL_2024, kernels)
    args = ["solar-catalog", "--kernels", str(kernels), "--out", str(tmp_path / "out")]
    assert cli.main([*args, "--start-year", "2024", "--end-year", "2024"]) == 0
    assert "wrote 1 solar eclipses in 1 files" in capsys.readouterr().out


def test_solar_catalog_reports_missing_or_insufficient_kernels(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    args = ["solar-catalog", "--kernels", str(tmp_path), "--out", str(tmp_path / "out")]
    assert cli.main(args) == 1
    assert "run fetch-ephemeris first" in capsys.readouterr().err
    _ = shutil.copy(TOTAL_2024, tmp_path)
    assert cli.main([*args, "--start-year", "2024", "--end-year", "2024"]) == 1
    assert "do not cover the range" in capsys.readouterr().err
