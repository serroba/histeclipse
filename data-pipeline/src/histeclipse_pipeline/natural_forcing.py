"""Natural climate forcing: the Sun's irradiance and volcanic sulfur, from three records (#536).

Three files, one per source, each kept in the source's own terms so that they can be set side
by side rather than merged:

- ``solar-cmip6.json``: the CMIP6 solar forcing, version 3.2 (Matthes et al. 2017, Geosci. Model
  Dev. 10, 2247, doi:10.5194/gmd-10-2247-2017), from SOLARIS-HEPPA's monthly "reference
  scenario" file (input4MIPs ``SOLARIS-HEPPA-CMIP-3-2``, a gzipped netCDF-4 file, read with
  h5py). Its ``tsi`` is total solar irradiance at 1 AU in W/m², the mean of the NRLSSI2 and
  SATIRE-TS reconstructions integrated over the spectrum. Only the historical part, 1850-2014,
  is kept: from 2015 the file is a forecast. Each year is the plain mean of its twelve months.
  The file's licence attribute names CC BY-SA 4.0 (and links the CC BY 4.0 deed).
- ``solar-holocene.json``: Steinhilber et al. (2012), PNAS 109, 5967,
  doi:10.1073/pnas.1118965109, from NOAA NCEI (study 12894, doi:10.25921/ytyh-f437; licence not
  stated, NCEI asks for citation). Total solar irradiance from beryllium-10 in ice cores and
  carbon-14 in tree rings over 9,400 years, as 22-year means, each with its 1-sigma, and the
  solar modulation potential (MV) it was derived from. The TSI is a DIFFERENCE from the PMOD
  composite at the 1986 solar minimum (1365.57 W/m², an older absolute scale than CMIP6's
  1361), so it is written as given with that reference beside it, not shifted onto CMIP6.
  Years are astronomical CE: year = 1950 - (cal yr BP).
- ``volcanic-evolv2k.json``: eVolv2k version 4 (Sigl & Toohey 2024, PANGAEA,
  doi:10.1594/PANGAEA.971968, CC BY 4.0; method in Toohey & Sigl 2017, Earth Syst. Sci. Data 9,
  809). Each volcanic stratospheric sulfur injection (VSSI, Tg S) from 500 BCE to 1900 CE with
  its 1-sigma, date, latitude and, where the authors know it, the volcano. It is a list of
  events: a year with none had no injection large enough to register in the ice. Years are the
  ISO column (astronomical, with a year 0). Where the file's two year columns disagree beyond
  that offset (Ilopango: 432 against 433), both are kept in ``yearMismatches``.

The eVolv2k aerosol optical depth (on WDC-Climate) needs an account, and HolVol's (PANGAEA) is
a 100 MB netCDF-3 file, so neither is read here; the sulfur injections are their input.
"""

import datetime as dt
import gzip
import io
import json
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

import h5py
import numpy as np

from histeclipse_pipeline.sky import verified

if TYPE_CHECKING:
    from pathlib import Path

    from histeclipse_pipeline.sky import Json

USER_AGENT = "histeclipse-pipeline (https://github.com/serroba/histeclipse)"

CMIP6_URL = "https://cloud.iaa.es/index.php/s/5qHwdy72pSjbWzs/download"
CMIP6_SHA256 = "2afd5ed359d4c2d5416c60e37982d7d27db6ada05402b5a93158fb8a8533f05d"
CMIP6_SOURCE = "https://doi.org/10.5194/gmd-10-2247-2017"
CMIP6_PAGE = "https://www.solarisheppa.kit.edu/85.php"
CMIP6_CREDIT = (
    "CMIP6 solar forcing v3.2 (Matthes et al. 2017, Geosci. Model Dev.), SOLARIS-HEPPA, "
    "CC BY-SA 4.0; these annual means are shared under the same licence"
)
#: The historical reconstruction; later years are the forecast "reference scenario".
CMIP6_YEARS = (1850, 2014)

STEINHILBER_URL = (
    "https://www.ncei.noaa.gov/pub/data/paleo/climate_forcing/solar_variability/"
    "steinhilber2012-noaa.txt"
)
STEINHILBER_SHA256 = "c78606de34f07811c0896dc96226a2e994372723891fa5734b2dddc9a1167f98"
STEINHILBER_SOURCE = "https://www.ncei.noaa.gov/access/paleo-search/study/12894"
STEINHILBER_CREDIT = (
    "Steinhilber et al. 2012 (PNAS), NOAA NCEI Paleoclimatology study 12894; "
    "no licence stated, cite the publication"
)
#: The PMOD composite's TSI at the 1986 solar minimum, which Steinhilber's values differ from.
STEINHILBER_REFERENCE = 1365.57

