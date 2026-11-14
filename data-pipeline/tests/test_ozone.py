import json
from typing import TYPE_CHECKING, cast

import pytest

from histeclipse_pipeline.ozone import (
    PUBLIC_DOMAIN,
    history_file,
    read_odgi,
    read_ozone_watch,
    write_history,
)

if TYPE_CHECKING:
    from pathlib import Path

# As Ozone Watch's annual file is laid out, its years cut short, 1995 left out as in the file.
WATCH = """# http://ozonewatch.gsfc.nasa.gov/meteorology/annual_data.txt
# TOMS. OMI. and OMPS data
# Missing data filled from NASA GMAO MERRA, MERRA-2, and GEOS FP
# Southern Hemisphere
# Ozone hole area mean (07 September -- 13 October)
# Minimum ozone (21 September -- 16 October)
      O3 Hole Area Minimum Ozone
Year     (mil km2)          (DU)
----  ------------ -------------
1979           0.1         225.0
1980           1.4         203.0
1994          23.6          92.3
1996          22.8         108.8
2025          18.7         138.3
"""

ANTARCTIC = """Year,CFC-12,CFC-11,SUM* (ppt),EESC SUM (ppt),ODGI(old) Antarctic,ODGI(new) Antarctic
1992,861,789,4184,3544,97.7,69.6
2024,832,641,3438,3583,0.0,71.6
,,,,,,
*Notes: the sum of the gases weighted by their ozone-depleting power,,,,,,
"""

MIDLATITUDE = """Year,CFC-12,CFC-11,SUM* (ppt),EESC SUM (ppt; new),\
ODGI(old) Mid Latitude,ODGI(new) Mid-Lat
1992,230,375,1945,1795,98.8,82.0
2024,226,350,1890,1500,0.0,45.3
"""


def test_reads_each_spring_of_the_hole_and_marks_a_year_with_no_satellite_as_missing() -> None:
    rows = read_ozone_watch(WATCH)
    assert rows[0] == [1979, 0.1, 225.0]
    assert rows[-1] == [2025, 18.7, 138.3]
    assert [1995, None, None] in rows
    # Every year from the first to the last, in order.
    assert [cast("list[object]", row)[0] for row in rows] == list(range(1979, 2026))


def test_refuses_a_file_that_no_longer_says_its_windows() -> None:
    with pytest.raises(ValueError, match="windows"):
        _ = read_ozone_watch(WATCH.replace("07 September", "1 September"))


def test_refuses_a_file_with_no_years() -> None:
    header = "\n".join(WATCH.splitlines()[:9])
    with pytest.raises(ValueError, match="no years"):
        _ = read_ozone_watch(header)


def test_reads_the_index_by_its_new_columns_leaving_the_notes_out() -> None:
    assert read_odgi(ANTARCTIC) == [[1992, 3544.0, 69.6], [2024, 3583.0, 71.6]]
    assert read_odgi(MIDLATITUDE) == [[1992, 1795.0, 82.0], [2024, 1500.0, 45.3]]


def test_refuses_an_index_table_without_its_columns_or_years() -> None:
    with pytest.raises(ValueError, match="columns"):
        _ = read_odgi(ANTARCTIC.replace("ODGI(new) Antarctic", "ODGI Antarctic"))
    with pytest.raises(ValueError, match="no years"):
        _ = read_odgi(ANTARCTIC.splitlines()[0])


def test_writes_one_file_crediting_each_source(tmp_path: Path) -> None:
    years = write_history(WATCH, ANTARCTIC, MIDLATITUDE, tmp_path / "ozone")
    assert years == 47
    written = cast("dict[str, object]", json.loads((tmp_path / "ozone/history.json").read_text()))
    assert written == history_file(WATCH, ANTARCTIC, MIDLATITUDE)
    hole = cast("dict[str, object]", written["hole"])
    gases = cast("dict[str, object]", written["gases"])
    assert hole["missing"] == [*range(1981, 1994), 1995, *range(1997, 2025)]
    assert hole["licence"] == PUBLIC_DOMAIN
    assert "NASA Ozone Watch" in cast("str", hole["credit"])
    assert "Montzka" in cast("str", gases["credit"])
    assert gases["antarctic"] == [[1992, 3544.0, 69.6], [2024, 3583.0, 71.6]]
