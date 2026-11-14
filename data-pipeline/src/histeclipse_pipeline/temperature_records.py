"""Global mean surface temperature since 1850, from six records shown side by side.

The IPCC never relies on one record, and these disagree a little, most in the early years and
the polar gaps: the site shows the spread rather than picking one. Each series is a list of
points ``[year, anomaly, low, high]`` (°C, rounded to 0.01), one per calendar year from the
record's first year to ``LAST_YEAR``; low and high are the source's 95% range, or null where
the source gives none in its annual file.

- GISTEMP v4 (NASA GISS; GISTEMP Team 2026, Lenssen et al. 2019 and 2024): the land-ocean
  ``J-D`` annual means, relative to 1951-1980, from 1880. The 95% range is the half-width in
  GISS's ``totalCI_ERA.csv`` (Lenssen et al. 2019, carried forward at its last value).
  No licence is stated; NASA asks for the page and the paper to be cited, with the access date.
- NOAAGlobalTemp v6.1.0 (NOAA NCEI; Huang et al., doi:10.25921/vvaa-wq11): annual land-ocean
  means, relative to 1991-2020, from 1850. The file's error-variance columns are all missing
  (-999), so it has no range here. No licence is stated; NCEI asks to be cited.
- ERA5 (Copernicus Climate Change Service, Hersbach et al. 2020), via Climate Pulse's daily
  global 2 m temperature series, relative to 1991-2020, from 1940; CC BY 4.0. A reanalysis,
  not a station record: each year is the mean of its daily anomalies.
- HadCRUT5 (Met Office and CRU, Morice et al. 2021): annual means with their 95% range,
  relative to 1961-1990, from 1850; Open Government Licence v3.
- Berkeley Earth Land/Ocean (Rohde & Hausfather 2020): annual means, with air temperature
  over sea ice, and their 95% range, relative to 1951-1980, from 1850; CC BY-NC 4.0. Its
  summary file ends in 2024.
- JRA-3Q (Japan Meteorological Agency; Kosaka et al. 2024), a second reanalysis, from 1948
  (JRA-3Q starts in September 1947). JMA's own downloads need registration, so the annual
  global means are read from the Copernicus Climate Change Service's Global Climate Highlights
  2025 (Figure 3's data), where C3S computed them: 2 m temperature from JRA-3Q's analysis over
  land and its background forecast over sea, as ERA5 does. C3S gives every dataset there
  relative to 1850-1900 after setting all six to the same 1991-2020 mean, which only adds a
  constant: taking off the column's own 1991-2020 mean gives JRA-3Q's 1991-2020 anomalies.
  C3S allows its web content to be reproduced with the source acknowledged; JMA asks for
  JRA-3Q to be cited and acknowledged.

Every series is put on the 1850-1900 baseline. The three that cover it (HadCRUT5, Berkeley
Earth, NOAAGlobalTemp) lose their own 1850-1900 mean. GISTEMP starts in 1880, ERA5 in 1940 and
JRA-3Q in 1948, so, as AR6 does for records that start late, each is shifted to agree with the
mean of those three over a period it shares with them: 1880-1900 for GISTEMP, 1991-2020 for ERA5
and JRA-3Q. The shift and the period used are written with each series.

``spread`` gives, for each year, the lowest and highest of the records that have that year,
and how many there are.

GISTEMP, NOAAGlobalTemp, ERA5 and HadCRUT5 are living files, updated each month (NOAA's file
name changes with it, and the old one is removed): re-running this command needs the new URL
and hash pinned, after looking at what changed. JRA-3Q's file is C3S's yearly report, fixed
once published: a later year needs the next report's file.
"""

import json
import math
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

from histeclipse_pipeline.holocene_temperature import HADCRUT5, hadcrut_rows
from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from pathlib import Path

