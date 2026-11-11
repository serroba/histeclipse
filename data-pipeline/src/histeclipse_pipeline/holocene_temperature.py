"""Temperature from 800,000 years ago to today, from four records shown side by side.

The site draws its own version of Figure 1 of the Planetary Health Check 2026, from the data
sets that figure cites. Each series is a list of points ``[year, median, low, high]``, oldest
first, with years in astronomical CE (1 BCE is 0, and years before present count from 1950, so
year = 1950 - BP). Temperatures are in °C, rounded to 0.01; low and high are null where the
source gives no range.

- Jouzel et al. (2007), Science 317: 793, doi:10.1126/science.1141038; PANGAEA
  doi:10.1594/PANGAEA.683655, CC BY 3.0. The EPICA Dome C deuterium record and the temperature
  estimated from it, 0-800 ka on the EDC3 age scale. Its "delta T" column is the difference
  from the mean of the last 1,000 years; rows without one are skipped. It is the temperature
  at Dome C, ANTARCTIC and not global: polar change is about twice the global one, so it is
  kept on its own scale and baseline (``scope: "antarctic"``), not rescaled. It is thinned to
  the mean of each 200-year bin of age within 20 ka and each 1,000-year bin beyond, placed at
  the mean age of the samples in the bin.
- Osman et al. (2021), Nature 599: 239, doi:10.1038/s41586-021-03984-4; NOAA, public domain.
  The Last Glacial Maximum Reanalysis (LGMR): global mean surface temperature in 200-year bins
  from 23.9 ka to 100 BP, 500 ensemble members, absolute °C. Each member is taken relative to
  its own most recent bin (100 BP, about 1850 CE, roughly pre-industrial), and the median and
  2.5th/97.5th percentiles of those changes are kept, so the range is the spread of the change
  and is zero at 1850 by construction.
- PAGES 2k Consortium (2019; Neukom et al.), Nature Geoscience 12: 643,
  doi:10.1038/s41561-019-0400-0; NOAA, licence not stated (NOAA asks for citation). Global mean
  temperature for 1-2000 CE, median and 95% range of the 7,000-member ensemble across methods,
  relative to 1961-1990. The 31-year filtered columns are used, so the first and last 15 years
  (no filtered value) are dropped.
- Morice et al. (2021), JGR Atmospheres 126, doi:10.1029/2019JD032361; HadCRUT.5.1.0.0 from the
  Met Office, Open Government Licence v3. Annual global mean anomaly relative to 1961-1990, with
  its 95% range, from 1850. The file includes the current year while it is incomplete; every row
  is kept and the last year is written as ``lastYear``. The Met Office updates the file each
  month, so its pinned checksum fails on a later download: re-running this command needs the
  new hash pinned (after looking at what changed).

The common baseline is 1850-1900, as in the report and the IPCC: HadCRUT5 and PAGES 2k are
shifted by the HadCRUT5 mean for 1850-1900 (relative to 1961-1990). LGMR is relative to its
1850 bin, close to the same thing. EPICA keeps its own baseline, as above.
"""

import io
import json
import math
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

import h5py
import numpy as np

from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from pathlib import Path


@dataclass(frozen=True)
class Source:
    """Where a series comes from, and the file it is read from."""

    url: str
    sha256: str


EPICA = Source(
    "https://doi.pangaea.de/10.1594/PANGAEA.683655?format=textfile",
    "d68f751e490a33bd39448b7b642d50756b0b8b755b9dd89af8eed595abc439c3",
)
LGMR = Source(
    "https://www.ncei.noaa.gov/pub/data/paleo/reconstructions/osman2021/LGMR_GMST_ens.nc",
    "98d8540283ee6a3d31b9cafb33ff791bc534e5196367cb7de9bab06820bfe8f3",
)
PAGES2K = Source(
    "https://www.ncei.noaa.gov/pub/data/paleo/pages2k/neukom2019temp/recons/Full_ensemble_median_and_95pct_range.txt",
    "4a98e9a2741d61e58a8565a43a7bb365ecb231f62cb3d8b526644d33101f6de1",
)
#: A living file: the Met Office adds each month, so this hash needs updating to re-run.
HADCRUT5 = Source(
    "https://www.metoffice.gov.uk/hadobs/hadcrut5/data/HadCRUT.5.1.0.0/analysis/diagnostics/HadCRUT.5.1.0.0.analysis.summary_series.global.annual.csv",
    "16633b8d7c4fe6026d53549f509355964ab56ca689a6f007f27d4a5fa87d6ec6",
)

#: Years before present count back from 1950 CE.
PRESENT = 1950
#: The pre-industrial baseline, inclusive.
BASELINE = (1850, 1900)
#: EPICA's thinning: 200-year bins of age within 20 ka, 1,000-year bins beyond.
NEAR_AGE = 20_000
NEAR_BIN = 200
FAR_BIN = 1_000
#: Percentiles of the LGMR ensemble kept as its range.
LOW_PERCENTILE, HIGH_PERCENTILE = 2.5, 97.5
#: The PAGES 2k columns read: year, then the 31-year filtered median and range.
_PAGES_YEAR = "Year"
_PAGES_COLUMNS = (
    "31-year filtered full ensemble median",
    "31-year filtered full ensemble 2.5th percentile",
    "31-year filtered full ensemble 97.5th percentile",
)

