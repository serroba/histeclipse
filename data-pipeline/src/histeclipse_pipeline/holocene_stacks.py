"""The Holocene temperature conundrum: three answers to how the last 12,000 years went (#532).

Proxy stacks have the Holocene peaking some 6,500 years ago and cooling since; models and data
assimilation have it warming steadily. This writes three records of that disagreement side by
side, for the boundaries' Holocene chart to draw beside ``holocene_temperature.py``'s, in the
same shape: each series is a list of points ``[year, median, low, high]``, oldest first, with
years in astronomical CE (1 BCE is 0; years before present count from 1950, so year = 1950 - BP)
and temperatures in °C, rounded to 0.01. No source is chosen: each keeps its own range and
baseline, written beside it.

- Kaufman et al. (2020), *Holocene global mean surface temperature, a multi-method
  reconstruction approach*, Scientific Data 7, 201, doi:10.1038/s41597-020-0530-7: the
  Temperature 12k global mean, from five statistical methods (SCC, DCC, GAM, CPS, PAI), 500
  ensemble members each, in 100-year bins from 0 to 12 ka. The file is ``temp12k_alldata.nc``,
  CC0 on figshare (doi:10.6084/m9.figshare.11455851) and the same bytes at NOAA NCEI
  (doi:10.25921/vzys-1280), where it is read from. Each member had its 12,000-year mean
  removed, and each method's median was then set to 0 at 100 BP (1800-1900 CE): the baseline
  is the 19th century. Written are the multi-method series (median and 5th/95th percentiles
  of all 2,500 members, which reproduces the authors' ``temp12k_allmethods_percentiles.csv``
  exactly) and each method's own, so the spread between methods shows. GAM has no value in
  its two oldest bins; those points are left out of its series and the pooled percentiles
  skip them.
- Osman et al. (2021), Nature 599: 239, doi:10.1038/s41586-021-03984-4: the Last Glacial
  Maximum Reanalysis' global mean, 200-year bins, 500 members; the same file
  ``holocene_temperature.py`` reads (NOAA NCEI, no licence stated). Only the Holocene, bins
  younger than 12 ka, is kept here. Each member is taken relative to its own 100 BP bin (about
  1850), as there, but the range is the 5th to 95th percentile, like Temp12k's, so the two
  can be compared directly.
- Bova et al. (2021), *Seasonal origin of the thermal maxima at the Holocene and the last
  interglacial*, Nature 589: 548, doi:10.1038/s41586-020-03155-x: the seasonal-bias
  explanation. Their 40°S-40°N sea-surface stack, in 1,000-year bins centred 0.5 to 11.5 ka,
  both as reconstructed (``SSTsn``, the proxies' own season) and transformed to the mean
  annual (``MASST``), each with one standard error. It is read from the paper's Source Data
  for Fig. 3 (panel d), on Springer Nature's site: the NOAA archive of the study
  (doi:10.25921/496t-9n92) holds the single cores but not the stacks. No licence is stated
  for the Source Data. The stack is sea surface between 40°S and 40°N, not global air
  temperature, and is against the mean of 0-1 ka, its own baseline: it is not rescaled.
"""

import io
import json
import math
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

import h5py
import numpy as np
import numpy.typing as npt
from openpyxl import load_workbook

from histeclipse_pipeline.holocene_temperature import LGMR, NOAA_TERMS, Source, year_of_bp
from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from pathlib import Path

SOURCE = "https://doi.org/10.25921/vzys-1280"
#: When the files pinned below were downloaded.
ACCESSED = "2026-11-12"

TEMP12K = Source(
    "https://www.ncei.noaa.gov/pub/data/paleo/reconstructions/kaufman2020/temp12k_alldata.nc",
    "222fad303513acb4a10a3ff3fe6591f39c574825ffe3a3894730dc7fbd2cd9f7",
)
#: Source Data for Fig. 3 of Bova et al. 2021.
BOVA = Source(
    "https://static-content.springer.com/esm/art%3A10.1038%2Fs41586-020-03155-x/MediaObjects/41586_2020_3155_MOESM3_ESM.xlsx",
    "70ce843c10188f82fec551da47fd889203418770bcf9b111bdfa2083b6bdcd8d",
)

