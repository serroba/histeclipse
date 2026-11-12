import hashlib
import io
import json
import math
from typing import TYPE_CHECKING

import h5py
import numpy as np
import numpy.typing as npt
import pytest
from PIL import Image

from histeclipse_pipeline import ar6_sealevel
from histeclipse_pipeline.ar6_sealevel import (
    GLOBAL,
    GRID_LOCATIONS,
    HIGHEST,
    LOWEST,
    MAP_YEARS,
    REGIONAL,
    Projection,
    build,
    metres,
    nearest,
    ocean_mean,
    read_curve,
    read_maps,
    to_nodes,
)
from histeclipse_pipeline.krapp import decode
from histeclipse_pipeline.paleotemp import COLUMNS, ROWS
from tests.test_icesheets import archive

if TYPE_CHECKING:
    from pathlib import Path

#: The quantiles AR6's files hold: a few, enough to hold the kept ones.
QUANTILES = np.array([0.0, 0.05, 0.17, 0.5, 0.83, 0.95, 1.0])
YEARS = np.arange(2020, 2310, 10, dtype=np.int32)


def confidence_file(
    change: npt.NDArray[np.float64],
    latitude: list[float],
    longitude: list[float],
    locations: list[int],
) -> bytes:
    """A confidence output file as AR6 writes it: quantiles x years x locations, int16 mm."""
    out = io.BytesIO()
    with h5py.File(out, "w") as made:
        _ = made.create_dataset("quantiles", data=QUANTILES.astype(np.float32))
        _ = made.create_dataset("years", data=YEARS)
        _ = made.create_dataset("lat", data=np.array(latitude, dtype=np.float32))
        _ = made.create_dataset("lon", data=np.array(longitude, dtype=np.float32))
        _ = made.create_dataset("locations", data=np.array(locations, dtype=np.int32))
        _ = made.create_dataset("sea_level_change", data=change.astype(np.int16))
    return out.getvalue()


def global_file(scale: int) -> bytes:
    """Sea level rising ``scale`` mm a decade at the median, quantile q shifted by 100*(q-0.5)."""
    decades = np.arange(len(YEARS))
    change = scale * decades[None, :, None] + np.round(1000 * (QUANTILES - 0.5))[:, None, None]
    return confidence_file(change, [np.nan], [np.nan], [-1])


#: Three grid points and a tide gauge: (lat, lon) and each one's metres at the median.
POINTS = [(52.0, 4.0, 0.6), (0.0, -180.0, 0.2), (-10.0, 179.0, -0.4)]


def regional_file() -> bytes:
    sites = len(POINTS) + 1
    change = np.zeros((len(QUANTILES), len(YEARS), sites))
    for site, (_, _, level) in enumerate(POINTS):
        change[:, :, site] = level * 1000 + np.round(1000 * (QUANTILES - 0.5))[:, None]
    change[:, :, sites - 1] = 9999  # the tide gauge: left out
    change[:, 0, 0] = -32768  # no value in 2020
    return confidence_file(
        change,
        [lat for lat, _, _ in POINTS] + [40.0],
        [lon for _, lon, _ in POINTS] + [-74.0],
        [GRID_LOCATIONS + site for site in range(len(POINTS))] + [12],
    )


def test_names_projections_as_the_report_does() -> None:
    projection = Projection("ssp245", "medium")
    assert projection.id == "ssp245-medium"
    assert projection.label == "SSP2-4.5"
    assert projection.member("global") == (
        "ar6/global/confidence_output_files/medium_confidence/ssp245/"
        "total_ssp245_medium_confidence_values.nc"
    )
    assert projection.member("regional").startswith("ar6-regional-confidence/regional/")
    assert Projection("ssp585", "low") in REGIONAL


def test_finds_quantiles_and_turns_millimetres_into_metres() -> None:
    assert nearest(QUANTILES, 0.17) == 2
    with pytest.raises(ValueError, match="not among"):
        _ = nearest(QUANTILES, 0.3)
    values = metres(np.array([1500.0, -32768.0]))
    assert values[0] == pytest.approx(1.5)
    assert math.isnan(values.item(1))


def test_reads_the_kept_quantiles_of_a_global_curve() -> None:
    curve = read_curve(global_file(100), GLOBAL[0])
    assert curve.years[0] == 2020
    assert curve.years[-1] == 2150  # the file goes on to 2300
    assert len(curve.quantiles[0]) == len(curve.years)
    median = curve.quantiles[2]
    assert median[0] == pytest.approx(0.0)
    assert median[-1] == pytest.approx(1.3)
    # 5th, 17th, 50th, 83rd, 95th: each 0.45, 0.33, 0, +0.33, +0.45 m from the median.
    assert [row[0] for row in curve.quantiles] == pytest.approx([-0.45, -0.33, 0.0, 0.33, 0.45])


