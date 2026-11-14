"""The ozone layer's story since 1979: the Antarctic ozone hole, and the gases that made it (#722).

Two sources, written to ``history.json``:

- NASA Ozone Watch (NASA Goddard Space Flight Center; NASA official N. Kramarova, science contact
  P. A. Newman, curator L. R. Lait), credited as the site asks, "NASA Ozone Watch". Its
  ``annual_data.txt``: each spring since 1979, the Antarctic ozone hole's mean area (million km²,
  7 September to 13 October; where ozone is below 220 Dobson units, as NASA defines the hole)
  and the mean of its daily minimum ozone (Dobson units, 21 September to 16 October), from TOMS,
  OMI and OMPS, with gaps filled from NASA GMAO's MERRA, MERRA-2 and GEOS FP. It has no 1995:
  no satellite measured it, and the file leaves the year out; here it is written as missing, not
  filled. A work of the US Government, in the public domain in the US.
- The NOAA Ozone Depleting Gas Index (S. A. Montzka, G. Dutton and I. Vimont, NOAA Global
  Monitoring Laboratory, 2024 update): each year since 1992, the equivalent effective
  stratospheric chlorine (EESC, ppt) the measured gases add up to over Antarctica and at the
  mid-latitudes, and the index (ODGI, the "new" one since 2012): 100 at its peak, 0 at 1980's
  level, about when the ozone hole was first readily seen. A work of the US Government, in the
  public domain in the US.

Each download is checked against its checksum: the sources are updated every year, and a new
year is taken in by hand (#560).
"""

from __future__ import annotations

import csv
import io
import json
import urllib.request
from typing import TYPE_CHECKING

from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from pathlib import Path

USER_AGENT = "histeclipse-pipeline (https://github.com/serroba/histeclipse)"

OZONE_WATCH_URL = "https://ozonewatch.gsfc.nasa.gov/statistics/annual_data.txt"
OZONE_WATCH_SHA256 = "bdbd12e5a9c6add8321947dca7be710162fdf99b8a5c43540c8b83d6bf929679"
ODGI_ANTARCTIC_URL = "https://gml.noaa.gov/odgi/odgi_table1.csv"
ODGI_ANTARCTIC_SHA256 = "31c79112829fb886cdbdcca4caae15d49145cc96213b9957a6a39eb4e747566f"
ODGI_MIDLATITUDE_URL = "https://gml.noaa.gov/odgi/odgi_table2.csv"
ODGI_MIDLATITUDE_SHA256 = "621ab6079e46b2111728586c7b9e539a310f0bbc09a61f6917893dffbb5e610d"

PUBLIC_DOMAIN = "Public domain (a work of the US Government)"
#: Whom each part is credited to, as each asks.
HOLE_CREDIT = "NASA Ozone Watch (TOMS, OMI, OMPS; gaps from NASA GMAO MERRA, MERRA-2, GEOS FP)"
GASES_CREDIT = "Montzka, Dutton, Vimont: The NOAA Ozone Depleting Gas Index (NOAA GML, 2024)"

#: The windows Ozone Watch averages over, as its file says; checked when it is read.
AREA_WINDOW = "Ozone hole area mean (07 September -- 13 October)"
MINIMUM_WINDOW = "Minimum ozone (21 September -- 16 October)"

#: The columns read from the index's tables, by the names each file gives them.
EESC_COLUMNS = ("EESC SUM (ppt)", "EESC SUM (ppt; new)")
ODGI_COLUMNS = ("ODGI(new) Antarctic", "ODGI(new) Mid-Lat")