#: When the files pinned below were downloaded.
ACCESSED = "2026-11-14"
#: The last complete calendar year in those files.
LAST_YEAR = 2025
#: The pre-industrial baseline, inclusive.
BASELINE = (1850, 1900)
#: The periods over which the late-starting records are matched to the full ones.
GISTEMP_MATCH = (1880, 1900)
ERA5_MATCH = (1991, 2020)
JRA3Q_MATCH = (1991, 2020)
#: When the JRA-3Q file below was downloaded.
JRA3Q_ACCESSED = "2026-11-13"
#: The column C3S gives JRA-3Q in, and the value it writes where a dataset has no year.
JRA3Q_COLUMN = "JRA-3Q"
MISSING = -999.0


@dataclass(frozen=True)
class Source:
    """Where a series comes from, and the file it is read from."""

    url: str
    sha256: str


GISTEMP = Source(
    "https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv",
    "a7b1939db2e7e484c798e925e0f07f8184356c52ac0e7ce264adcd0f25e81253",
)
GISTEMP_CI = Source(
    "https://data.giss.nasa.gov/gistemp/graphs_v4/graph_data/totalCI_ERA.csv",
    "c7ac791397b9aa82d08a68481881189184dea864858b8dccb8587807ad3ac4e6",
)
NOAA = Source(
    "https://www.ncei.noaa.gov/data/noaa-global-surface-temperature/v6.1/access/timeseries/aravg.ann.land_ocean.90S.90N.v6.1.0.202610.asc",
    "b2a17a71ee3fc542c15d0f9eef8ad9843cdf3b12516a847ef0d502f844210d05",
)
ERA5 = Source(
    "https://sites.ecmwf.int/data/climatepulse/data/series/era5_daily_series_2t_global.csv",
    "912ad5fafbebfe8558e76cc264123b382ad696908ee9b3664cf874bb811a2818",
)
#: holocene_temperature's pinned HadCRUT5 file, as this module's own Source.
HADCRUT = Source(HADCRUT5.url, HADCRUT5.sha256)
BERKELEY = Source(
    "https://berkeley-earth-temperature.s3.us-west-1.amazonaws.com/Global/Land_and_Ocean_summary.txt",
    "8f4b3f37846f0aacc270a3cf0090c1d94e857c8b2c7b8d8cdb081134781e819f",
)

JRA3Q = Source(
    "https://climate.copernicus.eu/sites/default/files/custom-uploads/GCH-2025/fig3/GCH2025_Fig3_annual_global_temperature_anomalies_preindustrial_data.csv",
    "f9edb27d2b8d79424626fc6a6c4a0fb4097e5dc361dfd5469dfd7337a5f9d677",
)

#: One point: year, anomaly, and the 95% range where there is one (°C).
type Point = tuple[int, float, float | None, float | None]
#: The same before rounding and shifting: year, anomaly, and the range's half-width or bounds.
type Row = tuple[int, float, float | None, float | None]


@dataclass(frozen=True)
class Record:
    """One record as read, on its own baseline."""

    id: str
    name: str
    kind: str
    source_id: str
    credit: str
    source: str
    own_baseline: str
    rows: list[Row]
    note: str | None = None


@dataclass(frozen=True)
class Series:
    """One record on the 1850-1900 baseline, as the chart draws it."""

    record: Record
    shift: float
    baseline: str
    points: list[Point]


def _round(value: float) -> float:
    return round(value, 2) + 0.0  # + 0.0 turns -0.0 into 0.0


def _complete(rows: list[Row]) -> list[Row]:
    return [row for row in rows if row[0] <= LAST_YEAR]


