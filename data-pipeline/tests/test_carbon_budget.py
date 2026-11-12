import io
import json
from typing import TYPE_CHECKING, cast

import pytest
from openpyxl import Workbook

from histeclipse_pipeline.carbon_budget import (
    SIGMA,
    Budget,
    Place,
    budget_file,
    build,
    read_budget,
    read_long,
    rounded,
    section_of,
)

if TYPE_CHECKING:
    from pathlib import Path

    from openpyxl.worksheet.worksheet import Worksheet

NOTES = [f"Some note: {words}, more words." for _, words in SIGMA.values()]


YEARS: list[list[object]] = [
    [1750, 0.0025398, None, None, None, 0.1855],
    ["1751", "0.0025676", None, -0.07434, None, -0.6189],
    # The years between are missing.
    [2025, 10.6427690728712, 1.18787666666667, 4.37544, 3.19, 3.636, 0.163, 0.4656],
    [2026, 10.591153609, 1.3869, 4.595, 3.1304, 4.098, 0.15445, 0],
    [None, "a footnote"],
]


def workbook(
    notes: list[str] | None = None, rows: list[list[object]] | None = None, *, heading: bool = True
) -> bytes:
    """A small workbook like the budget's: the notes sheet, and the historical one."""
    book = Workbook()
    first = book.active
    assert first is not None
    first.title = "Summary"
    budget = cast("Worksheet", book.create_sheet("Global Carbon Budget"))
    budget.append([None, "Global Carbon Budget"])
    for note in NOTES if notes is None else notes:
        budget.append([None, note])
    history = cast("Worksheet", book.create_sheet("Historical Budget"))
    history.append([None, "Historical CO2 budget"])
    history.append(["GtC/yr"])
    if heading:
        history.append(["Year", "fossil", "land-use change", "atmospheric growth"])
    for row in YEARS if rows is None else rows:
        history.append(row)
    out = io.BytesIO()
    book.save(out)
    return out.getvalue()


def test_rounds_to_four_figures_and_whole_numbers_to_ints() -> None:
    assert rounded(10.6427690728712) == 10.64
    assert rounded(0.000123456) == 0.0001235
    assert rounded(0.0) == 0
    assert isinstance(rounded(0.0), int)
    assert rounded(None) is None
    assert rounded(float("nan")) is None


def test_reads_the_historical_budget_with_the_uncertainties_its_notes_give() -> None:
    budget = read_budget(workbook())
    assert budget.first == 1750
    assert budget.rows[0] == [0.00254, None, None, None, 0.1855, None, None]
    # Text cells are read as numbers; a short row is padded; a missing year is all None.
    assert budget.rows[1] == [0.002568, None, -0.07434, None, -0.6189, None, None]
    assert budget.rows[2] == [None] * 7
    assert len(budget.rows) == 2026 - 1750 + 1
    assert budget.rows[-1] == [10.59, 1.387, 4.595, 3.13, 4.098, 0.1545, 0]


def test_refuses_a_budget_whose_notes_change_an_uncertainty() -> None:
    with pytest.raises(ValueError, match="landUse"):
        _ = read_budget(workbook(notes=[note for note in NOTES if "land-use" not in note]))


def test_refuses_a_budget_without_its_heading_or_years() -> None:
    with pytest.raises(ValueError, match="heading"):
        _ = read_budget(workbook(heading=False))
    with pytest.raises(ValueError, match="no years"):
        _ = read_budget(workbook(rows=[[None, "nothing"], ["n/a", 1.0], [True, 1.0]]))


def test_writes_the_budget_with_its_units_uncertainties_and_projection() -> None:
    written = budget_file(read_budget(workbook()))
    assert written["licence"] == "CC BY 4.0"
    assert written["unit"] == "GtC/yr"
    assert written["first"] == 1750
    assert written["budgetFrom"] == 1959
    assert written["projected"] == [2026]
    assert written["sigma"] == {
        "fossil": {"relative": 0.05},
        "landUse": {"gtc": 0.7},
        "atmosphere": {"gtc": 0.2, "from": 1980},
        "ocean": {"gtc": 0.6},
        "land": {"gtc": 0.7},
    }
    # A budget that ends before its release year projects nothing.
    assert budget_file(Budget(1750, [[None] * 7]))["projected"] == []