TEMP12K_CREDIT = (
    "Kaufman, McKay, Routson, Erb, Dätwyler, Sommer, Heiri & Davis 2020, Scientific Data 7, "
    "201, doi:10.1038/s41597-020-0530-7; data: figshare doi:10.6084/m9.figshare.11455851 and "
    f"NOAA NCEI doi:10.25921/vzys-1280, accessed {ACCESSED}; CC0 1.0"
)
LGMR_CREDIT = (
    "Osman et al. 2021, Nature 599: 239, doi:10.1038/s41586-021-03984-4; NOAA NCEI, "
    f"accessed {ACCESSED}; {NOAA_TERMS}"
)
BOVA_CREDIT = (
    "Bova, Rosenthal, Liu, Godad & Yan 2021, Nature 589: 548, doi:10.1038/s41586-020-03155-x; "
    f"data: the paper's Source Data for Fig. 3, accessed {ACCESSED}; no licence stated"
)
CREDIT = f"{TEMP12K_CREDIT}; {LGMR_CREDIT}; {BOVA_CREDIT}"

#: Temperature 12k's methods, as the netCDF names them, and what they stand for.
METHODS = (
    ("scc", "Standard calibrated composite"),
    ("dcc", "Dynamic calibrated composite"),
    ("gam", "Generalized additive model"),
    ("cps", "Composite plus scale"),
    ("pai", "Pairwise comparison (PaiCo)"),
)
#: Percentiles kept as each ensemble's range, as Temp12k publishes its own.
LOW_PERCENTILE, HIGH_PERCENTILE = 5.0, 95.0
#: The Holocene, in years before present: bins younger than this are kept.
HOLOCENE_BP = 12_000
#: The header of the age column and the two stacks in Bova et al.'s Fig. 3, panel d.
BOVA_AGE = "Age (ky)"
BOVA_SSTSN = "Full Stack SSTsn (40°S-40°N)"
BOVA_MASST = "Full Stack MASST (40°S-40°N)"
BOVA_ERROR = "1 std error"

TEMP12K_BASELINE = (
    "1800-1900 CE: each method's median is 0 at the 100 BP bin (the source's own); "
    "close to 1850-1900"
)

#: One point: year (astronomical CE), median, and the range (°C).
type Point = tuple[int, float, float, float]
type Floats = npt.NDArray[np.float64]


@dataclass(frozen=True)
class Series:
    """One record, as the chart would draw it."""

    id: str
    name: str
    registry: str
    scope: str
    baseline: str
    spread: str
    credit: str
    licence: str
    source: str
    points: list[Point]
    note: str | None = None


def _round(value: float) -> float:
    return round(value, 2) + 0.0  # + 0.0 turns -0.0 into 0.0


def ensemble_points(ages: Floats, members: Floats) -> list[Point]:
    """Median and 5th/95th percentile across members (ages x members), oldest first.

    Members missing at an age (NaN) are skipped there; an age with none is left out.
    """
    years: list[float] = ages.tolist()  # pyright: ignore[reportAny]
    rows: list[list[float]] = members.tolist()  # pyright: ignore[reportAny]
    points: list[Point] = []
    for i in sorted(range(len(years)), key=lambda i: -years[i]):
        row = [value for value in rows[i] if not math.isnan(value)]
        if not row:
            continue
        median, low, high = (
            float(np.percentile(row, at)) for at in (50.0, LOW_PERCENTILE, HIGH_PERCENTILE)
        )
        points.append((year_of_bp(years[i]), _round(median), _round(low), _round(high)))
    return points


