"""The SSP pathways to 2100: CO2 emissions, CO2 concentration and radiative forcing (#525).

The five scenarios the IPCC's AR6 leads with (SSP1-1.9, SSP1-2.6, SSP2-4.5, SSP3-7.0 and
SSP5-8.5), each with the history it continues, so a chart can run the observed past into a fan
of futures. Three variables, from three CC BY 4.0 data records:

- CO2 emissions (Gt CO2 per year, fossil and industrial plus land use) and CO2 concentration
  (ppm), from the RCMIP protocol (Nicholls & Lewis 2021, doi:10.5281/zenodo.4589727, CC BY 4.0;
  Nicholls et al. 2020, Geoscientific Model Development 13, 5175). Its SSP emissions are the
  CMIP6 harmonised marker scenarios (Gidden et al. 2019, from the SSP database of Riahi et al.
  2017), given for 2015, 2020 and every ten years to 2100; its concentrations are the CMIP6
  ones (Meinshausen et al. 2020), annual. History is RCMIP's own ``historical`` rows, to 2014.
  The same files are on Zenodo as v5.1.0 under CC BY-SA 4.0; the v4.0.0 record, with
  byte-identical data files, is CC BY 4.0, and is the one used.
- Effective radiative forcing (W/m², from 1750), two estimates side by side, since they differ:
  - the IPCC AR6 WG1 Annex III extended data (Smith et al. 2021, doi:10.5281/zenodo.5705391,
    CC BY 4.0): the assessed total ERF, best estimate with its 5-95% range, historical to 2014
    and each SSP from 2015;
  - RCMIP's total ERF for the same scenarios, a single line (no range), the forcing reduced
    complexity models were given for the CMIP6 era. It is some 0.3 W/m² below AR6's in 2014.

Each series is a list of points ``[year, value]``, or ``[year, best, low, high]`` for AR6's
forcing, oldest first, years CE; values are rounded to 0.01. ``history`` ends in 2014, the last
year before the scenarios split; each scenario starts in 2015. None of the scenarios is a
prediction: 2015 to today in them is projected, not observed.
"""

import csv
import io
import json
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from collections.abc import Mapping
    from pathlib import Path

RCMIP_SOURCE = "https://doi.org/10.5281/zenodo.4589727"
AR6_SOURCE = "https://doi.org/10.5281/zenodo.5705391"
_RCMIP_FILES = "https://zenodo.org/records/4589727/files"
_AR6_FILES = "https://zenodo.org/records/5705391/files"

RCMIP_CREDIT = (
    "RCMIP protocol v4.0.0 (Nicholls & Lewis 2021, doi:10.5281/zenodo.4589727; Nicholls et al. "
    "2020, Geoscientific Model Development 13, 5175), CC BY 4.0"
)
EMISSIONS_ORIGIN = (
    "SSP emissions harmonised for CMIP6 by Gidden et al. 2019 (Geoscientific Model Development "
    "12, 1443) from the SSP database (Riahi et al. 2017, Global Environmental Change 42, 153)"
)
CONCENTRATION_ORIGIN = (
    "CMIP6 concentrations of Meinshausen et al. 2020 (Geoscientific Model Development 13, 3571)"
)
EMISSIONS_CREDIT = f"{RCMIP_CREDIT}; {EMISSIONS_ORIGIN}"
CONCENTRATION_CREDIT = f"{RCMIP_CREDIT}; {CONCENTRATION_ORIGIN}"
AR6_CREDIT = (
    "IPCC AR6 WG1 Annex III extended data (Smith, Hall, Dentener et al. 2021, "
    "doi:10.5281/zenodo.5705391), CC BY 4.0"
)
LICENCE = "CC BY 4.0"
#: The last year of history; the scenarios start the year after.
HISTORY_END = 2014
FIRST_YEAR = 1750
LAST_YEAR = 2100
#: How far, in the source's units, two scenarios' history may differ and still count as one.
TOLERANCE = 1e-6
#: Mt to Gt.
MEGA_PER_GIGA = 1000.0


@dataclass(frozen=True)
class Scenario:
    """One SSP: its id in the files, the name the IPCC uses, and AR6's table letter."""

    id: str
    name: str
    table: str


SCENARIOS = (
    Scenario("ssp119", "SSP1-1.9", "a"),
    Scenario("ssp126", "SSP1-2.6", "b"),
    Scenario("ssp245", "SSP2-4.5", "c"),
    Scenario("ssp370", "SSP3-7.0", "d"),
    Scenario("ssp585", "SSP5-8.5", "e"),
)
#: AR6's three files per scenario: the best estimate, then the 5th and 95th percentiles.
PERCENTILES = ("best_estimate", "5th_percentile", "95th_percentile")

