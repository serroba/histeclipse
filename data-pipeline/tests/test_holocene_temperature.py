import io
from typing import TYPE_CHECKING

import h5py
import numpy as np
import pytest

from histeclipse_pipeline.holocene_temperature import (
    Series,
    baseline_offset,
    epica,
    epica_rows,
    hadcrut5,
    hadcrut_rows,
    lgmr,
    pages2k,
    thin,
    write_holocene_temperature,
    year_of_bp,
)
from tests.json_values import JsonValue, read_json

if TYPE_CHECKING:
    from pathlib import Path

EPICA_TEXT = (
    "/* DATA DESCRIPTION:\nCitation:\tJouzel\n*/\n"
    "Depth ice/snow [m]\tAge model [ka]\tδD [‰ SMOW]\tdelta T [°C]\tSample ID\n"
    "0.00\t-0.050\t\t\t1\n"
    "6.60\t0.038\t-390.9\t0.88\t13\n"
    "7.15\t0.150\t-385.1\t1.84\t14\n"
    "900.0\t20.400\t-440.0\t-9.00\t1500\n"
    "901.0\t20.900\t-441.0\t-8.00\t1501\n"
)


def test_counts_years_before_present_from_1950() -> None:
    assert (year_of_bp(100), year_of_bp(-50), year_of_bp(800_000)) == (1850, 2000, -798_050)


def test_reads_epica_ages_in_years_and_skips_rows_without_a_temperature() -> None:
    assert epica_rows(EPICA_TEXT) == [(38.0, 0.88), (150.0, 1.84), (20400.0, -9.0), (20900.0, -8.0)]


def test_thins_epica_to_200_years_near_and_1000_years_far_oldest_first() -> None:
    rows = [(10.0, 1.0), (190.0, 2.0), (210.0, 4.0), (20_100.0, -9.0), (20_900.0, -8.0)]
    assert thin(rows) == [
        (1950 - 20_500, -8.5, None, None),
        (1950 - 210, 4.0, None, None),
        (1950 - 100, 1.5, None, None),
    ]


def test_keeps_epica_antarctic_on_its_own_baseline() -> None:
    series = epica(EPICA_TEXT)
    assert (series.id, series.scope) == ("epica", "antarctic")
    assert "1,000 years" in series.baseline
    assert "CC BY 3.0" in series.credit
    assert series.points == [(1950 - 20_650, -8.5, None, None), (1950 - 94, 1.36, None, None)]


def _netcdf(ages: list[float], gmst: list[list[float]]) -> bytes:
    out = io.BytesIO()
    with h5py.File(out, "w") as made:
        _ = made.create_dataset("age", data=np.asarray(ages, dtype=np.float32))
        _ = made.create_dataset("gmst", data=np.asarray(gmst, dtype=np.float32))
    return out.getvalue()


def test_takes_lgmr_members_relative_to_their_newest_bin() -> None:
    # Three members, two bins: each member's change from 100 BP is -6, -7 and -8.
    data = _netcdf([100.0, 21_100.0], [[14.0, 8.0], [13.0, 6.0], [15.0, 7.0]])
    series = lgmr(data)
    assert (series.id, series.scope) == ("lgmr", "global")
    assert [point[0] for point in series.points] == [1950 - 21_100, 1850]
    assert series.points[1] == (1850, 0.0, 0.0, 0.0)
    year, median, low, high = series.points[0]
    assert (year, median) == (-19_150, -7.0)
    assert low is not None
    assert high is not None
    assert (round(low, 2), round(high, 2)) == (-7.95, -6.05)


HADCRUT_TEXT = (
    "Time,Anomaly (deg C),Lower confidence limit (2.5%),Upper confidence limit (97.5%)\n"
    + "".join(f"{year},-0.4,-0.6,-0.2\n" for year in range(1850, 1901))
    + "2024,1.1690052,1.1298352,1.2081751\n"
)


def test_reads_hadcrut_and_its_1850_1900_offset() -> None:
    rows = hadcrut_rows(HADCRUT_TEXT)
    assert rows[0] == (1850, -0.4, -0.6, -0.2)
    assert baseline_offset(rows) == pytest.approx(-0.4)
    series = hadcrut5(rows, baseline_offset(rows))
    assert series.points[0] == (1850, 0.0, -0.2, 0.2)
    assert series.points[-1] == (2024, 1.57, 1.53, 1.61)
    assert series.last_year == 2024


def test_refuses_a_hadcrut_file_missing_baseline_years() -> None:
    with pytest.raises(ValueError, match="1850-1900"):
        _ = baseline_offset([(1850, 0.0, 0.0, 0.0)])


PAGES_TEXT = (
    "## All values are °C wrt 1961-1990\n"
    "Year\tCowtan & Way instrumental target\tFull ensemble median\t"
    "Full ensemble 2.5th percentile\tFull ensemble 97.5th percentile\t"
    "Cowtan & Way instrumental target 31-year filtered\t31-year filtered full ensemble median\t"
    "31-year filtered full ensemble 2.5th percentile\t"
    "31-year filtered full ensemble 97.5th percentile\n"
    "1\tNA\t-0.369\t-0.7515\t0.0176\tNA\tNA\tNA\tNA\n"
    "16\tNA\t-0.3368\t-0.6918\t0.0341\tNA\t-0.2662\t-0.5154\t0.0628\n"
    "2000\t0.3\t0.2\t0.1\t0.3\t0.3\t0.25\t0.1\t0.4\n"
)


def test_reads_the_filtered_pages2k_columns_shifted_to_pre_industrial() -> None:
    series = pages2k(PAGES_TEXT, -0.36)
    assert series.points == [(16, 0.09, -0.16, 0.42), (2000, 0.61, 0.46, 0.76)]
    assert "no licence stated" in series.credit
    assert "accessed 2026-11-12" in series.credit


def test_writes_every_series_as_compact_points(tmp_path: Path) -> None:
    rows = hadcrut_rows(HADCRUT_TEXT)
    series = [
        epica(EPICA_TEXT),
        Series("x", "X", "global", "b", "c", "s", [(1, 0.5, None, None)]),
        hadcrut5(rows, baseline_offset(rows)),
    ]
    path = tmp_path / "data" / "holocene-temperature.json"
    assert write_holocene_temperature(series, path) == 2 + 1 + 52
    written = read_json(path)
    assert isinstance(written, dict)
    assert (written["schemaVersion"], written["baseline"]) == (1, "1850\u20131900")
    first, plain, last = (each for each in _list(written["series"]) if isinstance(each, dict))
    assert _list(first["points"])[0] == [-18_700, -8.5, None, None]
    assert "note" in first
    assert "lastYear" not in first
    assert plain == {
        "id": "x",
        "name": "X",
        "scope": "global",
        "baseline": "b",
        "credit": "c",
        "source": "s",
        "points": [[1, 0.5, None, None]],
    }
    assert last["lastYear"] == 2024


def _list(value: JsonValue) -> list[JsonValue]:
    assert isinstance(value, list)
    return value
