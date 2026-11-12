"""Measured change in the world's ice and snow: ice sheets, glaciers, sea ice and snow (#529).

Four sources, each written to its own folder as one compact ``index.json`` of curves; where a
source gives an uncertainty, it is kept. Where sources disagree they are kept side by side, not
averaged:

- Ice sheets: IMBIE, the Ice Sheet Mass Balance Inter-comparison Exercise (Otosaka et al. 2026,
  Scientific Data 13, 1301, doi:10.1038/s41597-026-08088-0; data doi:10.5285/128c5e33-5224-
  4197-82f0-19dcc95b80a0, NERC EDS UK Polar Data Centre, Open Government Licence v3.0): the
  reconciled mass balance of Greenland (from 1972) and Antarctica and its three parts (from
  1979) to 2023, monthly, from altimetry, gravimetry and the input-output method, with
  one-sigma uncertainties, and split into surface mass balance and ice dynamics. Written here once a
  year: the year's mean rate and the cumulative change at its last month, from zero at the
  start of each record.
- Glaciers: GlaMBIE, the Glacier Mass Balance Intercomparison Exercise (The GlaMBIE Team 2025,
  Nature 639, 382, doi:10.1038/s41586-024-08545-z; dataset 1.0.0, doi:10.5904/wgms-glambie-
  2024-07, WGMS, open access with citation): each of the 19 glacier regions' mass change per
  year 2000-2023, combined and (in hydrological years) by each kind of observation (altimetry,
  gravimetry, DEM differencing with the glaciological method), so the methods' disagreement
  shows; and the world's total. GlaMBIE's inputs include Hugonnet et al. (2021, Nature 592, 726,
  doi:10.1038/s41586-021-03436-z) by region, as five-year changes in surface elevation (metres
  of ice, not water equivalent); those are kept too.
- Sea ice: NSIDC's Sea Ice Index (G02135, version 4; Fetterer et al., doi:10.7265/a98x-0f50),
  the monthly mean extent and area of the Arctic in March and September and of the Antarctic in
  February and September, from 1978/79: each pole's month of most and least ice. NOAA@NSIDC
  data, free to use with citation. ``seaice.py`` keeps its 1981-2010 maps; this is the trend.
- Snow: Rutgers Global Snow Lab's monthly Northern Hemisphere snow-cover extent over land,
  Greenland included, from November 1966 (Robinson, Estilow & NOAA CDR Program 2012, NOAA
  Climate Data Record of NH Snow Cover Extent, doi:10.7289/V5N014G9; Estilow et al. 2015, Earth
  System Science Data 7, 137). No licence is stated; NOAA's CDRs are free to use with citation.
  Some months of 1968-1971 are missing in the source and are null here.

The Sea Ice Index and the snow table are updated every month, so their pinned checksums change
with each update: a new run needs new pins, deliberately, so a changed file is never used unseen.
"""

import base64
import csv
import io
import json
import math
import urllib.request
import zipfile
from dataclasses import dataclass
from typing import TYPE_CHECKING

from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from collections.abc import Callable, Iterable, Sequence
    from pathlib import Path

SCHEMA_VERSION = 1


@dataclass(frozen=True)
class Download:
    """A file to fetch, and the SHA-256 it must have."""

    url: str
    sha256: str


def _write(folder: Path, index: dict[str, Json]) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    body = json.dumps(index, separators=(",", ":"), ensure_ascii=False)
    _ = (folder / "index.json").write_text(body + "\n", encoding="utf-8")


def _length(value: Json) -> int:
    return len(value) if isinstance(value, list) else 0


def _number(text: str) -> float | None:
    """Parse a value; None where it is blank or not a number."""
    try:
        value = float(text)
    except ValueError:
        return None
    return None if math.isnan(value) else value


def _rounded(values: Iterable[float | None], digits: int) -> list[Json]:
    return [None if value is None else round(value, digits) for value in values]


# --- Ice sheets: IMBIE ------------------------------------------------------------------------