EMISSIONS_VARIABLE = "Emissions|CO2"
CONCENTRATION_VARIABLE = "Atmospheric Concentrations|CO2"
FORCING_VARIABLE = "Effective Radiative Forcing"


@dataclass(frozen=True)
class Download:
    """A file to fetch and the SHA-256 it must have."""

    url: str
    sha256: str


RCMIP_EMISSIONS = Download(
    f"{_RCMIP_FILES}/rcmip-emissions-annual-means-v4-0-0.csv",
    "2af9f90c42f9baa813199a902cdd83513fff157a0f96e1d1e6c48b58ffb8b0c1",
)
RCMIP_CONCENTRATIONS = Download(
    f"{_RCMIP_FILES}/rcmip-concentrations-annual-means-v4-0-0.csv",
    "b6749ea32cc36eb0badc5d028b5b7b7bbcc56606144155fa2c0c3f9ceeac18c9",
)
RCMIP_FORCING = Download(
    f"{_RCMIP_FILES}/rcmip-radiative-forcing-annual-means-v4-0-0.csv",
    "15ef911f0ea9854847dcd819df300cedac5fd001c6e740f2c5fdb32761ddec8b",
)
#: AR6 Annex III's tables A3.4a-e, by scenario id and percentile.
AR6_SHA256: dict[tuple[str, str], str] = {
    ("ssp119", "best_estimate"): "fbfc7aa19dfbe645c296a55b07a2e096680e6d55e4f70073663a435e8d791d61",
    (
        "ssp119",
        "5th_percentile",
    ): "4aad69f49b3ef2050e73e241a11f4239d7c7a28b262e6b93bef843c79a2489e6",
    (
        "ssp119",
        "95th_percentile",
    ): "6e09a49c10d413fa1d82e78ecc9da6686c130484b03bfc097486e34ccd259993",
    ("ssp126", "best_estimate"): "b03f2c56bb50d4b76f3733811d8233a0fc815f3a75b1e8a768bc83440dbf4865",
    (
        "ssp126",
        "5th_percentile",
    ): "429ebf71037535de13b454acb505476e00332b5fc3a610e782858deeaa545622",
    (
        "ssp126",
        "95th_percentile",
    ): "6372df712162138ba6598a8d57ee337c53eb2a0b3864875ba00d2683d6630d90",
    ("ssp245", "best_estimate"): "6c60037c412e3e7ee2780c7232903fcc36aaebd0a6ad736e3709c0dedcb31d8c",
    (
        "ssp245",
        "5th_percentile",
    ): "49ee66e205b6b3f4e4d85abcbc33f413fcfe1e28f5d8c373bdadc401912bc03b",
    (
        "ssp245",
        "95th_percentile",
    ): "b900f1d46d95bc10c3bb94912059c3554f7518d0cf01f0a511039592782c5f22",
    ("ssp370", "best_estimate"): "d3563ea67a2983ed186854968f2e7f45bc1173a65c593b80b84b423cbe49e10b",
    (
        "ssp370",
        "5th_percentile",
    ): "42d679d9f985bd09a82c9ff9b1c9d6c7020c3a76c4c88d92ae6c7d9027fb8f8e",
    (
        "ssp370",
        "95th_percentile",
    ): "1fea7debde75cae35bccb11db91e14065edac87bec43a232cfda5f1066ed0d86",
    ("ssp585", "best_estimate"): "79aa0ef39227b51663d1b585b2effbb342f039526f8a9dd03f358ea8fbfd7b50",
    (
        "ssp585",
        "5th_percentile",
    ): "f5bdbefc0123a55ee746e2d46ab2b9a46497b77a3782edf67499293ce2db9b93",
    (
        "ssp585",
        "95th_percentile",
    ): "89eeccdd59d7f959dac60a0946b78f9ff7299a5602bff1d3d27dbf0bea3291dc",
}

#: A point: year, then a value, or a best estimate with its 5-95% range.
type Point = tuple[int, float] | tuple[int, float, float, float]
#: Values by year.
type Yearly = dict[int, float]


def ar6_url(scenario: Scenario, percentile: str) -> str:
    """Where AR6 Annex III's table for this scenario and percentile is."""
    return f"{_AR6_FILES}/table_A3.4{scenario.table}_{scenario.id}_ERF_1750-2500_{percentile}.csv"


def _round(value: float) -> float:
    return round(value, 2) + 0.0  # + 0.0 turns -0.0 into 0.0


@dataclass(frozen=True)
class Row:
    """One row of an RCMIP file: the model that made it and its values by year."""

    model: str
    values: Yearly