def gistemp(text: str, ci_text: str) -> Record:
    """GISTEMP v4's annual (J-D) means, with the 95% half-width from ``totalCI_ERA.csv``."""
    half: dict[int, float] = {}
    for line in ci_text.splitlines()[1:]:
        if line.strip():
            ci_year, ci_width = line.split(",")[:2]
            half[int(ci_year)] = float(ci_width)
    lines = text.splitlines()
    header = lines[1].split(",")
    at = header.index("J-D")
    rows: list[Row] = []
    for line in lines[2:]:
        cells = line.split(",")
        if len(cells) <= at or "*" in cells[at]:
            continue
        year, value = int(cells[0]), float(cells[at])
        width = half.get(year)
        low = None if width is None else value - width
        high = None if width is None else value + width
        rows.append((year, value, low, high))
    return Record(
        id="gistemp",
        name="GISTEMP v4 (NASA)",
        kind="station and ship record",
        source_id="gistemp4",
        credit=(
            "GISTEMP Team 2026, GISS Surface Temperature Analysis (GISTEMP) v4, NASA Goddard "
            f"Institute for Space Studies, accessed {ACCESSED}; Lenssen et al. 2019, JGR "
            "Atmospheres 124, doi:10.1029/2018JD029522; Lenssen et al. 2024, JGR Atmospheres "
            "129, doi:10.1029/2023JD040179; no licence stated, NASA asks to be cited"
        ),
        source=GISTEMP.url,
        own_baseline="1951-1980",
        rows=_complete(rows),
        note=(
            "Starts in 1880. 95% range from Lenssen et al. 2019, held at its last value after 2018."
        ),
    )


def noaa(text: str) -> Record:
    """NOAAGlobalTemp's annual means; its error variances are missing (-999), so no range."""
    rows: list[Row] = []
    for line in text.splitlines():
        cells = line.split()
        if not cells:
            continue
        variance = float(cells[2])
        value = float(cells[1])
        width = None if variance < 0 else 1.96 * math.sqrt(variance)
        rows.append(
            (
                int(cells[0]),
                value,
                None if width is None else value - width,
                None if width is None else value + width,
            )
        )
    return Record(
        id="noaaglobaltemp",
        name="NOAAGlobalTemp v6.1 (NOAA)",
        kind="station and ship record",
        source_id="noaaGlobalTemp",
        credit=(
            "Huang, Yin, Menne, Vose (NOAA NCEI), NOAA Global Surface Temperature Dataset "
            "(NOAAGlobalTemp) v6.1.0, doi:10.25921/vvaa-wq11; Yin et al. 2024, BAMS 105, "
            f"doi:10.1175/BAMS-D-24-0012.1; accessed {ACCESSED}; no licence stated, NCEI asks "
            "to be cited"
        ),
        source=NOAA.url,
        own_baseline="1991-2020",
        rows=_complete(rows),
        note="The annual file gives no uncertainty (its error-variance columns are empty).",
    )


def era5(text: str) -> Record:
    """ERA5's yearly means of daily global 2 m anomalies, for every complete year."""
    sums: dict[int, list[float]] = {}
    lines = [line for line in text.splitlines() if line.strip() and not line.startswith("#")]
    header, *body = (line.split(",") for line in lines)
    at = header.index("ano_91-20")
    for cells in body:
        year = int(cells[0][:4])
        sums.setdefault(year, []).append(float(cells[at]))
    rows: list[Row] = []
    for year in sorted(sums):
        days = 366 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 365
        if len(sums[year]) == days:
            rows.append((year, sum(sums[year]) / days, None, None))
    return Record(
        id="era5",
        name="ERA5 (Copernicus)",
        kind="reanalysis",
        source_id="era5",
        credit=(
            "Copernicus Climate Change Service, ERA5 (Hersbach et al. 2020, QJRMS 146, "
            "doi:10.1002/qj.3803), daily global 2 m temperature from Climate Pulse, "
            f"accessed {ACCESSED}; CC BY 4.0. Contains modified Copernicus Climate Change "
            "Service information"
        ),
        source=ERA5.url,
        own_baseline="1991-2020",
        rows=_complete(rows),
        note="A reanalysis (a weather model fitted to observations), from 1940; no range given.",
    )


def hadcrut(text: str) -> Record:
    """HadCRUT5's annual means and 95% range, for complete years."""
    return Record(
        id="hadcrut5",
        name="HadCRUT5 (Met Office)",
        kind="station and ship record",
        source_id="hadcrut5",
        credit=(
            "Morice et al. 2021, JGR Atmospheres 126, doi:10.1029/2019JD032361; "
            f"HadCRUT.5.1.0.0, Met Office, accessed {ACCESSED}; Open Government Licence v3"
        ),
        source=HADCRUT.url,
        own_baseline="1961-1990",
        rows=_complete([(year, value, low, high) for year, value, low, high in hadcrut_rows(text)]),
        note="Leaves unsampled regions out rather than filling them, so it warms a little less.",
    )


