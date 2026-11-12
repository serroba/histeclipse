"""Measured global sea level since 1900, and where the sea has risen fastest since 1993 (#528).

``sealevel.py`` has the paleo curves, whose zero is "today". This module measures the modern
rise, so that "today" is a number: each series is in millimetres against the 1995-2014 mean,
the IPCC's present-day baseline (AR6 WG1). The sources disagree a little, and are shown side by
side:

- IPCC AR6's assessed global mean sea level from tide gauges, 1900-2010, and from satellite
  altimetry, 1993-2019, each with its 1-sigma uncertainty: the series of Cross-Chapter Box 9.1
  Figure 1 and Figure 2.28 (Palmer et al. 2023, CEDA, doi:10.5285/c622adfeb4cc4ae181dc4cca82c2311c,
  CC BY 4.0). They are the assessment's combination of the published reconstructions (AR6 WG1
  Annex I and Table 2.SM.1 name them), already against 1995-2014;
- NOAA's Laboratory for Satellite Altimetry (LSA): global mean sea level from TOPEX/Poseidon,
  Jason-1, -2, -3 and Sentinel-6MF, every ten days from late 1992, annual signal removed,
  inverted barometer applied, no glacial isostatic adjustment (which would add 0.2-0.5 mm a
  year). Where two missions overlap, their mean is kept. It is shifted to its own 1995-2014
  mean. A US government product, so in the public domain; NOAA asks for the acknowledgement
  "Altimetry data are provided by NOAA Laboratory for Satellite Altimetry";
- NOAA LSA's map of sea-level trends from the same missions (mm a year, 0.5° cells, the oceans
  to about 70° N and S), averaged onto the site's node-registered
  1° grid (``krapp.regrid``) and packed into one 8-bit image as ``krapp.to_png`` packs
  temperatures: R the trend as a byte from ``lowest`` to ``highest``, G 0 mm a year on the same
  scale, B and A 255 where there is data.

Frederikse et al. (2020), the tide-gauge reconstruction with its budget (glaciers, ice sheets,
thermal expansion, land water), is read by :func:`fetch_budget`. Its Zenodo supplement is "(c)
2020 All Rights Reserved", so its numbers are not committed to the site: the command writes
them where it is pointed, for checking against the open series. (NASA PO.DAAC re-issues the
same numbers as JPL_RECON_GMSL, but only behind an Earthdata login.)

Kopp et al. (2016)'s 2,000-year curve is left out for now: NOAA archives only its proxy
database, and the curve itself is in the PNAS supplement, which cannot be downloaded by script.

NOAA updates its files as new passes arrive; their checksums are pinned, so an update stops
the fetch until it is looked at and re-pinned.
"""

import csv
import io
import json
import math
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

import h5py
import numpy as np
from openpyxl import load_workbook

from histeclipse_pipeline.krapp import Grid, bounds, regrid, to_png
from histeclipse_pipeline.paleotemp import COLUMNS, ROWS
from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from pathlib import Path

SOURCE = "https://doi.org/10.5285/c622adfeb4cc4ae181dc4cca82c2311c"
CREDIT = (
    "IPCC AR6 WG1 assessed global mean sea level from tide gauges and satellite altimetry "
    "(Palmer et al. 2023, data for Cross-Chapter Box 9.1 Figure 1, CEDA, CC BY 4.0); "
    "altimetry data are provided by NOAA Laboratory for Satellite Altimetry (global mean and "
    "trend map from TOPEX/Poseidon, Jason-1, -2, -3 and Sentinel-6MF, public domain); "
    "against the 1995-2014 mean, the trend map averaged onto a 1° grid and packed into an "
    "8-bit image for this site"
)
AR6_LICENCE = "CC BY 4.0"
NOAA_LICENCE = "Public domain (US government); acknowledge NOAA Laboratory for Satellite Altimetry"
BASELINE = (1995, 2014)
TREND_FILE = "trend.png"
#: The years the pinned trend map spans, as its title gives them (decimal years).
TREND_PERIOD = "1992.96\u20132025.10"