def rcmip_rows(text: str, variable: str) -> dict[str, Row]:
    """Each scenario's global row of ``variable`` in an RCMIP file, by scenario id.

    Year columns are those whose header is a number; empty cells are years the row skips.
    """
    reader = csv.reader(io.StringIO(text))
    header = next(reader)
    model_at, scenario_at = header.index("Model"), header.index("Scenario")
    region_at, variable_at = header.index("Region"), header.index("Variable")
    years = [(at, int(name)) for at, name in enumerate(header) if name.isdigit()]
    rows: dict[str, Row] = {}
    for row in reader:
        if row[region_at] != "World" or row[variable_at] != variable:
            continue
        values = {year: float(row[at]) for at, year in years if row[at].strip()}
        rows[row[scenario_at]] = Row(row[model_at], values)
    return rows


def ar6_total(text: str) -> Yearly:
    """Read the ``total`` column of an AR6 Annex III ERF table, by year."""
    reader = csv.DictReader(io.StringIO(text))
    return {int(row["year"]): float(row["total"]) for row in reader}


def points(values: Mapping[int, float], first: int, last: int, scale: float = 1.0) -> list[Point]:
    """Keep the years from ``first`` to ``last`` that have a value, scaled and rounded."""
    return [
        (year, _round(values[year] / scale)) for year in sorted(values) if first <= year <= last
    ]


def ranged(best: Yearly, low: Yearly, high: Yearly, first: int, last: int) -> list[Point]:
    """``[year, best, low, high]`` for each year from ``first`` to ``last``."""
    return [
        (year, _round(best[year]), _round(low[year]), _round(high[year]))
        for year in range(first, last + 1)
    ]


def same_history(tables: Mapping[str, Yearly], what: str) -> Yearly:
    """Return the years to 2014, which every scenario must share; raise if any differs."""
    histories = [
        {year: value for year, value in table.items() if year <= HISTORY_END}
        for table in tables.values()
    ]
    first = histories[0]
    for other in histories[1:]:
        if other.keys() != first.keys() or any(
            abs(other[year] - first[year]) > TOLERANCE for year in first
        ):
            msg = f"{what}: the scenarios disagree before {HISTORY_END + 1}"
            raise ValueError(msg)
    return first


@dataclass(frozen=True)
class Inputs:
    """What the files hold, read: RCMIP rows by scenario, AR6 totals by scenario and percentile."""

    emissions: dict[str, Row]
    concentrations: dict[str, Row]
    rcmip_forcing: dict[str, Row]
    ar6: dict[tuple[str, str], Yearly]


def _row(rows: Mapping[str, Row], scenario: str, what: str) -> Row:
    if scenario not in rows:
        msg = f"{what}: no global row for {scenario}"
        raise ValueError(msg)
    return rows[scenario]


def pathways(inputs: Inputs) -> dict[str, Json]:
    """Build the file the web app reads: variables, history to 2014, and each scenario."""
    start = HISTORY_END + 1
    ar6_best = {each.id: inputs.ar6[each.id, PERCENTILES[0]] for each in SCENARIOS}
    ar6_low = {each.id: inputs.ar6[each.id, PERCENTILES[1]] for each in SCENARIOS}
    ar6_high = {each.id: inputs.ar6[each.id, PERCENTILES[2]] for each in SCENARIOS}
    history_best = same_history(ar6_best, "AR6 best estimate")
    history_low = same_history(ar6_low, "AR6 5th percentile")
    history_high = same_history(ar6_high, "AR6 95th percentile")
    emissions = _row(inputs.emissions, "historical", "RCMIP emissions").values
    concentration = _row(inputs.concentrations, "historical", "RCMIP concentrations").values
    rcmip_forcing = _row(inputs.rcmip_forcing, "historical", "RCMIP forcing").values
    history: dict[str, Json] = {
        "co2Emissions": _json(points(emissions, FIRST_YEAR, HISTORY_END, MEGA_PER_GIGA)),
        "co2": _json(points(concentration, FIRST_YEAR, HISTORY_END)),
        "forcing": _json(ranged(history_best, history_low, history_high, FIRST_YEAR, HISTORY_END)),
        "forcingRcmip": _json(points(rcmip_forcing, FIRST_YEAR, HISTORY_END)),
    }
    scenarios: list[Json] = []
    for each in SCENARIOS:
        row = _row(inputs.emissions, each.id, "RCMIP emissions")
        scenarios.append(
            {
                "id": each.id,
                "name": each.name,
                "model": row.model,
                "co2Emissions": _json(points(row.values, start, LAST_YEAR, MEGA_PER_GIGA)),
                "co2": _json(
                    points(
                        _row(inputs.concentrations, each.id, "RCMIP concentrations").values,
                        start,
                        LAST_YEAR,
                    )
                ),
                "forcing": _json(
                    ranged(ar6_best[each.id], ar6_low[each.id], ar6_high[each.id], start, LAST_YEAR)
                ),
                "forcingRcmip": _json(
                    points(
                        _row(inputs.rcmip_forcing, each.id, "RCMIP forcing").values,
                        start,
                        LAST_YEAR,
                    )
                ),
            }
        )
    return {
        "schemaVersion": 1,
        "credit": f"{RCMIP_CREDIT}; {EMISSIONS_ORIGIN}; {CONCENTRATION_ORIGIN}; {AR6_CREDIT}",
        "source": AR6_SOURCE,
        "licence": LICENCE,
        "historyEnd": HISTORY_END,
        "variables": _VARIABLES,
        "history": history,
        "scenarios": scenarios,
    }