def read_ozone_watch(text: str) -> list[Json]:
    """Read each year's ozone hole, in order from the first year to the last.

    Each is ``[year, mean area (million km²), mean minimum (DU)]``; a year the file leaves out is
    ``[year, None, None]``.
    """
    if AREA_WINDOW not in text or MINIMUM_WINDOW not in text:
        msg = "Ozone Watch's annual file no longer says the windows it averages over"
        raise ValueError(msg)
    found: dict[int, tuple[float, float]] = {}
    for line in text.splitlines():
        fields = line.split()
        if len(fields) != len(("year", "area", "minimum")) or not fields[0].isdigit():
            continue
        found[int(fields[0])] = (float(fields[1]), float(fields[2]))
    if not found:
        msg = "Ozone Watch's annual file has no years"
        raise ValueError(msg)
    first, last = min(found), max(found)
    rows: list[Json] = []
    for year in range(first, last + 1):
        values = found.get(year)
        rows.append([year, None, None] if values is None else [year, values[0], values[1]])
    return rows


def _column(header: list[str], names: tuple[str, ...]) -> int:
    for name in names:
        if name in header:
            return header.index(name)
    msg = f"the index's table has none of the columns {', '.join(names)}"
    raise ValueError(msg)


def read_odgi(text: str) -> list[Json]:
    """Read each year of an index table as ``[year, EESC (ppt), ODGI]``, in the table's order.

    Its notes below the years are left out.
    """
    rows = list(csv.reader(io.StringIO(text)))
    header = [name.strip() for name in rows[0]]
    eesc = _column(header, EESC_COLUMNS)
    index = _column(header, ODGI_COLUMNS)
    out: list[Json] = []
    for row in rows[1:]:
        if not row or not row[0].strip().isdigit():
            continue
        out.append([int(row[0]), float(row[eesc]), float(row[index])])
    if not out:
        msg = "the index's table has no years"
        raise ValueError(msg)
    return out


def history_file(watch: str, antarctic: str, midlatitude: str) -> dict[str, Json]:
    """Make one file of the ozone hole's years and the index's, with whom to credit."""
    hole = read_ozone_watch(watch)
    missing: list[Json] = [row[0] for row in hole if isinstance(row, list) and row[1] is None]
    return {
        "schemaVersion": 1,
        "hole": {
            "credit": HOLE_CREDIT,
            "source": "https://ozonewatch.gsfc.nasa.gov/meteorology/annual_data.html",
            "licence": PUBLIC_DOMAIN,
            "columns": ["year", "areaMkm2", "minimumDU"],
            "area": "Mean area inside 220 DU, 7 September to 13 October",
            "minimum": "Mean of the daily minimum, 21 September to 16 October",
            "missing": missing,
            "rows": hole,
        },
        "gases": {
            "credit": GASES_CREDIT,
            "source": "https://gml.noaa.gov/odgi/",
            "licence": PUBLIC_DOMAIN,
            "columns": ["year", "eescPpt", "odgi"],
            "index": "100 at the peak of ozone-depleting halogens; 0 at 1980's level",
            "antarctic": read_odgi(antarctic),
            "midlatitude": read_odgi(midlatitude),
        },
    }


def write_history(watch: str, antarctic: str, midlatitude: str, folder: Path) -> int:
    """Write ``history.json``; return how many years of the ozone hole it holds."""
    value = history_file(watch, antarctic, midlatitude)
    years = len(read_ozone_watch(watch))
    path = folder / "history.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_text(
        json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return years


def _download(url: str) -> bytes:  # pragma: no cover - needs network access
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})  # noqa: S310
    with urllib.request.urlopen(request, timeout=120) as response:  # noqa: S310 # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{url}: expected bytes"
        raise TypeError(msg)
    return body


def fetch_ozone_history(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download Ozone Watch's years and the index's tables (each checked); write the file."""
    watch = verified(_download(OZONE_WATCH_URL), OZONE_WATCH_SHA256, "NASA Ozone Watch")
    antarctic = verified(_download(ODGI_ANTARCTIC_URL), ODGI_ANTARCTIC_SHA256, "ODGI Antarctic")
    midlatitude = verified(
        _download(ODGI_MIDLATITUDE_URL), ODGI_MIDLATITUDE_SHA256, "ODGI mid-latitudes"
    )
    return write_history(
        watch.decode("utf-8"), antarctic.decode("utf-8"), midlatitude.decode("utf-8"), folder
    )