@dataclass(frozen=True)
class Download:
    """A file to fetch, and the checksum it must have."""

    url: str
    sha256: str


_AR6 = "https://dap.ceda.ac.uk/badc/ar6_wg1/data/ch_09/ch9_ccb9_1_fig1/v20230523/"
AR6_TIDE_GAUGE = Download(
    _AR6 + "AR6_FGD_assessment_timeseries_GMSL_tide_gauge.csv?download=1",
    "8bd3b63a91a05948725002f55f90a0ffdbfaec0a978699f92ed9ef14d06614ab",
)
AR6_ALTIMETER = Download(
    _AR6 + "AR6_FGD_assessment_timeseries_GMSL_satellite_altimeter.csv?download=1",
    "3bcf73805259b0b16ac0dd017b00306e27a2bfb9d8ebb59eaf6db936ece72fc6",
)
_LSA = "https://www.star.nesdis.noaa.gov/socd/lsa/SeaLevelRise/slr/"
#: The files of March 2025, through February 2025. A newer release changes them.
NOAA_MEAN = Download(
    _LSA + "slr_sla_gbl_free_ref_90.csv",
    "539ecde7a3e90e2a2f07c9a5a0a52e3ff34396fa57436d44375516a677c355a7",
)
NOAA_TRENDS = Download(
    _LSA + "slr_map_ref.nc",
    "cefefa9f6761db252c0f597c429364593bc043423eead6b3e93b6c2d79028cc7",
)
FREDERIKSE = Download(
    "https://zenodo.org/api/records/3862995/files/global_basin_timeseries.xlsx/content",
    "27964ba544cb92742919ed99483c83219ed8eeb3c3e748d7b8bb683ab763cc05",
)


@dataclass(frozen=True)
class Series:
    """One measured series: years (decimal) and sea level (mm), with a range where given."""

    id: str
    label: str
    method: str
    source: str
    url: str
    licence: str
    note: str | None
    years: list[float]
    level: list[float]
    #: What ``low`` and ``high`` are, e.g. "1 sigma".
    range: str | None = None
    low: list[float] | None = None
    high: list[float] | None = None


def _mm(value: float) -> float:
    return round(value, 1) + 0.0  # + 0.0 turns -0.0 into 0.0


def ar6_table(text: str) -> list[tuple[float, float, float]]:
    """Read an AR6 assessment CSV: a title line, a header, then year, central, ..., 1-sigma.

    The last column is the total 1-sigma uncertainty in both files.
    """
    lines = [line for line in text.splitlines() if line.strip()]
    rows = list(csv.reader(lines[2:]))
    return [(float(row[0]), float(row[1]), float(row[-1])) for row in rows]


def ar6_series(text: str, *, kind: str) -> Series:
    """IPCC AR6's assessed series, from tide gauges or altimetry, with its 1-sigma range."""
    rows = ar6_table(text)
    tide = kind == "tide-gauge"
    return Series(
        id=f"ar6-{kind}",
        label=f"IPCC AR6, {'tide gauges' if tide else 'satellite altimetry'}",
        method=(
            "the assessment's combination of tide-gauge reconstructions"
            if tide
            else "the assessment's ensemble of satellite-altimetry records"
        ),
        source="IPCC AR6 WG1, Cross-Chapter Box 9.1 Figure 1 (Palmer et al. 2023, CEDA)",
        url=SOURCE,
        licence=AR6_LICENCE,
        note="Annual means, plotted mid-year.",
        years=[year for year, _, _ in rows],
        level=[_mm(level) for _, level, _ in rows],
        range="1 sigma",
        low=[_mm(level - sigma) for _, level, sigma in rows],
        high=[_mm(level + sigma) for _, level, sigma in rows],
    )


