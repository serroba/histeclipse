"""The ozone layer over the whole Earth each October: the MSR-2 reanalysis's months."""

from __future__ import annotations

import io
import json
import math
import zipfile
from typing import TYPE_CHECKING

import h5py
import numpy as np
import pytest
from PIL import Image

from histeclipse_pipeline.ozone_msr import (
    SPANS,
    Span,
    build,
    digest,
    hole,
    index_file,
    octobers,
    read_month,
    request,
    to_degree,
    to_png,
    year_entry,
)
from tests.netcdf3_files import Var, netcdf3

if TYPE_CHECKING:
    from pathlib import Path

    import numpy.typing as npt

LATITUDE = np.linspace(-90.0, 90.0, 361)
LONGITUDE = np.linspace(-179.5, 180.0, 720)
SPAN = Span("v0025", 2022, 2023, "")


def field(hole_du: float = 150.0, *, reach: float = -70.0) -> npt.NDArray[np.float64]:
    """Ozone of 300 DU everywhere, ``hole_du`` south of ``reach``, as the files have it."""
    grid = np.full((361, 720), 300.0)
    grid[reach >= LATITUDE] = hole_du
    return grid


def netcdf4(grid: npt.NDArray[np.float64], units: bytes = b"Dobson units") -> bytes:
    out = io.BytesIO()
    with h5py.File(out, "w") as opened:
        _ = opened.create_dataset("latitude", data=LATITUDE.astype(np.float32))
        _ = opened.create_dataset("longitude", data=LONGITUDE.astype(np.float32))
        column = opened.create_dataset("total_ozone_column", data=grid[None].astype(np.int32))
        column.attrs["units"] = np.bytes_(units)
    return out.getvalue()


def classic(grid: npt.NDArray[np.float64]) -> bytes:
    return netcdf3(
        {"time": 1, "latitude": 361, "longitude": 720},
        {
            "longitude": Var(("longitude",), LONGITUDE),
            "latitude": Var(("latitude",), LATITUDE),
            "total_ozone_column": Var(
                ("time", "latitude", "longitude"), grid[None], ">i4", {"units": "Dobson units"}
            ),
        },
    )


def name(year: int, month: int, version: str = "v0025") -> str:
    return f"{year}{month:02d}-C3S-L4_OZONE-O3_PRODUCTS-MSR-ASSIM-ALG-MONTHLY-{version}.nc"


def archive(files: dict[str, bytes]) -> bytes:
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as opened:
        for each, data in files.items():
            opened.writestr(each, data)
    return out.getvalue()


def test_every_year_since_1970_is_asked_for_once_from_one_version() -> None:
    years = [year for span in SPANS for year in range(span.first, span.last + 1)]
    assert years == list(range(1970, 2026))
    asked = request(SPANS[-1])
    assert asked["version"] == "v0025"
    assert asked["year"] == ["2022", "2023", "2024", "2025"]
    assert asked["month"] == [f"{month:02d}" for month in range(1, 13)]
    assert asked["sensor"] == "msr"
    for span in SPANS:
        assert len(span.sha256) == len("0" * 64)


def test_a_month_is_read_north_first_from_either_format() -> None:
    for data in (netcdf4(field()), classic(field())):
        grid = read_month(data)
        assert grid.shape == (361, 720)
        assert grid[0, 0] == 300.0  # the North Pole first
        assert grid[-1, 0] == 150.0  # the hole at the South Pole last


def test_a_cell_with_no_value_is_not_a_number() -> None:
    grid = field()
    grid[180, 5] = 0
    assert np.isnan(read_month(netcdf4(grid))[180, 5])  # pyright: ignore[reportAny]


