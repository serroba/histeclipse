import io
from typing import TYPE_CHECKING

import h5py
import numpy as np
import pytest
from openpyxl import Workbook
from PIL import Image

from histeclipse_pipeline.sealevel_modern import (
    BUDGET_TERMS,
    TREND_FILE,
    ar6_series,
    ar6_table,
    budget,
    noaa_mean,
    noaa_series,
    ocean_mean,
    read_trends,
    rebased,
    series_json,
    write_modern,
)
from tests.json_values import read_json

if TYPE_CHECKING:
    from pathlib import Path

    from histeclipse_pipeline.krapp import Grid

TIDE = (
    "Change in global mean sea level (GMSL) in millimeters compared to 1995-2014 average\r\n"
    "Year,Central Estimate,Structural Unc. (1-sigma),Internal Unc. (1-sigma),"
    "Total Unc. (1-sigma)\r\n"
    "1900.5,-158.0177,9.5,25.3,27.06\r\n"
    "2010.5,18.6751,6.1,13.3,14.66\r\n"
)
ALTIMETER = (
    "Change in GMSL in millimeters compared to 1995-2014 average - Satellite Altimeter\n"
    "Year,Central Estimate,Uncertainty (1-sigma)\n"
    "1993.5,-32.26,4.81\n"
    "2019.5,55.64,2.7\n"
)
NOAA = (
    "#title = mean sea level anomaly global ocean\n"
    "#trend = 3.11 mm/year\n"
    "year,TOPEX/Poseidon,Jason-1,Jason-2\n"
    "1994.5,-10.0,,\n"
    "2002.1,10.0,8.0,\n"
    "2014.9,30.0,,\n"
    "2020.0,,,50.0\n"
)


def test_reads_the_ar6_table_with_its_total_uncertainty() -> None:
    assert ar6_table(TIDE) == [(1900.5, -158.0177, 27.06), (2010.5, 18.6751, 14.66)]


def test_keeps_the_ar6_series_with_a_one_sigma_range() -> None:
    tide = ar6_series(TIDE, kind="tide-gauge")
    assert tide.id == "ar6-tide-gauge"
    assert "tide gauges" in tide.label
    assert (tide.years, tide.level) == ([1900.5, 2010.5], [-158.0, 18.7])
    assert (tide.low, tide.high) == ([-185.1, 4.0], [-131.0, 33.3])
    altimeter = ar6_series(ALTIMETER, kind="altimeter")
    assert "altimetry" in altimeter.label
    assert altimeter.range == "1 sigma"
    assert altimeter.level == [-32.3, 55.6]


def test_averages_missions_where_they_overlap() -> None:
    years, level = noaa_mean(NOAA)
    assert years == [1994.5, 2002.1, 2014.9, 2020.0]
    assert level == [-10.0, 9.0, 30.0, 50.0]


def test_rebases_on_the_1995_2014_mean() -> None:
    # 2002.1 and 2014.9 are inside; 1994.5 and 2020.0 are not.
    assert rebased([1994.5, 2002.1, 2014.9, 2020.0], [-10.0, 9.0, 30.0, 50.0]) == [
        -29.5,
        -10.5,
        10.5,
        30.5,
    ]
    with pytest.raises(ValueError, match="no values"):
        _ = rebased([1990.0], [1.0])


def test_rebased_zero_is_not_negative() -> None:
    assert str(rebased([2000.0, 2001.0], [1.0, 1.0])[0]) == "0.0"


def test_reads_noaa_as_a_series_without_a_range() -> None:
    series = noaa_series(NOAA)
    assert series.id == "noaa-lsa"
    assert series.level == [-29.5, -10.5, 10.5, 30.5]
    shown = series_json(series)
    assert "range" not in shown
    assert shown["note"] is not None


def test_shows_a_range_only_with_both_bounds() -> None:
    shown = series_json(ar6_series(ALTIMETER, kind="altimeter"))
    assert shown["range"] == "1 sigma"
    assert shown["low"] == [-37.1, 52.9]


def trend_file(values: Grid) -> bytes:
    out = io.BytesIO()
    latitude = np.arange(-89.5, 90.0, 1.0)
    longitude = np.arange(-179.5, 180.0, 1.0)
    with h5py.File(out, "w") as opened:
        _ = opened.create_dataset("Sea_level_trends", data=values.astype(np.float32))
        _ = opened.create_dataset("lat", data=latitude)
        _ = opened.create_dataset("lon", data=longitude)
    return out.getvalue()


def test_reads_the_trend_map() -> None:
    values = np.full((180, 360), 3.0)
    trends = read_trends(trend_file(values))
    assert trends.values.shape == (180, 360)
    assert trends.latitude[0] == -89.5


def test_means_the_ocean_by_area() -> None:
    grid = np.full((181, 361), np.nan)
    grid[0, :] = 100.0  # the pole: no area
    grid[90, :] = 2.0
    assert ocean_mean(grid) == pytest.approx(2.0)


def test_writes_the_series_and_the_trend_image(tmp_path: Path) -> None:
    values = np.full((180, 360), np.nan)
    values[60:120, :] = 3.0
    values[60:120, :10] = -2.0
    folder = tmp_path / "sealevel-modern"
    points = write_modern(
        [ar6_series(TIDE, kind="tide-gauge"), noaa_series(NOAA)],
        read_trends(trend_file(values)),
        folder,
    )
    assert points == 6
    index = read_json(folder / "index.json")
    assert isinstance(index, dict)
    assert index["schemaVersion"] == 1
    assert index["units"] == "mm"
    assert index["baseline"] == "1995\u20132014"
    series = index["series"]
    assert isinstance(series, list)
    assert [each["id"] for each in series if isinstance(each, dict)] == [
        "ar6-tide-gauge",
        "noaa-lsa",
    ]
    trends = index["trends"]
    assert isinstance(trends, dict)
    assert (trends["lowest"], trends["highest"]) == (-2.0, 3.0)
    assert (trends["columns"], trends["rows"]) == (361, 181)
    image = Image.open(folder / TREND_FILE)
    assert (image.mode, image.size) == ("RGBA", (361, 181))
    pixels = np.asarray(image, dtype=np.int64)
    # 3 mm a year, against 0 mm a year as byte 102; then no data at the pole.
    assert [pixels.item(90, 180, band) for band in range(4)] == [255, 102, 255, 255]
    assert pixels.item(0, 180, 3) == 0


def budget_file() -> bytes:
    book = Workbook()
    sheet = book.active
    assert sheet is not None
    header: list[str | None] = [None]
    for title in BUDGET_TERMS:
        header += [f"{title} [lower]", f"{title} [mean]", f"{title} [upper]"]
    sheet.append(header)
    terms = len(BUDGET_TERMS) * 3
    sheet.append([1900, *([-1.04] * (terms - 3)), None, None, None])
    sheet.append([1901, *([2.0] * terms)])
    out = io.BytesIO()
    book.save(out)
    return out.getvalue()


def test_reads_the_budget_with_its_range() -> None:
    body = budget(budget_file())
    assert body["years"] == [1900, 1901]
    assert body["range"] == "5-95%"
    terms = body["terms"]
    assert isinstance(terms, dict)
    assert terms["glaciers"] == {"lower": [-1.0, 2.0], "mean": [-1.0, 2.0], "upper": [-1.0, 2.0]}
    # No altimetry before 1993.
    assert terms["altimetry"] == {"lower": [None, 2.0], "mean": [None, 2.0], "upper": [None, 2.0]}
