import gzip
import io
from typing import TYPE_CHECKING

import h5py
import numpy as np
import pytest

from histeclipse_pipeline.extremes import INDICES, build, file_url, read_index
from histeclipse_pipeline.water_cycle import decode
from tests.manifests import by_id, manifest, number, numbers, pixel

if TYPE_CHECKING:
    from pathlib import Path

#: HadEX3's grid, coarsened: latitudes south first, longitudes 0-360.
LATITUDE = np.array([-45.0, 45.0])
LONGITUDE = np.array([45.0, 135.0, 225.0, 315.0])


def node(latitude: int, longitude: int) -> tuple[int, int]:
    return 90 - latitude, longitude + 180


def index_file(rise: float) -> bytes:
    """An index, 1901-2018: 30 everywhere, rising by ``rise`` a year from 1951 at 45° N 45° E.

    45° S 45° E has data only before 1990, too few years for a trend; 45° S 135° E none.
    """
    years = np.arange(1901, 2019)
    fields = np.full((len(years), 2, 4), 30.0, dtype=np.float32)
    fields[:, 1, 0] += np.where(years >= 1951, (years - 1951) * rise, 0.0).astype(np.float32)
    fields[years >= 1990, 0, 0] = -99.9
    fields[:, 0, 1] = -99.9
    out = io.BytesIO()
    with h5py.File(out, "w") as opened:
        _ = opened.create_dataset("time", data=years.astype(np.float64))
        _ = opened.create_dataset("latitude", data=LATITUDE)
        _ = opened.create_dataset("longitude", data=LONGITUDE)
        _ = opened.create_dataset("Ann", data=fields)
    return gzip.compress(out.getvalue())


def test_reads_an_index_with_missing_values() -> None:
    years, fields, latitude, longitude = read_index(index_file(0.1))
    assert (years[0], years[-1]) == (1901, 2018)
    assert fields.shape == (118, 2, 4)
    assert np.isnan(fields.item(0, 0, 1))
    assert latitude.tolist() == LATITUDE.tolist()
    assert longitude.tolist() == LONGITUDE.tolist()


def test_writes_trend_maps_and_curves(tmp_path: Path) -> None:
    out = tmp_path / "extremes"
    assert build({"txx": index_file(0.02), "rx1day": index_file(0.5)}, out) == 2
    index = manifest(out)
    assert str(index["licence"]).startswith("Open Government Licence v3")
    assert index["baseline"] == "1961\u20131990"
    maps = by_id(index["maps"])
    assert maps["txx"]["units"] == "\u00b0C per decade"
    assert maps["rx1day"]["index"] == "Rx1day"
    bound = number(maps["txx"]["bound"])
    image = out / "txx.png"
    red, green, blue, alpha = pixel(image, node(45, 45))
    assert decode(red, bound) - decode(green, bound) == pytest.approx(0.2, abs=bound / 100)
    assert (blue, alpha) == (255, 255)
    assert pixel(image, node(-45, 45))[3] == 0  # too few years
    assert pixel(image, node(-45, 135))[3] == 0  # no data
    curves = by_id(index["curves"])
    assert numbers(curves["rx1day"]["years"])[0] == 1951
    wettest = numbers(curves["rx1day"]["values"])
    assert wettest[-1] > wettest[0]


def test_names_the_files() -> None:
    assert set(INDICES) == {"txx", "rx1day"}
    assert file_url("TXx").endswith("/HadEX3_TXx_1901-2018_ADW_61-90_1.25x1.875deg.nc.gz")
