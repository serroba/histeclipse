import hashlib
import io
import json
from typing import TYPE_CHECKING
from unittest.mock import ANY

import numpy as np
import pytest
from PIL import Image

from histeclipse_pipeline.krapp import decode
from histeclipse_pipeline.paleotemp import COLUMNS, ROWS
from histeclipse_pipeline.sky import verified
from histeclipse_pipeline.warming_levels import (
    CONFLICTING,
    CROSSING,
    LEVELS,
    NOT_ROBUST,
    PRECIPITATION,
    ROBUST,
    TEMPERATURE,
    Variable,
    area_mean,
    build,
    crossing_of,
    file_name,
    read_panel,
    scale,
)
from tests.test_cesm import netcdf3

if TYPE_CHECKING:
    from pathlib import Path

LATITUDE = np.arange(-89.5, 90.0, 1.0)
LONGITUDE = np.arange(0.5, 360.0, 1.0)


def panel(field: str, change: float, *, fill_pole: bool = False) -> bytes:
    """A 1° panel like the report's: ``change`` everywhere, more in the far north; the
    northern half hatched, a band near the equator cross-hatched."""
    values = np.full((1, 180, 360), change)
    values[0, 170:, :] = change * 2  # north of 80° N
    if fill_pole:
        values[0, 0, :] = 1e36
    hatch = np.zeros((1, 180, 360))
    hatch[0, 90:, :] = 1.0
    cross = np.zeros((1, 180, 360))
    cross[0, 88:92, :] = 1.0
    return netcdf3(
        {"panel": 1, "lat": 180, "lon": 360},
        {
            "lat": (("lat",), LATITUDE),
            "lon": (("lon",), LONGITUDE),
            field: (("panel", "lat", "lon"), values),
            "hatch": (("panel", "lat", "lon"), hatch),
            "crosshatch": (("panel", "lat", "lon"), cross),
            "model_nr": (("panel",), np.array([42.0])),
        },
    )


def node(latitude: int, longitude: int) -> tuple[int, int]:
    return 90 - latitude, longitude + 180


def test_reads_a_panel_and_turns_fill_into_no_data() -> None:
    read = read_panel(panel("tas", 1.5, fill_pole=True), "tas")
    assert read.models == 42
    assert read.change.shape == (180, 360)
    assert bool(np.isnan(read.change[0, :]).all())
    assert read.change[100, 0] == pytest.approx(1.5)
    with pytest.raises(ValueError, match="no pr"):
        _ = read_panel(panel("tas", 1.5), "pr")


def test_rejects_more_than_one_panel() -> None:
    data = netcdf3(
        {"panel": 2, "lat": 1, "lon": 1},
        {
            "lat": (("lat",), np.array([0.5])),
            "lon": (("lon",), np.array([0.5])),
            "tas": (("panel", "lat", "lon"), np.zeros((2, 1, 1))),
            "hatch": (("panel", "lat", "lon"), np.zeros((2, 1, 1))),
            "crosshatch": (("panel", "lat", "lon"), np.zeros((2, 1, 1))),
            "model_nr": (("panel",), np.array([1.0, 1.0])),
        },
    )
    with pytest.raises(ValueError, match="one panel"):
        _ = read_panel(data, "tas")


def test_rounds_the_scale_outward_and_keeps_zero_on_it() -> None:
    assert scale([np.array([0.4, 3.2]), np.array([np.nan, 5.1])], 1.0) == (0.0, 6.0)
    assert scale([np.array([-46.0, 177.0])], 10.0) == (-50.0, 180.0)


def test_weights_the_mean_by_area() -> None:
    values = np.array([[1.0], [3.0], [np.nan]])
    latitude = np.array([0.0, 60.0, 30.0])
    assert area_mean(values, latitude) == pytest.approx((1.0 + 3.0 * 0.5) / 1.5)


def test_names_maps_by_variable_and_level() -> None:
    assert file_name("temperature", 1.5) == "temperature-1.5.png"
    assert file_name("precipitation", 2.0, "-robustness") == "precipitation-2-robustness.png"


