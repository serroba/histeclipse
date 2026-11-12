"""Natural forcing: CMIP6 and Steinhilber solar irradiance, and eVolv2k volcanic sulfur."""

from __future__ import annotations

import gzip
import io

import h5py
import numpy as np
import pytest

from histeclipse_pipeline.natural_forcing import (
    CMIP6_YEARS,
    STEINHILBER_REFERENCE,
    annual_means,
    cmip6_file,
    evolv2k_file,
    read_cmip6,
    read_evolv2k,
    read_steinhilber,
    steinhilber_file,
)


def cmip6(years: list[float], tsi: list[float]) -> bytes:
    """A small gzipped HDF5 file shaped like the CMIP6 monthly file."""
    buffer = io.BytesIO()
    with h5py.File(buffer, "w") as file:
        _ = file.create_dataset("calyear", data=np.asarray(years, dtype=np.float64))
        _ = file.create_dataset("tsi", data=np.asarray(tsi, dtype=np.float32))
    return gzip.compress(buffer.getvalue())


def test_averages_each_year_and_refuses_a_gap() -> None:
    years = [1850, 1850, 1851, 1852, 1853]
    assert annual_means(years, [1.0, 3.0, 5.0, 7.0, 9.0], 1850, 1852) == [2.0, 5.0, 7.0]
    with pytest.raises(ValueError, match="no values for 1851"):
        _ = annual_means([1850, 1852], [1.0, 2.0], 1850, 1852)


def test_reads_the_cmip6_file_and_keeps_the_historical_years() -> None:
    first, last = CMIP6_YEARS
    years = [float(year) for year in range(first, last + 2) for _ in range(2)]
    tsi = [1361.0 + 0.5 * (index % 2) for index in range(len(years))]
    read_years, read_tsi = read_cmip6(cmip6(years, tsi))
    assert read_years[:3] == [1850, 1850, 1851]
    built = cmip6_file(read_years, read_tsi, "2026-11-12")
    assert built["firstYear"] == first
    assert built["unit"] == "W/m²"
    assert built["accessed"] == "2026-11-12"
    values = built["tsi"]
    assert isinstance(values, list)
    assert len(values) == last - first + 1
    assert values[0] == 1361.25


STEINHILBER = """# 9400 Year Cosmogenic Isotope Data and Solar Activity Reconstruction
# Investigators: Steinhilber, F.; Fröhlich
## TSI\tsolar irradiance
age_calBP\t1.PC\t1.PCErr\tPhi\tPhiErr\tTSI\tTSIErr
-27\t1\t0.03\t617\t63\t0.31\t0.53

9389\t1.35\t0.09\t142\t148\t-0.38\t0.39
-5\t1\t0.03\t611\t56\t0.3\t0.52
"""


def test_reads_steinhilber_oldest_first_in_years_ce() -> None:
    rows = read_steinhilber(STEINHILBER)
    assert [row.year for row in rows] == [-7439, 1955, 1977]
    assert rows[0].tsi == -0.38
    assert rows[0].tsi_sigma == 0.39
    assert rows[0].phi == 142.0
    assert rows[0].phi_sigma == 148.0
    built = steinhilber_file(rows, "2026-11-12")
    assert built["reference"] == STEINHILBER_REFERENCE
    assert built["year"] == [-7439, 1955, 1977]
    assert built["tsi"] == [-0.38, 0.3, 0.31]
    assert built["tsiSigma"] == [0.39, 0.52, 0.53]
    assert built["phi"] == [142.0, 611.0, 617.0]
    assert built["phiSigma"] == [148.0, 56.0, 63.0]


def test_refuses_a_steinhilber_file_without_data() -> None:
    with pytest.raises(ValueError, match="no data lines"):
        _ = read_steinhilber("# only comments\n")


EVOLV2K = (
    "/* DATA DESCRIPTION:\n"
    "Citation:\tSigl, Michael; Toohey, Matthew (2024)\n"
    "*/\n"
    "Eruption [a AD]\tEruption ISO\tMonth\tDay\tLatitude\tG\tA\tVSSI\tsd\tAsy\tLocation\tT\tRef\n"
    "1883\t1883\t8\t27\t-6.0\t17.6\t10.4\t9.34\t1.91\t0.629\tKrakatao (Indonesia)\tN\teVolv2k\n"
    "432\t433\t1\t1\t13.7\t14.7\t27.2\t13.98\t2.23\t0.351\tIlopango,  TBJ\tY\teVolv2k\n"
    "-491\t-490\t1\t1\t0.0\t18.9\t3.8\t7.56\t2.34\t0.832\tN/A\tN\teVolv2k\n"
    "a short line\n"
)


def test_reads_evolv2k_oldest_first_and_names_its_year_mismatches() -> None:
    events = read_evolv2k(EVOLV2K)
    assert [event.year for event in events] == [-490, 433, 1883]
    assert events[0].location is None
    assert events[1].location == "Ilopango, TBJ"
    built = evolv2k_file(events, "2026-11-12")
    assert built["year"] == [-490, 433, 1883]
    assert built["month"] == [1, 1, 8]
    assert built["day"] == [1, 1, 27]
    assert built["latitude"] == [0.0, 13.7, -6.0]
    assert built["sulfur"] == [7.56, 13.98, 9.34]
    assert built["sigma"] == [2.34, 2.23, 1.91]
    assert built["location"] == [None, "Ilopango, TBJ", "Krakatao (Indonesia)"]
    assert built["yearMismatches"] == [{"iso": 433, "listed": 432, "location": "Ilopango, TBJ"}]


def test_refuses_an_evolv2k_file_without_events() -> None:
    with pytest.raises(ValueError, match="no events"):
        _ = read_evolv2k("/* header */\nheading\n")