IMBIE_SOURCE = "https://doi.org/10.5285/128c5e33-5224-4197-82f0-19dcc95b80a0"
IMBIE_LICENCE = "Open Government Licence v3.0"
IMBIE_CREDIT = (
    "IMBIE (Otosaka et al. 2026, Mass balance of the Greenland and Antarctic ice sheets from "
    "the 1970s to 2023, Scientific Data 13, 1301; data: NERC EDS UK Polar Data Centre, "
    "doi:10.5285/128c5e33-5224-4197-82f0-19dcc95b80a0, version 1.0), Open Government Licence "
    "v3.0; yearly from the monthly series, with one-sigma uncertainties"
)
_IMBIE_URL = (
    "https://ramadda.data.bas.ac.uk/repository/entry/get/imbie3_{name}_Gt_partitioned.csv"
    "?entryid=synth:128c5e33-5224-4197-82f0-19dcc95b80a0:{encoded}"
)
#: Each region's id, label and file's pinned SHA-256 (version 1.0, published July 2026).
IMBIE_REGIONS: tuple[tuple[str, str, str], ...] = (
    (
        "greenland",
        "Greenland",
        "1d4df7c73845ab9194fd07999ce7a7716d01ef5c9fbc2d4a464be5afc6b52a26",
    ),
    (
        "antarctica",
        "Antarctica",
        "cdb5f37c703af3fb36ccbf89f6ca0ba8b444817cb48ff34cc77ca7a9d9a525b2",
    ),
    (
        "west_antarctica",
        "West Antarctica",
        "3288956edc5407fb5d63559f8a5eee0012e650a07d16a860a677f7a6209a83d2",
    ),
    (
        "east_antarctica",
        "East Antarctica",
        "e4cb99717dc10c65c8e35d48f5f575a8c9f38887c08c0b3bf4fe393ba8c9bd13",
    ),
    (
        "antarctic_peninsula",
        "Antarctic Peninsula",
        "ff144cc08fb3f78e8f511743294c17f8ab178a021ee4068ad7356fb46c0122eb",
    ),
)
#: Gigatonnes of ice per millimetre of global sea level, as IMBIE converts.
GT_PER_MM = 362.5
#: The IMBIE columns kept, by the name written: rates (Gt/yr) averaged over the year, cumulative
#: changes (Gt) taken at its last month. Each is followed in the file by its uncertainty.
_IMBIE_RATES = {"rate": 1, "surfaceRate": 5, "dynamicsRate": 9}
_IMBIE_TOTALS = {"mass": 3, "surface": 7, "dynamics": 11}


def imbie_url(name: str) -> str:
    """Link to one region's file at the Polar Data Centre (its id holds the path in base64)."""
    encoded = base64.b64encode(f"/imbie3_{name}_Gt_partitioned.csv".encode()).decode()
    return _IMBIE_URL.format(name=name, encoded=encoded)


def imbie_rows(text: str) -> list[list[str]]:
    """Return the data rows of an IMBIE CSV, without its ``#`` header lines or column names."""
    lines = [line for line in text.splitlines() if line.strip() and not line.startswith("#")]
    rows = list(csv.reader(lines))
    if not rows or rows[0][0] != "Date":
        msg = "IMBIE file: no 'Date' header"
        raise ValueError(msg)
    return rows[1:]


def imbie_region(region_id: str, label: str, text: str) -> dict[str, Json]:
    """One region's yearly series: mean rates and end-of-year cumulative change, with errors."""
    years: dict[int, list[list[float]]] = {}
    for row in imbie_rows(text):
        values = [float(cell) for cell in row[1:]]
        years.setdefault(int(row[0][:4]), []).append(values)
    out: dict[str, Json] = {"id": region_id, "label": label, "years": list[Json](years)}
    for name, column in _IMBIE_RATES.items():
        index = column - 1
        out[name] = [round(sum(m[index] for m in ms) / len(ms), 1) for ms in years.values()]
        out[name + "Error"] = [
            round(sum(m[index + 1] for m in ms) / len(ms), 1) for ms in years.values()
        ]
    for name, column in _IMBIE_TOTALS.items():
        index = column - 1
        out[name] = [round(ms[-1][index], 1) for ms in years.values()]
        out[name + "Error"] = [round(ms[-1][index + 1], 1) for ms in years.values()]
    return out