def test_a_month_in_other_units_or_on_another_grid_is_refused() -> None:
    with pytest.raises(ValueError, match="not Dobson units"):
        _ = read_month(netcdf4(field(), b"mol m-2"))
    out = io.BytesIO()
    with h5py.File(out, "w") as opened:
        _ = opened.create_dataset("latitude", data=np.linspace(-90.0, 90.0, 91))
        _ = opened.create_dataset("longitude", data=np.linspace(-178.0, 180.0, 180))
        column = opened.create_dataset("total_ozone_column", data=np.ones((1, 91, 180)))
        column.attrs["units"] = "Dobson units"
    with pytest.raises(ValueError, match="not one of the reanalysis"):
        _ = read_month(out.getvalue())
    shifted = io.BytesIO()
    with h5py.File(shifted, "w") as opened:
        _ = opened.create_dataset("latitude", data=LATITUDE)
        _ = opened.create_dataset("longitude", data=LONGITUDE + 180)
        column = opened.create_dataset("total_ozone_column", data=np.ones((1, 361, 720)))
        column.attrs["units"] = "Dobson units"
    with pytest.raises(ValueError, match="from the South Pole"):
        _ = read_month(shifted.getvalue())


def test_each_october_of_a_span_is_read_and_the_other_months_passed_over() -> None:
    files = {
        name(2022, 10): netcdf4(field(150.0)),
        name(2022, 3): netcdf4(field(280.0)),
        f"folder/{name(2023, 10)}": netcdf4(field(200.0)),
    }
    found = octobers(archive(files), SPAN)
    assert sorted(found) == [2022, 2023]
    assert found[2022][-1, 0] == 150.0
    assert found[2023][-1, 0] == 200.0


def test_an_archive_with_a_stray_file_a_wrong_year_or_no_october_is_refused() -> None:
    with pytest.raises(ValueError, match="not a month"):
        _ = octobers(archive({"readme.txt": b""}), SPAN)
    with pytest.raises(ValueError, match="not of v0025"):
        _ = octobers(archive({name(2019, 10): b""}), SPAN)
    with pytest.raises(ValueError, match="not of v0025"):
        _ = octobers(archive({name(2022, 10, "v0024"): b""}), SPAN)
    with pytest.raises(ValueError, match=r"no October for \[2023\]"):
        _ = octobers(archive({name(2022, 10): netcdf4(field())}), SPAN)


def test_the_checksum_is_of_the_files_not_of_how_they_are_packed() -> None:
    files = {name(2022, 10): b"one", name(2023, 10): b"two"}
    turned = dict(reversed(files.items()))
    assert digest(archive(files)) == digest(archive(turned))
    assert digest(archive(files)) != digest(archive({**files, name(2023, 10): b"three"}))


def test_the_degree_grid_takes_whole_degrees_from_180_west_to_180_east() -> None:
    grid = np.tile(LONGITUDE, (361, 1))
    grid[:, :] += np.linspace(90.0, -90.0, 361)[:, None] * 1000
    thinned = to_degree(grid)
    assert thinned.shape == (181, 361)
    # 180°W is the file's last column, 180°E; then 179°W on.
    assert thinned[0, 0] == 90_000 + 180
    assert thinned[0, 1] == 90_000 - 179
    assert thinned[0, 360] == 90_000 + 180
    assert thinned[90, 180] == 0
    assert thinned[180, 180] == -90_000


def test_the_png_holds_two_dobson_units_a_step_and_nothing_where_there_is_no_value() -> None:
    grid = np.full((181, 361), 300.0)
    grid[0, 0] = np.nan
    grid[0, 1] = 90.0  # under the scale: its lowest step, not "no value"
    grid[0, 2] = 900.0
    grid[0, 3] = 221.0
    with Image.open(io.BytesIO(to_png(grid))) as image:
        assert image.mode == "L"
        assert image.size == (361, 181)
        pixels = np.asarray(image)
    assert pixels[0, 0] == 0
    assert pixels[0, 1] == 1
    assert pixels[0, 2] == 255
    assert 100 + 2 * int(pixels[0, 3]) in {220, 222}  # pyright: ignore[reportAny]
    assert pixels[5, 5] == 100


def test_the_hole_is_the_south_under_220_dobson_units_by_area() -> None:
    found = hole(read_month(netcdf4(field(150.0, reach=-70.0))))
    lowest, area = found.lowest, found.area
    assert (found.covered, found.south_covered) == (1.0, 1.0)
    assert lowest == 150.0
    # The cap south of 69.75°S: 2πR²(1 - sin 69.75°), in million km².
    cap = 2 * math.pi * 6371.0**2 * (1 - math.sin(math.radians(69.75))) / 1e6
    assert area == pytest.approx(cap, abs=0.1)
    # Low ozone in the north is not the Antarctic hole; none under the line is no area.
    north = field(300.0)
    north[LATITUDE >= 80] = 150.0
    unholed = hole(read_month(netcdf4(north)))
    assert (unholed.lowest, unholed.area) == (300.0, 0.0)


