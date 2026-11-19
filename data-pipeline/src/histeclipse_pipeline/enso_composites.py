"""What El Niño and La Niña usually do to rain and temperature, as maps (#891, #892).

A composite: the mean, over the seasons an index names El Niño (or La Niña), of each node's
departure from normal. It is made the same way for rain and for temperature, so the two read
alike:

- each node's season is the mean of its three months: December-February (``djf``, named by its
  January) and June-August (``jja``); a season with a month missing is left out;
- each node's linear trend over the years used is taken out first, so the warming's own change
  (or a drift in the record) does not read as El Niño or La Niña;
- a season is El Niño (La Niña) by an index when its middle month lies in one of that index's
  El Niño (La Niña) episodes (``public/data/enso/index.json``, #887): NOAA's indices are
  three-month seasons placed at their middle month, so this is the index's own call for that
  season;
- the composite is the mean of those seasons' detrended values, and it is marked significant
  where it differs from none at the 10% level (two-sided, Student's t on the seasons, as
  ``water_cycle`` judges its trends);
- RONI's and ONI's composites are made apart, never merged; each says how many seasons it rests
  on and which.

Rain is GPCP v2.3's monthly rate (mm a day, 2.5°, from 1979; the file ``precipitation.py``
pins) and temperature Berkeley Earth's land-and-ocean anomaly (°C, 1°, from 1850; the file
``measured_warming.py`` pins), from 1950, when the indices start. Both are brought onto the
site's 1° nodes as ``water_cycle.to_nodes`` does, and each map is packed as the trend maps are
(``water_cycle.encode``): R the composite from ``-bound`` to ``+bound``, G zero, B significant,
A data.
"""

import json
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal

import h5py
import numpy as np

from histeclipse_pipeline.enso_sst import sha256_of
from histeclipse_pipeline.measured_warming import FILE_SHA256 as BERKELEY_SHA256
from histeclipse_pipeline.measured_warming import FILE_URL as BERKELEY_URL
from histeclipse_pipeline.precipitation import GPCP_SHA256, GPCP_URL
from histeclipse_pipeline.water_cycle import (
    Mask,
    Trend,
    area_share,
    critical_t,
    month_dates,
    symmetric_bound,
    text,
    to_nodes,
    to_png,
)

if TYPE_CHECKING:
    from collections.abc import Callable, Mapping, Sequence
    from pathlib import Path

    from histeclipse_pipeline.krapp import Grid
    from histeclipse_pipeline.sky import Json

type Season = Literal["djf", "jja"]
type Phase = Literal["elNino", "laNina"]

SEASONS: tuple[Season, ...] = ("djf", "jja")
PHASES: tuple[Phase, ...] = ("elNino", "laNina")
#: Each season's months, as (years after the season's year, month).
SEASON_MONTHS: dict[Season, tuple[tuple[int, int], ...]] = {
    "djf": ((-1, 12), (0, 1), (0, 2)),
    "jja": ((0, 6), (0, 7), (0, 8)),
}
#: The month whose episode names the season.
MIDDLE: dict[Season, int] = {"djf": 1, "jja": 7}
#: The fewest seasons a composite is made from.
FEWEST = 3
MONTHS = 12
#: Anything this large is a fill value (GPCP's is -9.97e36).
_MISSING_FROM = 1e3


@dataclass(frozen=True)
class Variable:
    """A quantity composited: its id, words, units, colour step and where it comes from."""

    id: str
    label: str
    units: str
    #: The colour bound is rounded up to a multiple of this.
    step: float
    years: tuple[int, int]
    source_id: str
    credit: str
    source: str
    licence: str


RAIN = Variable(
    id="rain",
    label="Rain",
    units="mm a day",
    step=0.5,
    years=(1979, 2025),
    source_id="gpcp",
    credit=(
        "GPCP v2.3 monthly precipitation (Adler et al. 2018), NOAA PSL; composites computed "
        "for this site"
    ),
    source="https://psl.noaa.gov/data/gridded/data.gpcp.html",
    licence="none stated (NOAA Climate Data Record); credited to NOAA PSL and GPCP",
)
TEMPERATURE = Variable(
    id="temperature",
    label="Temperature",
    units="°C",
    step=0.25,
    years=(1950, 2024),
    source_id="berkeleyEarth",
    credit=(
        "Berkeley Earth land and ocean (Rohde & Hausfather 2020), CC BY-NC 4.0; composites "
        "computed for this site"
    ),
    source="https://berkeleyearth.org/data/",
    licence="CC BY-NC 4.0",
)


@dataclass(frozen=True)
class Monthly:
    """A monthly record on its own grid: its months, a reader for one, and its axes."""

    dates: list[tuple[int, int]]
    month: Callable[[int], Grid]
    latitude: Grid
    longitude: Grid


@dataclass(frozen=True)
class Composite:
    """One map: the variable, index, phase and season, its field, and the seasons it rests on."""

    variable: str
    index: str
    phase: Phase
    season: Season
    found: Trend
    years: list[int]