def imbie_index(regions: Sequence[dict[str, Json]]) -> dict[str, Json]:
    """Build the IMBIE manifest: credit, units and every region's series."""
    return {
        "schemaVersion": SCHEMA_VERSION,
        "credit": IMBIE_CREDIT,
        "source": IMBIE_SOURCE,
        "licence": IMBIE_LICENCE,
        "units": {"rate": "Gt/yr", "mass": "Gt"},
        "gtPerMm": GT_PER_MM,
        "baseline": "cumulative change from zero at the first month of each record",
        "uncertainty": "one sigma",
        "regions": list(regions),
    }


def write_imbie(texts: Sequence[str], folder: Path) -> int:
    """Write the regions' series, in ``IMBIE_REGIONS`` order; return how many years in all."""
    regions = [
        imbie_region(region_id, label, text)
        for (region_id, label, _), text in zip(IMBIE_REGIONS, texts, strict=True)
    ]
    _write(folder, imbie_index(regions))
    return sum(_length(region["years"]) for region in regions)


# --- Glaciers: GlaMBIE, with Hugonnet et al. by region -------------------------------------

GLAMBIE = Download(
    "https://wgms.ch/downloads/GlaMBIE_Data_DOI_10.5904_wgms-glambie-2024-07.zip",
    "f2e615a2598229396ab7e262b3a5d66c1b7acce999c93d3c5d3a884418546265",
)
GLAMBIE_SOURCE = "https://doi.org/10.5904/wgms-glambie-2024-07"
GLAMBIE_LICENCE = "Open access, on condition of correct citation (WGMS)"
GLAMBIE_CREDIT = (
    "GlaMBIE (The GlaMBIE Team 2025, Community estimate of global glacier mass changes from "
    "2000 to 2023, Nature 639, 382; dataset 1.0.0, WGMS, doi:10.5904/wgms-glambie-2024-07), open "
    "access with citation; with Hugonnet et al. 2021 (Nature 592, 726) by region, as submitted "
    "to GlaMBIE"
)
_RESULTS = "glambie_results_20240716/"
_INPUTS = "glambie_input_20240716/"
#: The 19 glacier regions (GTN-G / RGI first order), by GlaMBIE's folder name.
GLACIER_REGIONS: dict[str, str] = {
    "alaska": "Alaska",
    "western_canada_us": "Western Canada and USA",
    "arctic_canada_north": "Arctic Canada North",
    "arctic_canada_south": "Arctic Canada South",
    "greenland_periphery": "Greenland Periphery",
    "iceland": "Iceland",
    "svalbard": "Svalbard and Jan Mayen",
    "scandinavia": "Scandinavia",
    "russian_arctic": "Russian Arctic",
    "north_asia": "North Asia",
    "central_europe": "Central Europe",
    "caucasus_middle_east": "Caucasus and Middle East",
    "central_asia": "Central Asia",
    "south_asia_west": "South Asia West",
    "south_asia_east": "South Asia East",
    "low_latitudes": "Low Latitudes",
    "southern_andes": "Southern Andes",
    "new_zealand": "New Zealand",
    "antarctic_and_subantarctic": "Antarctic and Subantarctic",
}
#: The kinds of observation GlaMBIE combines, by their column prefix.
GLACIER_METHODS = ("altimetry", "gravimetry", "demdiff_and_glaciological")


def _table(data: str) -> list[dict[str, str]]:
    return list(csv.DictReader(io.StringIO(data)))


def _column(rows: Sequence[dict[str, str]], name: str) -> list[float | None]:
    return [_number(row.get(name, "")) for row in rows]


def glacier_calendar(rows: Sequence[dict[str, str]]) -> dict[str, Json]:
    """GlaMBIE's combined change per calendar year: Gt and m w.e., with errors."""
    return {
        "years": [int(float(row["start_dates"])) for row in rows],
        "area": round(float(rows[0]["glacier_area"])),
        "gt": _rounded(_column(rows, "combined_gt"), 2),
        "gtError": _rounded(_column(rows, "combined_gt_errors"), 2),
        "mwe": _rounded(_column(rows, "combined_mwe"), 3),
        "mweError": _rounded(_column(rows, "combined_mwe_errors"), 3),
    }


