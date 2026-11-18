"""The sea's surface temperature each month since September 1981, as anomalies, for El Niño (#886).

NOAA's Optimum Interpolation Sea Surface Temperature, version 2.1 (OISST; Huang et al. 2021,
*Improvements of the Daily Optimum Interpolation Sea Surface Temperature (DOISST) Version 2.1*,
Journal of Climate 34, 2923, doi:10.1175/JCLI-D-20-0166.1) blends satellite (AVHRR), ship,
buoy and Argo measurements into a daily field on a 0.25° grid from September 1981, with sea ice
turned into the temperature of freezing sea water. NOAA's Physical Sciences Laboratory (PSL)
publishes its monthly means as one file (``sst.mon.mean.nc``), updated each month in place.

Each month is averaged here onto the site's node-registered 1° grid (``krapp.regrid``), and
measured against the same calendar month's mean over 1991-2020, the base period NOAA's Relative
Oceanic Niño Index uses: a node counts in the base where all 30 years have data. The anomaly is
what shows El Niño and La Niña: the warm or cool tongue along the equatorial Pacific.

The images are packed as the ocean heat maps are (``water_cycle.to_png``), so the web app reads
them alike: R the anomaly from ``-BOUND`` to ``+BOUND`` °C, clipped beyond; G zero; B 255; A
where there is sea. One image a month, named ``YYYY-MM.png``.

PSL asks to be acknowledged ("data provided by the NOAA PSL, Boulder, Colorado, USA, from their
website at https://psl.noaa.gov"); OISST is a US Government work, no licence stated. The file
is a living one (``living_pins.py``). Its last month is built from OISST's preliminary days,
which NCEI replaces with final ones about two weeks on.
"""

import datetime as dt
import hashlib
import json
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

import h5py
import numpy as np

from histeclipse_pipeline.krapp import Grid, regrid
from histeclipse_pipeline.paleotemp import COLUMNS, ROWS
from histeclipse_pipeline.water_cycle import Trend, to_png

if TYPE_CHECKING:
    from collections.abc import Iterator
    from pathlib import Path

    from histeclipse_pipeline.sky import Json

FILE_URL = "https://downloads.psl.noaa.gov/Datasets/noaa.oisst.v2.highres/sst.mon.mean.nc"
#: The file of 15 November 2026, September 1981 to October 2026. PSL updates it each month.
FILE_SHA256 = "133e872bb7966f423ba8f63c058d5049110993dd2b74b60d6bb8a11edc597ad8"
SOURCE = "https://psl.noaa.gov/data/gridded/data.noaa.oisst.v2.highres.html"
PAPER = "https://doi.org/10.1175/JCLI-D-20-0166.1"
CREDIT = (
    "NOAA OISST v2.1 (Huang et al. 2021, Journal of Climate 34, 2923), monthly means, data "
    "provided by the NOAA PSL, Boulder, Colorado, USA, from their website at "
    "https://psl.noaa.gov; US Government work, no licence stated; anomalies against "
    "1991-2020 computed for this site, averaged onto a 1° grid and packed into 8-bit images"
)
LICENCE = "none stated (US Government work); acknowledged as NOAA PSL asks"
BASE = (1991, 2020)
#: The anomaly's colours run from -BOUND to +BOUND °C; beyond, they are clipped.
BOUND = 4.0
MONTHS = 12
#: PSL's time axis: days since this day.
EPOCH = dt.date(1800, 1, 1)
#: Anything this large is PSL's fill value.
_MISSING_FROM = 1e3


@dataclass(frozen=True)
class Months:
    """Every month's field on the 1° nodes (months first, NaN on land) and its first month."""

    first: tuple[int, int]
    fields: Grid


def month_of(days: float) -> tuple[int, int]:
    """Give the year and month of a time on PSL's axis (days since 1 January 1800)."""
    day = EPOCH + dt.timedelta(days=days)
    return day.year, day.month


def month_text(month: tuple[int, int]) -> str:
    """Write a month as ``YYYY-MM``."""
    return f"{month[0]:04d}-{month[1]:02d}"


def months_after(first: tuple[int, int], count: int) -> list[tuple[int, int]]:
    """List ``count`` months from ``first`` on."""
    year, month = first
    out: list[tuple[int, int]] = []
    for _ in range(count):
        out.append((year, month))
        year, month = (year + 1, 1) if month == MONTHS else (year, month + 1)
    return out


def cleaned(values: Grid) -> Grid:
    """Turn PSL's fill values into NaN."""
    return np.asarray(np.where(np.fabs(values) >= _MISSING_FROM, np.nan, values), np.float64)


