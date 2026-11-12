"""Ocean heat content since 1955 and the Earth's heat inventory since 1971 (#527).

About nine tenths of the heat the Earth has gained since the 1970s went into the ocean. Two
independent analyses of the measured ocean heat content are shown side by side, and they differ
in method, coverage and how they fill gaps, which the site shows rather than averages away:

- IAP, version 4.2 (Cheng et al. 2024, *IAPv4 ocean temperature and ocean heat content gridded
  dataset*, Earth System Science Data 16, 3517, doi:10.5194/essd-16-3517-2024): monthly global
  heat content of the 0-700 m and 0-2000 m layers from 1940, each month with a 95% range, against
  2006-2015, in 10^22 J. The authors call it reliable from 1955, so years before are left out.
  Each year here is the mean of its twelve months; its range the mean of their ranges, which
  overstates the range of an annual mean a little. The file carries no licence; it is freely
  given out from the IAP's server and is credited here.
- NOAA NCEI (Levitus et al. 2012, *World ocean heat content and thermosteric sea level change
  (0-2000 m), 1955-2010*, Geophysical Research Letters 39, L10603, doi:10.1029/2012GL051106;
  dataset doi:10.7289/V53F4MVP): yearly heat content of the 0-700 m layer from 1955, and running
  5-year (pentadal) means of the 0-2000 m layer from 1955-1959, with a standard error, against
  the World Ocean Atlas 2009 climatology for 1955-2006, in 10^22 J. A US government work, in
  the public domain. Its range here is 1.96 standard errors each side, about 95%.

Both are put in zettajoules (10^21 J) and measured from their own 2006-2015 mean, so that the
curves start from the same place; each series records the baseline its source used.

The heat inventory is the Indicators of Global Climate Change 2025 update (Forster et al. 2026,
Earth System Science Data 18, 3889, doi:10.5194/essd-18-3889-2026; data Smith et al. 2026,
doi:10.5281/zenodo.21494229, CC BY 4.0), which carries on the GCOS Earth heat inventory of
von Schuckmann et al. (2023, ESSD 15, 1675): the heat each part of the climate system has gained
since 1971, in ZJ. The ocean's layers run to 2024; the atmosphere, land, ice and their sum end
in 2020, the last year of the GCOS estimates. The ocean layers carry an uncertainty whose level
the data file does not state. The GCOS dataset itself (WDCC, CC BY 4.0) needs a registered
login to download, so it is read through this update.

The site's ``public/data/ocean-heat/index.json`` holds every series.
"""

import csv
import io
import json
import math
import re
import urllib.request
import zipfile
from dataclasses import dataclass
from typing import TYPE_CHECKING

from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from pathlib import Path


@dataclass(frozen=True)
class Source:
    """A pinned download: where it is and the SHA-256 it must have."""

    url: str
    sha256: str


#: The update of January 2026, through December 2025. A newer update changes it. Served over
#: plain HTTP only; the checksum guards it.
IAP = Source(
    "http://www.ocean.iap.ac.cn/ftp/images_files/IAPv4.2_OHC_estimate_update.txt",
    "a9ac01b9d802666eca7f7b15814abd06888273eb7d36de43fa503c6f1a772d33",
)
#: NCEI's files are updated each quarter; a newer one changes these.
NCEI_700 = Source(
    "https://www.ncei.noaa.gov/data/oceans/woa/DATA_ANALYSIS/3M_HEAT_CONTENT/DATA/basin/yearly/h22-w0-700m.dat",
    "29114e2df7b856f88876f97ca4f073b5a04786ca86c0d643565a9f035046489b",
)
NCEI_2000 = Source(
    "https://www.ncei.noaa.gov/data/oceans/woa/DATA_ANALYSIS/3M_HEAT_CONTENT/DATA/basin/pentad/pent_h22-w0-2000m.dat",
    "2160656a7afed5d87e95b079374efb83e3ade2f9d1a58e0649290ce0eddf73b4",
)
#: Indicators of Global Climate Change 2025 (IGCC-2025a), Zenodo record of 22 July 2026.
IGCC = Source(
    "https://zenodo.org/records/21494229/files/ClimateIndicator/data-IGCC-2025a.zip?download=1",
    "04658ff91053808aced03f65dc977311668aec1610ec83bec72fff303dcbcbcd",
)
#: The inventory's table inside the archive, found by the end of its path.
IGCC_TABLE = "data/base/earth_energy_imbalance/earth_energy_imbalance.csv"

