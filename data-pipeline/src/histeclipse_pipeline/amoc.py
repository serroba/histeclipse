"""The Atlantic overturning (AMOC): measured since 2004, and reconstructions that disagree (#531).

The AMOC is measured directly only since April 2004, at 26.5°N; before that it is inferred, and
the inferences disagree on whether it has already weakened. The site keeps each source apart,
in its own units, rather than average them away:

- **RAPID** (Moat et al. 2026, BODC, doi:10.5285/48d0bf43-0598-ceb2-e063-7086abc062f1, UK Open
  Government Licence): the overturning measured by the RAPID-MOCHA-WBTS array at 26.5°N, every
  12 hours (10-day filtered) from April 2004 to March 2024, in sverdrups (Sv, 10⁶ m³/s). Kept
  here as monthly means (a month counts with at least ``MONTH_SAMPLES`` of its readings).
- **Caesar et al. 2018** (Nature 556): an index from sea-surface temperature, the subpolar
  gyre's minus the globe's, 1871-2016, in kelvin, with its 95% range; the paper calibrates it at
  3.8 ± 0.5 Sv per K. A falling index is read as a weakening AMOC.
- **Rahmstorf et al. 2015** (Nature Climate Change 5): an index of the same kind from proxy
  temperatures, 900-1995, in kelvin, with its 2-sigma range.
- **Thornalley et al. 2018** (Nature 556): a subsurface-temperature AMOC proxy from Labrador
  Sea and Gulf Stream cores, 400-2000, with its 2-sigma range.
- **Terhaar et al. 2025** (Nature Communications 16, 222): the AMOC at 26.5°N inferred from
  air-sea heat fluxes in two reanalyses (ERA5, JRA-55), decadal averages as anomalies from
  1963-2017, in Sv, with the standard deviation the source gives. They find no decline.

The three proxy series are read from the compilation Caesar et al. 2021 (Nature Geoscience 14)
published with their analysis (GitHub ``ncahill89/AMOC-Analysis``, no licence stated), pinned to
a commit. Its "lower" and "upper" columns are not always the value minus and plus the 2-sigma
(Rahmstorf's lower column is the value's negative, Thornalley's are swapped), so the range is
computed here from the 2-sigma where one is given. Kilbourne et al. 2022 (Nature Geoscience
15), who argue that these proxies leave the trend uncertain, publish no series of their own.

Terhaar et al.'s source data are CC BY-NC-ND 4.0: no adapted material may be shared, so their
values are copied as the source gives them, unrounded; only the file's format changes, which
the licence allows.
"""

import datetime as dt
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

from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from pathlib import Path

    from openpyxl.worksheet.worksheet import Worksheet


type Floats = npt.NDArray[np.float64]


@dataclass(frozen=True)
class Download:
    """A pinned file: where it is, and its SHA-256."""

    url: str
    sha256: str


#: The release of 29 January 2026 (v2024.1a), April 2004 to March 2024.
RAPID = Download(
    "https://rapid.ac.uk/sites/default/files/rapid_data/moc_transports.nc",
    "ba135d9447a87c2bf5dcc8870e2cb73ff348c412fa1bc3501145e01c79788eed",
)
#: Caesar et al. 2021's compilation, at the repository's last commit (25 February 2021).
COMPILATION = Download(
    (
        "https://raw.githubusercontent.com/ncahill89/AMOC-Analysis/"
        "c1ca72b25c05022b238abf1b58e5d45d365cd5ac/data/Data_compilation.xlsx"
    ),
    "c706d083b54745f74589fe90ca3d5e4b3414ece0bbf4cb098645588672b669ef",
)
#: Terhaar et al. 2025's Source Data file.
TERHAAR = Download(
    (
        "https://static-content.springer.com/esm/art%3A10.1038%2Fs41467-024-55297-5/"
        "MediaObjects/41467_2024_55297_MOESM3_ESM.xlsx"
    ),
    "d45f5168991d1bac53835bada49f6511bc35eeb0aea950bd7312eccbbf318757",
)

SOURCE = "https://rapid.ac.uk/"
CREDIT = (
    "RAPID-MOCHA-WBTS (Moat et al. 2026, BODC, Open Government Licence; funded by NERC, NSF "
    "and NOAA, freely available from rapid.ac.uk); Caesar et al. 2018, Rahmstorf et al. 2015 "
    "and Thornalley et al. 2018 as compiled by Caesar et al. 2021 (no licence stated); "
    "Terhaar et al. 2025 source data (CC BY-NC-ND 4.0)"
)
RAPID_DOI = "https://doi.org/10.5285/48d0bf43-0598-ceb2-e063-7086abc062f1"
#: RAPID's time axis starts here.
RAPID_EPOCH = np.datetime64("2004-04-01T00:00:00", "s")
#: Of a month's ~60 twelve-hourly readings, how many it needs to count.
MONTH_SAMPLES = 40
#: RAPID's fill value.
_FILL = -99999.0
#: The compilation's sheets, and the Terhaar file's sheet at 26.5°N.
CAESAR_SHEET = "Caesar et al. (2018)"
RAHMSTORF_SHEET = "Rahmstorf et al. (2015)"
THORNALLEY_SHEET = "Thornalley et al. (2018), Tsub"
TERHAAR_SHEET = "26.5"
#: Rows before the data in each sheet: a note, then the headings (Terhaar's: two heading rows).
_COMPILATION_SKIP = 2
_TERHAAR_SKIP = 2


