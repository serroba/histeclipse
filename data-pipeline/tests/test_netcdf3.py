import numpy as np
import pytest

from histeclipse_pipeline.netcdf3 import read_netcdf3
from tests.netcdf3_files import Var, netcdf3


def sample(version: int = 1) -> bytes:
    """Two record variables (interleaved, padded), a fixed one, text, and attributes."""
    rain = np.arange(3 * 2 * 3, dtype=np.float64).reshape(3, 2, 3)
    count = np.arange(3 * 2 * 3, dtype=np.float64).reshape(3, 2, 3) * 10
    return netcdf3(
        {"time": 0, "lat": 2, "lon": 3, "chars": 5},
        {
            "lat": Var(("lat",), np.array([10.0, -10.0]), ">f8", {"units": "degrees_north"}),
            "name": Var(("chars",), b"hello"),
            "rain": Var(("time", "lat", "lon"), rain, ">f4", {"_FillValue": -9.5, "units": "mm"}),
            "count": Var(("time", "lat", "lon"), count, ">i2"),
        },
        records=3,
        global_attributes={"title": "test", "scale": 2.0},
        version=version,
    )


@pytest.mark.parametrize("version", [1, 2])
def test_reads_fixed_and_interleaved_record_variables(version: int) -> None:
    variables, attributes = read_netcdf3(sample(version))
    assert attributes == {"title": "test", "scale": (2.0,)}
    assert "name" not in variables  # text is skipped
    assert variables["lat"].values.tolist() == [10.0, -10.0]
    assert variables["lat"].attributes == {"units": "degrees_north"}
    rain = variables["rain"]
    assert rain.values.shape == (3, 2, 3)
    assert rain.values[2, 1, 2] == 17.0
    assert rain.number("_FillValue") == -9.5
    assert rain.number("units") is None
    assert rain.number("missing") is None
    assert variables["count"].values[1, 0, 0] == 60.0


def test_reads_a_lone_record_variable_unpadded() -> None:
    # Three bytes a record: a lone record variable's records are not padded to four.
    values = np.array([[1.0, 2.0, 3.0], [4.0, 5.0, 6.0]])
    data = netcdf3({"time": 0, "x": 3}, {"v": Var(("time", "x"), values, ">i1")}, records=2)
    variables, _ = read_netcdf3(data)
    assert variables["v"].values.tolist() == values.tolist()


def test_rejects_what_it_cannot_read() -> None:
    with pytest.raises(ValueError, match="not a classic NetCDF-3"):
        _ = read_netcdf3(b"\x89HDF\r\n\x1a\n")
    streaming = bytearray(sample())
    streaming[4:8] = b"\xff\xff\xff\xff"
    with pytest.raises(ValueError, match="record count is unknown"):
        _ = read_netcdf3(bytes(streaming))
    bad_tag = bytearray(sample())
    bad_tag[8:12] = (11).to_bytes(4, "big")
    with pytest.raises(ValueError, match="expected dimensions"):
        _ = read_netcdf3(bytes(bad_tag))
    bad_type = bytearray(netcdf3({"x": 1}, {"v": Var(("x",), np.zeros(1), ">f8")}))
    # The variable's type code sits just before its vsize and begin, at the end of the header.
    bad_type[-8 - 8 - 4 : -8 - 8] = (9).to_bytes(4, "big")
    with pytest.raises(ValueError, match="unsupported NetCDF type 9"):
        _ = read_netcdf3(bytes(bad_type))
