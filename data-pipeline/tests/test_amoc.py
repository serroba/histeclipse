"""Tests for the AMOC: RAPID's measurements and the reconstructions, each kept apart."""

import io
from typing import TYPE_CHECKING, cast

import h5py
import numpy as np
from openpyxl import Workbook

from histeclipse_pipeline.amoc import (
    CAESAR_SHEET,
    MONTH_SAMPLES,
    RAHMSTORF_SHEET,
    TERHAAR_SHEET,
    THORNALLEY_SHEET,
    compilation,
    monthly_means,
    rapid,
    terhaar,
    write_amoc,
)
from tests.json_values import read_json

if TYPE_CHECKING:
    from pathlib import Path

    from openpyxl.worksheet.worksheet import Worksheet


def _rapid_file(days: list[float], moc: list[float]) -> bytes:
    out = io.BytesIO()
    with h5py.File(out, "w") as opened:
        _ = opened.create_dataset("time", data=np.asarray(days))
        _ = opened.create_dataset("moc_mar_hc10", data=np.asarray(moc))
    return out.getvalue()


def test_averages_rapid_by_month_and_leaves_out_thin_months_and_gaps() -> None:
    # April 2004: 60 readings of 17 Sv, one of them missing (-99999); May: too few.
    april = [0.5 * at for at in range(60)]
    may = [30.0 + 0.5 * at for at in range(MONTH_SAMPLES - 1)]
    moc = [17.0] * 59 + [-99999.0] + [12.0] * len(may)
    years, means = monthly_means(np.asarray(april + may), np.asarray(moc))
    assert years == [round(2004 + 3 / 12 + 1 / 24, 3)]
    assert means == [17.0]


def test_reads_rapids_file() -> None:
    days = [0.5 * at for at in range(60)]
    series = rapid(_rapid_file(days, [18.25] * 60))
    assert series.id == "rapid"
    assert series.units == "Sv"
    assert series.values == [18.25]
    assert series.low is None


def _sheet(book: Workbook, title: str, heading: list[str], rows: list[list[object]]) -> None:
    sheet = cast("Worksheet", book.create_sheet(title))
    sheet.append(["Source: someone"])
    sheet.append(heading)
    for row in rows:
        sheet.append(row)


def _compilation() -> bytes:
    book = Workbook()
    book.remove(cast("Worksheet", book.active))
    _sheet(
        book,
        CAESAR_SHEET,
        ["year", "AMOC proxy [K]", "lower", "upper"],
        [[1871, -8.4395, -8.6995, -8.1795], [1872, "n/a", None, None]],
    )
    # Rahmstorf's lower column is the value's negative: the range comes from the 2-sigma.
    _sheet(
        book,
        RAHMSTORF_SHEET,
        ["year", "Amoc Index [K]", "2-sigma", "lower", "upper"],
        [[900, 0.5, 0.25, -0.5, 0.75]],
    )
    # Thornalley's lower and upper are swapped.
    _sheet(
        book,
        THORNALLEY_SHEET,
        ["year", "Tsub", "2-sigma", "lower", "upper"],
        [[400, 2.0, 3.0, 5.0, -1.0], [401, 1.9, 3.0, 4.9, -1.1]],
    )
    out = io.BytesIO()
    book.save(out)
    return out.getvalue()


def test_reads_the_compilation_with_ranges_from_the_two_sigma() -> None:
    caesar, rahmstorf, thornalley = compilation(_compilation())
    assert caesar.years == [1871]
    assert caesar.values == [-8.44]
    assert caesar.low == [-8.7]
    assert caesar.high == [-8.18]
    assert rahmstorf.low == [0.25]
    assert rahmstorf.high == [0.75]
    assert thornalley.years == [400, 401]
    assert thornalley.low == [-1.0, -1.1]
    assert thornalley.high == [5.0, 4.9]


def _terhaar() -> bytes:
    book = Workbook()
    sheet = cast("Worksheet", book.active)
    sheet.title = TERHAAR_SHEET
    sheet.append(["Year", "EAR5", None, "JRA-55", None, None, "All units are in Sv"])
    sheet.append([None, "Mean", "Std-dev", "Mean", "Std-dev"])
    sheet.append([1963.5, 0.472666743956718, 0.671395041200177, 0.138269124303471, 0.67])
    out = io.BytesIO()
    book.save(out)
    return out.getvalue()


def test_copies_terhaars_values_unrounded() -> None:
    era5, jra55 = terhaar(_terhaar())
    assert era5.id == "terhaar-2025-era5"
    assert jra55.id == "terhaar-2025-jra55"
    assert era5.years == [1963.5]
    assert era5.values == [0.472666743956718]
    assert era5.std == [0.671395041200177]
    assert jra55.values == [0.138269124303471]
    assert era5.low is None


def test_writes_every_series_with_its_credit(tmp_path: Path) -> None:
    days = [0.5 * at for at in range(60)]
    series = [
        rapid(_rapid_file(days, [17.0] * 60)),
        *compilation(_compilation()),
        *terhaar(_terhaar()),
    ]
    points = write_amoc(series, tmp_path, "2026-11-12")
    assert points == 1 + 1 + 1 + 2 + 1 + 1
    index = read_json(tmp_path / "index.json")
    assert isinstance(index, dict)
    assert index["schemaVersion"] == 1
    assert index["accessed"] == "2026-11-12"
    assert isinstance(index["credit"], str)
    assert "RAPID" in index["credit"]
    listed = index["series"]
    assert isinstance(listed, list)
    ids = [each["id"] for each in listed if isinstance(each, dict)]
    assert ids == [
        "rapid",
        "caesar-2018",
        "rahmstorf-2015",
        "thornalley-2018",
        "terhaar-2025-era5",
        "terhaar-2025-jra55",
    ]
    first, caesar, *_, era5, _ = (each for each in listed if isinstance(each, dict))
    assert "low" not in first
    assert caesar["low"] == [-8.7]
    assert era5["std"] == [0.671395041200177]
    assert "low" not in era5