def berkeley(text: str) -> Record:
    """Berkeley Earth's annual means (air temperature over sea ice) and 95% half-width."""
    rows: list[Row] = []
    for line in text.splitlines():
        cells = line.split()
        if not cells or line.lstrip().startswith("%"):
            continue
        value, width = float(cells[1]), float(cells[2])
        rows.append((int(cells[0]), value, value - width, value + width))
    return Record(
        id="berkeley",
        name="Berkeley Earth",
        kind="station and ship record",
        source_id="berkeleyEarth",
        credit=(
            "Rohde & Hausfather 2020, Earth System Science Data 12, 3469, "
            "doi:10.5194/essd-12-3469-2020; Berkeley Earth Land/Ocean summary, "
            f"accessed {ACCESSED}; CC BY-NC 4.0"
        ),
        source=BERKELEY.url,
        own_baseline="1951-1980",
        rows=_complete(rows),
        note="Air temperature over sea ice. The summary file ends in 2024.",
    )


def jra3q(text: str) -> Record:
    """JRA-3Q's annual means from C3S's table, put back on their own 1991-2020 mean."""
    lines = text.splitlines()
    at_header = next(i for i, line in enumerate(lines) if line.strip().startswith("Year,"))
    at = [cell.strip() for cell in lines[at_header].split(",")].index(JRA3Q_COLUMN)
    given: list[Row] = []
    for line in lines[at_header + 1 :]:
        cells = [cell.strip() for cell in line.split(",")]
        if len(cells) <= at or not cells[0]:
            continue
        value = float(cells[at])
        if value != MISSING:
            given.append((int(cells[0]), value, None, None))
    rows = _complete(given)
    offset = period_mean(rows, JRA3Q_MATCH)
    return Record(
        id="jra3q",
        name="JRA-3Q (JMA)",
        kind="reanalysis",
        source_id="jra3q",
        credit=(
            "Japan Meteorological Agency, JRA-3Q reanalysis (Kosaka et al. 2024, J. Meteor. Soc. "
            "Japan 102, 49-109, doi:10.2151/jmsj.2024-004); annual global 2 m temperature as "
            "computed and published by the Copernicus Climate Change Service (C3S/ECMWF), Global "
            f"Climate Highlights 2025, Figure 3 data, accessed {JRA3Q_ACCESSED}; reproduced with "
            "the source acknowledged, as C3S allows; edited (put on its own 1991-2020 mean)"
        ),
        source=JRA3Q.url,
        own_baseline="1991-2020",
        rows=[(year, value - offset, None, None) for year, value, _, _ in rows],
        note=(
            "A reanalysis, from 1948; no range given. Computed by C3S: analysis over land, "
            "background forecast over sea."
        ),
    )


def period_mean(rows: list[Row], period: tuple[int, int]) -> float:
    """Mean anomaly over ``period`` (inclusive), which ``rows`` must cover year by year."""
    first, last = period
    values = [value for year, value, _, _ in rows if first <= year <= last]
    if len(values) != last - first + 1:
        msg = f"expected every year of {first}-{last}, found {len(values)}"
        raise ValueError(msg)
    return sum(values) / len(values)


def shifted(record: Record, shift: float, baseline: str) -> Series:
    """Subtract ``shift`` from every value of ``record``, rounded."""
    return Series(
        record=record,
        shift=_round(shift),
        baseline=baseline,
        points=[
            (
                year,
                _round(value - shift),
                None if low is None else _round(low - shift),
                None if high is None else _round(high - shift),
            )
            for year, value, low, high in record.rows
        ],
    )


def own_baseline(record: Record) -> Series:
    """Shift a record that covers 1850-1900 by its own mean over those years."""
    return shifted(
        record,
        period_mean(record.rows, BASELINE),
        f"1850-1900: its {record.own_baseline} anomalies less their own 1850-1900 mean",
    )