def read_months(opened: h5py.File) -> Months:
    """Read every month of ``sst`` onto the 1° nodes, one at a time; the months must run on."""
    days = np.asarray(opened["time"][()], dtype=np.float64)
    latitude = np.asarray(opened["lat"][()], dtype=np.float64)
    longitude = np.asarray(opened["lon"][()], dtype=np.float64)
    listed: list[float] = days.tolist()  # pyright: ignore[reportAny]
    first = month_of(listed[0])
    expected = months_after(first, len(listed))
    found = [month_of(day) for day in listed]
    if found != expected:
        msg = f"the months do not run on from {month_text(first)}"
        raise ValueError(msg)
    sst = opened["sst"]
    fields = np.stack(
        [
            regrid(cleaned(np.asarray(sst[at], dtype=np.float64)), latitude, longitude)
            for at in range(len(days))
        ]
    )
    return Months(first, fields)


def climatology(months: Months, base: tuple[int, int] = BASE) -> Grid:
    """Each calendar month's mean over ``base`` (twelve fields); NaN where a year lacks data."""
    first, last = base
    listed = months_after(months.first, len(months.fields))
    means: list[Grid] = []
    for month in range(1, MONTHS + 1):
        picked = [
            at for at, (year, each) in enumerate(listed) if each == month and first <= year <= last
        ]
        if len(picked) != last - first + 1:
            msg = f"the months read do not cover {first}-{last}"
            raise ValueError(msg)
        means.append(np.mean(months.fields[picked], axis=0))
    return np.stack(means)


def anomalies(
    months: Months, base: tuple[int, int] = BASE
) -> Iterator[tuple[tuple[int, int], Grid]]:
    """Yield each month and its anomaly against its calendar month's base mean."""
    normal = climatology(months, base)
    for at, month in enumerate(months_after(months.first, len(months.fields))):
        this: Grid = months.fields[at]  # pyright: ignore[reportAny]
        usual: Grid = normal[month[1] - 1]  # pyright: ignore[reportAny]
        yield month, np.asarray(this - usual, dtype=np.float64)


def png(anomaly: Grid) -> bytes:
    """Pack one month's anomaly as the ocean heat maps are packed (see the module's notes)."""
    return to_png(Trend(anomaly, np.isfinite(anomaly)), BOUND)


def index_file(first: tuple[int, int], last: tuple[int, int], accessed: str) -> dict[str, Json]:
    """Build the manifest the web app reads: credit, scale, encoding and the months there are."""
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "paper": PAPER,
        "licence": LICENCE,
        "accessed": accessed,
        "units": "°C",
        "baseline": f"{BASE[0]}\N{EN DASH}{BASE[1]}, each calendar month against its own mean",
        "bound": BOUND,
        "encoding": "R anomaly from -bound to +bound; G zero; B 255; A sea",
        "files": "YYYY-MM.png",
        "first": month_text(first),
        "last": month_text(last),
        "columns": COLUMNS,
        "rows": ROWS,
    }


def write_enso_sst(months: Months, folder: Path, accessed: str) -> int:
    """Write a map a month and the index; return the number of maps."""
    folder.mkdir(parents=True, exist_ok=True)
    written: list[tuple[int, int]] = []
    for month, anomaly in anomalies(months):
        _ = (folder / f"{month_text(month)}.png").write_bytes(png(anomaly))
        written.append(month)
    index = index_file(written[0], written[-1], accessed)
    _ = (folder / "index.json").write_text(
        json.dumps(index, separators=(",", ":"), ensure_ascii=False) + "\n"
    )
    return len(written)


def sha256_of(path: Path) -> str:
    """Hash a file in pieces, so a large one is not held in memory."""
    digest = hashlib.sha256()
    with path.open("rb") as opened:
        for chunk in iter(lambda: opened.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fetch_enso_sst(folder: Path, cache: Path) -> int:  # pragma: no cover - needs network access
    """Download PSL's file to ``cache`` (checked against its pin), and write the maps."""
    cache.parent.mkdir(parents=True, exist_ok=True)
    if not cache.exists() or sha256_of(cache) != FILE_SHA256:
        # The URL is the pinned https constant above.
        request = urllib.request.Request(FILE_URL, headers={"User-Agent": "histeclipse-pipeline"})
        with urllib.request.urlopen(request, timeout=7200) as response, cache.open("wb") as out:  # noqa: S310  # pyright: ignore[reportAny]
            while chunk := response.read(1 << 20):  # pyright: ignore[reportAny]
                _ = out.write(chunk)  # pyright: ignore[reportAny]
    found = sha256_of(cache)
    if found != FILE_SHA256:
        msg = f"OISST monthly means: SHA-256 {found}, pinned {FILE_SHA256}"
        raise ValueError(msg)
    accessed = dt.datetime.now(tz=dt.UTC).date().isoformat()
    with h5py.File(str(cache), "r") as opened:
        months = read_months(opened)
    return write_enso_sst(months, folder, accessed)