def test_places_grid_points_on_the_nodes_and_repeats_the_dateline() -> None:
    grid = to_nodes(np.array([1.0, 2.0]), np.array([90.0, -90.0]), np.array([-180.0, 179.0]))
    assert grid.shape == (ROWS, COLUMNS)
    assert grid[0, 0] == 1.0
    assert grid[0, COLUMNS - 1] == 1.0
    assert grid[ROWS - 1, 359] == 2.0
    assert np.isfinite(grid).sum() == 3


def test_reads_the_regional_grid_without_tide_gauges() -> None:
    maps = read_maps(regional_file(), REGIONAL[0])
    assert [each.year for each in maps] == list(MAP_YEARS)
    median, low, high = maps[0].grids
    assert median[90 - 52, 180 + 4] == pytest.approx(0.6)
    assert low[90 - 52, 180 + 4] == pytest.approx(0.6 - 0.33)
    assert high[90 - 52, 180 + 4] == pytest.approx(0.6 + 0.33)
    assert median[90 + 10, 359] == pytest.approx(-0.4)
    assert median[90, 0] == pytest.approx(0.2)
    assert median[90 - 40, 180 - 74] != median[90 - 40, 180 - 74]  # the tide gauge: NaN
    assert ocean_mean(median) == pytest.approx(
        (0.6 * math.cos(math.radians(52)) + 0.2 - 0.4 * math.cos(math.radians(10)))
        / (math.cos(math.radians(52)) + 1 + math.cos(math.radians(10)))
    )


def test_builds_the_curves_and_maps_from_the_archives(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    global_members = {each.member("global"): global_file(50) for each in GLOBAL}
    regional_members = {each.member("regional"): regional_file() for each in REGIONAL}
    monkeypatch.setattr(
        ar6_sealevel,
        "GLOBAL_SHA256",
        {
            each.id: hashlib.sha256(global_members[each.member("global")]).hexdigest()
            for each in GLOBAL
        },
    )
    monkeypatch.setattr(
        ar6_sealevel,
        "REGIONAL_SHA256",
        {
            each.id: hashlib.sha256(regional_members[each.member("regional")]).hexdigest()
            for each in REGIONAL
        },
    )
    global_zip = archive(global_members)
    regional_zip = archive(regional_members)

    def fetch_global(start: int, length: int) -> bytes:
        return global_zip[start : start + length]

    def fetch_regional(start: int, length: int) -> bytes:
        return regional_zip[start : start + length]

    count = build(fetch_global, len(global_zip), fetch_regional, len(regional_zip), tmp_path)
    assert count == len(REGIONAL) * len(MAP_YEARS)
    index = json.loads((tmp_path / "index.json").read_text())  # pyright: ignore[reportAny]
    assert index["schemaVersion"] == 1
    assert index["licence"] == "CC BY 4.0"
    assert index["baseline"] == "1995\u20132014"
    curves: list[dict[str, str]] = index["curves"]  # pyright: ignore[reportAny]
    assert [curve["id"] for curve in curves] == [each.id for each in GLOBAL]
    assert curves[1]["scenario"] == "SSP1-2.6"
    assert index["curves"][0]["values"][2][-1] == pytest.approx(0.65)
    assert index["lowest"] == LOWEST
    assert index["highest"] == HIGHEST
    first: str = index["maps"][0]["file"]  # pyright: ignore[reportAny]
    assert first == "ssp126-medium-2050.png"
    pixels = np.asarray(Image.open(tmp_path / first), dtype=np.int64)
    assert pixels.shape == (ROWS, COLUMNS, 4)
    bands: list[int] = pixels[90 - 52, 180 + 4].tolist()  # pyright: ignore[reportAny]
    red, green, blue, alpha = bands
    assert decode(red, LOWEST, HIGHEST) == pytest.approx(0.6, abs=0.03)
    assert decode(green, LOWEST, HIGHEST) == pytest.approx(0.27, abs=0.03)
    assert decode(blue, LOWEST, HIGHEST) == pytest.approx(0.93, abs=0.03)
    assert alpha == 255
    # Spread a node inland, but flagged as not AR6's.
    inland: list[int] = pixels[90 - 53, 180 + 4].tolist()  # pyright: ignore[reportAny]
    assert inland[3] == 0
    assert decode(inland[0], LOWEST, HIGHEST) == pytest.approx(0.6, abs=0.03)