@dataclass(frozen=True)
class Series:
    """One source's curve: years (decimal), values, and its range or spread where given."""

    id: str
    label: str
    measures: str
    units: str
    baseline: str | None
    source: str
    url: str
    licence: str
    note: str
    years: list[float]
    values: list[float]
    low: list[float] | None = None
    high: list[float] | None = None
    #: One standard deviation, as the source gives it, where it gives no range.
    std: list[float] | None = None


def monthly_means(days: Floats, moc: Floats) -> tuple[list[float], list[float]]:
    """Average RAPID's readings by calendar month; a month counts with enough readings.

    ``days`` are days since 1 April 2004; returns each month's middle as a decimal year, and
    its mean in Sv.
    """
    seconds = np.round(days * 86400).astype("timedelta64[s]")
    # Months since January 1970.
    months = np.asarray((RAPID_EPOCH + seconds).astype("datetime64[M]"), dtype=np.int64)
    known: npt.NDArray[np.bool_] = np.logical_and(np.isfinite(moc), moc > _FILL / 2)
    years: list[float] = []
    means: list[float] = []
    every: list[int] = np.unique(months).tolist()  # pyright: ignore[reportAny]
    for month in every:
        mask: npt.NDArray[np.bool_] = np.logical_and(np.equal(months, month), known)
        if np.count_nonzero(mask) < MONTH_SAMPLES:
            continue
        years.append(round(1970 + month / 12 + 1 / 24, 3))
        means.append(round(float(np.mean(moc[mask])), 2))
    return years, means


def rapid(data: bytes) -> Series:
    """RAPID's overturning at 26.5°N, as monthly means, from ``moc_transports.nc``."""
    with h5py.File(io.BytesIO(data), "r") as opened:
        days = np.asarray(opened["time"][()], dtype=np.float64)
        moc = np.asarray(opened["moc_mar_hc10"][()], dtype=np.float64)
    years, means = monthly_means(days, moc)
    return Series(
        id="rapid",
        label="RAPID array, 26.5°N",
        measures="overturning measured by moored instruments across the Atlantic",
        units="Sv",
        baseline=None,
        source=(
            "Moat et al. 2026, RAPID-MOCHA-WBTS array at 26N, 2004-2024 (v2024.1a), "
            "British Oceanographic Data Centre"
        ),
        url=RAPID_DOI,
        licence="Open Government Licence v3.0",
        note="Monthly means of the 10-day filtered, 12-hourly series.",
        years=years,
        values=means,
    )