def noaa_mean(text: str) -> tuple[list[float], list[float]]:
    """Read NOAA LSA's global mean: one column per mission; the mean where two overlap (mm)."""
    lines = [line for line in text.splitlines() if line.strip() and not line.startswith("#")]
    years: list[float] = []
    level: list[float] = []
    for row in list(csv.reader(lines))[1:]:
        values = [float(cell) for cell in row[1:] if cell.strip()]
        if values:
            years.append(float(row[0]))
            level.append(sum(values) / len(values))
    return years, level


def rebased(years: list[float], level: list[float]) -> list[float]:
    """Shift a series to its own mean over the baseline years."""
    first, last = BASELINE
    inside = [value for year, value in zip(years, level, strict=True) if first <= year < last + 1]
    if not inside:
        msg = f"the series has no values in {first}-{last}"
        raise ValueError(msg)
    mean = sum(inside) / len(inside)
    return [_mm(value - mean) for value in level]


def noaa_series(text: str) -> Series:
    """NOAA LSA's ten-day global mean from the reference missions, against 1995-2014."""
    years, level = noaa_mean(text)
    return Series(
        id="noaa-lsa",
        label="NOAA satellite altimetry",
        method="TOPEX/Poseidon, Jason-1, -2, -3 and Sentinel-6MF, every ten days",
        source="NOAA Laboratory for Satellite Altimetry",
        url="https://www.star.nesdis.noaa.gov/socd/lsa/SeaLevelRise/",
        licence=NOAA_LICENCE,
        note=(
            "Annual signal removed; no glacial isostatic adjustment, which would add "
            "0.2-0.5 mm a year. Shifted to its own 1995-2014 mean."
        ),
        years=[round(year, 3) for year in years],
        level=rebased(years, level),
    )


def series_json(series: Series) -> dict[str, Json]:
    """One series as the web app reads it."""
    out: dict[str, Json] = {
        "id": series.id,
        "label": series.label,
        "method": series.method,
        "source": series.source,
        "url": series.url,
        "licence": series.licence,
        "years": list[Json](series.years),
        "level": list[Json](series.level),
    }
    if series.note is not None:
        out["note"] = series.note
    if series.range is not None and series.low is not None and series.high is not None:
        out["range"] = series.range
        out["low"] = list[Json](series.low)
        out["high"] = list[Json](series.high)
    return out


@dataclass(frozen=True)
class Trends:
    """The trend map on the source's cells: mm a year, latitude first; NaN where no data."""

    values: Grid
    latitude: Grid
    longitude: Grid


def read_trends(data: bytes) -> Trends:
    """Read NOAA LSA's trend map (NetCDF 4)."""
    with h5py.File(io.BytesIO(data), "r") as opened:
        values = np.asarray(opened["Sea_level_trends"][()], dtype=np.float64)
        latitude = np.asarray(opened["lat"][()], dtype=np.float64)
        longitude = np.asarray(opened["lon"][()], dtype=np.float64)
    return Trends(values, latitude, longitude)


def ocean_mean(grid: Grid) -> float:
    """Area-weighted (cos latitude) mean over the 1° nodes with data."""
    body = grid[:, :-1]  # the last column repeats the first
    latitudes = np.linspace(90.0, -90.0, ROWS)
    weights = np.broadcast_to(np.cos(np.radians(latitudes))[:, None], body.shape)
    valid = np.isfinite(body)
    return float(np.average(body[valid], weights=weights[valid]))


