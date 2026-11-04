"""CO2 estimates of the last 455 million years, by method, from the Paleo-CO2 Data Archive.

*Paleo-CO2 Data Archive*, v1.12 (May 2025), Zenodo record 15546408, CC BY 4.0: published CO2
estimates assembled by the CO2PIP community (the CenCO2PIP Consortium, Science 2023,
doi:10.1126/science.adi5177), one spreadsheet per study, each in the project's template. Its
first sheet's "Basic Info" columns are read: the proxy, the study (first author, year, DOI),
the age (thousands of years) and the CO2 (ppm) with its uncertainty above and below. The
template also records who entered the data and how to reach them; those are left out.

The proxies' names vary from file to file; each is put under one of the methods below. A row
without an age or a CO2 is left out, as is a CO2 of zero or below (a paleosol's calculation can
give one); a few studies' sheets have no CO2 at all, and the command names them.
"""

import datetime as dt
import io
import json
import math
import urllib.request
import zipfile
from dataclasses import dataclass
from typing import TYPE_CHECKING

from openpyxl import load_workbook

from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from pathlib import Path

ARCHIVE_URL = "https://zenodo.org/records/15546408/files/archive%20May%202025%20.zip?download=1"
ARCHIVE_SHA256 = "270077adcda347fb08f215ef1cb04aca20475647d5f95a91480cc76f16adccf4"
SOURCE = "https://doi.org/10.5281/zenodo.15546408"
CREDIT = (
    "Paleo-CO2 Data Archive v1.12 (CO2PIP community; CenCO2PIP Consortium 2023, Science), "
    "Zenodo, CC BY 4.0"
)

#: Each method, and the words its proxies' names begin with (lower case), in the order shown.
METHODS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("Boron", ("boron", "b/ca")),
    ("Phytoplankton", ("phytoplankton",)),
    ("Land-plant δ¹³C", ("land_plant", "land plant")),
    ("Leaf gas exchange", ("stomata-franks", "stomata-konrad")),
    ("Stomatal index", ("stomata-si",)),
    ("Stomatal ratio", ("stomata-sr",)),
    ("Stomatal density", ("stomata-sd",)),
    ("Paleosols", ("paleosol",)),
    ("Liverworts", ("liverwort",)),
    ("Nahcolite", ("nahcolite",)),
)
#: The template's heading row is among a sheet's first rows.
_HEADING_ROWS = 15


@dataclass(frozen=True)
class Study:
    """A study's first author, year and DOI."""

    author: str
    year: int | None
    doi: str


@dataclass(frozen=True)
class Estimate:
    """A CO2 estimate: age (Ma), CO2 and its range (ppm), its method and study."""

    ma: float
    ppm: float
    low: float | None
    high: float | None
    method: str
    study: Study


def method_of(proxy: str) -> str | None:
    """Name the method a proxy belongs to; None for one not known."""
    name = proxy.strip().lower()
    return next(
        (method for method, starts in METHODS if any(name.startswith(word) for word in starts)),
        None,
    )


def _number(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    number = float(value)
    return number if math.isfinite(number) else None


def _text(value: object) -> str:
    return str(value).strip() if value is not None else ""


def estimates_in(data: bytes) -> list[Estimate]:
    """Read one study's spreadsheet: every row with an age and a CO2, from its first sheet."""
    sheet = load_workbook(io.BytesIO(data), read_only=True, data_only=True).worksheets[0]
    rows = [list(row) for row in sheet.iter_rows(values_only=True)]
    heading: list[str] | None = None
    found: list[Estimate] = []
    for row in rows:
        cells = [_text(cell) for cell in row]
        if heading is None:
            if "age_ka" in cells and "CO2_ppm" in cells:
                heading = cells
            continue
        # A heading may come again further along (a block of other columns): the first counts.
        record: dict[str, object] = {}
        for name, value in zip(heading, row, strict=False):
            _ = record.setdefault(name, value)
        ka, ppm = _number(record.get("age_ka")), _number(record.get("CO2_ppm"))
        method = method_of(_text(record.get("proxy")))
        if ka is None or ppm is None or ppm <= 0 or method is None:
            continue
        above = _number(record.get("CO2_uncertainty_pos_ppm"))
        below = _number(record.get("CO2_uncertainty_neg_ppm"))
        year = _number(record.get("publication_year"))
        study = Study(
            author=_text(record.get("first_author_last_name")),
            year=None if year is None else round(year),
            doi=_text(record.get("doi")),
        )
        found.append(
            Estimate(
                ma=ka / 1000,
                ppm=ppm,
                low=None if below is None else max(0.0, ppm - below),
                high=None if above is None else ppm + above,
                method=method,
                study=study,
            )
        )
    return found


def read_archive(archive: bytes) -> tuple[list[Estimate], list[str]]:
    """Read every study in the archive; also name the spreadsheets that gave no estimate."""
    estimates: list[Estimate] = []
    empty: list[str] = []
    with zipfile.ZipFile(io.BytesIO(archive)) as zipped:
        for name in sorted(zipped.namelist()):
            if not name.endswith(".xlsx") or "__MACOSX" in name:
                continue
            found = estimates_in(zipped.read(name))
            if not found:
                empty.append(name.rsplit("/", 1)[-1])
            estimates.extend(found)
    return estimates, empty


def _doi(text: str) -> str | None:
    """Read a DOI as 10.x/y, however a study wrote it; None if it has none."""
    start = text.find("10.")
    return text[start:].strip() if start >= 0 else None


def archive_file(estimates: list[Estimate], accessed: str) -> dict[str, Json]:
    """Build the site's file: the methods, the studies, and each estimate as a compact row."""
    methods = [method for method, _ in METHODS]
    studies = sorted(
        {estimate.study for estimate in estimates},
        key=lambda study: (study.author.lower(), study.year or 0, study.doi),
    )
    index = {study: at for at, study in enumerate(studies)}
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "accessed": accessed,
        "methods": list[Json](methods),
        "studies": [
            {"author": study.author, "year": study.year, "doi": _doi(study.doi)}
            for study in studies
        ],
        # Each: Ma, ppm, low, high (ppm, null where not given), method, study (indexes).
        "estimates": [
            [
                round(estimate.ma, 4),
                round(estimate.ppm),
                None if estimate.low is None else round(estimate.low),
                None if estimate.high is None else round(estimate.high),
                methods.index(estimate.method),
                index[estimate.study],
            ]
            for estimate in sorted(estimates, key=lambda estimate: estimate.ma)
        ],
    }


def _download(url: str) -> bytes:  # pragma: no cover - needs network access
    request = urllib.request.Request(url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
    with urllib.request.urlopen(request, timeout=300) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{url}: expected bytes"
        raise TypeError(msg)
    return body


def fetch_co2_archive(path: Path) -> tuple[int, list[str]]:  # pragma: no cover - needs network
    """Download the archive (checked against its checksum) and write the site's file."""
    accessed = dt.datetime.now(tz=dt.UTC).date().isoformat()
    archive = verified(_download(ARCHIVE_URL), ARCHIVE_SHA256, "Paleo-CO2 Data Archive")
    estimates, empty = read_archive(archive)
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_text(
        json.dumps(archive_file(estimates, accessed), separators=(",", ":"), ensure_ascii=False)
        + "\n"
    )
    return len(estimates), empty
