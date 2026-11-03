"""Carbon dioxide and oxygen over the last 540 million years, each with its uncertainty.

- CO2: Foster, Royer & Lunt (2017), *Future climate forcing potentially without precedent in
  the last 420 million years*, Nature Communications 8, 14845 (doi:10.1038/ncomms14845), CC BY
  4.0. Supplementary Data 2 is their LOESS fit to the compilation, with its 68% and 95% bands,
  0-420 Ma; Supplementary Data 1 is the compilation itself: about 1,200 estimates from five kinds
  of proxy, each kept as its source gives it (age, CO2 and its low and high), by proxy.
- O2: Mills, Krause, Jarvis & Cramer (2023), *Evolution of Atmospheric O2 Through the
  Phanerozoic, Revisited*, Annual Review of Earth and Planetary Sciences 51, 253-276
  (doi:10.1146/annurev-earth-032320-095425), CC BY 4.0: their combined estimate, the data behind
  their Figure 6 as the authors publish it (github.com/bjwmills/AREPS_2023_O2_estimate), each
  million years with its best guess and the range of the methods they combine.

Each file is pinned by its SHA-256 (the O2 one by the repository's commit too).
"""

import io
import json
import math
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

from openpyxl import load_workbook

from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from pathlib import Path

    from openpyxl.worksheet.worksheet import Worksheet

_ESM = "https://static-content.springer.com/esm/art%3A10.1038%2Fncomms14845/MediaObjects/"
CO2_PROXIES_URL = _ESM + "41467_2017_BFncomms14845_MOESM2874_ESM.xlsx"
CO2_PROXIES_SHA256 = "0dfd7fca2203379c04852f78b3bd09caed3990a1345d70b299dc7fc5e91e897d"
CO2_FIT_URL = _ESM + "41467_2017_BFncomms14845_MOESM2875_ESM.xlsx"
CO2_FIT_SHA256 = "84df255974cb77c95d298d324fb281fe2ac40a0696ea92598985816e7095c74c"
O2_URL = (
    "https://raw.githubusercontent.com/bjwmills/AREPS_2023_O2_estimate/"
    "5311dbfb6800ffff53b4fb4fc5169efa6d8ac95d/Mills_etal_2023_AREPS_O2.xlsx"
)
O2_SHA256 = "873a445a3a3068126fe3658b1248ead5bb3c7fc28fd65859fd572bd1b3410a7b"

#: Each proxy's block of columns in the compilation: its name in the sheet, and here.
PROXIES: tuple[tuple[str, str], ...] = (
    ("PALEOSOLS", "Paleosols"),
    ("ALKENONES", "Alkenones"),
    ("STOMATA", "Stomata"),
    ("MARINE BORON", "Boron"),
    ("LIVERWORTS", "Liverworts"),
)
#: Within a proxy's block: where its age (Ma), CO2, and CO2 low and high are.
_AGE, _CO2, _LOW, _HIGH = 2, 5, 7, 8
#: The compilation's rows of data begin after its title and three rows of headings.
_FIRST_ROW = 5
#: The fit is kept every million years; its rows come every half.
FIT_STEP_MA = 1.0


@dataclass(frozen=True)
class Estimate:
    """A CO2 estimate: its age (Ma), value and range (ppm), from one proxy."""

    ma: float
    ppm: float
    low: float | None
    high: float | None