def seasonal(record: Monthly, season: Season, years: tuple[int, int]) -> dict[int, Grid]:
    """Average each year's season on the record's grid; years missing a month are left out."""
    at = {date: row for row, date in enumerate(record.dates)}
    out: dict[int, Grid] = {}
    for year in range(years[0], years[1] + 1):
        rows = [at.get((year + offset, month)) for offset, month in SEASON_MONTHS[season]]
        found = [row for row in rows if row is not None]
        if len(found) == len(rows):
            out[year] = np.mean(np.stack([record.month(row) for row in found]), axis=0)
    return out


def detrended(years: Sequence[int], fields: Grid) -> Grid:
    """Take each node's least-squares line through the years away (fields years first).

    Where a node has a gap, the line is fitted through the years it has; NaN stays NaN.
    """
    x = np.asarray(years, dtype=np.float64).reshape((-1,) + (1,) * (fields.ndim - 1))
    valid = np.isfinite(fields)
    weight = valid.astype(np.float64)
    y = np.where(valid, fields, 0.0)
    with np.errstate(invalid="ignore", divide="ignore"):
        count = weight.sum(axis=0)
        x_mean = (weight * x).sum(axis=0) / count
        y_mean = y.sum(axis=0) / count
        dx = weight * (x - x_mean)
        sxx = (dx * dx).sum(axis=0)
        slope = np.where(sxx > 0, (dx * (y - y_mean)).sum(axis=0) / sxx, 0.0)
        line = y_mean + slope * (x - x_mean)
    return np.asarray(np.where(valid, fields - line, np.nan), dtype=np.float64)


def months_in(episodes: Sequence[Mapping[str, Json]], phase: Phase) -> set[tuple[int, int]]:
    """List every month in an index's episodes of a phase."""
    out: set[tuple[int, int]] = set()
    for episode in episodes:
        if episode.get("phase") != phase:
            continue
        first, last = str(episode["first"]), str(episode["last"])
        year, month = int(first[:4]), int(first[5:7])
        end = (int(last[:4]), int(last[5:7]))
        while (year, month) <= end:
            out.add((year, month))
            year, month = (year + 1, 1) if month == MONTHS else (year, month + 1)
    return out


def phase_years(
    episodes: Sequence[Mapping[str, Json]], phase: Phase, season: Season, years: Sequence[int]
) -> list[int]:
    """Pick the years whose season the index names ``phase``, by the season's middle month."""
    named = months_in(episodes, phase)
    return [year for year in years if (year, MIDDLE[season]) in named]


def composite(fields: Grid, picked: Sequence[int]) -> Trend:
    """Average the picked seasons (rows of ``fields``); mark where the mean differs from none.

    A node needs at least ``FEWEST`` seasons with data; the test is Student's t at the 10% level.
    """
    chosen = fields[list(picked)] if picked else np.full((0, *fields.shape[1:]), np.nan)
    valid = np.isfinite(chosen)
    count = valid.sum(axis=0)
    with np.errstate(invalid="ignore", divide="ignore"):
        mean = np.where(valid, chosen, 0.0).sum(axis=0) / count
        spread = np.where(valid, (chosen - mean) ** 2, 0.0).sum(axis=0) / (count - 1)
        error = np.sqrt(spread / count)
        t = np.abs(mean) / error
        critical = critical_t(np.maximum(count - 1, 1).astype(np.float64))
    enough = count >= FEWEST
    significant: Mask = enough & np.isfinite(t) & np.greater(t, critical)
    return Trend(np.asarray(np.where(enough, mean, np.nan), np.float64), np.asarray(significant))


def composites(
    variable: Variable, record: Monthly, indices: Sequence[Mapping[str, Json]]
) -> list[Composite]:
    """Make every composite of a variable: each index, phase and season."""
    out: list[Composite] = []
    for season in SEASONS:
        by_year = seasonal(record, season, variable.years)
        years = sorted(by_year)
        fields = to_nodes(
            np.stack([by_year[year] for year in years]), record.latitude, record.longitude
        )
        residual = detrended(years, fields)
        for index in indices:
            episodes = index["episodes"]
            if not isinstance(episodes, list):
                msg = "an index without episodes"
                raise TypeError(msg)
            listed = [episode for episode in episodes if isinstance(episode, dict)]
            for phase in PHASES:
                picked = phase_years(listed, phase, season, years)
                found = composite(residual, [years.index(year) for year in picked])
                out.append(Composite(variable.id, str(index["id"]), phase, season, found, picked))
    return out


def file_name(made: Composite) -> str:
    """Name a composite's image: ``rain-roni-elNino-djf.png``."""
    return f"{made.variable}-{made.index}-{made.phase}-{made.season}.png"


