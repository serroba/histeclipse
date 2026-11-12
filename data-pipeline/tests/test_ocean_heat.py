import io
import zipfile
from typing import TYPE_CHECKING

import pytest

from histeclipse_pipeline.ocean_heat import (
    IGCC_TABLE,
    iap,
    iap_annual,
    igcc_table,
    index_file,
    inventory,
    ncei,
    ncei_table,
    rebased,
    write_ocean_heat,
)
from tests.json_values import json_round_trip, read_json

if TYPE_CHECKING:
    from pathlib import Path

IAP_HEAD = "%%% Global Ocean Heat Content estimate\n%%% unit of OHC:  *10^22 Joules\n\n[year] ...\n"


def iap_row(year: int, month: int, upper: float, error: float) -> str:
    """One IAP month: 0-700 m, 700-2000 m, 0-2000 m and 2000-6000 m, each value/smoothed/error."""
    cells = [upper, float("nan"), error, 1.0, float("nan"), 0.1]
    cells += [upper + 1.0, float("nan"), error * 2, float("nan"), float("nan"), float("nan")]
    return "\t".join([str(year), str(month), *(f"{cell:.2f}" for cell in cells)]) + "\n"


def iap_text(years: range, upper: float = 1.0, error: float = 0.5) -> str:
    body = "".join(
        iap_row(year, month, upper + (year - 2006), error)
        for year in years
        for month in range(1, 13)
    )
    return IAP_HEAD + body


def test_averages_iap_months_into_years_in_zj() -> None:
    text = IAP_HEAD + "".join(
        iap_row(2006, month, float(month), 0.1 * month) for month in range(1, 13)
    )
    layers = iap_annual(text)
    year, value, error = layers["0-700 m"][0]
    assert year == 2006
    assert value == pytest.approx(65.0)  # mean of 1..12 is 6.5 (10^22 J)
    assert error == pytest.approx(6.5)
    assert layers["0-2000 m"][0][1] == pytest.approx(75.0)


def test_leaves_out_iap_years_before_1955_partial_years_and_gaps() -> None:
    text = iap_text(range(1954, 1956)) + iap_row(1956, 1, 1.0, 0.1)
    text += "".join(iap_row(1957, month, float("nan"), 0.1) for month in range(1, 13))
    layers = iap_annual(text)
    assert [year for year, _, _ in layers["0-700 m"]] == [1955]


def test_measures_from_the_2006_2015_mean() -> None:
    rows = [(year + 0.5, float(year), 1.0) for year in range(2000, 2020)]
    years, values, shift = rebased(rows)
    assert years[0] == 2000.5
    assert shift == pytest.approx(2010.5)
    assert values[0] == pytest.approx(-10.5)


def test_needs_every_baseline_year() -> None:
    with pytest.raises(ValueError, match="expected 10 years"):
        _ = rebased([(2006.5, 1.0, 0.0)])


def test_builds_the_iap_analysis_with_its_range() -> None:
    analysis = iap(iap_text(range(2006, 2016)))
    upper, deep = analysis.series
    assert (upper.id, deep.id) == ("iap-0-700m", "iap-0-2000m")
    assert upper.years[0] == 2006.5
    assert upper.values[0] == -45.0  # 10 ZJ a year, measured from the mean
    assert upper.low is not None
    assert upper.high is not None
    assert (upper.low[0], upper.high[0]) == (-50.0, -40.0)
    assert deep.low is not None
    assert deep.low[0] == -55.0


NCEI_HEAD = "    YEAR      WO    WOse      NH    NHse      SH    SHse\n"


def ncei_text(years: range) -> str:
    rows = "".join(
        f"{year}.500  {(year - 2006) * 0.5:.3f}   0.100   0.0   0.0   0.0   0.0\n" for year in years
    )
    return NCEI_HEAD + rows


def test_reads_an_ncei_basin_file_in_zj() -> None:
    [(year, value, error)] = ncei_table(
        NCEI_HEAD + "1955.500  -3.201   1.700  -1.4 0.9 -1.7 0.7\n\n"
    )
    assert year == 1955.5
    assert value == pytest.approx(-32.01)
    assert error == pytest.approx(17.0)


def test_builds_the_ncei_analysis_with_a_95_percent_range() -> None:
    analysis = ncei(ncei_text(range(2000, 2020)), ncei_text(range(2006, 2016)))
    upper, deep = analysis.series
    assert (upper.id, deep.id) == ("ncei-0-700m", "ncei-0-2000m")
    assert upper.values[0] == -52.5
    assert upper.low is not None
    assert upper.low[0] == pytest.approx(-54.5)  # 1.96 x 1 ZJ, rounded
    assert "5-year" in deep.note


IGCC_CSV = (
    "time,timebound_lower,timebound_upper,atmosphere,cryosphere,land,ocean_0-700m,"
    "ocean_0-700m_error,ocean_700-2000m,ocean_700-2000m_error,ocean_2000-6000m,"
    "ocean_2000-6000m_error,ocean_full-depth,ocean_full-depth_error,total\n"
    "1971.5,1971,1972,-1.06,0,2.6,0,45.5,0,20.3,0,0,0,65.8,1.54\n"
    "1972.5,1972,1973,,,,9.9,45.5,-0.24,20.6,0,0,9.66,66.1,\n"
    ",,,,,,350,21,148.7,9.1,39.1,11.8,537.8,41.9,\n"
)


def igcc_archive(names: list[str]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name in names:
            archive.writestr(name, IGCC_CSV)
    return buffer.getvalue()


def test_finds_the_inventory_in_the_igcc_archive() -> None:
    assert igcc_table(igcc_archive([f"ClimateIndicator-data-abc/{IGCC_TABLE}", "README.md"])) == (
        IGCC_CSV
    )
    with pytest.raises(ValueError, match="expected one"):
        _ = igcc_table(igcc_archive(["README.md"]))


def test_reads_each_part_over_the_years_it_has() -> None:
    parts = {series.id: series for series in inventory(IGCC_CSV)}
    assert parts["total"].years == [1971.5]
    assert parts["total"].low is None
    assert parts["total"].note == "1971\u20131971"
    ocean = parts["ocean-0-700m"]
    assert ocean.years == [1971.5, 1972.5]  # the row without a year is left out
    assert (ocean.low, ocean.high) == ([-45.5, -35.6], [45.5, 55.4])
    assert parts["atmosphere"].values == [-1.1]


def test_writes_one_index_with_credit_units_and_baseline(tmp_path: Path) -> None:
    analyses = [
        iap(iap_text(range(2006, 2016))),
        ncei(ncei_text(range(2006, 2016)), ncei_text(range(2006, 2016))),
    ]
    parts = inventory(IGCC_CSV)
    count = write_ocean_heat(analyses, parts, tmp_path / "ocean-heat")
    assert count == 40 + 1 + 2 * 4 + 3
    expected = index_file(analyses, parts)
    assert read_json(tmp_path / "ocean-heat" / "index.json") == json_round_trip(expected)
    assert expected["schemaVersion"] == 1
    assert expected["units"] == "ZJ"
    assert "IAP" in str(expected["credit"])
    ocean = expected["oceanHeat"]
    assert isinstance(ocean, dict)
    assert ocean["baseline"] == "2006\u20132015"
    heat = expected["inventory"]
    assert isinstance(heat, dict)
    assert heat["licence"] == "CC BY 4.0"
    every = heat["series"]
    assert isinstance(every, list)
    total = every[0]
    assert isinstance(total, dict)
    assert total["id"] == "total"
    assert "low" not in total
