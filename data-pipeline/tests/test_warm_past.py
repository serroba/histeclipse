import io
import math
import struct
from typing import TYPE_CHECKING

import h5py
import numpy as np
import pytest
from PIL import Image

from histeclipse_pipeline.paleotemp import COLUMNS, ROWS
from histeclipse_pipeline.warm_past import (
    COLDEST,
    WARMEST,
    SeaLevel,
    area_mean,
    build,
    decode,
    encode,
    file_id,
    fill_gaps,
    read_models,
    read_pliomip2,
    to_nodes,
)
from tests.json_values import JsonValue, read_json
from tests.test_cesm import netcdf3

if TYPE_CHECKING:
    from pathlib import Path

    from histeclipse_pipeline.warm_past import Grid

#: A coarse cell-centred grid like the atlas's: latitude ascending, longitude from 180° W.
LATITUDE = np.array([-60.0, -20.0, 20.0, 60.0])
LONGITUDE = np.arange(-157.5, 180.0, 45.0)
FILL = 9.96921e36


def atlas(change: Grid, names: tuple[str, ...] = ("Model-A", "Model_B.2")) -> bytes:
    """An atlas ensemble-difference file: a change per model, with names and years."""
    out = io.BytesIO()
    years = np.array([f"{index}01-{index}12" for index in range(len(names))], dtype=np.bytes_)
    with h5py.File(out, "w") as written:
        _ = written.create_dataset("lat", data=LATITUDE)
        _ = written.create_dataset("lon", data=LONGITUDE)
        _ = written.create_dataset("tas", data=change.astype(np.float32))
        _ = written.create_dataset("model_name", data=np.array(names, dtype=np.bytes_))
        _ = written.create_dataset("years_averaged", data=years)
        _ = written.create_dataset("piControl_years_averaged", data=years)
    return out.getvalue()


def entries(value: JsonValue) -> list[dict[str, JsonValue]]:
    assert isinstance(value, list)
    out: list[dict[str, JsonValue]] = []
    for item in value:
        assert isinstance(item, dict)
        out.append(item)
    return out


def pliomip2(value: float = 3.0) -> bytes:
    """The AR6 file: one record of tas on a 0°-360° grid, latitude ascending."""
    longitude = np.arange(0.0, 360.0, 45.0)
    tas = np.full((1, len(LATITUDE), len(longitude)), value)
    data = bytearray(
        netcdf3(
            {"time": 0, "latitude": len(LATITUDE), "longitude": len(longitude)},
            {
                "longitude": (("longitude",), longitude),
                "latitude": (("latitude",), LATITUDE),
                "tas": (("time", "latitude", "longitude"), tas),
            },
        )
    )
    data[4:8] = struct.pack(">I", 1)
    return bytes(data)


def grid(value: float) -> Grid:
    return np.full((len(LATITUDE), len(LONGITUDE)), value)


def test_reads_each_models_change_names_and_years() -> None:
    change = np.stack([grid(1.0), grid(2.0)])
    change[1, 0] = FILL
    models = read_models(atlas(change))
    assert models.names == ("Model-A", "Model_B.2")
    assert models.years == ("001-012", "101-112")
    assert models.control_years == models.years
    assert bool(np.all(np.isnan(models.change[1:2, 0])))
    assert models.change[0, 0, 0] == pytest.approx(1.0)


def test_rejects_names_that_do_not_match_the_maps() -> None:
    with pytest.raises(ValueError, match="1 model names for 2 maps"):
        _ = read_models(atlas(np.stack([grid(1.0), grid(2.0)]), names=("only",)))


def test_reads_the_pliomip2_mean_from_its_one_record() -> None:
    latitude, longitude, change = read_pliomip2(pliomip2(2.5))
    assert latitude.tolist() == LATITUDE.tolist()
    assert longitude[0] == 0.0
    assert change.shape == (len(LATITUDE), 8)
    assert np.allclose(change, 2.5)


def test_fills_gaps_from_the_row_or_the_nearest_full_row() -> None:
    field = np.array([[np.nan, np.nan], [1.0, np.nan], [2.0, 4.0], [np.nan, np.nan]])
    filled = fill_gaps(field)
    assert filled.tolist() == [[1.0, 1.0], [1.0, 1.0], [2.0, 4.0], [3.0, 3.0]]
    with pytest.raises(ValueError, match="no values"):
        _ = fill_gaps(np.full((2, 2), np.nan))