def write_composites(
    made: Mapping[str, list[Composite]],
    variables: Sequence[Variable],
    folder: Path,
    accessed: str,
) -> int:
    """Write each composite's image and the index; return the number of images."""
    folder.mkdir(parents=True, exist_ok=True)
    described: list[Json] = []
    maps: list[Json] = []
    for variable in variables:
        own = made[variable.id]
        bound = symmetric_bound([each.found.slope for each in own], variable.step)
        described.append(
            {
                "id": variable.id,
                "label": variable.label,
                "units": variable.units,
                "bound": bound,
                "years": list(variable.years),
                "sourceId": variable.source_id,
                "credit": variable.credit,
                "source": variable.source,
                "licence": variable.licence,
            }
        )
        for each in own:
            _ = (folder / file_name(each)).write_bytes(to_png(each.found, bound))
            share = area_share(each.found.significant, np.isfinite(each.found.slope))
            maps.append(
                {
                    "variable": each.variable,
                    "index": each.index,
                    "phase": each.phase,
                    "season": each.season,
                    "file": file_name(each),
                    "seasons": len(each.years),
                    "years": list(each.years),
                    "significantShare": None if share is None else round(share, 2),
                }
            )
    index: dict[str, Json] = {
        "schemaVersion": 1,
        "accessed": accessed,
        "method": (
            "Mean of the seasons each index names El Niño or La Niña (by the season's middle "
            "month), of each node's departure from its own linear trend; significant where "
            "Student's t says it differs from none at the 10% level"
        ),
        "encoding": "R composite from -bound to +bound; G zero; B significant; A data",
        "variables": described,
        "maps": maps,
    }
    _ = (folder / "index.json").write_text(
        json.dumps(index, separators=(",", ":"), ensure_ascii=False) + "\n"
    )
    return len(maps)


def gpcp_record(opened: h5py.File) -> Monthly:
    """Read PSL's GPCP file (mm a day each month); missing values become NaN."""
    days = np.asarray(opened["time"][()], dtype=np.float64)
    units = text(opened["time"].attrs["units"], "GPCP time units")
    dates = month_dates(units, days.tolist())  # pyright: ignore[reportAny]
    precip = opened["precip"]

    def month(row: int) -> Grid:
        values = np.asarray(precip[row], dtype=np.float64)
        return np.asarray(
            np.where((values < 0) | (np.fabs(values) >= _MISSING_FROM), np.nan, values),
            np.float64,
        )

    return Monthly(
        dates,
        month,
        np.asarray(opened["lat"][()], dtype=np.float64),
        np.asarray(opened["lon"][()], dtype=np.float64),
    )


def berkeley_record(opened: h5py.File) -> Monthly:
    """Read Berkeley Earth's land-and-ocean file (°C anomaly; time in decimal years)."""
    times = np.asarray(opened["time"][()], dtype=np.float64)
    dates: list[tuple[int, int]] = []
    for time in times.tolist():  # pyright: ignore[reportAny]
        year = int(np.floor(float(time)))  # pyright: ignore[reportAny]
        in_year = int(np.floor((float(time) - year) * MONTHS)) + 1  # pyright: ignore[reportAny]
        dates.append((year, in_year))
    temperature = opened["temperature"]

    def month(row: int) -> Grid:
        return np.asarray(temperature[row], dtype=np.float64)

    return Monthly(
        dates,
        month,
        np.asarray(opened["latitude"][()], dtype=np.float64),
        np.asarray(opened["longitude"][()], dtype=np.float64),
    )


def cached(url: str, sha256: str, path: Path) -> Path:  # pragma: no cover - needs network access
    """Download ``url`` to ``path`` unless already there; check it against its pin."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or sha256_of(path) != sha256:
        # The URLs are the pinned https constants of precipitation.py and measured_warming.py.
        if not url.startswith("https://"):
            msg = f"{url}: not https"
            raise ValueError(msg)
        request = urllib.request.Request(url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
        with urllib.request.urlopen(request, timeout=7200) as response, path.open("wb") as out:  # noqa: S310  # pyright: ignore[reportAny]
            while chunk := response.read(1 << 20):  # pyright: ignore[reportAny]
                _ = out.write(chunk)  # pyright: ignore[reportAny]
    found = sha256_of(path)
    if found != sha256:
        msg = f"{url}: SHA-256 {found}, pinned {sha256}"
        raise ValueError(msg)
    return path


def fetch_enso_composites(
    folder: Path, cache: Path, enso_file: Path
) -> int:  # pragma: no cover - needs network access
    """Download the two records (checked against their pins) and write the composites."""
    import datetime as dt  # noqa: PLC0415

    indices = json.loads(enso_file.read_text())["indices"]  # pyright: ignore[reportAny]
    made: dict[str, list[Composite]] = {}
    rain = cached(GPCP_URL, GPCP_SHA256, cache / "precip.mon.mean.nc")
    with h5py.File(str(rain), "r") as opened:
        made[RAIN.id] = composites(RAIN, gpcp_record(opened), indices)  # pyright: ignore[reportAny]
    temperature = cached(BERKELEY_URL, BERKELEY_SHA256, cache / "Land_and_Ocean_LatLong1.nc")
    with h5py.File(str(temperature), "r") as opened:
        made[TEMPERATURE.id] = composites(TEMPERATURE, berkeley_record(opened), indices)  # pyright: ignore[reportAny]
    accessed = dt.datetime.now(tz=dt.UTC).date().isoformat()
    return write_composites(made, (RAIN, TEMPERATURE), folder, accessed)
