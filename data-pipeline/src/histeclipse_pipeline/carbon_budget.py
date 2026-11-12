"""Where carbon comes from and goes: the Global Carbon Budget, and each country's share (#535).

Two sources, written to three files:

- ``global.json``, from the *Global Carbon Budget 2026* data supplement (Global Carbon Project,
  ICOS Carbon Portal, doi:10.18160/GCP-2026, CC BY 4.0; the budget paper is Friedlingstein et al.
  2026, Earth System Science Data, in review when this was written). Its "Historical Budget" sheet
  is read: each year since 1750, in GtC/yr, the emissions from fossil fuels and industry (less
  cement carbonation) and from land-use change, and where they went: the air's growth, the ocean
  and land sinks, the cement carbonation sink, and the budget imbalance (what the rest leaves
  unexplained). From 1959 these are the budget proper, with the 1-sigma uncertainties the
  "Global Carbon Budget" sheet's notes give (checked against the notes when the file is read);
  before 1959 they come from other methods, without year-to-year variability in the air or
  ocean, and the sheet gives no uncertainty for them. The last year is the budget's projection
  of the year in progress, and the file says so.

- ``national-emissions.json`` and ``national-warming.json``, from Jones et al.'s *National
  contributions to climate change due to historical emissions of carbon dioxide, methane and
  nitrous oxide* (Zenodo, version 2025.1, doi:10.5281/zenodo.16640595, CC BY 4.0; described in
  Jones et al. 2023, Scientific Data 10, 155, doi:10.1038/s41597-023-02041-1). Each country is
  keyed by its ISO 3166-1 alpha-3 code, as the file gives it; the few places the file codes
  outside ISO 3166 (Kosovo, the Kuwaiti oil fires and two former territories) are kept apart,
  under ``others``, as are the groupings it adds (the globe, the EU27, Annex I and others). The
  emissions: each year since 1850, fossil and land-use CO2 (Mt CO2/yr) and all CH4
  (Tg CH4/yr) and N2O (Tg N2O/yr). The warming: each year from 1851, the warming caused since
  1850 (°C of global mean surface temperature), from fossil and land-use sources, and by gas.
  Its CO2 is the Global Carbon Project's (of the 2025 budget), its CH4 and N2O PRIMAP-hist's;
  the warming is from cumulative CO2-equivalent emissions (GWP*) and the IPCC AR6's
  best-estimate TCRE, so it leaves out aerosols' cooling and other forcings, and the globe's is
  larger than the warming measured. The source gives no uncertainty for either.

Values are rounded to four significant figures; a value the source does not give is null. Each
national file is kept under 2 MB, so the two are apart.
"""

import csv
import io
import json
import math
import re
import urllib.request
from dataclasses import dataclass
from http.cookiejar import CookieJar
from typing import TYPE_CHECKING

from openpyxl import load_workbook

from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from collections.abc import Iterable
    from pathlib import Path

#: The Global Carbon Budget 2026 data supplement, version 0.1, on the ICOS Carbon Portal.
BUDGET_OBJECT = "tGBR0_JV6zn3TGDzwaIEUNNn"
#: ICOS serves a data object once its licence (CC BY 4.0) is accepted, which sets a cookie.
BUDGET_URL = f"https://data.icos-cp.eu/licence_accept?ids=%5B%22{BUDGET_OBJECT}%22%5D"
BUDGET_SHA256 = "b46051d3f255eb39f74c60f3c1a20450d36795a34865bb2dfb90949c0bf3e4a2"
BUDGET_SOURCE = "https://doi.org/10.18160/GCP-2026"
BUDGET_CREDIT = (
    "Global Carbon Project, Global Carbon Budget 2026 (Friedlingstein et al. 2026, Earth System "
    "Science Data), data supplement v0.1, ICOS Carbon Portal, CC BY 4.0"
)
#: The year the budget was published in: its value for this year is a projection.
BUDGET_YEAR = 2026