SOURCE = "https://www.ncei.noaa.gov/access/global-ocean-heat-content/"
CREDIT = (
    "Ocean heat content: IAP v4.2 (Cheng et al. 2024, Earth System Science Data 16, 3517), "
    "update of January 2026; NOAA NCEI (Levitus et al. 2012, Geophysical Research Letters 39, "
    "L10603), public domain. Earth heat inventory: Indicators of Global Climate Change 2025 "
    "(Forster et al. 2026, Earth System Science Data 18, 3889; Smith et al. 2026, Zenodo, "
    "CC BY 4.0), after von Schuckmann et al. 2023. Ocean heat content put in ZJ and measured "
    "from each series' 2006-2015 mean for this site"
)
#: The period every ocean-heat-content series is measured from here.
BASELINE = (2006, 2015)
#: IAP's note: "Reliable records are after 1955".
IAP_FIRST_YEAR = 1955
#: Months in a year: a year counts only when it has them all.
MONTHS = 12
#: 10^22 J in ZJ.
ZJ_PER_UNIT = 10.0
#: Standard errors each side for a range of about 95%.
SE_95 = 1.96


@dataclass(frozen=True)
class Series:
    """One curve: years and values (ZJ), with a range where the source gives one."""

    id: str
    label: str
    layer: str
    note: str
    years: list[float]
    values: list[float]
    low: list[float] | None = None
    high: list[float] | None = None


@dataclass(frozen=True)
class Analysis:
    """One ocean-heat-content analysis and the series read from it."""

    id: str
    label: str
    method: str
    source: str
    url: str
    licence: str
    baseline: str
    range: str
    series: list[Series]


def _round(value: float) -> float:
    return round(value, 1) + 0.0  # no -0.0


def iap_annual(text: str) -> dict[str, list[tuple[int, float, float]]]:
    """Read IAP's monthly table into yearly means by layer: (year, ZJ, 95% half-range in ZJ).

    Only years with all twelve months, from 1955 on, are kept.
    """
    columns = {"0-700 m": (2, 4), "0-2000 m": (8, 10)}
    months: dict[int, list[list[float]]] = {}
    for line in text.splitlines():
        cells = line.split()
        if not cells or not re.fullmatch(r"\d{4}", cells[0]):
            continue
        months.setdefault(int(cells[0]), []).append([float(cell) for cell in cells])
    out: dict[str, list[tuple[int, float, float]]] = {layer: [] for layer in columns}
    for year, rows in sorted(months.items()):
        if year < IAP_FIRST_YEAR or len(rows) != MONTHS:
            continue
        for layer, (value, error) in columns.items():
            values = [row[value] for row in rows]
            errors = [row[error] for row in rows]
            if any(math.isnan(each) for each in values + errors):
                continue
            out[layer].append(
                (year, sum(values) / MONTHS * ZJ_PER_UNIT, sum(errors) / MONTHS * ZJ_PER_UNIT)
            )
    return out


def ncei_table(text: str) -> list[tuple[float, float, float]]:
    """Read an NCEI basin file's world-ocean columns: (mid-year, ZJ, standard error in ZJ)."""
    rows: list[tuple[float, float, float]] = []
    for line in text.splitlines():
        cells = line.split()
        if len(cells) < 3 or cells[0] == "YEAR":  # noqa: PLR2004 - year, value, error
            continue
        rows.append((float(cells[0]), float(cells[1]) * ZJ_PER_UNIT, float(cells[2]) * ZJ_PER_UNIT))
    return rows