def test_gives_each_level_its_crossing_periods_from_table_4_5() -> None:
    assert set(CROSSING) == {level for level, _ in LEVELS}
    for level in CROSSING:
        for central, early, late in CROSSING[level].values():
            for period in (central, early, late):
                if period is not None:
                    assert period[1] - period[0] == 19
            # The very likely range brackets the central estimate.
            if central is not None:
                assert early is not None
                assert early[0] <= central[0]
                assert late is None or late[0] >= central[0]
    middle = crossing_of(2.0)[2]
    assert middle == {
        "scenario": "SSP2-4.5",
        "central": [2043, 2062],
        "early": [2028, 2047],
        "late": [2075, 2094],
    }
    assert crossing_of(4.0)[0] == {
        "scenario": "SSP1-1.9",
        "central": None,
        "early": None,
        "late": None,
    }


def pinned(variable: Variable, files: dict[tuple[int, str], bytes]) -> Variable:
    """The variable with its checksums pinned to the synthetic files."""
    a, b, c, d = (
        hashlib.sha256(files[variable.figure, letter]).hexdigest() for _, letter in LEVELS
    )
    return Variable(
        variable.id, variable.field, variable.figure, variable.units, variable.step, (a, b, c, d)
    )


def level_entry(variable: str, level: float, mean: float) -> dict[str, object]:
    return {
        "level": level,
        "file": file_name(variable, level),
        "robustness": file_name(variable, level, "-robustness"),
        "mean": pytest.approx(mean, rel=0.02),
        "models": 42,
    }


def test_builds_maps_robustness_and_an_index(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    files: dict[tuple[int, str], bytes] = {}
    for level, letter in LEVELS:
        files[31, letter] = panel("tas", level)
        files[32, letter] = panel("pr", level * 5)
    variables = (pinned(TEMPERATURE, files), pinned(PRECIPITATION, files))
    monkeypatch.setattr("histeclipse_pipeline.warming_levels.VARIABLES", variables)

    def read(variable: Variable, letter: str, sha256: str) -> bytes:
        return verified(files[variable.figure, letter], sha256, "panel")

    assert build(read, tmp_path) == 16
    index: dict[str, object] = json.loads((tmp_path / "index.json").read_text())  # pyright: ignore[reportAny]
    assert index["schemaVersion"] == 1
    assert index["licence"] == "CC BY 4.0"
    assert index["baseline"] == "1850\u20131900"
    assert (index["columns"], index["rows"]) == (COLUMNS, ROWS)
    # The far north counts double, but is small.
    assert index["variables"] == {
        "temperature": {
            "units": "°C",
            "low": 0.0,
            "high": 8.0,
            "levels": [level_entry("temperature", level, level) for level, _ in LEVELS],
        },
        "precipitation": {
            "units": "%",
            "low": 0.0,
            "high": 40.0,
            "levels": [level_entry("precipitation", level, level * 5) for level, _ in LEVELS],
        },
    }
    assert index["crossing"] == {
        "note": ANY,
        "levels": [{"level": level, "scenarios": crossing_of(level)} for level, _ in LEVELS],
    }

    image = np.asarray(
        Image.open(io.BytesIO((tmp_path / "temperature-2.png").read_bytes())), dtype=np.int64
    )
    assert image.shape == (ROWS, COLUMNS, 4)
    row, column = node(-30, 0)
    red, green, blue, alpha = (image.item(row, column, band) for band in range(4))
    assert decode(red, 0.0, 8.0) == pytest.approx(2.0, abs=0.02)
    assert decode(green, 0.0, 8.0) == pytest.approx(0.0)
    assert (blue, alpha) == (255, 255)
    assert decode(image.item(*node(85, 10), 0), 0.0, 8.0) == pytest.approx(4.0, abs=0.02)

    robust = np.asarray(
        Image.open(io.BytesIO((tmp_path / "temperature-2-robustness.png").read_bytes()))
    )
    assert robust.shape == (ROWS, COLUMNS)
    assert robust.item(*node(-30, 0)) == ROBUST
    assert robust.item(*node(30, 0)) == NOT_ROBUST
    assert robust.item(*node(0, 0)) == CONFLICTING
    assert robust.item(*node(0, 180)) == CONFLICTING  # the 180° meridian wraps


def test_refuses_a_file_that_is_not_the_pinned_one(tmp_path: Path) -> None:
    def read(variable: Variable, letter: str, sha256: str) -> bytes:
        return verified(panel(variable.field, 1.0), sha256, f"{variable.id} {letter}")

    with pytest.raises(ValueError, match="does not match the pinned"):
        _ = build(read, tmp_path)
