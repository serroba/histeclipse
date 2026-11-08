"""Archaeological radiocarbon dates, as a map of where people left dated remains: p3k14c (#149).

Bird et al. (2022), *p3k14c, a synthetic global database of archaeological radiocarbon dates*,
Scientific Data 9, 27 (doi:10.1038/s41597-022-01118-7): about 174,000 dates gathered from
many regional databases, data CC0 1.0 (attribution asked), as its R package publishes them
(people3k/p3k14c, release 2025.07, `p3k14c_scrubbed_fuzzed.csv`). Its locations are fuzzed on
purpose, to protect the sites; the site's file keeps them only to a cell.

Each date is a radiocarbon age, so it is calibrated here: against IntCal20 north of the equator
and SHCal20 south of it, as the calibration curves stand in the site's own file, with the same
arithmetic the site uses (each calendar year weighed by how well the curve there fits the age),
and placed at its median calendar age. They are counted by 1° cell and 250 calendar years, over
the last 12,500 years. The dates themselves, with their sites, are written in tiles of 5°, so
a place's card can show one and carry it across the curve again.

The counts show where dates have been measured, not how many people lived: some regions have
been dug and dated far more than others.
"""

import csv
import datetime as dt
import io
import json
import math
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

import numpy as np

from histeclipse_pipeline.sky import verified

if TYPE_CHECKING:
    from collections.abc import Iterable, Mapping
    from pathlib import Path

    from histeclipse_pipeline.arrays import FloatArray
    from histeclipse_pipeline.sky import Json

RELEASE = "2025.07"
COMMIT = "99e893474b601af5e4065d3997eec7d10b108411"
CSV_URL = (
    f"https://raw.githubusercontent.com/people3k/p3k14c/{COMMIT}/inst/p3k14c_scrubbed_fuzzed.csv"
)
CSV_SHA256 = "5c92b7ae96959bc2924409cf66a8919aac955a4abac5545fad26f3fb209eca0c"
CREDIT = (
    f"p3k14c {RELEASE} (Bird et al. 2022, Scientific Data 9, 27), CC0 1.0; calibrated here "
    "with IntCal20 or SHCal20, counted by 1° cell and 250 years"
)
SOURCE = "https://doi.org/10.1038/s41597-022-01118-7"
#: Cells are this many degrees on a side.
CELL = 1
#: Calendar years counted together.
STEP = 250
#: How far back the counts reach, years before 1950.
REACH_BP = 12_500
#: Tiles of dates are this many degrees on a side: small enough to fetch for one place's card.
TILE = 5


@dataclass(frozen=True)
class RadiocarbonDate:
    """A dated sample: its lab code, radiocarbon age and error, place, site and what was dated."""

    lab: str
    age: float
    error: float
    latitude: float
    longitude: float
    site: str
    country: str
    period: str
    material: str


@dataclass(frozen=True)
class CurveArrays:
    """A calibration curve as arrays: calendar years BP, radiocarbon age, its error, row widths."""

    cal_bp: FloatArray
    age: FloatArray
    sigma: FloatArray
    width: FloatArray


def parse_dates(text: str) -> list[RadiocarbonDate]:
    """Read the CSV, keeping dates with an age, an error above zero and a place."""
    dates: list[RadiocarbonDate] = []
    for row in csv.DictReader(io.StringIO(text)):
        try:
            age = float(row["Age"])
            error = float(row["Error"])
            latitude = float(row["Lat"])
            longitude = float(row["Long"])
        except KeyError, ValueError:
            continue
        if error <= 0 or not (-90 <= latitude <= 90 and -180 <= longitude <= 180):  # noqa: PLR2004
            continue
        dates.append(
            RadiocarbonDate(
                lab=row.get("LabID", "").strip(),
                age=age,
                error=error,
                latitude=latitude,
                longitude=longitude,
                site=row.get("SiteName", "").strip(),
                country=row.get("Country", "").strip(),
                period=row.get("Period", "").strip(),
                material=row.get("Material", "").strip(),
            )
        )
    return dates


def curve_arrays(
    cal_bp: Iterable[float], age: Iterable[float], sigma: Iterable[float]
) -> CurveArrays:
    """Turn a curve's columns into arrays, with each row's width (half the gaps either side)."""
    years = np.asarray(list(cal_bp), dtype=np.float64)
    gaps = np.diff(years)
    width = np.empty_like(years)
    width[0] = gaps[0]
    width[-1] = gaps[-1]
    width[1:-1] = (gaps[:-1] + gaps[1:]) / 2
    return CurveArrays(
        cal_bp=years,
        age=np.asarray(list(age), dtype=np.float64),
        sigma=np.asarray(list(sigma), dtype=np.float64),
        width=width,
    )


def median_calendar_age(age: float, error: float, curve: CurveArrays) -> float | None:
    """Return the median calendar age, years BP, of a radiocarbon age; None beyond the curve."""
    if age - 3 * error > float(np.max(curve.age)):
        return None
    spread = error**2 + curve.sigma**2
    weight = np.exp(-((age - curve.age) ** 2) / (2 * spread)) / np.sqrt(spread) * curve.width
    total = float(np.sum(weight))
    if not math.isfinite(total) or total <= 0:
        return None
    cumulative = np.cumsum(weight) / total
    return float(np.interp(0.5, cumulative, curve.cal_bp))


