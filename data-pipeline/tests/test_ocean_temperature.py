"""Tests for the ocean's temperature by depth and the equatorial section (#590, #895)."""

import io
import math
import zipfile
from typing import TYPE_CHECKING

import numpy as np
import pytest
from PIL import Image

from histeclipse_pipeline.ocean_temperature import (
    BASE,
    DECADES,
    DEFLATE64,
    Month,
    Normals,
    base_spans,
    index_file,
    months_in,
    normals,
    pack,
    read_month,
    rounded,
    write_all,
    zip_months,
    zip_name,
)
from histeclipse_pipeline.paleotemp import COLUMNS, ROWS
from tests.json_values import read_json
from tests.netcdf3_files import Var, netcdf3

if TYPE_CHECKING:
    from pathlib import Path

    from histeclipse_pipeline.krapp import Grid

LATITUDE = np.array([-2.5, -1.5, -0.5, 0.5, 1.5, 2.5])
LONGITUDE = np.array([100.5, 150.5, 200.5, 300.5])
DEPTHS = np.array([1.0, 100.0, 400.0, 700.0])


def _month_file(stamp: int, warm: float = 0.0, depths: Grid | None = None) -> bytes:
    """A month of IAP's: ``warm`` °C everywhere, more with depth, one cell missing."""
    levels = DEPTHS if depths is None else depths
    temp = np.full((LATITUDE.size, LONGITUDE.size, levels.size), warm)
    temp += np.arange(levels.size) * 0.1
    temp[0, 0, :] = 999.0
    return netcdf3(
        {"lat": LATITUDE.size, "lon": LONGITUDE.size, "depth_std": levels.size, "time": 1},
        {
            "lat": Var(("lat",), LATITUDE),
            "lon": Var(("lon",), LONGITUDE),
            "time": Var(("time",), np.array([float(stamp)])),
            "depth_std": Var(("depth_std",), levels),
            "temp": Var(("lat", "lon", "depth_std"), temp, attributes={"_FillValue": 999.0}),
        },
    )


def test_reads_a_month_its_depths_and_its_section() -> None:
    month = read_month(_month_file(202601, warm=1.0))
    assert (month.year, month.month) == (2026, 1)
    assert set(month.maps) == {"surface", "100m", "700m"}
    surface: list[list[float]] = month.maps["surface"].tolist()  # pyright: ignore[reportAny]
    assert math.isnan(surface[0][0])
    assert surface[1][1] == pytest.approx(1.0)
    deep: list[list[float]] = month.maps["700m"].tolist()  # pyright: ignore[reportAny]
    assert deep[1][1] == pytest.approx(1.3)
    # Within 2° of the equator, 120°E to 80°W, to 400 m: three levels by two columns.
    assert month.section.shape == (3, 2)
    section: list[list[float]] = month.section.tolist()  # pyright: ignore[reportAny]
    assert section[2][0] == pytest.approx(1.2)
    assert month.depths.tolist() == [1.0, 100.0, 400.0]


def test_refuses_a_bad_time_or_a_missing_depth() -> None:
    with pytest.raises(ValueError, match="not yyyymm"):
        _ = read_month(_month_file(202613))
    with pytest.raises(ValueError, match="no level at 700"):
        _ = read_month(_month_file(202601, depths=np.array([1.0, 100.0, 400.0])))