HEADER = '"CNTR_NAME","ISO3","Gas","Component","Year","Data","Unit"\n'


def long_file(rows: list[str]) -> str:
    return HEADER + "".join(f"{row}\n" for row in rows)


EMISSIONS = long_file(
    [
        '"USA","USA","CO[2]","Fossil",1849,0.001,"Pg~CO[2]~year^-1"',
        '"USA","USA","CO[2]","Fossil",1850,0.0012345,"Pg~CO[2]~year^-1"',
        '"USA","USA","CO[2]","Fossil",1851,0.0013,"Pg~CO[2]~year^-1"',
        '"USA","USA","CO[2]","LULUCF",1850,0.2,"Pg~CO[2]~year^-1"',
        '"USA","USA","CH[4]","Total",1851,1.5,"Tg~CH[4]~year^-1"',
        '"USA","USA","N[2]*O","Total",1850,NA,"Tg~N[2]*O~year^-1"',
        '"USA","USA","SF[6]","Total",1850,1,"Gg"',
        '"Kosovo","KSV","CO[2]","Fossil",1850,0,"Pg~CO[2]~year^-1"',
        '"EIT","EIT","CO[2]","Fossil",1850,0.1,"Pg~CO[2]~year^-1"',
        '"GLOBAL","GLOBAL","CO[2]","Fossil",1850,0.2,"Pg~CO[2]~year^-1"',
    ]
)
WARMING = long_file(
    [
        '"USA","USA","3-GHG","Fossil",1851,0.000233872770505294,"°C"',
        '"USA","USA","3-GHG","LULUCF",1851,0.0001,"°C"',
        '"USA","USA","CO[2]","Total",1851,0.0003,"°C"',
        '"USA","USA","3-GHG","Fossil",1852,0.0004,"°C"',
    ]
)


def test_reads_a_long_file_by_place_series_and_year() -> None:
    places: dict[str, Place] = {}
    assert read_long(EMISSIONS, places) == (1849, 1851)
    usa = places["USA"]
    assert usa.name == "USA"
    assert usa.series["co2", "fossil"][1850] == pytest.approx(0.0012345)
    assert usa.series["n2o", "total"][1850] is None
    assert ("sf6", "total") not in usa.series
    with pytest.raises(ValueError, match="no rows"):
        _ = read_long(HEADER, {})


def test_keeps_countries_by_iso_code_apart_from_other_places_and_groups() -> None:
    assert section_of("USA") == "countries"
    assert section_of("KSV") == "others"
    assert section_of("EIT") == "groups"
    assert section_of("GLOBAL") == "groups"


def test_writes_the_global_and_national_files(tmp_path: Path) -> None:
    out = tmp_path / "carbon"
    years, countries = build(workbook(), EMISSIONS.encode("utf-8"), WARMING.encode("utf-8"), out)
    assert (years, countries) == (277, 1)
    budget = json.loads((out / "global.json").read_text())  # pyright: ignore[reportAny]
    assert budget["schemaVersion"] == 1
    emissions = json.loads((out / "national-emissions.json").read_text())  # pyright: ignore[reportAny]
    assert emissions["first"] == 1850
    assert emissions["series"] == ["co2Fossil", "co2Land", "ch4", "n2o"]
    assert emissions["units"][0] == "Mt CO2/yr"
    # Pg to Mt, from 1850 (not the file's 1849), four figures; null where the file has none.
    assert emissions["countries"]["USA"] == {
        "name": "USA",
        "values": [[1.234, 1.3], [200, None], [None, 1.5], [None, None]],
    }
    # Kosovo has no ISO code, and EIT is a grouping, though its code looks like a country's.
    assert emissions["others"] == {
        "KSV": {"name": "Kosovo", "values": [[0, None], [None, None], [None, None], [None, None]]}
    }
    assert "EIT" in emissions["groups"]
    assert "GLOBAL" in emissions["groups"]
    warming = json.loads((out / "national-warming.json").read_text())  # pyright: ignore[reportAny]
    assert warming["first"] == 1851
    assert warming["since"] == 1850
    assert warming["unit"] == "°C"
    assert warming["countries"]["USA"]["values"] == [
        [0.0002339, 0.0004],
        [0.0001, None],
        [0.0003, None],
        [None, None],
        [None, None],
    ]
