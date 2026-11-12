import base64
import io
import zipfile
from typing import TYPE_CHECKING

import pytest

from histeclipse_pipeline.cryosphere import (
    GLACIER_REGIONS,
    IMBIE_REGIONS,
    SEAICE_SERIES,
    imbie_region,
    imbie_rows,
    imbie_url,
    seaice_series,
    seaice_url,
    snow_cover,
    write_glaciers,
    write_imbie,
    write_seaice_trend,
    write_snow_cover,
)
from tests.json_values import JsonValue, read_json

if TYPE_CHECKING:
    from pathlib import Path


def obj(value: JsonValue) -> dict[str, JsonValue]:
    assert isinstance(value, dict)
    return value


def items(value: JsonValue) -> list[JsonValue]:
    assert isinstance(value, list)
    return value


IMBIE_HEADER = (
    "Date,Mass balance (Gt/yr),Mass balance uncertainty (Gt/yr),"
    "Cumulative mass balance anomaly (Gt),Cumulative mass balance anomaly uncertainty (Gt),"
    "Surface mass balance anomaly (Gt/yr),Surface mass balance anomaly uncertainty (Gt/yr),"
    "Cumulative surface mass balance anomaly (Gt),"
    "Cumulative surface mass balance anomaly uncertainty (Gt),"
    "Dynamics mass balance anomaly (Gt/yr),Dynamics mass balance anomaly uncertainty (Gt/yr),"
    "Cumulative dynamics mass balance anomaly (Gt),"
    "Cumulative dynamics mass balance anomaly uncertainty (Gt)"
)
IMBIE_TEXT = (
    "# id: GB/NERC/BAS/PDC/02074\n# title: Mass balance\n"
    + IMBIE_HEADER
    + "\n1979-11-01,-10,4,-1,2,1,1,0.1,0.1,-11,3,-1.1,2"
    + "\n1979-12-01,-20,6,-3,3,2,1,0.3,0.2,-22,5,-3.3,3"
    + "\n1980-01-01,-12,2,-4,4,0,1,0.3,0.3,-12,2,-4.3,4\n"
)


def test_reads_imbie_rows_without_the_header_lines() -> None:
    rows = imbie_rows(IMBIE_TEXT)
    assert [row[0] for row in rows] == ["1979-11-01", "1979-12-01", "1980-01-01"]
    with pytest.raises(ValueError, match="Date"):
        _ = imbie_rows("# nothing\n")


def test_averages_imbie_rates_and_keeps_each_years_last_cumulative_change() -> None:
    region = imbie_region("greenland", "Greenland", IMBIE_TEXT)
    assert region["years"] == [1979, 1980]
    assert region["rate"] == [-15.0, -12.0]
    assert region["rateError"] == [5.0, 2.0]
    assert region["mass"] == [-3.0, -4.0]
    assert region["massError"] == [3.0, 4.0]
    assert region["surface"] == [0.3, 0.3]
    assert region["dynamics"] == [-3.3, -4.3]
    assert region["dynamicsRate"] == [-16.5, -12.0]


def test_links_each_imbie_file_by_its_path_in_base64() -> None:
    url = imbie_url("greenland")
    encoded = url.rsplit(":", 1)[1]
    assert base64.b64decode(encoded).decode() == "/imbie3_greenland_Gt_partitioned.csv"
    assert url.startswith("https://ramadda.data.bas.ac.uk/")


def test_writes_imbie_with_credit_units_and_every_region(tmp_path: Path) -> None:
    count = write_imbie([IMBIE_TEXT] * len(IMBIE_REGIONS), tmp_path)
    index = obj(read_json(tmp_path / "index.json"))
    assert count == 2 * len(IMBIE_REGIONS)
    assert index["schemaVersion"] == 1
    assert index["licence"] == "Open Government Licence v3.0"
    assert index["units"] == {"rate": "Gt/yr", "mass": "Gt"}
    assert [obj(region)["id"] for region in items(index["regions"])][:2] == [
        "greenland",
        "antarctica",
    ]


def glambie_zip() -> bytes:
    buffer = io.BytesIO()
    calendar = (
        "start_dates,end_dates,glacier_area,region,combined_gt,combined_gt_errors,"
        "combined_mwe,combined_mwe_errors\n"
        "2000.0,2001.0,1000.4,r,-1.234,0.5,-0.12345,0.05\n"
        "2001.0,2002.0,990.0,r,-2.0,0.6,-0.2,0.06\n"
    )
    groups = ("altimetry", "gravimetry", "demdiff_and_glaciological")
    columns = ["combined", *groups]
    hydro_head = "start_dates,end_dates,glacier_area,region," + ",".join(
        f"{name}_gt,{name}_gt_errors" for name in columns
    )
    # Gravimetry has no estimate in this region: it is left out.
    hydro = hydro_head + "\n1999.75,2000.75,1000,r,-1,0.5,-1.5,0.7,,,-0.8,0.4\n"
    hugonnet = (
        "start_dates,end_dates,changes,errors,unit,author\n"
        "2000.0,2005.0,-3.26,0.6,m,Hugonnet et al.\n"
    )
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("glambie_results_20240716/calendar_years/0_global.csv", calendar)
        for number, key in enumerate(GLACIER_REGIONS, start=1):
            folder = f"{number}_{key}"
            archive.writestr(f"glambie_results_20240716/calendar_years/{folder}.csv", calendar)
            archive.writestr(f"glambie_results_20240716/hydrological_years/{folder}.csv", hydro)
            archive.writestr(
                f"glambie_input_20240716/{folder}/{key}_demdiff_ETH_Hugonnet_et_al.csv", hugonnet
            )
    return buffer.getvalue()