def temp12k_members(data: bytes) -> tuple[Floats, dict[str, Floats]]:
    """Temperature 12k's ages (years BP) and each method's global members (ages x 500)."""
    with h5py.File(io.BytesIO(data), "r") as opened:
        ages = np.asarray(opened["age"][()], dtype=np.float64)
        methods = {
            key: np.asarray(opened[f"{key}_globalmean"][()], dtype=np.float64) for key, _ in METHODS
        }
    return ages, methods


def _temp12k_series(id_: str, name: str, points: list[Point], note: str) -> Series:
    return Series(
        id=id_,
        name=name,
        registry="kaufman2020",
        scope="global",
        baseline=TEMP12K_BASELINE,
        spread="5th-95th percentile of the ensemble",
        credit=TEMP12K_CREDIT,
        licence="CC0 1.0",
        source=TEMP12K.url,
        points=points,
        note=note,
    )


def temp12k(data: bytes) -> list[Series]:
    """Read the multi-method Temperature 12k series, then each method's own."""
    ages, methods = temp12k_members(data)
    pooled = np.concatenate(list(methods.values()), axis=1)
    series = [
        _temp12k_series(
            "temp12k",
            "Temperature 12k, all five methods",
            ensemble_points(ages, pooled),
            (
                "Proxy stack, 100-year bins; median and 5-95% range of 2,500 members "
                "(500 from each of five methods)."
            ),
        )
    ]
    for key, name in METHODS:
        series.append(
            _temp12k_series(
                f"temp12k-{key}",
                f"Temperature 12k, {name} ({key.upper()})",
                ensemble_points(ages, methods[key]),
                "One of the five methods; median and 5-95% range of its 500 members.",
            )
        )
    return series


def lgmr_holocene(data: bytes) -> Series:
    """Osman et al. 2021's global mean over the Holocene, each member against its 100 BP bin."""
    with h5py.File(io.BytesIO(data), "r") as opened:
        ages = np.asarray(opened["age"][()], dtype=np.float64)
        gmst = np.asarray(opened["gmst"][()], dtype=np.float64)
    newest = int(np.argmin(ages))
    change = (gmst - gmst[:, newest : newest + 1]).T
    keep = ages < HOLOCENE_BP
    return Series(
        id="lgmr",
        name="Last Glacial Maximum Reanalysis (Holocene)",
        registry="osman2021",
        scope="global",
        baseline="each ensemble member's 100 BP bin (about 1850, roughly pre-industrial)",
        spread="5th-95th percentile of the ensemble",
        credit=LGMR_CREDIT,
        licence="none stated",
        source=LGMR.url,
        points=ensemble_points(ages[keep], change[keep]),
        note=(
            "Data assimilation (proxies with a climate model), 200-year bins; median and 5-95% "
            "range of 500 members. The same file holocene-temperature.json draws, there with "
            "the 95% range."
        ),
    )