def test_reads_deflate64_with_the_systems_unzip(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = tmp_path / "decade.zip"
    with zipfile.ZipFile(path, "w") as out:
        out.writestr("IAPv4_Temp_anomaly_year_2000_month_01.nc", b"month")
    asked: list[list[str]] = []

    def run(args: list[str], **_: object) -> object:
        asked.append(args)
        return type("Done", (), {"stdout": b"from unzip"})()

    original = zipfile.ZipFile.infolist

    def deflate64(self: zipfile.ZipFile) -> list[zipfile.ZipInfo]:
        infos = original(self)
        for info in infos:
            info.compress_type = DEFLATE64
        return infos

    monkeypatch.setattr(zipfile.ZipFile, "infolist", deflate64)
    monkeypatch.setattr("histeclipse_pipeline.ocean_temperature.subprocess.run", run)
    assert list(zip_months(path)) == [b"from unzip"]
    assert asked == [["unzip", "-p", str(path), "IAPv4_Temp_anomaly_year_2000_month_01.nc"]]


def test_reads_the_months_of_a_zip_in_order(tmp_path: Path) -> None:
    path = tmp_path / "decade.zip"
    with zipfile.ZipFile(path, "w") as out:
        out.writestr("x/IAPv4_Temp_anomaly_year_2000_month_02.nc", _month_file(200002))
        out.writestr("x/IAPv4_Temp_anomaly_year_2000_month_01.nc", _month_file(200001))
        out.writestr("x/readme.txt", b"not a month")
    assert len(list(zip_months(path))) == 2
    assert [(each.year, each.month) for each in months_in([path])] == [(2000, 1), (2000, 2)]


def _month(year: int, month: int, value: float) -> Month:
    field = np.full((LATITUDE.size, LONGITUDE.size), value)
    return Month(
        year,
        month,
        {"surface": field, "100m": field, "700m": field},
        np.full((3, 2), value),
        LATITUDE,
        LONGITUDE,
        DEPTHS[:3],
    )


def test_normals_need_every_base_year() -> None:
    every = [_month(year, 1, float(year - BASE[0])) for year in range(1980, BASE[1] + 1)]
    found = normals(every)
    mean: list[list[float]] = found.mean("surface", 1).tolist()  # pyright: ignore[reportAny]
    assert mean[0][0] == pytest.approx(14.5)  # 0 to 29
    with pytest.raises(ValueError, match="month 2: the base 1991-2020 is not complete"):
        _ = found.mean("surface", 2)
    with pytest.raises(ValueError, match="not complete"):
        _ = normals(every[:-1]).mean("section", 1)


def test_rounds_and_packs_a_section() -> None:
    values: list[float] = rounded(np.array([0.04, 0.06, np.nan]), 0.1).tolist()  # pyright: ignore[reportAny]
    assert values[:2] == [0.0, pytest.approx(0.1)]
    assert math.isnan(values[2])
    section = np.array([[-4.0, 0.0], [4.0, np.nan]])
    with Image.open(io.BytesIO(pack(section, 4.0))) as image:
        pixels = np.asarray(image)
    assert pixels.shape == (2, 2, 4)
    assert pixels[0, 0].tolist() == [0, 128, 255, 255]  # pyright: ignore[reportAny]
    assert pixels[1, 1, 3] == 0


def test_writes_every_month_its_maps_section_and_the_index(tmp_path: Path) -> None:
    usual = Normals({}, {})
    for year in range(BASE[0], BASE[1] + 1):
        usual.add(_month(year, 1, 0.0))
    usual.add(_month(1950, 1, 9.0))  # outside the base: not counted
    index = write_all([_month(1941, 1, 1.0), _month(2026, 1, 2.0)], usual, tmp_path, "x")
    assert (index["first"], index["last"]) == ("1941-01", "2026-01")
    for name in ("surface", "100m", "700m"):
        with Image.open(tmp_path / name / "2026-01.png") as image:
            assert image.size == (COLUMNS, ROWS)
    with Image.open(tmp_path / "section" / "1941-01.png") as image:
        assert image.size == (2, 3)
    written = read_json(tmp_path / "index.json")
    assert isinstance(written, dict)
    section = written["section"]
    assert isinstance(section, dict)
    assert section["levels"] == [1.0, 100.0, 400.0]
    with pytest.raises(ValueError, match="no months"):
        _ = write_all([], usual, tmp_path, "x")


def test_describes_the_decades_and_the_base() -> None:
    assert zip_name("1940_1949") == "Temperature_Anomaly_IAPv4.2_gridded_data_1940_1949.zip"
    assert base_spans() == ["1990_1999", "2000_2009", "2010_2019", "2020_2026"]
    assert len(DECADES) == 9
    index = index_file((1940, 1), (2026, 9), DEPTHS[:3], "x")
    depths = index["depths"]
    assert isinstance(depths, list)
    assert depths[2] == {"id": "700m", "metres": 700.0, "bound": 1.0, "step": 0.025}
