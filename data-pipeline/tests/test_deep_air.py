"""Tests for CO2 and O2 over the last 540 million years."""

import io
from typing import TYPE_CHECKING, cast

from openpyxl import Workbook

if TYPE_CHECKING:
    from openpyxl.worksheet.worksheet import Worksheet

from histeclipse_pipeline.deep_air import (
    Estimate,
    co2_estimates,
    co2_fit,
    deep_air_file,
    o2_estimate,
)


def _book(*sheets: list[list[object]]) -> bytes:
    book = Workbook()
    first = book.active
    assert first is not None
    book.remove(first)
    for index, rows in enumerate(sheets):
        sheet = cast("Worksheet", book.create_sheet(f"sheet{index}"))
        for row in rows:
            sheet.append(row)
    out = io.BytesIO()
    book.save(out)
    return out.getvalue()


def _block(name: str, *rows: tuple[object, ...]) -> list[list[object]]:
    """A proxy's block as the compilation lays it out: name, headings, units, data."""
    return [
        [name, *[None] * 8],
        ["Reference", "Age", "Age", "Age", "Age", "CO2", "type", "CO2 low", "CO2 high"],
        ["", "description", "(Ma)", "old", "young", "(ppm)", "", "(ppm)", "(ppm)"],
        [None] * 9,
        *[list(row) for row in rows],
    ]


def test_reads_each_proxys_estimates_oldest_first() -> None:
    paleosols = _block(
        "PALEOSOLS (d13C)",
        ("Royer 2001", "Eocene", 50.0, 52, 48, 1200, "mean", 600, 2400),
        ("Nordt 2002", "Permian", 280.0, 281, 279, 900, "mean", None, None),
        ("Note", None, None, None, None, None, None, None, None),
    )
    boron = _block(
        "MARINE BORON (d11B)", ("Foster 2012", "Pliocene", 3.2, 3.3, 3.1, 390, "mean", 350, 420)
    )
    boron += [[None] * 9] * (len(paleosols) - len(boron))
    proxies = [[*left, None, *right] for left, right in zip(paleosols, boron, strict=True)]
    data = _book([["Notes"]], [["Supplementary Data 1."], *proxies])
    found = co2_estimates(data)
    assert found == {
        "Paleosols": [Estimate(280.0, 900.0, None, None), Estimate(50.0, 1200.0, 600.0, 2400.0)],
        "Boron": [Estimate(3.2, 390.0, 350.0, 420.0)],
    }


def test_keeps_the_fit_every_million_years_with_no_negative_co2() -> None:
    data = _book(
        [
            ["Supplementary Data 2."],
            ["Age (Ma)", "best", "lw95%", "lw68%", "up68%", "up95%"],
            [0.0039, 276.0, 175.5, 230.6, 306.4, 342.7],
            [0.5039, 280.0, 180.0, 235.0, 310.0, 345.0],
            [419.0039, 1414.0, -452.6, 471.5, 2587.4, 3588.9],
        ]
    )
    assert co2_fit(data) == [
        (0, 276.0, 175.5, 230.6, 306.4, 342.7),
        (419, 1414.0, 0, 471.5, 2587.4, 3588.9),
    ]


def test_reads_the_o2_estimate_by_age_from_negative_time() -> None:
    data = _book([["Time", "Mid", "Min", "Max"], [-541, 5.65, 0.07, 15.3], [0, 20.6, 18.2, 28.0]])
    assert o2_estimate(data) == [(0, 20.6, 18.2, 28.0), (541, 5.65, 0.07, 15.3)]


def test_the_site_file_has_the_fit_the_estimates_by_proxy_and_o2() -> None:
    data = deep_air_file(
        {"Stomata": [Estimate(409.2, 2836.4, 2505.0, None)]},
        [(0, 276.4, 175.5, 230.6, 306.4, 342.7)],
        [(0, 20.645, 18.164, 27.961)],
    )
    co2 = data["co2"]
    assert isinstance(co2, dict)
    assert co2["fit"] == [[0, 276, 176, 231, 306, 343]]
    assert co2["proxies"] == [{"name": "Stomata", "estimates": [[409.2, 2836, 2505, None]]}]
    o2 = data["o2"]
    assert isinstance(o2, dict)
    assert o2["points"] == [[0, 20.64, 18.16, 27.96]]