def glacier_methods(rows: Sequence[dict[str, str]]) -> dict[str, Json]:
    """Each kind of observation's change per hydrological year, in Gt; those with none left out."""
    out: dict[str, Json] = {"start": [float(row["start_dates"]) for row in rows]}
    for method in ("combined", *GLACIER_METHODS):
        values = _column(rows, f"{method}_gt")
        if all(value is None for value in values):
            continue
        out[method] = {
            "gt": _rounded(values, 2),
            "gtError": _rounded(_column(rows, f"{method}_gt_errors"), 2),
        }
    return out


def hugonnet(rows: Sequence[dict[str, str]]) -> dict[str, Json]:
    """Hugonnet et al.'s change in surface elevation (m) over each period, with its error."""
    if any(row["unit"] != "m" for row in rows):
        msg = "Hugonnet et al.: expected changes in metres"
        raise ValueError(msg)
    return {
        "periods": [[float(row["start_dates"]), float(row["end_dates"])] for row in rows],
        "dh": _rounded(_column(rows, "changes"), 3),
        "dhError": _rounded(_column(rows, "errors"), 3),
    }


def _member(names: Iterable[str], prefix: str, suffix: str) -> str:
    for name in names:
        if name.startswith(prefix) and name.endswith(suffix):
            return name
    msg = f"GlaMBIE archive: no {prefix}*{suffix}"
    raise ValueError(msg)


def glaciers_from_zip(data: bytes) -> dict[str, Json]:
    """Read the GlaMBIE archive into the glaciers manifest."""
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        names = archive.namelist()

        def read(name: str) -> list[dict[str, str]]:
            return _table(archive.read(name).decode("utf-8"))

        regions: list[Json] = []
        for number, (key, label) in enumerate(GLACIER_REGIONS.items(), start=1):
            folder = f"{number}_{key}"
            calendar = read(f"{_RESULTS}calendar_years/{folder}.csv")
            hydrological = read(f"{_RESULTS}hydrological_years/{folder}.csv")
            dh = read(_member(names, f"{_INPUTS}{folder}/", "_demdiff_ETH_Hugonnet_et_al.csv"))
            regions.append(
                {
                    "id": key.replace("_", "-"),
                    "rgi": number,
                    "label": label,
                    "calendar": glacier_calendar(calendar),
                    "methods": glacier_methods(hydrological),
                    "hugonnet": hugonnet(dh),
                }
            )
        world = glacier_calendar(read(f"{_RESULTS}calendar_years/0_global.csv"))
    return glaciers_index(world, regions)


def glaciers_index(world: dict[str, Json], regions: list[Json]) -> dict[str, Json]:
    """Build the glaciers manifest: credit, units, the world's total and each region's series."""
    return {
        "schemaVersion": SCHEMA_VERSION,
        "credit": GLAMBIE_CREDIT,
        "source": GLAMBIE_SOURCE,
        "licence": GLAMBIE_LICENCE,
        "units": {
            "gt": "Gt per year (negative: loss)",
            "mwe": "m water equivalent per year",
            "area": "km² (the first year's)",
            "dh": "m of surface elevation over the period (ice, not water equivalent)",
        },
        "years": "calendar: the year from each start; methods: hydrological years from 'start'",
        "uncertainty": "as GlaMBIE and Hugonnet et al. give them (one sigma)",
        "methods": {
            "combined": "GlaMBIE's combined estimate",
            "altimetry": "altimetry",
            "gravimetry": "gravimetry (GRACE, GRACE-FO)",
            "demdiff_and_glaciological": "DEM differencing and the glaciological method",
        },
        "hugonnet": {
            "credit": (
                "Hugonnet et al. 2021, Accelerated global glacier mass loss in the early "
                "twenty-first century, Nature 592, 726"
            ),
            "url": "https://doi.org/10.1038/s41586-021-03436-z",
        },
        "world": world,
        "regions": regions,
    }


def write_glaciers(data: bytes, folder: Path) -> int:
    """Write the glaciers manifest from the GlaMBIE archive; return how many regions."""
    index = glaciers_from_zip(data)
    _write(folder, index)
    return _length(index["regions"])