def write_modern(series: list[Series], trends: Trends, folder: Path) -> int:
    """Write the series and the trend map's image and manifest to ``index.json``.

    Returns how many points the series hold.
    """
    grid = regrid(trends.values, trends.latitude, trends.longitude)
    lowest, highest = bounds([grid])
    zero = np.where(np.isfinite(grid), 0.0, np.nan)
    folder.mkdir(parents=True, exist_ok=True)
    _ = (folder / TREND_FILE).write_bytes(to_png(grid, zero, lowest, highest))
    first, last = BASELINE
    index: dict[str, Json] = {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "units": "mm",
        "baseline": f"{first}\u2013{last}",
        "series": [series_json(each) for each in series],
        "trends": {
            "file": TREND_FILE,
            "period": TREND_PERIOD,
            "units": "mm/year",
            "source": NOAA_TRENDS.url,
            "licence": NOAA_LICENCE,
            "columns": COLUMNS,
            "rows": ROWS,
            "lowest": lowest,
            "highest": highest,
            "mean": round(ocean_mean(grid), 2),
        },
    }
    _ = (folder / "index.json").write_text(json.dumps(index, separators=(",", ":")) + "\n")
    return sum(len(each.years) for each in series)


#: Frederikse et al.'s global sheet: its columns come in [lower], [mean], [upper] threes.
BUDGET_TERMS = {
    "Observed GMSL": "observed",
    "Sum of contributors": "sum",
    "Steric": "thermal",
    "Glaciers": "glaciers",
    "Greenland Ice Sheet": "greenland",
    "Antarctic Ice Sheet": "antarctica",
    "Terrestrial Water Storage": "land-water",
    "Altimetry": "altimetry",
}


def budget(data: bytes) -> dict[str, Json]:
    """Frederikse et al. (2020)'s global budget: each term's mean and 5-95% range, mm."""
    sheet = load_workbook(io.BytesIO(data), read_only=True, data_only=True).worksheets[0]
    header, *rows = sheet.iter_rows(values_only=True)
    names = [str(cell) for cell in header]
    years = [int(str(row[0])) for row in rows]
    terms: dict[str, Json] = {}
    for title, key in BUDGET_TERMS.items():
        parts: dict[str, Json] = {}
        for part in ("lower", "mean", "upper"):
            column = names.index(f"{title} [{part}]")
            parts[part] = [_number(row[column]) for row in rows]
        terms[key] = parts
    return {
        "schemaVersion": 1,
        "credit": (
            "Frederikse et al. 2020, The causes of sea-level rise since 1900, Nature 584, 393; "
            "data supplement, Zenodo 3862995, (c) 2020 All Rights Reserved"
        ),
        "source": "https://doi.org/10.5281/zenodo.3862995",
        "units": "mm",
        "range": "5-95%",
        "years": list[Json](years),
        "terms": terms,
    }


def _number(cell: object) -> Json:
    if isinstance(cell, int | float) and math.isfinite(cell):
        return _mm(float(cell))
    return None


def _download(source: Download, what: str) -> bytes:  # pragma: no cover - needs network access
    # Each URL is one of the pinned constants above, all https.
    request = urllib.request.Request(source.url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
    with urllib.request.urlopen(request, timeout=300) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{source.url}: expected bytes"
        raise TypeError(msg)
    return verified(body, source.sha256, what)


def fetch_modern(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download the open sources (each checked against its pinned checksum) and write them."""
    tide = _download(AR6_TIDE_GAUGE, "AR6 tide-gauge series").decode()
    altimeter = _download(AR6_ALTIMETER, "AR6 altimetry series").decode()
    noaa = _download(NOAA_MEAN, "NOAA LSA global mean").decode()
    trends = read_trends(_download(NOAA_TRENDS, "NOAA LSA trend map"))
    series = [
        ar6_series(tide, kind="tide-gauge"),
        ar6_series(altimeter, kind="altimeter"),
        noaa_series(noaa),
    ]
    return write_modern(series, trends, folder)


def fetch_budget(path: Path) -> int:  # pragma: no cover - needs network access
    """Write Frederikse et al.'s budget to ``path``; not for the site (all rights reserved)."""
    body = budget(_download(FREDERIKSE, "Frederikse et al. 2020 supplement"))
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_text(json.dumps(body, separators=(",", ":")) + "\n")
    years = body["years"]
    return len(years) if isinstance(years, list) else 0