def test_weights_the_mean_by_area() -> None:
    assert area_mean(grid(2.0), LATITUDE) == pytest.approx(2.0)
    field = grid(0.0)
    field[-1] = 1.0  # only 60° N, which has half the weight of the 20° rows
    share = 0.5 / (1.0 + 2 * math.cos(math.radians(20)))
    assert area_mean(field, LATITUDE) == pytest.approx(share)


def test_regrids_from_180_west_onto_the_nodes() -> None:
    field = np.tile(np.mod(LONGITUDE, 360), (len(LATITUDE), 1))
    out = to_nodes(field, LATITUDE, LONGITUDE)
    assert out.shape == (ROWS, COLUMNS)
    middle = COLUMNS // 2  # 0°
    assert out[90, middle + 30] == pytest.approx(30.0)
    assert out[90, middle + 90] == pytest.approx(90.0)
    assert np.allclose(out[:, 0], out[:, -1])


def test_packs_change_into_bytes_and_back() -> None:
    packed = encode(np.array([COLDEST - 5, 0.0, WARMEST + 5]))
    assert packed.tolist() == [0, 76, 255]
    assert decode(0) == COLDEST
    assert decode(255) == WARMEST
    assert decode(76) == pytest.approx(0.0, abs=0.2)


def test_names_files_after_models() -> None:
    assert file_id("NorESM1-F") == "noresm1-f"
    assert file_id("EC-Earth3.3_x") == "ec-earth3-3-x"


def test_gives_only_the_numbers_a_source_states() -> None:
    assert SeaLevel("a", 1.0, 2.0, None, "n").as_json() == {
        "source": "a",
        "low": 1.0,
        "high": 2.0,
        "note": "n",
    }
    assert SeaLevel("b", None, None, None, "n").as_json() == {"source": "b", "note": "n"}


def test_builds_every_map_and_the_index(tmp_path: Path) -> None:
    annual = np.stack([grid(1.0), grid(-1.0)])
    annual[0, -1] = FILL  # one model leaves its northern row empty
    monthly = np.zeros((2, 12, len(LATITUDE), len(LONGITUDE)))
    monthly[:, 5:8] = 4.0  # June to August
    plio = np.stack([grid(5.0), grid(2.0)])
    count = build(atlas(annual), atlas(monthly), atlas(plio), pliomip2(3.0), tmp_path / "warmpast")
    assert count == 4 + 3
    index = read_json(tmp_path / "warmpast" / "index.json")
    assert isinstance(index, dict)
    assert index["schemaVersion"] == 1
    assert index["units"] == "°C"
    assert (index["coldest"], index["warmest"]) == (COLDEST, WARMEST)
    lig, plio_period = entries(index["periods"])
    lig_maps = entries(lig["maps"])
    assert [each["id"] for each in lig_maps] == ["ensemble", "ensemble-jja", "model-a", "model-b-2"]
    means = {str(each["id"]): each["mean"] for each in lig_maps}
    assert means["ensemble-jja"] == 4.0
    assert means["model-a"] == 1.0
    # Where only model B has a value, the ensemble mean is its value.
    ensemble = means["ensemble"]
    assert isinstance(ensemble, float)
    assert -1.0 < ensemble < 0.0
    assert entries(lig["seaLevel"])[0]["source"] == "dutton2015"
    assert lig_maps[2]["years"] == "001-012"
    assert "years" not in lig_maps[0]
    assert entries(plio_period["maps"])[0] == {
        "id": "pliomip2",
        "label": "PlioMIP2 ensemble mean",
        "file": "mpwp/pliomip2.png",
        "season": "annual",
        "source": "ar6Fig713",
        "models": 17,
        "mean": 3.0,
    }
    sea_level = entries(plio_period["seaLevel"])
    assert [each["source"] for each in sea_level] == ["dumitru2019", "dutton2015"]
    with Image.open(tmp_path / "warmpast" / "mpwp" / "pliomip2.png") as image:
        assert image.size == (COLUMNS, ROWS)
        pixel = int(np.asarray(image, dtype=np.uint8)[90:91, 180:181].sum())
    assert decode(pixel) == pytest.approx(3.0, abs=0.1)