# --- Sea ice: NSIDC Sea Ice Index trend -------------------------------------------------------

SEAICE_SOURCE = "https://doi.org/10.7265/a98x-0f50"
SEAICE_LICENCE = "None stated; free to use on condition of citing it (NSIDC data use policy)"
SEAICE_CREDIT = (
    "NSIDC Sea Ice Index, version 4 (Fetterer, Knowles, Meier, Savoie, Windnagel & Stafford "
    "2025, doi:10.7265/a98x-0f50), NOAA@NSIDC: monthly mean extent and area"
)
_SEAICE_URL = "https://noaadata.apps.nsidc.org/NOAA/G02135/{pole}/monthly/data/{p}_{month:02d}_extent_v4.0.csv"
#: Each series: id, label, pole, month, pinned SHA-256 (the files as of November 2026).
SEAICE_SERIES: tuple[tuple[str, str, str, int, str], ...] = (
    (
        "arctic-march",
        "Arctic, March (most ice)",
        "north",
        3,
        "01c4fa25d1a4a35aee9558eeecd652564fc91582e35e7b2fcaf8c19ebf56aff7",
    ),
    (
        "arctic-september",
        "Arctic, September (least ice)",
        "north",
        9,
        "3968dfdbe73b8361712da9136cfeff6dbc9a6d87ab3e75daa30cc254615eab1f",
    ),
    (
        "antarctic-february",
        "Antarctic, February (least ice)",
        "south",
        2,
        "ee9717d02fbc7f5ad66fb6982d3a5cb746c02a011311f2419f1483384ce9f8b3",
    ),
    (
        "antarctic-september",
        "Antarctic, September (most ice)",
        "south",
        9,
        "32e94df4721daf475d675490ce81d49d5e99f47e43cad2660c064ab56ba4f01a",
    ),
)
#: The Sea Ice Index's mark for a month without data.
MISSING = -9999


def seaice_url(pole: str, month: int) -> str:
    """Link to the Sea Ice Index's monthly extent file for one pole and month."""
    return _SEAICE_URL.format(pole=pole, p=pole[0].upper(), month=month)


def seaice_series(series_id: str, label: str, month: int, text: str) -> dict[str, Json]:
    """One month's extent and area by year (million km²), skipping years without data."""
    rows = [
        {key.strip(): value.strip() for key, value in row.items()}
        for row in csv.DictReader(io.StringIO(text))
    ]
    years: list[Json] = []
    extent: list[Json] = []
    area: list[Json] = []
    for row in rows:
        if int(row["mo"]) != month:
            msg = f"{series_id}: a row for month {row['mo']}"
            raise ValueError(msg)
        value = float(row["extent"])
        if value <= MISSING:
            continue
        years.append(int(row["year"]))
        extent.append(round(value, 2))
        covered = float(row["area"])
        area.append(None if covered <= MISSING else round(covered, 2))
    return {
        "id": series_id,
        "label": label,
        "month": month,
        "years": years,
        "extent": extent,
        "area": area,
    }


def seaice_index(series: Sequence[dict[str, Json]]) -> dict[str, Json]:
    """Build the sea-ice trend manifest: credit, units and each month's series."""
    return {
        "schemaVersion": SCHEMA_VERSION,
        "credit": SEAICE_CREDIT,
        "source": SEAICE_SOURCE,
        "licence": SEAICE_LICENCE,
        "units": {"extent": "million km²", "area": "million km²"},
        "note": (
            "Monthly means, not the single day of most or least ice. Extent counts every "
            "cell with at least 15% ice; area, only the ice in them."
        ),
        "series": list(series),
    }


def write_seaice_trend(texts: Sequence[str], folder: Path) -> int:
    """Write the four months' series, in ``SEAICE_SERIES`` order; return how many points."""
    series = [
        seaice_series(series_id, label, month, text)
        for (series_id, label, _, month, _), text in zip(SEAICE_SERIES, texts, strict=True)
    ]
    _write(folder, seaice_index(series))
    return sum(_length(each["years"]) for each in series)


# --- Snow: Rutgers Global Snow Lab ---------------------------------------------------------