def rebased(rows: list[tuple[float, float, float]]) -> tuple[list[float], list[float], float]:
    """Measure the values from their 2006-2015 mean; return years, values and the shift (ZJ).

    A row counts for the baseline when its year (the whole part, as 2006.5 is 2006) is in it.
    """
    first, last = BASELINE
    inside = [value for year, value, _ in rows if first <= math.floor(year) <= last]
    if len(inside) != last - first + 1:
        msg = f"expected {last - first + 1} years in {first}-{last}, got {len(inside)}"
        raise ValueError(msg)
    shift = sum(inside) / len(inside)
    return [year for year, _, _ in rows], [value - shift for _, value, _ in rows], shift


def ranged(
    label: str,
    layer: str,
    note: str,
    rows: list[tuple[float, float, float]],
    half: float,
) -> Series:
    """Rebase the rows; give each a range of ``half`` times its error, each side."""
    years, values, _ = rebased(rows)
    errors = [error * half for _, _, error in rows]
    return Series(
        id=f"{label}-{layer.replace(' ', '')}",
        label=label,
        layer=layer,
        note=note,
        years=years,
        values=[_round(value) for value in values],
        low=[_round(value - error) for value, error in zip(values, errors, strict=True)],
        high=[_round(value + error) for value, error in zip(values, errors, strict=True)],
    )


def iap(text: str) -> Analysis:
    """IAP v4.2: yearly means of the monthly global series, 0-700 m and 0-2000 m."""
    layers = iap_annual(text)
    return Analysis(
        id="iap",
        label="IAP v4.2 (Cheng et al.)",
        method=(
            "ensemble optimal interpolation of every in-situ profile, with gaps filled using "
            "covariances from CMIP models"
        ),
        source="Cheng et al. 2024, Earth System Science Data 16, 3517; IAP update of January 2026",
        url="https://doi.org/10.5194/essd-16-3517-2024",
        licence="no licence stated; freely available from the IAP, credited",
        baseline="2006\u20132015",
        range="95%; a year's range is the mean of its months' ranges",
        series=[
            ranged(
                "iap",
                layer,
                "Yearly means of monthly values; before 1955 left out, as the authors advise.",
                [(year + 0.5, value, error) for year, value, error in rows],
                1.0,
            )
            for layer, rows in layers.items()
        ],
    )


def ncei(text_700: str, text_2000: str) -> Analysis:
    """NOAA NCEI: yearly 0-700 m and pentadal 0-2000 m world-ocean heat content."""
    return Analysis(
        id="ncei",
        label="NOAA NCEI (Levitus et al.)",
        method=(
            "objective analysis of the World Ocean Database's profiles, anomalies left at zero "
            "where data are sparse"
        ),
        source="Levitus et al. 2012, Geophysical Research Letters 39, L10603; NOAA NCEI",
        url="https://doi.org/10.7289/V53F4MVP",
        licence="public domain (US government work)",
        baseline="World Ocean Atlas 2009 climatology, 1955\u20132006",
        range="1.96 standard errors each side, about 95%",
        series=[
            ranged("ncei", "0-700 m", "Yearly.", ncei_table(text_700), SE_95),
            ranged(
                "ncei",
                "0-2000 m",
                "Running 5-year means, each at the middle of its five years.",
                ncei_table(text_2000),
                SE_95,
            ),
        ],
    )


#: The inventory's columns, and how they are shown.
INVENTORY = (
    ("total", "Whole Earth system", None),
    ("ocean_full-depth", "Ocean, full depth", "ocean_full-depth_error"),
    ("ocean_0-700m", "Ocean, 0-700 m", "ocean_0-700m_error"),
    ("ocean_700-2000m", "Ocean, 700-2000 m", "ocean_700-2000m_error"),
    ("ocean_2000-6000m", "Ocean, 2000-6000 m", "ocean_2000-6000m_error"),
    ("land", "Land", None),
    ("cryosphere", "Ice (melting)", None),
    ("atmosphere", "Atmosphere", None),
)


def igcc_table(archive: bytes) -> str:
    """Pull the inventory's CSV out of the IGCC archive."""
    with zipfile.ZipFile(io.BytesIO(archive)) as opened:
        names = [name for name in opened.namelist() if name.endswith(IGCC_TABLE)]
        if len(names) != 1:
            msg = f"expected one {IGCC_TABLE} in the archive, found {len(names)}"
            raise ValueError(msg)
        return opened.read(names[0]).decode()


