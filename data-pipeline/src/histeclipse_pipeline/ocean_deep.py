"""The deep ocean's temperature each year since 1940, at 2,000 to 5,000 m (#940).

From the same IAP v4.2 files as ``ocean_temperature`` (one a month, 119 standard depths from
1 to 6,000 m), four deep levels: 2,000, 3,000, 4,000 and 5,000 m (6,000 m holds no values).
The deep ocean changes slowly, one month's map much like the next, so each year is the mean
of its twelve months, kept only where all twelve have a value, against the mean of the years
1991-2020 at that place. The maps are on the site's 1° nodes and packed as the upper maps are
(``water_cycle.to_png``), one bound and rounding step for each depth.

Below 2,000 m, which Argo floats do not reach, the ocean is measured by research ships along
repeated lines about once a decade, and since the mid 2010s by a few Deep Argo floats; IAP fills
the rest from climate models' covariances. The maps show IAP's reconstruction, not measurements
at each place, and say so.

The maps sit beside the monthly ones (``deep/<depth>/YYYY.png`` under the same folder) with an
index of their own (``deep.json``), so either pipeline can be run without the other.
"""

import json
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

import numpy as np

from histeclipse_pipeline.netcdf3 import read_netcdf3
from histeclipse_pipeline.ocean_temperature import (
    BASE,
    DECADES,
    LICENCE,
    MONTHS,
    PAPER,
    SOURCE,
    months_bytes,
    rounded,
    zip_name,
)
from histeclipse_pipeline.paleotemp import COLUMNS, ROWS
from histeclipse_pipeline.precipitation import masked
from histeclipse_pipeline.water_cycle import Trend, to_nodes, to_png

if TYPE_CHECKING:
    from collections.abc import Iterable
    from pathlib import Path

    from histeclipse_pipeline.krapp import Grid
    from histeclipse_pipeline.sky import Json

#: The deep levels kept: name, metres, the colour bound and the step values are rounded to, °C.
DEEP: tuple[tuple[str, float, float, float], ...] = (
    ("2000m", 2000.0, 0.2, 0.005),
    ("3000m", 3000.0, 0.15, 0.005),
    ("4000m", 4000.0, 0.1, 0.0025),
    ("5000m", 5000.0, 0.1, 0.0025),
)
CREDIT = (
    "IAP v4.2 gridded ocean temperature anomalies (Cheng et al. 2024, IAPv4 ocean temperature "
    "and ocean heat content gridded dataset, Earth System Science Data 16, 3517), Institute of "
    "Atmospheric Physics, Chinese Academy of Sciences, no licence stated; yearly means at four "
    "deep levels against 1991-2020 computed for this site, averaged onto a 1° grid and packed "
    "into 8-bit images"
)
#: IAP's missing marker is 999; anything this large is missing.
_MISSING_FROM = 900.0


@dataclass(frozen=True)
class DeepMonth:
    """One month's deep levels (°C on IAP's grid, latitude first)."""

    year: int
    month: int
    maps: dict[str, Grid]
    latitude: Grid
    longitude: Grid


def read_deep(data: bytes) -> DeepMonth:
    """Read the deep levels of one of IAP's monthly files."""
    variables, _ = read_netcdf3(data)
    stamp = round(float(variables["time"].values.item(0)))
    year, month = divmod(stamp, 100)
    if not 1 <= month <= MONTHS:
        msg = f"time {stamp} is not yyyymm"
        raise ValueError(msg)
    values = masked(variables["temp"])
    listed: list[float] = variables["depth_std"].values.tolist()  # pyright: ignore[reportAny]
    maps: dict[str, Grid] = {}
    for name, metres, _, _ in DEEP:
        if metres not in listed:
            msg = f"no level at {metres} m"
            raise ValueError(msg)
        level = np.asarray(values[:, :, listed.index(metres)], np.float64)
        maps[name] = np.asarray(np.where(np.fabs(level) >= _MISSING_FROM, np.nan, level))
    return DeepMonth(year, month, maps, variables["lat"].values, variables["lon"].values)