def test_a_month_with_gaps_says_how_much_it_covers_and_gives_no_area_it_cannot_know() -> None:
    patchy = field(150.0)
    patchy[LATITUDE <= -80] = 0  # no value about the pole
    found = hole(read_month(netcdf4(patchy)))
    assert found.lowest == 150.0
    assert found.area is None
    assert 0.9 < found.covered < 1
    assert 0.9 < found.south_covered < 1
    northern = field()
    northern[LATITUDE <= -40] = 0
    none = hole(read_month(netcdf4(northern)))
    assert (none.lowest, none.area, none.south_covered) == (None, None, 0.0)


def test_the_octobers_are_written_with_an_index_that_credits_them(tmp_path: Path) -> None:
    bare = field()
    bare[LATITUDE < 85] = 0  # values for hardly any of the Earth
    span = Span("v0025", 2022, 2024, "")
    files = {
        name(2022, 10): netcdf4(field(150.0)),
        name(2023, 10): netcdf4(field(240.0)),
        name(2024, 10): netcdf4(bare),
    }
    count = build([(span, archive(files))], tmp_path / "ozone")
    assert count == 2
    index = json.loads((tmp_path / "ozone" / "maps.json").read_text())  # pyright: ignore[reportAny]
    assert index == json.loads(json.dumps(index_file(index["years"], [2024])))  # pyright: ignore[reportAny]
    assert not (tmp_path / "ozone" / "october-2024.png").exists()
    assert index["licence"] == "CC BY 4.0"
    assert "van der A" in index["credit"]
    assert "Copernicus Climate Change Service" in index["credit"]
    assert index["encoding"] == {"offsetDU": 100.0, "stepDU": 2.0}
    assert (index["columns"], index["rows"]) == (361, 181)
    first, second = index["years"]  # pyright: ignore[reportAny]
    assert first["year"] == 2022
    assert first["file"] == "october-2022.png"
    assert first["version"] == "v0025"
    assert first["covered"] == 1.0
    assert first["minimumDU"] == 150.0
    assert first["belowMkm2"] > 10
    assert second["belowMkm2"] == 0
    with Image.open(tmp_path / "ozone" / "october-2022.png") as image:
        assert image.size == (361, 181)


def test_the_early_years_coarser_grid_is_read_thinned_and_measured_too() -> None:
    latitude = np.linspace(-90.0, 90.0, 181)
    longitude = np.linspace(-178.5, 180.0, 240)
    values = np.full((181, 240), 300.0)
    values[latitude <= -70] = 150.0
    values[-1, 0] = 310.0  # at the North Pole's row: 178.5°W
    values[-1, -1] = 320.0  # and 180°E
    data = netcdf3(
        {"time": 1, "latitude": 181, "longitude": 240},
        {
            "longitude": Var(("longitude",), longitude),
            "latitude": Var(("latitude",), latitude),
            "total_ozone_column": Var(
                ("time", "latitude", "longitude"), values[None], ">i4", {"units": "Dobson units"}
            ),
        },
    )
    grid = read_month(data)
    assert grid.shape == (181, 240)
    thinned = to_degree(grid)
    assert thinned.shape == (181, 361)
    # 180°W and 180°E are the grid's last column; 179°W its first, the nearest.
    assert (thinned[0, 0], thinned[0, 1], thinned[0, 360]) == (320.0, 310.0, 320.0)
    found = hole(grid)
    lowest, area = found.lowest, found.area
    assert lowest == 150.0
    cap = 2 * math.pi * 6371.0**2 * (1 - math.sin(math.radians(69.5))) / 1e6
    assert area == pytest.approx(cap, abs=0.1)
    assert year_entry(1975, "v0023", grid)["gridDeg"] == [1.0, 1.5]