def _number(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    number = float(value)
    return number if math.isfinite(number) else None


def _sheet(data: bytes, index: int = 0) -> Worksheet:
    return load_workbook(io.BytesIO(data), read_only=True, data_only=True).worksheets[index]


def co2_estimates(data: bytes) -> dict[str, list[Estimate]]:
    """Each proxy's estimates, oldest first, from the compilation's sheet of proxies."""
    sheet = _sheet(data, 1)
    rows = [list(row) for row in sheet.iter_rows(values_only=True)]
    heading = rows[1] if len(rows) > 1 else []
    starts = {
        name: next(
            (
                at
                for at, cell in enumerate(heading)
                if isinstance(cell, str) and cell.startswith(key)
            ),
            None,
        )
        for key, name in PROXIES
    }
    found: dict[str, list[Estimate]] = {}
    for name, start in starts.items():
        if start is None:
            continue
        estimates: list[Estimate] = []
        for row in rows[_FIRST_ROW - 1 :]:
            cells = [*row, *([None] * (start + _HIGH + 1 - len(row)))]
            ma, ppm = _number(cells[start + _AGE]), _number(cells[start + _CO2])
            if ma is None or ppm is None or ppm <= 0:
                continue
            low, high = _number(cells[start + _LOW]), _number(cells[start + _HIGH])
            estimates.append(Estimate(ma, ppm, low, high))
        found[name] = sorted(estimates, key=lambda estimate: -estimate.ma)
    return found


def co2_fit(data: bytes) -> list[tuple[float, float, float, float, float, float]]:
    """Read the LOESS fit every million years: age, best, low 95%, low 68%, high 68%, high 95%."""
    kept: list[tuple[float, float, float, float, float, float]] = []
    for row in _sheet(data).iter_rows(min_row=3, values_only=True):
        values = [_number(cell) for cell in row[:6]]
        if any(value is None for value in values):
            continue
        ma, best, low95, low68, high68, high95 = (float(value or 0) for value in values)
        # Every million years, from the rows nearest to whole ones.
        if abs(ma - round(ma / FIT_STEP_MA) * FIT_STEP_MA) > FIT_STEP_MA / 4:
            continue
        # Near its oldest end the fit's lower bands fall below zero, which CO2 cannot: none.
        kept.append((round(ma), best, max(low95, 0), max(low68, 0), high68, high95))
    return kept


def o2_estimate(data: bytes) -> list[tuple[int, float, float, float]]:
    """Read the combined O2 estimate each million years: age (Ma), best, lowest, highest (%)."""
    found: list[tuple[int, float, float, float]] = []
    for row in _sheet(data).iter_rows(min_row=2, values_only=True):
        time, mid, low, high = (_number(cell) for cell in row[:4])
        if time is None or mid is None or low is None or high is None:
            continue
        # The sheet counts time as negative millions of years.
        found.append((round(-time), mid, low, high))
    return sorted(found)


def _round(value: float | None, places: int) -> Json:
    return None if value is None else round(value, places)


def deep_air_file(
    estimates: dict[str, list[Estimate]],
    fit: list[tuple[float, float, float, float, float, float]],
    o2: list[tuple[int, float, float, float]],
) -> dict[str, Json]:
    """Build the site's file: the CO2 fit and estimates by proxy, and the O2 estimate."""
    return {
        "schemaVersion": 1,
        "co2": {
            "credit": "Foster, Royer & Lunt 2017, Nature Communications 8, 14845, CC BY 4.0",
            "doi": "10.1038/ncomms14845",
            # Each: Ma, best, low 95%, low 68%, high 68%, high 95% (ppm).
            "fit": [[ma, *(round(value) for value in values)] for ma, *values in fit],
            "proxies": [
                {
                    "name": name,
                    # Each: Ma, ppm, low, high (ppm, null where not given).
                    "estimates": [
                        [
                            round(estimate.ma, 2),
                            round(estimate.ppm),
                            _round(estimate.low, 0),
                            _round(estimate.high, 0),
                        ]
                        for estimate in found
                    ],
                }
                for name, found in estimates.items()
            ],
        },
        "o2": {
            "credit": (
                "Mills, Krause, Jarvis & Cramer 2023, Annual Review of Earth and Planetary "
                "Sciences 51, 253-276, CC BY 4.0; the data of their Figure 6"
            ),
            "doi": "10.1146/annurev-earth-032320-095425",
            # Each: Ma, best guess, lowest, highest (% of the air).
            "points": [
                [ma, round(mid, 2), round(low, 2), round(high, 2)] for ma, mid, low, high in o2
            ],
        },
    }


def _download(url: str) -> bytes:  # pragma: no cover - needs network access
    request = urllib.request.Request(url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
    with urllib.request.urlopen(request, timeout=120) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{url}: expected bytes"
        raise TypeError(msg)
    return body


def fetch_deep_air(path: Path) -> int:  # pragma: no cover - needs network access
    """Download the three files (checked against their checksums) and write the site's file."""
    estimates = co2_estimates(
        verified(_download(CO2_PROXIES_URL), CO2_PROXIES_SHA256, "Foster 2017 compilation")
    )
    fit = co2_fit(verified(_download(CO2_FIT_URL), CO2_FIT_SHA256, "Foster 2017 LOESS fit"))
    o2 = o2_estimate(verified(_download(O2_URL), O2_SHA256, "Mills 2023 O2 estimate"))
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_text(json.dumps(deep_air_file(estimates, fit, o2), separators=(",", ":")) + "\n")
    return sum(len(found) for found in estimates.values())
