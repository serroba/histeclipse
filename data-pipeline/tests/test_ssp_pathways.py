from typing import TYPE_CHECKING

import pytest

from histeclipse_pipeline.ssp_pathways import (
    AR6_SHA256,
    PERCENTILES,
    SCENARIOS,
    Inputs,
    Row,
    Yearly,
    ar6_total,
    ar6_url,
    count_points,
    pathways,
    points,
    ranged,
    rcmip_rows,
    same_history,
    write_pathways,
)
from tests.json_values import read_json

if TYPE_CHECKING:
    from pathlib import Path

RCMIP_TEXT = (
    "Model,Scenario,Region,Variable,Unit,Mip_Era,Activity_Id,1750,2014,2015,2016,2100\n"
    "unspecified,historical,World,Emissions|CO2,Mt CO2/yr,CMIP6,x,9.5,35000,,,\n"
    "IMAGE,ssp119,World,Emissions|CO2,Mt CO2/yr,CMIP6,x,9.5,35000,39000,,-1500.4\n"
    "IMAGE,ssp119,World|R5.2ASIA,Emissions|CO2,Mt CO2/yr,CMIP6,x,1,2,3,4,5\n"
    "IMAGE,ssp119,World,Emissions|CH4,Mt CH4/yr,CMIP6,x,1,2,3,4,5\n"
)

AR6_TEXT = "year,co2,total\n1750,0.0,0.3\n2014,2.0,2.5\n2015,2.1,2.6\n"


def test_reads_global_rows_of_one_variable_skipping_empty_years() -> None:
    rows = rcmip_rows(RCMIP_TEXT, "Emissions|CO2")
    assert rows == {
        "historical": Row("unspecified", {1750: 9.5, 2014: 35000.0}),
        "ssp119": Row("IMAGE", {1750: 9.5, 2014: 35000.0, 2015: 39000.0, 2100: -1500.4}),
    }


def test_reads_the_total_column_of_an_ar6_table() -> None:
    assert ar6_total(AR6_TEXT) == {1750: 0.3, 2014: 2.5, 2015: 2.6}


def test_points_keep_the_years_in_range_scaled_and_rounded() -> None:
    values = {2100: -1500.4, 1750: 9.5, 2015: 39000.0, 2016: -0.001}
    assert points(values, 2015, 2100, 1000.0) == [(2015, 39.0), (2016, 0.0), (2100, -1.5)]


def test_ranged_points_carry_best_low_and_high() -> None:
    best, low, high = {1: 1.004, 2: 2.0}, {1: 0.5, 2: 1.5}, {1: 1.5, 2: 2.555}
    assert ranged(best, low, high, 1, 2) == [(1, 1.0, 0.5, 1.5), (2, 2.0, 1.5, 2.56)]


def test_history_must_be_the_same_in_every_scenario() -> None:
    shared = {2013: 1.0, 2014: 2.0}
    assert same_history({"a": {**shared, 2015: 3.0}, "b": {**shared, 2015: 4.0}}, "x") == shared
    with pytest.raises(ValueError, match="disagree before 2015"):
        _ = same_history({"a": shared, "b": {2013: 1.0, 2014: 2.1}}, "x")
    with pytest.raises(ValueError, match="disagree"):
        _ = same_history({"a": shared, "b": {2014: 2.0}}, "x")


def test_names_each_ar6_table_and_pins_each_one() -> None:
    assert ar6_url(SCENARIOS[2], "best_estimate").endswith(
        "/table_A3.4c_ssp245_ERF_1750-2500_best_estimate.csv"
    )
    assert set(AR6_SHA256) == {(each.id, p) for each in SCENARIOS for p in PERCENTILES}


def _yearly(base: float, scenario_offset: float) -> Yearly:
    history = {year: base + 0.01 * (year - 1750) for year in range(1750, 2015)}
    future = {year: base + scenario_offset + year * 0.001 for year in range(2015, 2101)}
    return {**history, **future}


def _rows(base: float) -> dict[str, Row]:
    rows = {"historical": Row("unspecified", {1750: base, 2014: base * 2})}
    for at, each in enumerate(SCENARIOS):
        rows[each.id] = Row(f"model-{each.id}", {2015: base + at, 2020: base + at, 2100: at})
    return rows


def _inputs() -> Inputs:
    ar6: dict[tuple[str, str], Yearly] = {}
    for at, each in enumerate(SCENARIOS):
        for shift, percentile in zip((0.0, -0.5, 0.5), PERCENTILES, strict=True):
            ar6[each.id, percentile] = _yearly(shift, at)
    return Inputs(
        emissions=_rows(9000.0),
        concentrations=_rows(280.0),
        rcmip_forcing=_rows(0.2),
        ar6=ar6,
    )


def test_builds_history_and_a_fan_of_scenarios_with_their_credits() -> None:
    body = pathways(_inputs())
    assert (body["schemaVersion"], body["licence"], body["historyEnd"]) == (1, "CC BY 4.0", 2014)
    assert "Gidden et al. 2019" in str(body["credit"])
    assert "Meinshausen et al. 2020" in str(body["credit"])
    history = body["history"]
    assert isinstance(history, dict)
    assert history["co2Emissions"] == [[1750, 9.0], [2014, 18.0]]
    assert history["co2"] == [[1750, 280.0], [2014, 560.0]]
    forcing = history["forcing"]
    assert isinstance(forcing, list)
    assert (len(forcing), forcing[0], forcing[-1]) == (
        265,
        [1750, 0.0, -0.5, 0.5],
        [2014, 2.64, 2.14, 3.14],
    )
    scenarios = body["scenarios"]
    assert isinstance(scenarios, list)
    assert [each["name"] for each in scenarios if isinstance(each, dict)] == [
        "SSP1-1.9",
        "SSP1-2.6",
        "SSP2-4.5",
        "SSP3-7.0",
        "SSP5-8.5",
    ]
    last = scenarios[-1]
    assert isinstance(last, dict)
    assert (last["id"], last["model"]) == ("ssp585", "model-ssp585")
    assert last["co2Emissions"] == [[2015, 9.0], [2020, 9.0], [2100, 0.0]]
    assert last["forcingRcmip"] == [[2015, 4.2], [2020, 4.2], [2100, 4.0]]
    scenario_forcing = last["forcing"]
    assert isinstance(scenario_forcing, list)
    assert (len(scenario_forcing), scenario_forcing[0]) == (86, [2015, 6.02, 5.52, 6.52])


def test_fails_when_a_scenario_has_no_row() -> None:
    inputs = _inputs()
    del inputs.concentrations["ssp370"]
    with pytest.raises(ValueError, match="RCMIP concentrations: no global row for ssp370"):
        _ = pathways(inputs)


def test_writes_the_index_and_counts_its_points(tmp_path: Path) -> None:
    count = write_pathways(_inputs(), tmp_path / "ssp")
    written = read_json(tmp_path / "ssp" / "index.json")
    assert isinstance(written, dict)
    variables = written["variables"]
    assert isinstance(variables, list)
    assert [each["id"] for each in variables if isinstance(each, dict)] == [
        "co2Emissions",
        "co2",
        "forcing",
        "forcingRcmip",
    ]
    # History: 2 + 2 + 265 + 2; each scenario: 3 + 3 + 86 + 3.
    assert count == 271 + 5 * 95
    assert count_points({"history": {}, "scenarios": "none"}) == 0