SNOW = Download(
    "https://climate.rutgers.edu/snowcover/files/moncov.nhland.txt",
    # The table as of November 2026, through October 2026.
    "1bf917902dad81f4936ecfd740e9e2da001f2c69ba4ca6ae00ca564f27ae2e09",
)
SNOW_SOURCE = "https://climate.rutgers.edu/snowcover/"
SNOW_LICENCE = "None stated; free to use with citation (NOAA Climate Data Record)"
SNOW_CREDIT = (
    "Rutgers University Global Snow Lab, Northern Hemisphere snow-cover extent over land "
    "(Robinson, Estilow & NOAA CDR Program 2012, NOAA Climate Data Record of Northern "
    "Hemisphere Snow Cover Extent, version 1, doi:10.7289/V5N014G9; Estilow et al. 2015, "
    "Earth System Science Data 7, 137): monthly, Greenland included"
)
MONTHS = 12
_KM2_PER_MILLION = 1e6


def snow_cover(text: str) -> dict[str, Json]:
    """Each year's twelve monthly extents (million km²), null for months the source lacks."""
    by_year: dict[int, list[float | None]] = {}
    for line in text.splitlines():
        parts = line.split()
        if not parts:
            continue
        year, month, km2 = int(parts[0]), int(parts[1]), float(parts[2])
        months = by_year.setdefault(year, [None] * MONTHS)
        months[month - 1] = km2 / _KM2_PER_MILLION
    years = sorted(by_year)
    complete = [
        sum(v for v in by_year[year] if v is not None) / MONTHS
        if all(v is not None for v in by_year[year])
        else None
        for year in years
    ]
    return {
        "schemaVersion": SCHEMA_VERSION,
        "credit": SNOW_CREDIT,
        "source": SNOW_SOURCE,
        "licence": SNOW_LICENCE,
        "units": {"extent": "million km²"},
        "coverage": "Northern Hemisphere land, Greenland included",
        "note": (
            "Mapped weekly from visible satellite imagery; 'annual' is the mean of the "
            "twelve months, null where any is missing."
        ),
        "years": list[Json](years),
        "months": [_rounded(by_year[year], 2) for year in years],
        "annual": _rounded(complete, 2),
    }


def write_snow_cover(text: str, folder: Path) -> int:
    """Write the snow-cover manifest; return how many years."""
    index = snow_cover(text)
    _write(folder, index)
    return _length(index["years"])


# --- Downloads --------------------------------------------------------------------------------


def _download(url: str, sha256: str, what: str) -> bytes:  # pragma: no cover - needs network access
    # Every URL is built from the https constants above.
    request = urllib.request.Request(url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
    with urllib.request.urlopen(request, timeout=300) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{url}: expected bytes"
        raise TypeError(msg)
    return verified(body, sha256, what)


def _texts(
    items: Iterable[tuple[str, str, str]], fetch: Callable[[str, str, str], bytes]
) -> list[str]:  # pragma: no cover - needs network access
    return [fetch(url, sha256, what).decode("utf-8") for url, sha256, what in items]


def fetch_imbie(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download IMBIE's five regions (each checked against its pinned checksum); write them."""
    items = [(imbie_url(name), sha256, f"IMBIE {label}") for name, label, sha256 in IMBIE_REGIONS]
    return write_imbie(_texts(items, _download), folder)


def fetch_glaciers(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download the GlaMBIE archive (checked against its pinned checksum) and write it."""
    return write_glaciers(_download(GLAMBIE.url, GLAMBIE.sha256, "GlaMBIE archive"), folder)


def fetch_seaice_trend(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download the four Sea Ice Index files (each checked against its pin) and write them."""
    items = [
        (seaice_url(pole, month), sha256, f"Sea Ice Index {series_id}")
        for series_id, _, pole, month, sha256 in SEAICE_SERIES
    ]
    return write_seaice_trend(_texts(items, _download), folder)


def fetch_snow_cover(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download the Rutgers snow table (checked against its pinned checksum) and write it."""
    text = _download(SNOW.url, SNOW.sha256, "Rutgers snow cover").decode("utf-8")
    return write_snow_cover(text, folder)