def calibrated(
    dates: Iterable[RadiocarbonDate], north: CurveArrays, south: CurveArrays
) -> list[tuple[RadiocarbonDate, int]]:
    """Each date with its median calendar age, rounded to the year, by its hemisphere's curve."""
    found: list[tuple[RadiocarbonDate, int]] = []
    for date in dates:
        median = median_calendar_age(date.age, date.error, north if date.latitude >= 0 else south)
        if median is not None:
            found.append((date, round(median)))
    return found


def heat_file(dated: Iterable[tuple[RadiocarbonDate, int]], accessed: str) -> dict[str, Json]:
    """Count dates by cell and step: the south-west corner of each cell, the step, the count."""
    counts: dict[tuple[int, int, int], int] = {}
    for date, median in dated:
        if median >= REACH_BP:
            continue
        key = (
            math.floor(date.latitude / CELL) * CELL,
            math.floor(date.longitude / CELL) * CELL,
            median // STEP,
        )
        counts[key] = counts.get(key, 0) + 1
    keys = sorted(counts, key=lambda key: (key[2], key[0], key[1]))
    return {
        "schemaVersion": 1,
        "accessed": accessed,
        "credit": CREDIT,
        "source": SOURCE,
        "cellDegrees": CELL,
        "stepYears": STEP,
        "reachBP": REACH_BP,
        "tileDegrees": TILE,
        "latitude": [key[0] for key in keys],
        "longitude": [key[1] for key in keys],
        "step": [key[2] for key in keys],
        "count": [counts[key] for key in keys],
    }


def tile_key(latitude: float, longitude: float) -> str:
    """Name the tile a place falls in by its south-west corner: ``40_-10``."""
    return f"{math.floor(latitude / TILE) * TILE}_{math.floor(longitude / TILE) * TILE}"


def tile_files(dated: Iterable[tuple[RadiocarbonDate, int]]) -> dict[str, dict[str, Json]]:
    """Group the dates by tile: its sites once, each date with its cell, age and what it was."""
    tiles: dict[str, tuple[dict[tuple[str, str], int], list[Json]]] = {}
    for date, median in dated:
        sites, samples = tiles.setdefault(tile_key(date.latitude, date.longitude), ({}, []))
        site = sites.setdefault((date.site, date.country), len(sites))
        # The cell it is counted in, not the place itself: the places are fuzzed anyway, and a
        # rounded place could fall on the other side of a cell's edge.
        samples.append(
            [
                math.floor(date.latitude / CELL) * CELL,
                math.floor(date.longitude / CELL) * CELL,
                round(date.age),
                round(date.error),
                median,
                site,
                date.lab,
                date.material,
                date.period,
            ]
        )
    return {
        key: {
            "schemaVersion": 1,
            "sites": [[name, country] for (name, country) in sites],
            "samples": samples,
        }
        for key, (sites, samples) in sorted(tiles.items())
    }


def _download(url: str) -> bytes:  # pragma: no cover - needs network access
    with urllib.request.urlopen(url, timeout=120) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{url}: expected bytes"
        raise TypeError(msg)
    return body


def _curve(curves: Mapping[str, object], key: str) -> CurveArrays:
    curve = curves.get(key)
    if not isinstance(curve, dict):
        msg = f"radiocarbon file: no {key} curve"
        raise TypeError(msg)
    columns: list[list[float]] = []
    for name in ("calBP", "age", "sigma"):
        values: object = curve.get(name)  # pyright: ignore[reportUnknownMemberType, reportUnknownVariableType]
        if not isinstance(values, list):
            msg = f"radiocarbon file: {key} has no {name}"
            raise TypeError(msg)
        columns.append([float(value) for value in values])  # pyright: ignore[reportUnknownArgumentType, reportUnknownVariableType]
    return curve_arrays(*columns)


def read_curves(radiocarbon: object) -> tuple[CurveArrays, CurveArrays]:
    """Read the northern and southern curves from the site's radiocarbon file."""
    if not isinstance(radiocarbon, dict):
        msg = "radiocarbon file: expected an object"
        raise TypeError(msg)
    curves: object = radiocarbon.get("curves")  # pyright: ignore[reportUnknownMemberType, reportUnknownVariableType]
    if not isinstance(curves, dict):
        msg = "radiocarbon file: expected curves"
        raise TypeError(msg)
    return _curve(curves, "intcal20"), _curve(curves, "shcal20")  # pyright: ignore[reportUnknownArgumentType]


def compact_json(value: Json) -> str:
    """Write JSON without spaces, keeping accented letters as they are."""
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False)


def fetch_p3k14c(curves_path: Path, out: Path) -> int:  # pragma: no cover - needs network access
    """Download p3k14c, check it, calibrate every date, and write the counts and the tiles."""
    dates = parse_dates(verified(_download(CSV_URL), CSV_SHA256, "p3k14c").decode("utf-8"))
    curves: object = json.loads(curves_path.read_text())  # pyright: ignore[reportAny]
    north, south = read_curves(curves)
    dated = calibrated(dates, north, south)
    made = dt.datetime.now(tz=dt.UTC).date().isoformat()
    out.mkdir(parents=True, exist_ok=True)
    _ = (out / "heat.json").write_text(compact_json(heat_file(dated, made)) + "\n")
    tiles = out / "tiles"
    tiles.mkdir(exist_ok=True)
    for key, tile in tile_files(dated).items():
        _ = (tiles / f"{key}.json").write_text(compact_json(tile) + "\n")
    return len(dated)