NATIONAL_RECORD = "https://zenodo.org/records/16640595/files"
EMISSIONS_URL = f"{NATIONAL_RECORD}/EMISSIONS_ANNUAL_1830-2024.csv?download=1"
EMISSIONS_SHA256 = "c718f698de72c6ff2de404ee4c9ee1c51a273252049068d1fa2bc814bb60d073"
WARMING_URL = f"{NATIONAL_RECORD}/GMST_response_1851-2024.csv?download=1"
WARMING_SHA256 = "84f6cee695abf6a522de77b9899b094a982356ceb421e1c18c109530596de238"
NATIONAL_SOURCE = "https://doi.org/10.5281/zenodo.16640595"
NATIONAL_CREDIT = (
    "Jones et al., National contributions to climate change due to historical emissions of "
    "carbon dioxide, methane and nitrous oxide, version 2025.1 (Zenodo; Jones et al. 2023, "
    "Scientific Data 10, 155), CC BY 4.0"
)

USER_AGENT = "histeclipse-pipeline"
LICENCE = "CC BY 4.0"
#: Four significant figures: far finer than any of these estimates is known.
FIGURES = 4
#: GtC to Gt CO2, as the budget's sheets give it.
CO2_PER_C = 3.664

#: The budget's columns, in the sheet's order, by the names the files use.
BUDGET_COLUMNS = ("fossil", "landUse", "atmosphere", "ocean", "land", "cement", "imbalance")
#: Where the budget proper begins; earlier years come from other methods.
BUDGET_FROM = 1959
#: The 1-sigma uncertainties the "Global Carbon Budget" sheet's notes give, and the words each
#: is given in, so a release that changes them is not written out unseen.
SIGMA: dict[str, tuple[dict[str, Json], str]] = {
    "fossil": ({"relative": 0.05}, "uncertainty of ±5%"),
    "landUse": ({"gtc": 0.7}, "Emissions from land-use change (uncertainty of ±0.7 GtC/yr)"),
    "atmosphere": ({"gtc": 0.2, "from": 1980}, "variable uncertainty around 0.2 GtC/yr from 1980"),
    "ocean": ({"gtc": 0.6}, "ocean sink (uncertainty of ±0.6 GtC/yr"),
    "land": ({"gtc": 0.7}, "land sink (uncertainty of ±0.7 GtC/yr"),
}

#: Jones et al.'s gases and components, by the names the national file uses.
GASES = {"CO[2]": "co2", "CH[4]": "ch4", "N[2]*O": "n2o", "3-GHG": "ghg"}
COMPONENTS = {"Fossil": "fossil", "LULUCF": "land", "Total": "total"}
#: The emission series written for each country: (gas, component), unit, and scale from the
#: source's unit (Pg CO2 to Mt CO2; Tg as given).
EMISSION_SERIES: tuple[tuple[str, tuple[str, str], str, float], ...] = (
    ("co2Fossil", ("co2", "fossil"), "Mt CO2/yr", 1000.0),
    ("co2Land", ("co2", "land"), "Mt CO2/yr", 1000.0),
    ("ch4", ("ch4", "total"), "Tg CH4/yr", 1.0),
    ("n2o", ("n2o", "total"), "Tg N2O/yr", 1.0),
)
#: The warming series written for each country, in °C since 1850.
WARMING_SERIES: tuple[tuple[str, tuple[str, str]], ...] = (
    ("fossil", ("ghg", "fossil")),
    ("land", ("ghg", "land")),
    ("co2", ("co2", "total")),
    ("ch4", ("ch4", "total")),
    ("n2o", ("n2o", "total")),
)
#: The first year written; the emissions file starts earlier only for GWP*'s sake.
NATIONAL_FROM = 1850
_ISO3 = re.compile(r"[A-Z]{3}")
#: The groupings whose codes look like a country's.
GROUPS = frozenset({"EIT", "LDC"})
#: The places the file gives codes outside ISO 3166 (named in the file: Kosovo, the Kuwaiti oil
#: fires, the Pacific Islands (Palau) and the Ryukyu Islands).
NOT_ISO = frozenset({"KSV", "XKW", "XPC", "XRY"})
WARMING_METHOD = (
    "cumulative CO2-equivalent emissions (GWP*) and the TCRE, IPCC AR6 best estimates; CO2, "
    "CH4 and N2O only, without aerosols or other forcings"
)


