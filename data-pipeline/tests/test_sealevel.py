import io
import json
from typing import TYPE_CHECKING

from openpyxl import Workbook

from histeclipse_pipeline.sealevel import (
    Series,
    bintanja,
    miller,
    noaa_table,
    pangaea_table,
    spratt,
    van_der_meer,
    write_sealevel,
)

if TYPE_CHECKING:
    from pathlib import Path

NOAA_HEAD = "# NOAA template\n## age_calkaBP\tage\n#------\n"


def test_reads_a_noaa_table() -> None:
    rows = noaa_table(NOAA_HEAD + "a\tb\n1\t2\n\n3\t4\n")
    assert rows == [{"a": "1", "b": "2"}, {"a": "3", "b": "4"}]


def test_reads_a_pangaea_export() -> None:
    text = "/* DATA DESCRIPTION:\nCitation:\tMiller\n*/\nAge [ka BP]\tSea lev rel [m]\n980\t-33.0\n"
    assert pangaea_table(text) == [["980", "-33.0"]]


def test_reads_the_spratt_stack_with_its_range_and_skips_gaps() -> None:
    columns = [
        "age_calkaBP",
        "SeaLev_longPC1",
        "SeaLev_longPC1_err_lo",
        "SeaLev_longPC1_err_up",
    ]
    text = (
        NOAA_HEAD
        + "\t".join(columns)
        + "\n0\t8.96\t-1.21\t20.38\n1\t7.72\t-2.77\t17.1\n799\tNaN\tNaN\tNaN\n"
    )
    series = spratt(text)
    assert series.ages == [0, 1]
    assert series.level == [9.0, 7.7]
    assert (series.low, series.high) == ([-1.2, -2.8], [20.4, 17.1])
    assert series.note is not None
    assert "+9 m" in series.note


def test_thins_bintanja_to_thousands_of_years_and_turns_its_sign() -> None:
    text = NOAA_HEAD + "age_calkaBP\tRSL\n0.00000\t0.0\n0.10010\t1.507\n20.000\t123.39\n"
    series = bintanja(text)
    # A fall below today in the source; a height above today here.
    assert (series.ages, series.level) == ([0.0, 20.0], [0.0, -123.4])
    assert str(series.level[0]) == "0.0"


def test_reads_miller_in_thousands_of_years() -> None:
    text = "/* x */\nAge [ka BP]\tSea lev rel [m]\n980\t-33.0\n64820\t59.14\n"
    series = miller(text)
    assert (series.ages, series.level, series.low) == ([980.0, 64820.0], [-33.0, 59.1], None)


def test_reads_van_der_meer_from_its_table() -> None:
    book = Workbook()
    sheet = book.active
    assert sheet is not None
    sheet.append([None] * 37)
    sheet.append(["", "Fig2a"] + [None] * 35)
    sheet.append(["Ma"] + ["x"] * 36)
    sheet.append([None] + ["AVG"] * 36)
    sheet.append([0] + [0.0] * 33 + [0.0, -5.0, 5.0])
    sheet.append([540] + [1.0] * 33 + [123.45, 80.0, 160.0])
    sheet.append(["Notes: see the article"] + [None] * 36)  # skipped
    out = io.BytesIO()
    book.save(out)
    series = van_der_meer(out.getvalue())
    assert series.ages == [0.0, 540_000.0]
    assert series.level == [0.0, 123.5]
    assert (series.low, series.high) == ([-5.0, 80.0], [5.0, 160.0])


def test_writes_every_series(tmp_path: Path) -> None:
    plain = Series("a", "A", "m", "s", "https://x", "CC BY 4.0", None, [0.0, 1.0], [0.0, -1.0])
    ranged = Series("b", "B", "m", "s", "https://y", "CC0", "careful", [0.0], [9.0], [1.0], [20.0])
    assert write_sealevel([plain, ranged], tmp_path) == 3
    index = json.loads((tmp_path / "index.json").read_text())  # pyright: ignore[reportAny]
    first, second = index["series"]  # pyright: ignore[reportAny]
    assert "note" not in first
    assert "low" not in first
    assert second["note"] == "careful"
    assert (second["low"], second["high"]) == ([1.0], [20.0])