EVOLV2K_URL = "https://doi.pangaea.de/10.1594/PANGAEA.971968?format=textfile"
EVOLV2K_SHA256 = "468deb97903816df90f1fd6bc810afdcb928d3ef463ba4a341318932d09f8b40"
EVOLV2K_SOURCE = "https://doi.org/10.1594/PANGAEA.971968"
EVOLV2K_CREDIT = (
    "eVolv2k v4 (Sigl & Toohey 2024, PANGAEA; Toohey & Sigl 2017, Earth Syst. Sci. Data), CC BY 4.0"
)
_EVOLV2K_COLUMNS = 13


def annual_means(years: list[int], values: list[float], first: int, last: int) -> list[float]:
    """Average monthly values into each year from first to last; every year must have some."""
    sums: dict[int, list[float]] = {}
    for year, value in zip(years, values, strict=True):
        if first <= year <= last:
            sums.setdefault(year, []).append(value)
    missing = [year for year in range(first, last + 1) if year not in sums]
    if missing:
        msg = f"no values for {missing[0]}"
        raise ValueError(msg)
    return [sum(sums[year]) / len(sums[year]) for year in range(first, last + 1)]


def read_cmip6(gzipped: bytes) -> tuple[list[int], list[float]]:
    """Read the monthly file's calendar years and TSI (W/m²)."""
    with h5py.File(io.BytesIO(gzip.decompress(gzipped))) as file:
        columns: list[list[float]] = [
            file[name][()].astype(np.float64).tolist() for name in ("calyear", "tsi")
        ]
    years, tsi = columns
    return [round(year) for year in years], tsi


def cmip6_file(years: list[int], tsi: list[float], accessed: str) -> dict[str, Json]:
    """Build the site's file: annual mean TSI over the historical years."""
    first, last = CMIP6_YEARS
    means = annual_means(years, tsi, first, last)
    return {
        "schemaVersion": 1,
        "credit": CMIP6_CREDIT,
        "source": CMIP6_SOURCE,
        "page": CMIP6_PAGE,
        "accessed": accessed,
        "unit": "W/m²",
        "what": "total solar irradiance at 1 AU, annual mean of the monthly reconstruction",
        "firstYear": first,
        "tsi": [round(value, 3) for value in means],
    }


@dataclass(frozen=True)
class SolarRow:
    """One 22-year mean of Steinhilber et al.: year CE, TSI difference and Phi, with sigmas."""

    year: int
    tsi: float
    tsi_sigma: float
    phi: float
    phi_sigma: float


def read_steinhilber(text: str) -> list[SolarRow]:
    """Read the NOAA template's data lines, oldest first."""
    rows: list[SolarRow] = []
    heading: list[str] | None = None
    for line in text.splitlines():
        if line.startswith("#") or not line.strip():
            continue
        cells = line.split("\t")
        if heading is None:
            heading = cells
            continue
        record = dict(zip(heading, cells, strict=True))
        rows.append(
            SolarRow(
                year=1950 - round(float(record["age_calBP"])),
                tsi=float(record["TSI"]),
                tsi_sigma=float(record["TSIErr"]),
                phi=float(record["Phi"]),
                phi_sigma=float(record["PhiErr"]),
            )
        )
    if not rows:
        msg = "no data lines in the file"
        raise ValueError(msg)
    return sorted(rows, key=lambda row: row.year)


def steinhilber_file(rows: list[SolarRow], accessed: str) -> dict[str, Json]:
    """Build the site's file: the 22-year means as columns, oldest first."""
    return {
        "schemaVersion": 1,
        "credit": STEINHILBER_CREDIT,
        "source": STEINHILBER_SOURCE,
        "paper": "https://doi.org/10.1073/pnas.1118965109",
        "accessed": accessed,
        "unit": "W/m²",
        "what": (
            "total solar irradiance as the difference from the PMOD composite at the 1986 "
            "solar minimum, 22-year means; phi is the solar modulation potential (MV)"
        ),
        "reference": STEINHILBER_REFERENCE,
        "window": 22,
        "year": [row.year for row in rows],
        "tsi": [row.tsi for row in rows],
        "tsiSigma": [row.tsi_sigma for row in rows],
        "phi": [row.phi for row in rows],
        "phiSigma": [row.phi_sigma for row in rows],
    }