def rounded(value: float | None) -> float | int | None:
    """Round to four significant figures, a whole number as an int; None for no value."""
    if value is None or not math.isfinite(value):
        return None
    number = float(f"{value:.{FIGURES}g}")
    return int(number) if number.is_integer() else number


def _number(value: object) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int | float):
        number = float(value)
    elif isinstance(value, str):
        try:
            number = float(value)
        except ValueError:
            return None
    else:
        return None
    return number if math.isfinite(number) else None


# The global budget.


@dataclass(frozen=True)
class Budget:
    """The budget's years, from the first, each with its columns (GtC/yr, None for none)."""

    first: int
    rows: list[list[float | int | None]]


def read_budget(data: bytes) -> Budget:
    """Read the "Historical Budget" sheet, checking the uncertainties the notes give."""
    book = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    notes = " ".join(
        str(cell)
        for row in book["Global Carbon Budget"].iter_rows(max_row=25, values_only=True)
        for cell in row
        if isinstance(cell, str)
    )
    for name, (_, words) in SIGMA.items():
        if words not in notes:
            msg = f"the budget's notes no longer give the {name} uncertainty as {words!r}"
            raise ValueError(msg)
    rows = [list(row) for row in book["Historical Budget"].iter_rows(values_only=True)]
    heading = next((i for i, row in enumerate(rows) if row and row[0] == "Year"), None)
    if heading is None:
        msg = "no Year heading in the Historical Budget sheet"
        raise ValueError(msg)
    years: dict[int, list[float | int | None]] = {}
    for row in rows[heading + 1 :]:
        year = _number(row[0] if row else None)
        if year is None:
            continue
        cells = [*row[1:], *([None] * len(BUDGET_COLUMNS))][: len(BUDGET_COLUMNS)]
        years[round(year)] = [rounded(_number(cell)) for cell in cells]
    if not years:
        msg = "no years in the Historical Budget sheet"
        raise ValueError(msg)
    first, last = min(years), max(years)
    empty: list[float | int | None] = [None] * len(BUDGET_COLUMNS)
    return Budget(first, [years.get(year, empty) for year in range(first, last + 1)])


def budget_file(budget: Budget) -> dict[str, Json]:
    """Build the global file: credit, units, uncertainties and a row per year."""
    last = budget.first + len(budget.rows) - 1
    rows: list[Json] = [list(row) for row in budget.rows]
    return {
        "schemaVersion": 1,
        "credit": BUDGET_CREDIT,
        "source": BUDGET_SOURCE,
        "licence": LICENCE,
        "unit": "GtC/yr",
        "co2PerC": CO2_PER_C,
        "columns": list(BUDGET_COLUMNS),
        "budgetFrom": BUDGET_FROM,
        "sigma": {name: sigma for name, (sigma, _) in SIGMA.items()},
        "projected": [year for year in (BUDGET_YEAR,) if budget.first <= year <= last],
        "first": budget.first,
        "rows": rows,
    }


# The national contributions.

type Key = tuple[str, str]


@dataclass
class Place:
    """A country or a grouping, and its series by (gas, component), each by year."""

    name: str
    series: dict[Key, dict[int, float | None]]


def read_long(text: str, places: dict[str, Place]) -> tuple[int, int]:
    """Read one of Jones et al.'s long files into ``places``; return its first and last year."""
    first, last = math.inf, -math.inf
    for record in csv.DictReader(io.StringIO(text)):
        gas = GASES.get(record["Gas"])
        component = COMPONENTS.get(record["Component"])
        year = _number(record["Year"])
        if gas is None or component is None or year is None:
            continue
        code = record["ISO3"].strip()
        place = places.setdefault(code, Place(record["CNTR_NAME"].strip(), {}))
        place.series.setdefault((gas, component), {})[round(year)] = _number(record["Data"])
        first, last = min(first, year), max(last, year)
    if not math.isfinite(first):
        msg = "no rows in the national file"
        raise ValueError(msg)
    return round(first), round(last)