def _cell(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def bova_rows(data: bytes) -> list[tuple[float, float, float, float, float]]:
    """Age (ka), SSTsn and its error, MASST and its error, from the 40°S-40°N stack."""
    sheet = load_workbook(io.BytesIO(data), read_only=True, data_only=True).worksheets[0]
    rows = [list(row) for row in sheet.iter_rows(values_only=True)]
    for at, header in enumerate(rows):
        names = [_cell(each) for each in header]
        if BOVA_SSTSN not in names:
            continue
        col = names.index(BOVA_SSTSN)
        expected = [BOVA_AGE, BOVA_SSTSN, BOVA_ERROR, BOVA_MASST, BOVA_ERROR]
        if names[col - 1 : col + 4] != expected:
            msg = f"Bova et al. 2021: unexpected columns {names[col - 1 : col + 4]}"
            raise ValueError(msg)
        out: list[tuple[float, float, float, float, float]] = []
        for row in rows[at + 1 :]:
            cells = row[col - 1 : col + 4]
            if not isinstance(cells[0], int | float):
                break
            age, sstsn, sstsn_error, masst, masst_error = (float(str(each)) for each in cells)
            out.append((age, sstsn, sstsn_error, masst, masst_error))
        return out
    msg = f"Bova et al. 2021: no column {BOVA_SSTSN!r}"
    raise ValueError(msg)


def _bova_series(id_: str, name: str, points: list[Point], note: str) -> Series:
    return Series(
        id=id_,
        name=name,
        registry="bova2021",
        scope="sea surface, 40°S-40°N",
        baseline="mean of 0-1 ka (950-1950 CE), the source's own",
        spread="median ± 1 standard error",
        credit=BOVA_CREDIT,
        licence="none stated",
        source=BOVA.url,
        points=points,
        note=note,
    )


def bova(rows: list[tuple[float, float, float, float, float]]) -> list[Series]:
    """Bova et al.'s stack as reconstructed (SSTsn) and as mean annual (MASST), oldest first."""
    ordered = sorted(rows, key=lambda row: -row[0])

    def points(value: int, error: int) -> list[Point]:
        return [
            (
                year_of_bp(row[0] * 1000),
                _round(row[value]),
                _round(row[value] - row[error]),
                _round(row[value] + row[error]),
            )
            for row in ordered
        ]

    return [
        _bova_series(
            "bova-masst",
            "Bova et al. 2021, mean annual sea surface (40°S-40°N)",
            points(3, 4),
            (
                "Seasonal proxies transformed to the mean annual: no mid-Holocene peak, a "
                "steady warming. 1,000-year bins. Sea surface between 40°S and 40°N, not global."
            ),
        ),
        _bova_series(
            "bova-sstsn",
            "Bova et al. 2021, proxies' own season (40°S-40°N)",
            points(1, 2),
            (
                "The same proxies before the seasonal transform: the mid-Holocene peak the "
                "transform explains as summer warmth. 1,000-year bins."
            ),
        ),
    ]


def series_json(series: Series) -> dict[str, Json]:
    """One series as the web app would read it."""
    out: dict[str, Json] = {
        "id": series.id,
        "name": series.name,
        "registry": series.registry,
        "scope": series.scope,
        "units": "°C",
        "baseline": series.baseline,
        "spread": series.spread,
        "credit": series.credit,
        "licence": series.licence,
        "source": series.source,
    }
    if series.note is not None:
        out["note"] = series.note
    out["points"] = [list[Json](point) for point in series.points]
    return out


def write_holocene_stacks(series: list[Series], path: Path) -> int:
    """Write every series to ``path`` (an index.json); return how many points they hold."""
    path.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(
        {
            "schemaVersion": 1,
            "credit": CREDIT,
            "source": SOURCE,
            "years": "astronomical CE (1 BCE is 0); year = 1950 - years BP",
            "point": "[year, median, low, high], oldest first",
            "units": "°C",
            "baseline": (
                "each series' own, written with it: the global series are against about the "
                "19th century (1800-1900 or the 1850 bin), close to holocene-temperature.json's "
                "1850-1900; Bova et al.'s sea surface is against 0-1 ka"
            ),
            "series": [series_json(each) for each in series],
        },
        ensure_ascii=False,
        separators=(",", ":"),
    )
    _ = path.write_text(body + "\n")
    return sum(len(each.points) for each in series)


def _download(source: Source, what: str) -> bytes:  # pragma: no cover - needs network access
    # Each URL is one of the pinned constants, all https.
    request = urllib.request.Request(source.url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
    with urllib.request.urlopen(request, timeout=120) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{source.url}: expected bytes"
        raise TypeError(msg)
    return verified(body, source.sha256, what)


def fetch_holocene_stacks(path: Path) -> int:  # pragma: no cover - needs network access
    """Download the three sources (each checked against its pinned checksum) and write them."""
    return write_holocene_stacks(
        [
            *temp12k(_download(TEMP12K, "Temperature 12k ensembles")),
            lgmr_holocene(_download(LGMR, "Osman et al. 2021 LGMR ensemble")),
            *bova(bova_rows(_download(BOVA, "Bova et al. 2021 Fig. 3 source data"))),
        ],
        path,
    )