#: One point: year (astronomical CE), median, and the range where there is one (°C).
type Point = tuple[int, float, float | None, float | None]


@dataclass(frozen=True)
class Series:
    """One record, as the chart draws it."""

    id: str
    name: str
    scope: str
    baseline: str
    credit: str
    source: str
    points: list[Point]
    note: str | None = None
    last_year: int | None = None


def _round(value: float) -> float:
    return round(value, 2) + 0.0  # + 0.0 turns -0.0 into 0.0


def year_of_bp(years_bp: float) -> int:
    """Astronomical year of an age in years before present (1950)."""
    return round(PRESENT - years_bp)


def epica_rows(text: str) -> list[tuple[float, float]]:
    """Age (years BP) and delta T (°C) of each EPICA sample that has a temperature."""
    _, _, body = text.partition("*/")
    lines = [line for line in body.splitlines() if line.strip()]
    rows: list[tuple[float, float]] = []
    for line in lines[1:]:
        cells = line.split("\t")
        if cells[3].strip():
            rows.append((float(cells[1]) * 1000, float(cells[3])))
    return rows


def thin(rows: list[tuple[float, float]]) -> list[Point]:
    """Mean of each age bin (200 years within 20 ka, 1,000 beyond), oldest first."""
    bins: dict[int, list[tuple[float, float]]] = {}
    for age, value in rows:
        width = NEAR_BIN if age < NEAR_AGE else FAR_BIN
        key = math.floor(age / width) * width
        bins.setdefault(key, []).append((age, value))
    points: list[Point] = []
    for key in sorted(bins, reverse=True):
        members = bins[key]
        age = sum(each[0] for each in members) / len(members)
        value = sum(each[1] for each in members) / len(members)
        points.append((year_of_bp(age), _round(value), None, None))
    return points


def epica(text: str) -> Series:
    """Read the EPICA Dome C temperature estimate, thinned; Antarctic, on its own baseline."""
    return Series(
        id="epica",
        name="EPICA Dome C (Antarctica)",
        scope="antarctic",
        baseline="mean of the last 1,000 years, at Dome C (the source's own)",
        credit=(
            "Jouzel et al. 2007, Science 317: 793, doi:10.1126/science.1141038; data "
            "doi:10.1594/PANGAEA.683655, CC BY 3.0"
        ),
        source=EPICA.url,
        points=thin(epica_rows(text)),
        note=(
            "Antarctic temperature, not global: polar change is about twice the global one. "
            "Means of 200-year bins within 20,000 years and 1,000-year bins beyond."
        ),
    )


def lgmr_points(
    ages: np.typing.NDArray[np.float64], gmst: np.typing.NDArray[np.float64]
) -> list[Point]:
    """Median and 95% range of each member's change from its most recent bin, oldest first."""
    newest = int(np.argmin(ages))
    change = gmst - gmst[:, newest : newest + 1]
    years: list[float] = ages.tolist()  # pyright: ignore[reportAny]
    median: list[float] = np.median(change, axis=0).tolist()  # pyright: ignore[reportAny]
    low: list[float] = np.percentile(change, LOW_PERCENTILE, axis=0).tolist()  # pyright: ignore[reportAny]
    high: list[float] = np.percentile(change, HIGH_PERCENTILE, axis=0).tolist()  # pyright: ignore[reportAny]
    order = sorted(range(len(years)), key=lambda i: -years[i])
    return [
        (year_of_bp(years[i]), _round(median[i]), _round(low[i]), _round(high[i])) for i in order
    ]


def lgmr(data: bytes) -> Series:
    """Osman et al. 2021's LGMR global mean, relative to its 100 BP (1850) bin."""
    with h5py.File(io.BytesIO(data), "r") as opened:
        ages = np.asarray(opened["age"][()], dtype=np.float64)
        gmst = np.asarray(opened["gmst"][()], dtype=np.float64)
    return Series(
        id="lgmr",
        name="Last Glacial Maximum Reanalysis",
        scope="global",
        baseline="each ensemble member's 100 BP bin (about 1850, roughly pre-industrial)",
        credit=(
            "Osman et al. 2021, Nature 599: 239, doi:10.1038/s41586-021-03984-4; NOAA, "
            "public domain"
        ),
        source=LGMR.url,
        points=lgmr_points(ages, gmst),
        note="200-year bins; median and 95% range of 500 ensemble members.",
    )


def _number(cell: str) -> float | None:
    cell = cell.strip()
    return None if cell in {"", "NA"} else float(cell)