def test_writes_glaciers_combined_by_method_and_hugonnet(tmp_path: Path) -> None:
    assert write_glaciers(glambie_zip(), tmp_path) == len(GLACIER_REGIONS)
    index = obj(read_json(tmp_path / "index.json"))
    world = obj(index["world"])
    assert world["years"] == [2000, 2001]
    assert world["gt"] == [-1.23, -2.0]
    assert world["mwe"] == [-0.123, -0.2]
    assert world["area"] == 1000
    regions = items(index["regions"])
    alaska = obj(regions[0])
    methods = obj(alaska["methods"])
    assert (alaska["id"], alaska["rgi"], alaska["label"]) == ("alaska", 1, "Alaska")
    assert sorted(methods) == [
        "altimetry",
        "combined",
        "demdiff_and_glaciological",
        "start",
    ]
    assert methods["altimetry"] == {"gt": [-1.5], "gtError": [0.7]}
    assert alaska["hugonnet"] == {"periods": [[2000.0, 2005.0]], "dh": [-3.26], "dhError": [0.6]}
    assert obj(regions[-1])["id"] == "antarctic-and-subantarctic"


def test_refuses_a_glambie_archive_without_hugonnet_or_in_other_units(tmp_path: Path) -> None:
    buffer = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(glambie_zip())) as source, zipfile.ZipFile(buffer, "w") as out:
        for name in source.namelist():
            if "1_alaska/" not in name:
                out.writestr(name, source.read(name))
    with pytest.raises(ValueError, match="Hugonnet"):
        _ = write_glaciers(buffer.getvalue(), tmp_path)
    buffer = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(glambie_zip())) as source, zipfile.ZipFile(buffer, "w") as out:
        for name in source.namelist():
            data = source.read(name).decode()
            out.writestr(name, data.replace(",m,", ",Gt,"))
    with pytest.raises(ValueError, match="metres"):
        _ = write_glaciers(buffer.getvalue(), tmp_path)


SEAICE_TEXT = (
    "year, mo,source_dataset, region, extent,   area\n"
    "1979,  9,    NSIDC-0051,      N,   7.05,   4.58\n"
    "1980,  9,    NSIDC-0051,      N,-9999,-9999\n"
    "2026,  9,    NSIDC-0803,      N,   4.81,   -9999\n"
)


def test_reads_one_months_sea_ice_skipping_missing_years() -> None:
    series = seaice_series("arctic-september", "Arctic", 9, SEAICE_TEXT)
    assert series["years"] == [1979, 2026]
    assert series["extent"] == [7.05, 4.81]
    assert series["area"] == [4.58, None]
    with pytest.raises(ValueError, match="month 9"):
        _ = seaice_series("arctic-march", "Arctic", 3, SEAICE_TEXT)


def test_writes_the_sea_ice_trend(tmp_path: Path) -> None:
    texts = [SEAICE_TEXT.replace("  9,", f"{month:3d},") for *_, month, _ in SEAICE_SERIES]
    assert write_seaice_trend(texts, tmp_path) == 2 * len(SEAICE_SERIES)
    index = obj(read_json(tmp_path / "index.json"))
    assert [obj(each)["month"] for each in items(index["series"])] == [3, 9, 2, 9]
    assert obj(index["units"])["extent"] == "million km²"
    assert seaice_url("south", 2).endswith("/south/monthly/data/S_02_extent_v4.0.csv")


SNOW_TEXT = "1966  11  34943905\n1966  12  43004840\n\n" + "".join(
    f"1967  {month:02d}  {month * 1_000_000}\n" for month in range(1, 13)
)


def test_reads_snow_cover_by_month_with_an_annual_mean_only_for_whole_years() -> None:
    snow = snow_cover(SNOW_TEXT)
    assert snow["years"] == [1966, 1967]
    months = snow["months"]
    assert isinstance(months, list)
    assert months[0] == [None] * 10 + [34.94, 43.0]
    assert snow["annual"] == [None, 6.5]


def test_writes_snow_cover(tmp_path: Path) -> None:
    assert write_snow_cover(SNOW_TEXT, tmp_path) == 2
    index = obj(read_json(tmp_path / "index.json"))
    assert index["coverage"] == "Northern Hemisphere land, Greenland included"