def _row(values: dict[int, float | None] | None, years: Iterable[int], scale: float) -> list[Json]:
    out: list[Json] = []
    for year in years:
        value = None if values is None else values.get(year)
        out.append(rounded(None if value is None else value * scale))
    return out


def section_of(code: str) -> str:
    """Say where a code goes: ``countries`` (ISO alpha-3), ``others`` or ``groups``."""
    if code in NOT_ISO:
        return "others"
    if code in GROUPS or not _ISO3.fullmatch(code):
        return "groups"
    return "countries"


def places_file(
    places: dict[str, Place],
    series: Iterable[tuple[Key, float]],
    years: range,
    header: dict[str, Json],
) -> dict[str, Json]:
    """Build a national file: the header, then per country, other place and grouping, by code.

    Each entry has its name and, per series, a value per year from ``years``' first.
    """
    keys = list(series)
    sections: dict[str, dict[str, Json]] = {"countries": {}, "others": {}, "groups": {}}
    for code in sorted(places):
        place = places[code]
        rows: list[Json] = [_row(place.series.get(key), years, scale) for key, scale in keys]
        sections[section_of(code)][code] = {"name": place.name, "values": rows}
    return {
        "schemaVersion": 1,
        "credit": NATIONAL_CREDIT,
        "source": NATIONAL_SOURCE,
        "licence": LICENCE,
        **header,
        "first": years.start,
        **sections,
    }


def emissions_file(places: dict[str, Place], last: int) -> dict[str, Json]:
    """Build the national emissions file: annual emissions since 1850."""
    return places_file(
        places,
        ((key, scale) for _, key, _, scale in EMISSION_SERIES),
        range(NATIONAL_FROM, last + 1),
        {
            "series": [name for name, _, _, _ in EMISSION_SERIES],
            "units": [unit for _, _, unit, _ in EMISSION_SERIES],
        },
    )


def warming_file(places: dict[str, Place], last: int) -> dict[str, Json]:
    """Build the national warming file: the warming caused since 1850, each year from 1851."""
    return places_file(
        places,
        ((key, 1.0) for _, key in WARMING_SERIES),
        range(NATIONAL_FROM + 1, last + 1),
        {
            "series": [name for name, _ in WARMING_SERIES],
            "unit": "°C",
            "since": NATIONAL_FROM,
            "method": WARMING_METHOD,
        },
    )


def write_json(value: dict[str, Json], path: Path) -> int:
    """Write compact JSON; return its size in bytes."""
    text = json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n"
    path.parent.mkdir(parents=True, exist_ok=True)
    return path.write_text(text, encoding="utf-8")


def build(budget: bytes, emissions: bytes, warming: bytes, folder: Path) -> tuple[int, int]:
    """Write the global and the two national files; return how many years and countries."""
    read = read_budget(budget)
    _ = write_json(budget_file(read), folder / "global.json")
    emitted: dict[str, Place] = {}
    _, last = read_long(emissions.decode("utf-8"), emitted)
    _ = write_json(emissions_file(emitted, last), folder / "national-emissions.json")
    warmed: dict[str, Place] = {}
    _, last = read_long(warming.decode("utf-8"), warmed)
    _ = write_json(warming_file(warmed, last), folder / "national-warming.json")
    return len(read.rows), sum(section_of(code) == "countries" for code in emitted)


def _download(
    url: str, opener: urllib.request.OpenerDirector
) -> bytes:  # pragma: no cover - needs network access
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})  # noqa: S310
    with opener.open(request, timeout=300) as response:  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{url}: expected bytes"
        raise TypeError(msg)
    return body


def fetch_carbon_budget(folder: Path) -> tuple[int, int]:  # pragma: no cover - needs network access
    """Download the budget and the national files (each checked against its checksum); write."""
    # ICOS's licence page sets a cookie for the object, then redirects to it.
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))
    budget = verified(_download(BUDGET_URL, opener), BUDGET_SHA256, "Global Carbon Budget")
    emissions = verified(_download(EMISSIONS_URL, opener), EMISSIONS_SHA256, "national emissions")
    warming = verified(_download(WARMING_URL, opener), WARMING_SHA256, "national warming")
    return build(budget, emissions, warming, folder)