def pages2k(text: str, offset: float) -> Series:
    """PAGES 2k's 31-year filtered median and range, shifted by ``offset`` to 1850-1900."""
    lines = [line for line in text.splitlines() if line.strip() and not line.startswith("#")]
    header, *rows = (line.split("\t") for line in lines)
    year_at = header.index(_PAGES_YEAR)
    median_at, low_at, high_at = (header.index(name) for name in _PAGES_COLUMNS)
    points: list[Point] = []
    for row in rows:
        median, low, high = (_number(row[at]) for at in (median_at, low_at, high_at))
        if median is None or low is None or high is None:
            continue
        points.append(
            (
                int(row[year_at]),
                _round(median - offset),
                _round(low - offset),
                _round(high - offset),
            )
        )
    return Series(
        id="pages2k",
        name="PAGES 2k Consortium",
        scope="global",
        baseline="1850-1900, shifted from 1961-1990 by HadCRUT5's mean for 1850-1900",
        credit=(
            "PAGES 2k Consortium (Neukom et al.) 2019, Nature Geoscience 12: 643, "
            "doi:10.1038/s41561-019-0400-0; NOAA, licence not stated (NOAA asks for citation)"
        ),
        source=PAGES2K.url,
        points=points,
        note="31-year filtered; median and 95% range of a 7,000-member multi-method ensemble.",
    )


def hadcrut_rows(text: str) -> list[tuple[int, float, float, float]]:
    """Year, anomaly and 95% range (°C, relative to 1961-1990) of each row of the CSV."""
    lines = [line for line in text.splitlines() if line.strip()]
    rows: list[tuple[int, float, float, float]] = []
    for line in lines[1:]:
        year, anomaly, low, high = line.split(",")
        rows.append((int(year), float(anomaly), float(low), float(high)))
    return rows


def baseline_offset(rows: list[tuple[int, float, float, float]]) -> float:
    """HadCRUT5's mean anomaly over 1850-1900: what 1961-1990 values lose to be pre-industrial."""
    first, last = BASELINE
    values = [anomaly for year, anomaly, _, _ in rows if first <= year <= last]
    if len(values) != last - first + 1:
        msg = f"HadCRUT5: expected every year of {first}-{last}, found {len(values)}"
        raise ValueError(msg)
    return sum(values) / len(values)


def hadcrut5(rows: list[tuple[int, float, float, float]], offset: float) -> Series:
    """HadCRUT5's annual global anomaly and range, shifted by ``offset`` to 1850-1900."""
    return Series(
        id="hadcrut5",
        name="HadCRUT5",
        scope="global",
        baseline="1850-1900 (the file's 1961-1990 anomalies, less their 1850-1900 mean)",
        credit=(
            "Morice et al. 2021, JGR Atmospheres 126, doi:10.1029/2019JD032361; "
            "HadCRUT.5.1.0.0, Met Office, Open Government Licence v3"
        ),
        source=HADCRUT5.url,
        points=[
            (year, _round(anomaly - offset), _round(low - offset), _round(high - offset))
            for year, anomaly, low, high in rows
        ],
        note="Annual means; the last year may be incomplete when the file was downloaded.",
        last_year=rows[-1][0],
    )


def series_json(series: Series) -> dict[str, Json]:
    """One series as the web app reads it."""
    out: dict[str, Json] = {
        "id": series.id,
        "name": series.name,
        "scope": series.scope,
        "baseline": series.baseline,
        "credit": series.credit,
        "source": series.source,
    }
    if series.note is not None:
        out["note"] = series.note
    if series.last_year is not None:
        out["lastYear"] = series.last_year
    out["points"] = [list[Json](point) for point in series.points]
    return out


def write_holocene_temperature(series: list[Series], path: Path) -> int:
    """Write every series to ``path``; return how many points they hold."""
    path.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(
        {
            "schemaVersion": 1,
            "baseline": "1850\u20131900",
            "series": [series_json(each) for each in series],
        },
        ensure_ascii=False,
        separators=(",", ":"),
    )
    _ = path.write_text(body + "\n")
    return sum(len(each.points) for each in series)


def _download(source: Source, what: str) -> bytes:  # pragma: no cover - needs network access
    # Each URL is one of the pinned constants above, all https.
    request = urllib.request.Request(source.url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
    with urllib.request.urlopen(request, timeout=120) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{source.url}: expected bytes"
        raise TypeError(msg)
    return verified(body, source.sha256, what)


def fetch_holocene_temperature(path: Path) -> int:  # pragma: no cover - needs network access
    """Download the four sources (each checked against its pinned checksum) and write them."""
    rows = hadcrut_rows(_download(HADCRUT5, "HadCRUT5 annual global series").decode())
    offset = baseline_offset(rows)
    return write_holocene_temperature(
        [
            epica(_download(EPICA, "EPICA Dome C temperature").decode()),
            lgmr(_download(LGMR, "Osman et al. 2021 LGMR ensemble")),
            pages2k(_download(PAGES2K, "PAGES 2k 2019 reconstruction").decode(), offset),
            hadcrut5(rows, offset),
        ],
        path,
    )