@dataclass
class Years:
    """Each year's sum of its months at each deep level, and how many months had a value."""

    sums: dict[tuple[str, int], Grid] = field(default_factory=dict)
    counts: dict[tuple[str, int], Grid] = field(default_factory=dict)
    latitude: Grid | None = None
    longitude: Grid | None = None

    def add(self, month: DeepMonth) -> None:
        """Add one month."""
        self.latitude, self.longitude = month.latitude, month.longitude
        for name, values in month.maps.items():
            key = (name, month.year)
            known = np.isfinite(values)
            here = np.where(known, values, 0.0)
            self.sums[key] = here if key not in self.sums else self.sums[key] + here
            ones = known.astype(np.float64)
            self.counts[key] = ones if key not in self.counts else self.counts[key] + ones

    def mean(self, name: str, year: int) -> Grid:
        """Average a year at a level, where all twelve months have a value; else NaN."""
        count = self.counts[(name, year)]
        with np.errstate(invalid="ignore", divide="ignore"):
            means: Grid = self.sums[(name, year)] / count
        whole = np.equal(count, MONTHS)
        return np.asarray(np.where(whole, means, np.nan), np.float64)

    def years(self) -> list[int]:
        """List the years read, in order."""
        return sorted({year for _, year in self.sums})


def years_of(months: Iterable[DeepMonth]) -> Years:
    """Sum every month into its year."""
    found = Years()
    for month in months:
        found.add(month)
    return found


def whole_years(found: Years) -> list[int]:
    """List the years with all twelve months read (the last is usually not yet whole)."""
    whole: list[int] = []
    for year in found.years():
        months = max(float(np.max(found.counts[(name, year)])) for name, *_ in DEEP)
        if months == MONTHS:
            whole.append(year)
    return whole


def baseline(found: Years, name: str) -> Grid:
    """Average a level's base years' yearly means; every base year must be whole."""
    years = range(BASE[0], BASE[1] + 1)
    missing = [year for year in years if year not in whole_years(found)]
    if missing:
        msg = f"{name}: the base {BASE[0]}-{BASE[1]} lacks {missing[0]}"
        raise ValueError(msg)
    return np.asarray(np.mean([found.mean(name, year) for year in years], axis=0), np.float64)


def deep_index(first: int, last: int, accessed: str) -> dict[str, Json]:
    """Build the deep maps' manifest."""
    return {
        "schemaVersion": 1,
        "sources": ["iap2024"],
        "credit": CREDIT,
        "source": SOURCE,
        "paper": PAPER,
        "licence": LICENCE,
        "accessed": accessed,
        "changes": (
            "Yearly means at four deep levels against 1991-2020 computed for this site, "
            "averaged onto a 1° grid and packed into 8-bit images"
        ),
        "units": "°C",
        "baseline": f"{BASE[0]}\N{EN DASH}{BASE[1]}, the mean of its yearly means",
        "encoding": "R anomaly from -bound to +bound; G zero; B 255; A data",
        "files": "deep/<depth>/YYYY.png",
        "first": first,
        "last": last,
        "columns": COLUMNS,
        "rows": ROWS,
        "depths": [
            {"id": name, "metres": metres, "bound": bound, "step": step}
            for name, metres, bound, step in DEEP
        ],
    }


def write_deep(found: Years, folder: Path, accessed: str) -> dict[str, Json]:
    """Write each whole year's map at each level, then the index; return the index."""
    years = whole_years(found)
    if not years or found.latitude is None or found.longitude is None:
        msg = "no whole years to write"
        raise ValueError(msg)
    for name, _, bound, step in DEEP:
        usual = baseline(found, name)
        place = folder / "deep" / name
        place.mkdir(parents=True, exist_ok=True)
        for year in years:
            anomaly = found.mean(name, year) - usual
            regridded: Grid = to_nodes(anomaly[None], found.latitude, found.longitude)[0]  # pyright: ignore[reportAny]
            nodes = rounded(regridded, step)
            png = to_png(Trend(nodes, np.isfinite(nodes)), bound)
            _ = (place / f"{year:04d}.png").write_bytes(png)
    index = deep_index(years[0], years[-1], accessed)
    _ = (folder / "deep.json").write_text(
        json.dumps(index, separators=(",", ":"), ensure_ascii=False) + "\n"
    )
    return index


def fetch_ocean_deep(folder: Path, cache: Path) -> int:  # pragma: no cover - needs network access
    """Read the pinned zips (downloading any not cached) and write the deep maps; count years."""
    import datetime as dt  # noqa: PLC0415

    from histeclipse_pipeline.ocean_temperature import cached_zip  # noqa: PLC0415

    paths = [cached_zip(zip_name(span), sha256, cache) for span, sha256 in DECADES]
    found = years_of(read_deep(data) for data in months_bytes(paths))
    accessed = dt.datetime.now(tz=dt.UTC).date().isoformat()
    index = write_deep(found, folder, accessed)
    return int(str(index["last"])) - int(str(index["first"])) + 1
