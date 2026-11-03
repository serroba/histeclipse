"""Tests for the ice-core CO2 and methane records."""

from histeclipse_pipeline.atmosphere import Point, atmosphere_file, parse_ch4, parse_co2

CO2 = """# Antarctic Ice Cores Revised 800KYr CO2 Data
# Data line format - tab-delimited text
age_gas_calBP\tco2_ppm\tco2_1s_ppm
805668.87\t207.29\t2.20
-51.03\t368.02\t0.06
"""

CH4 = """EPICA Dome C Ice Core 800KYr Methane Data
Column 2: Gas Age (EDC3 gas age, years before 1950 AD)

Depth      Gas Age   CH4 mean   1s    Lab.
99.34           13     907      10      b
3190.53     799396     399      10      g
"""


def test_reads_the_co2_composite_youngest_first() -> None:
    assert parse_co2(CO2) == [
        Point(ka=-0.05103, value=368.02, sigma=0.06),
        Point(ka=805.66887, value=207.29, sigma=2.2),
    ]


def test_reads_the_methane_record() -> None:
    assert parse_ch4(CH4) == [
        Point(ka=0.013, value=907.0, sigma=10.0),
        Point(ka=799.396, value=399.0, sigma=10.0),
    ]


def test_the_site_file_gives_each_gas_its_unit_sources_and_points() -> None:
    data = atmosphere_file(parse_co2(CO2), parse_ch4(CH4))
    gases = data["gases"]
    assert isinstance(gases, list)
    co2, ch4 = gases
    assert isinstance(co2, dict)
    assert isinstance(ch4, dict)
    assert (co2["unit"], co2["preindustrial"], co2["doi"]) == ("ppm", 278, "10.1002/2014GL061957")
    assert co2["points"] == [[-0.051, 368.02, 0.06], [805.669, 207.29, 2.2]]
    assert (ch4["unit"], ch4["preindustrial"]) == ("ppb", 729)