@dataclass(frozen=True)
class Injection:
    """One eVolv2k event: date, latitude, sulfur (Tg S) and its sigma, and the volcano if known."""

    year: int
    listed_year: int
    month: int
    day: int
    latitude: float
    sulfur: float
    sigma: float
    location: str | None


def _listed_matches(listed: int, iso: int) -> bool:
    """Whether the listed year and the ISO year agree, BCE years being one apart."""
    return iso == (listed + 1 if listed < 0 else listed)


def read_evolv2k(text: str) -> list[Injection]:
    """Read PANGAEA's tab-separated export: the rows after the header block, oldest first."""
    _, _, body = text.partition("*/\n")
    found: list[Injection] = []
    for line in body.splitlines()[1:]:
        cells = line.split("\t")
        if len(cells) != _EVOLV2K_COLUMNS:
            continue
        location = cells[10].strip()
        found.append(
            Injection(
                year=int(cells[1]),
                listed_year=int(cells[0]),
                month=int(cells[2]),
                day=int(cells[3]),
                latitude=float(cells[4]),
                sulfur=float(cells[7]),
                sigma=float(cells[8]),
                location=None if location in {"", "N/A"} else " ".join(location.split()),
            )
        )
    if not found:
        msg = "no events in the file"
        raise ValueError(msg)
    return sorted(found, key=lambda event: (event.year, event.month, event.day))


def evolv2k_file(events: list[Injection], accessed: str) -> dict[str, Json]:
    """Build the site's file: the events as columns, oldest first."""
    return {
        "schemaVersion": 1,
        "credit": EVOLV2K_CREDIT,
        "source": EVOLV2K_SOURCE,
        "paper": "https://doi.org/10.5194/essd-9-809-2017",
        "accessed": accessed,
        "unit": "Tg S",
        "what": "volcanic stratospheric sulfur injection per eruption, with its 1-sigma",
        "year": [event.year for event in events],
        "month": [event.month for event in events],
        "day": [event.day for event in events],
        "latitude": [event.latitude for event in events],
        "sulfur": [event.sulfur for event in events],
        "sigma": [event.sigma for event in events],
        "location": [event.location for event in events],
        "yearMismatches": [
            {"iso": event.year, "listed": event.listed_year, "location": event.location}
            for event in events
            if not _listed_matches(event.listed_year, event.year)
        ],
    }


def _download(url: str) -> bytes:  # pragma: no cover - needs network access
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})  # noqa: S310
    with urllib.request.urlopen(request, timeout=300) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{url}: expected bytes"
        raise TypeError(msg)
    return body


def _write(path: Path, built: dict[str, Json]) -> int:  # pragma: no cover - needs network access
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(built, separators=(",", ":"), ensure_ascii=False) + "\n"
    return path.write_text(text, encoding="utf-8")


def fetch_natural_forcing(folder: Path) -> dict[str, int]:  # pragma: no cover - needs network
    """Download the three records (each checked against its checksum) and write their files."""
    accessed = dt.datetime.now(tz=dt.UTC).date().isoformat()
    cmip6 = verified(_download(CMIP6_URL), CMIP6_SHA256, "CMIP6 solar forcing")
    years, tsi = read_cmip6(cmip6)
    built = cmip6_file(years, tsi, accessed)
    _ = _write(folder / "solar-cmip6.json", built)
    solar = verified(_download(STEINHILBER_URL), STEINHILBER_SHA256, "Steinhilber 2012")
    rows = read_steinhilber(solar.decode("utf-8"))
    _ = _write(folder / "solar-holocene.json", steinhilber_file(rows, accessed))
    volcanic = verified(_download(EVOLV2K_URL), EVOLV2K_SHA256, "eVolv2k v4")
    events = read_evolv2k(volcanic.decode("utf-8"))
    _ = _write(folder / "volcanic-evolv2k.json", evolv2k_file(events, accessed))
    return {
        "solar-cmip6": CMIP6_YEARS[1] - CMIP6_YEARS[0] + 1,
        "solar-holocene": len(rows),
        "volcanic-evolv2k": len(events),
    }