def _json(series: list[Point]) -> list[Json]:
    return [list[Json](point) for point in series]


_VARIABLES: list[Json] = [
    {
        "id": "co2Emissions",
        "name": "CO₂ emissions",
        "unit": "Gt CO₂/yr",
        "baseline": "absolute",
        "note": (
            "Fossil and industrial plus land use. Scenarios give 2015, 2020 and every ten years "
            "to 2100."
        ),
        "credit": EMISSIONS_CREDIT,
        "source": RCMIP_SOURCE,
        "licence": LICENCE,
    },
    {
        "id": "co2",
        "name": "CO₂ concentration",
        "unit": "ppm",
        "baseline": "absolute",
        "note": "Global annual mean.",
        "credit": CONCENTRATION_CREDIT,
        "source": RCMIP_SOURCE,
        "licence": LICENCE,
    },
    {
        "id": "forcing",
        "name": "Effective radiative forcing (IPCC AR6)",
        "unit": "W/m²",
        "baseline": "1750",
        "range": "5\u201395%",
        "note": "Total, natural included: best estimate, 5th and 95th percentiles.",
        "credit": AR6_CREDIT,
        "source": AR6_SOURCE,
        "licence": LICENCE,
    },
    {
        "id": "forcingRcmip",
        "name": "Effective radiative forcing (RCMIP)",
        "unit": "W/m²",
        "baseline": "1750",
        "note": "Total, natural included; a single line. Lower than AR6's assessment.",
        "credit": RCMIP_CREDIT,
        "source": RCMIP_SOURCE,
        "licence": LICENCE,
    },
]


def write_pathways(inputs: Inputs, folder: Path) -> int:
    """Write ``index.json`` into ``folder``; return how many points it holds."""
    body = pathways(inputs)
    folder.mkdir(parents=True, exist_ok=True)
    text = json.dumps(body, ensure_ascii=False, separators=(",", ":"))
    _ = (folder / "index.json").write_text(text + "\n")
    return count_points(body)


def count_points(body: Mapping[str, Json]) -> int:
    """How many points the file's series hold, history and scenarios together."""
    blocks: list[Json] = [body["history"]]
    scenarios = body["scenarios"]
    if isinstance(scenarios, list):
        blocks.extend(scenarios)
    return sum(
        len(series)
        for block in blocks
        if isinstance(block, dict)
        for series in block.values()
        if isinstance(series, list)
    )


def _download(source: Download, what: str) -> str:  # pragma: no cover - needs network access
    # Each URL is one of the pinned constants above, all https.
    request = urllib.request.Request(source.url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
    with urllib.request.urlopen(request, timeout=600) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{source.url}: expected bytes"
        raise TypeError(msg)
    return verified(body, source.sha256, what).decode()


def fetch_pathways(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download RCMIP's files and AR6's tables (each checked against its hash); write the file."""
    ar6: dict[tuple[str, str], Yearly] = {}
    for each in SCENARIOS:
        for percentile in PERCENTILES:
            source = Download(ar6_url(each, percentile), AR6_SHA256[each.id, percentile])
            ar6[each.id, percentile] = ar6_total(_download(source, f"AR6 {each.name}"))
    inputs = Inputs(
        emissions=rcmip_rows(_download(RCMIP_EMISSIONS, "RCMIP emissions"), EMISSIONS_VARIABLE),
        concentrations=rcmip_rows(
            _download(RCMIP_CONCENTRATIONS, "RCMIP concentrations"), CONCENTRATION_VARIABLE
        ),
        rcmip_forcing=rcmip_rows(_download(RCMIP_FORCING, "RCMIP forcing"), FORCING_VARIABLE),
        ar6=ar6,
    )
    return write_pathways(inputs, folder)