def inventory(text: str) -> list[Series]:
    """Read the heat each part has gained since 1971 (ZJ), each over the years it has."""
    rows = [row for row in csv.DictReader(io.StringIO(text)) if row["time"].strip()]
    out: list[Series] = []
    for column, label, error in INVENTORY:
        kept = [row for row in rows if row[column].strip()]
        years = [float(row["time"]) for row in kept]
        values = [float(row[column]) for row in kept]
        low: list[float] | None = None
        high: list[float] | None = None
        if error is not None:
            errors = [float(row[error]) for row in kept]
            low = [_round(v - e) for v, e in zip(values, errors, strict=True)]
            high = [_round(v + e) for v, e in zip(values, errors, strict=True)]
        out.append(
            Series(
                id=column.replace("_", "-"),
                label=label,
                layer=label,
                note=f"{int(years[0])}\u2013{int(years[-1])}",
                years=years,
                values=[_round(value) for value in values],
                low=low,
                high=high,
            )
        )
    return out


def series_json(series: Series) -> dict[str, Json]:
    """One series as the web app reads it."""
    out: dict[str, Json] = {
        "id": series.id,
        "label": series.label,
        "layer": series.layer,
        "note": series.note,
        "years": list[Json](series.years),
        "values": list[Json](series.values),
    }
    if series.low is not None and series.high is not None:
        out["low"] = list[Json](series.low)
        out["high"] = list[Json](series.high)
    return out


def analysis_json(analysis: Analysis) -> dict[str, Json]:
    """One analysis and its series as the web app reads them."""
    return {
        "id": analysis.id,
        "label": analysis.label,
        "method": analysis.method,
        "source": analysis.source,
        "url": analysis.url,
        "licence": analysis.licence,
        "sourceBaseline": analysis.baseline,
        "range": analysis.range,
        "series": [series_json(each) for each in analysis.series],
    }


def index_file(analyses: list[Analysis], parts: list[Series]) -> dict[str, Json]:
    """Build the file the web app reads: credit, units, baseline and every series."""
    first, last = BASELINE
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "units": "ZJ",
        "oceanHeat": {
            "baseline": f"{first}\u2013{last}",
            "analyses": [analysis_json(each) for each in analyses],
        },
        "inventory": {
            "label": "Indicators of Global Climate Change 2025 (Forster et al. 2026)",
            "source": "Forster et al. 2026, Earth System Science Data 18, 3889; Smith et al. 2026",
            "url": "https://doi.org/10.5281/zenodo.21494229",
            "licence": "CC BY 4.0",
            "baseline": "1971",
            "range": "the source's uncertainty, each side; its level is not stated in the file",
            "series": [series_json(each) for each in parts],
        },
    }


def write_ocean_heat(analyses: list[Analysis], parts: list[Series], folder: Path) -> int:
    """Write ``index.json``; return how many points it holds."""
    folder.mkdir(parents=True, exist_ok=True)
    body = json.dumps(index_file(analyses, parts), separators=(",", ":"))
    _ = (folder / "index.json").write_text(body + "\n")
    every = [series for each in analyses for series in each.series] + parts
    return sum(len(series.years) for series in every)


def _download(source: Source, what: str) -> bytes:  # pragma: no cover - needs network access
    # Each URL is one of the pinned constants above.
    request = urllib.request.Request(source.url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
    with urllib.request.urlopen(request, timeout=120) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{source.url}: expected bytes"
        raise TypeError(msg)
    return verified(body, source.sha256, what)


def fetch_ocean_heat(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download the four files (each checked against its pinned checksum) and write the index."""
    return write_ocean_heat(
        [
            iap(_download(IAP, "IAP v4.2 ocean heat content").decode()),
            ncei(
                _download(NCEI_700, "NCEI 0-700 m heat content").decode(),
                _download(NCEI_2000, "NCEI 0-2000 m heat content").decode(),
            ),
        ],
        inventory(igcc_table(_download(IGCC, "IGCC 2025 archive"))),
        folder,
    )