def _number(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    number = float(value)
    return number if math.isfinite(number) else None


def _rows(sheet: Worksheet, skip: int, columns: int) -> list[list[float]]:
    """Read the rows after ``skip`` whose first ``columns`` cells are all numbers."""
    found: list[list[float]] = []
    for at, row in enumerate(sheet.iter_rows(values_only=True)):
        if at < skip:
            continue
        cells = [_number(cell) for cell in row[:columns]]
        numbers = [cell for cell in cells if cell is not None]
        if len(numbers) == columns:
            found.append(numbers)
    return found


def _sigma_series(rows: list[list[float]], digits: int) -> tuple[list[float], ...]:
    """Years, values, and value minus and plus the 2-sigma, from rows of year, value, 2-sigma."""
    years = [row[0] for row in rows]
    values = [round(row[1], digits) for row in rows]
    low = [round(row[1] - row[2], digits) for row in rows]
    high = [round(row[1] + row[2], digits) for row in rows]
    return years, values, low, high


def compilation(data: bytes) -> list[Series]:
    """Caesar 2018's, Rahmstorf 2015's and Thornalley 2018's series, from the compilation."""
    book = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    caesar = _rows(book[CAESAR_SHEET], _COMPILATION_SKIP, 4)  # year, value, lower, upper
    years, values, low, high = (
        [row[0] for row in caesar],
        [round(row[1], 3) for row in caesar],
        [round(row[2], 3) for row in caesar],
        [round(row[3], 3) for row in caesar],
    )
    out = [
        Series(
            id="caesar-2018",
            label="Caesar et al. 2018",
            measures="sea-surface temperature of the subpolar gyre minus the globe's (HadISST)",
            units="K",
            baseline=None,
            source="Caesar et al. 2018, Nature 556, 191-196, via Caesar et al. 2021",
            url="https://doi.org/10.1038/s41586-018-0006-5",
            licence="none stated",
            note=(
                "Calibrated at 3.8 ± 0.5 Sv per K; a falling index is read as a weakening "
                "AMOC, some 3 ± 1 Sv since the mid-20th century."
            ),
            years=years,
            values=values,
            low=low,
            high=high,
        )
    ]
    years, values, low, high = _sigma_series(_rows(book[RAHMSTORF_SHEET], _COMPILATION_SKIP, 3), 3)
    out.append(
        Series(
            id="rahmstorf-2015",
            label="Rahmstorf et al. 2015",
            measures="proxy temperature of the subpolar gyre minus the northern hemisphere's",
            units="K",
            baseline="as the source gives it",
            source=(
                "Rahmstorf et al. 2015, Nature Climate Change 5, 475-480, via Caesar et al. 2021"
            ),
            url="https://doi.org/10.1038/nclimate2554",
            licence="none stated",
            note="An anomaly; range: 2-sigma.",
            years=years,
            values=values,
            low=low,
            high=high,
        )
    )
    years, values, low, high = _sigma_series(_rows(book[THORNALLEY_SHEET], _COMPILATION_SKIP, 3), 3)
    out.append(
        Series(
            id="thornalley-2018",
            label="Thornalley et al. 2018",
            measures="subsurface-temperature AMOC proxy from Labrador Sea and Gulf Stream cores",
            units="index",
            baseline="as the source gives it",
            source="Thornalley et al. 2018, Nature 556, 227-230, via Caesar et al. 2021",
            url="https://doi.org/10.1038/s41586-018-0007-4",
            licence="none stated",
            note="Extended Data Fig. 4e-g of the paper; range: 2-sigma.",
            years=years,
            values=values,
            low=low,
            high=high,
        )
    )
    return out


def terhaar(data: bytes) -> list[Series]:
    """Terhaar et al. 2025's two reconstructions at 26.5°N, copied unrounded (CC BY-NC-ND)."""
    book = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    # Year, ERA5 mean and std, JRA-55 mean and std.
    rows = _rows(book[TERHAAR_SHEET], _TERHAAR_SKIP, 5)
    years = [row[0] for row in rows]
    out: list[Series] = []
    for name, column in (("ERA5", 1), ("JRA-55", 3)):
        out.append(
            Series(
                id=f"terhaar-2025-{name.lower().replace('-', '')}",
                label=f"Terhaar et al. 2025 ({name})",
                measures=f"AMOC inferred from air-sea heat fluxes in the {name} reanalysis",
                units="Sv",
                baseline="1963\u20132017",
                source=(
                    "Terhaar, Vogt & Foukal 2025, Nature Communications 16, 222, Source Data "
                    "(Fig. 9a)"
                ),
                url="https://doi.org/10.1038/s41467-024-55297-5",
                licence="CC BY-NC-ND 4.0",
                note=(
                    "Decadal averages, as anomalies from 1963-2017; the spread is the standard "
                    "deviation the source gives, from the fit only. Values as given, unrounded."
                ),
                years=years,
                values=[row[column] for row in rows],
                std=[row[column + 1] for row in rows],
            )
        )
    return out


def series_json(series: Series) -> dict[str, Json]:
    """One series as the web app reads it."""
    out: dict[str, Json] = {
        "id": series.id,
        "label": series.label,
        "measures": series.measures,
        "units": series.units,
        "baseline": series.baseline,
        "source": series.source,
        "url": series.url,
        "licence": series.licence,
        "note": series.note,
        "years": list[Json](series.years),
        "values": list[Json](series.values),
    }
    if series.low is not None and series.high is not None:
        out["low"] = list[Json](series.low)
        out["high"] = list[Json](series.high)
    if series.std is not None:
        out["std"] = list[Json](series.std)
    return out


def index_file(series: list[Series], accessed: str) -> dict[str, Json]:
    """Build the manifest: credit, and every series side by side."""
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "accessed": accessed,
        "disputed": (
            "Whether the AMOC has already weakened is disputed: the temperature indices "
            "(Caesar 2018, Rahmstorf 2015) and Thornalley 2018 read a decline since the 19th or "
            "mid-20th century; Terhaar 2025's heat-flux reconstruction finds none since 1963; "
            "Kilbourne et al. 2022 argue the proxies leave it uncertain. RAPID has measured it "
            "directly only since 2004."
        ),
        "series": [series_json(each) for each in series],
    }


def write_amoc(series: list[Series], folder: Path, accessed: str) -> int:
    """Write every series to ``index.json``; return how many points they hold."""
    folder.mkdir(parents=True, exist_ok=True)
    body = json.dumps(index_file(series, accessed), separators=(",", ":"), ensure_ascii=False)
    _ = (folder / "index.json").write_text(body + "\n")
    return sum(len(each.years) for each in series)


def _download(source: Download, what: str) -> bytes:  # pragma: no cover - needs network access
    # Each URL is one of the pinned constants above, all https.
    request = urllib.request.Request(source.url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
    with urllib.request.urlopen(request, timeout=300) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{source.url}: expected bytes"
        raise TypeError(msg)
    return verified(body, source.sha256, what)


def fetch_amoc(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download the three files (each checked against its pinned checksum) and write them."""
    accessed = dt.datetime.now(tz=dt.UTC).date().isoformat()
    series = [
        rapid(_download(RAPID, "RAPID moc_transports.nc")),
        *compilation(_download(COMPILATION, "Caesar et al. 2021 compilation")),
        *terhaar(_download(TERHAAR, "Terhaar et al. 2025 source data")),
    ]
    return write_amoc(series, folder, accessed)