def matched(record: Record, full: list[Series], period: tuple[int, int]) -> Series:
    """Shift a late-starting record to agree with the mean of ``full`` over ``period``."""
    first, last = period
    reference = sum(
        period_mean([(y, v, None, None) for y, v, _, _ in each.points], period) for each in full
    ) / len(full)
    names = ", ".join(each.record.name for each in full)
    return shifted(
        record,
        period_mean(record.rows, period) - reference,
        (
            f"1850-1900, estimated: its {record.own_baseline} anomalies shifted so their "
            f"{first}-{last} mean matches the mean of {names} over those years"
        ),
    )


def spread(series: list[Series]) -> list[list[Json]]:
    """For each year, the lowest and highest record and how many records have that year."""
    by_year: dict[int, list[float]] = {}
    for each in series:
        for year, value, _, _ in each.points:
            by_year.setdefault(year, []).append(value)
    return [
        [year, min(values), max(values), len(values)] for year, values in sorted(by_year.items())
    ]


def on_baseline(full: list[Record], late: list[tuple[Record, tuple[int, int]]]) -> list[Series]:
    """Put every record on 1850-1900: the full ones on their own, the late ones matched."""
    covered = [own_baseline(each) for each in full]
    return covered + [matched(record, covered, period) for record, period in late]


def series_json(series: Series) -> dict[str, Json]:
    """One series as the web app reads it."""
    record = series.record
    out: dict[str, Json] = {
        "id": record.id,
        "name": record.name,
        "kind": record.kind,
        "sourceId": record.source_id,
        "credit": record.credit,
        "source": record.source,
        "ownBaseline": record.own_baseline,
        "baseline": series.baseline,
        "shift": series.shift,
    }
    if record.note is not None:
        out["note"] = record.note
    out["points"] = [list[Json](point) for point in series.points]
    return out


def write_temperature_records(series: list[Series], folder: Path) -> int:
    """Write every series and their spread to ``index.json``; return how many points."""
    folder.mkdir(parents=True, exist_ok=True)
    body = json.dumps(
        {
            "schemaVersion": 1,
            "units": "°C",
            "baseline": "1850\u20131900",
            "lastYear": LAST_YEAR,
            "credit": "; ".join(each.record.credit for each in series),
            "source": [each.record.source for each in series],
            "range": "95% range where the source gives one; null where it does not",
            "series": [series_json(each) for each in series],
            "spread": spread(series),
        },
        ensure_ascii=False,
        separators=(",", ":"),
    )
    _ = (folder / "index.json").write_text(body + "\n")
    return sum(len(each.points) for each in series)


def _download(source: Source, what: str) -> bytes:  # pragma: no cover - needs network access
    # Each URL is one of the pinned constants above, all https.
    request = urllib.request.Request(source.url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
    with urllib.request.urlopen(request, timeout=120) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{source.url}: expected bytes"
        raise TypeError(msg)
    return verified(body, source.sha256, what)


def fetch_temperature_records(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download the six records (each checked against its pinned checksum) and write them."""
    text = {
        name: _download(source, name).decode("utf-8", errors="replace")
        for name, source in {
            "GISTEMP v4 table": GISTEMP,
            "GISTEMP confidence intervals": GISTEMP_CI,
            "NOAAGlobalTemp annual series": NOAA,
            "ERA5 daily global series": ERA5,
            "HadCRUT5 annual global series": HADCRUT,
            "Berkeley Earth Land/Ocean summary": BERKELEY,
            "JRA-3Q annual global series (C3S)": JRA3Q,
        }.items()
    }
    series = on_baseline(
        [
            hadcrut(text["HadCRUT5 annual global series"]),
            berkeley(text["Berkeley Earth Land/Ocean summary"]),
            noaa(text["NOAAGlobalTemp annual series"]),
        ],
        [
            (
                gistemp(text["GISTEMP v4 table"], text["GISTEMP confidence intervals"]),
                GISTEMP_MATCH,
            ),
            (era5(text["ERA5 daily global series"]), ERA5_MATCH),
            (jra3q(text["JRA-3Q annual global series (C3S)"]), JRA3Q_MATCH),
        ],
    )
    return write_temperature_records(series, folder)
