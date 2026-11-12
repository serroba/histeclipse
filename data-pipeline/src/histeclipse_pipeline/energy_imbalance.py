"""The Earth's energy imbalance measured from space: CERES EBAF since March 2000 (#527).

The net flux at the top of the atmosphere, sunlight in less sunlight reflected and heat radiated
out, is the rate at which the Earth gains energy. It is read from CERES EBAF Edition 4.2.1
(Loeb et al. 2018, *Clouds and the Earth's Radiant Energy System (CERES) Energy Balanced and
Filled (EBAF) Top-of-Atmosphere (TOA) Edition-4.0 Data Product*, Journal of Climate 31, 895;
data doi:10.5067/TERRA-AQUA-NOAA20/CERES/EBAF-TOA_L3B004.2.1), monthly on a 1° grid.

NASA's own copy needs an Earthdata login, so the grid is read from the obs4MIPs copy that
NASA GISS prepared from it and publishes openly through ESGF (variable ``rt``), with the same
data and NASA LaRC's licence, CC BY 4.0. Its global mean is the area-weighted mean over the
grid, each 1° band of geodetic latitude weighted by its area on the WGS84 ellipsoid, as the
CERES team weights its global means. July 2005 to June 2015 then averages 0.74 W/m² here,
against the 0.71 W/m² EBAF is anchored to; the rest is a detail of grid and weights.
Weighting the bands as on a sphere instead gives about 0.2 W/m² more: on an oblate Earth the
high-latitude bands, which lose heat, hold more area.

The satellites measure changes in the imbalance far better than its size: EBAF moves its
fluxes, within their calibration uncertainty, so that the mean from July 2005 to June 2015
matches the heat the ocean, land, ice and air took up in those years (0.71 W/m²). The curve's
rise and wiggles are measured; its level comes from the ocean.

The site's ``public/data/ocean-heat/imbalance.json`` holds the monthly values, the yearly
means of full years and the least-squares trend per decade.
"""

import datetime as dt
import io
import json
import math
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

import h5py
import numpy as np

from histeclipse_pipeline.arrays import as_floats
from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from pathlib import Path

    from numpy.typing import NDArray


@dataclass(frozen=True)
class Source:
    """A pinned download: where it is and the SHA-256 it must have."""

    url: str
    sha256: str


#: The obs4MIPs version of 20 February 2026, March 2000 to September 2025. A later version has
#: a new URL and checksum; ESGF publishes the checksum beside each file.
CERES = Source(
    "https://esgf-node.ornl.gov/thredds/fileServer/user_pub_work/obs4MIPs/NASA-LaRC/CERES-EBAF-4-2-1/mon/rt/gn/v20260220/rt_mon_CERES-EBAF-4-2-1_NASA-GISS_gn_200003-202509.nc",
    "ba802664ba68302fcdce422bb0126088688a2898bf06c4d7e341850a1dc9bb0e",
)

SOURCE = "https://ceres.larc.nasa.gov/data/"
CREDIT = (
    "CERES EBAF Edition 4.2.1 top-of-atmosphere net flux, NASA Langley Research Center "
    "(Loeb et al. 2018, Journal of Climate 31, 895; doi:10.5067/TERRA-AQUA-NOAA20/CERES/"
    "EBAF-TOA_L3B004.2.1), CC BY 4.0, read from the obs4MIPs copy prepared by NASA GISS; "
    "global and yearly means for this site"
)
#: WGS84's first eccentricity squared, for the area of each latitude band.
ECCENTRICITY_SQUARED = 0.00669437999014
#: The grid's time axis counts days from this date.
EPOCH = dt.date(2000, 3, 1)
#: Months in a year: a year counts only when it has them all.
MONTHS = 12
#: Grid values at or above this are the file's fill value.
FILL = 1e19
#: The period EBAF anchors to the heat the climate system took up (Loeb et al. 2018).
ANCHOR = ((2005, 7), (2015, 6))


@dataclass(frozen=True)
class Month:
    """One month's global-mean net flux, W/m² (positive: the Earth gains heat)."""

    year: int
    month: int
    value: float


def _authalic(latitude: float) -> float:
    """Measure the area from the equator to ``latitude`` (degrees) on the ellipsoid, unscaled."""
    e2 = ECCENTRICITY_SQUARED
    e = math.sqrt(e2)
    s = math.sin(math.radians(latitude))
    return (1 - e2) * (s / (1 - e2 * s * s) - math.log((1 - e * s) / (1 + e * s)) / (2 * e))


def band_weights(bounds: list[tuple[float, float]]) -> list[float]:
    """Each latitude band's share of the ellipsoid's area, given its edges in degrees."""
    areas = [abs(_authalic(north) - _authalic(south)) for south, north in bounds]
    total = sum(areas)
    return [area / total for area in areas]


def global_means(grid: NDArray[np.float64], weights: list[float]) -> list[float]:
    """Area-weighted means of a (time, latitude, longitude) grid; refuse a gap."""
    if bool(np.any(grid >= FILL)) or bool(np.any(np.isnan(grid))):
        msg = "the grid has missing values"
        raise ValueError(msg)
    zonal = np.asarray(grid.mean(axis=2), dtype=np.float64)
    return as_floats(np.asarray(zonal @ np.asarray(weights, dtype=np.float64), dtype=np.float64))


def calendar_months(days: list[float]) -> list[tuple[int, int]]:
    """Give the (year, month) of each time stamp, counted in days from March 2000."""
    out: list[tuple[int, int]] = []
    for day in days:
        date = EPOCH + dt.timedelta(days=day)
        out.append((date.year, date.month))
    if len(set(out)) != len(out):
        msg = "two time stamps fall in the same month"
        raise ValueError(msg)
    return out


def read_ceres(body: bytes) -> list[Month]:
    """Read the obs4MIPs file into global-mean months."""
    with h5py.File(io.BytesIO(body)) as file:
        days = as_floats(np.asarray(file["time"][()], dtype=np.float64))
        edges = as_floats(np.ravel(np.asarray(file["lat_bnds"][()], dtype=np.float64)))
        grid = np.asarray(file["rt"][()], dtype=np.float64)
    weights = band_weights(list(zip(edges[0::2], edges[1::2], strict=True)))
    values = global_means(grid, weights)
    stamps = calendar_months(days)
    return [Month(year, month, value) for (year, month), value in zip(stamps, values, strict=True)]


def yearly(months: list[Month]) -> list[tuple[int, float]]:
    """Means of the years that have all twelve months."""
    by_year: dict[int, list[float]] = {}
    for each in months:
        by_year.setdefault(each.year, []).append(each.value)
    return [
        (year, sum(values) / MONTHS)
        for year, values in sorted(by_year.items())
        if len(values) == MONTHS
    ]


def _decimal(each: Month) -> float:
    return each.year + (each.month - 0.5) / MONTHS


def trend_per_decade(months: list[Month]) -> float:
    """Fit the least-squares slope of the monthly values, W/m² per decade."""
    x = np.asarray([_decimal(each) for each in months], dtype=np.float64)
    y = np.asarray([each.value for each in months], dtype=np.float64)
    slope = as_floats(np.asarray(np.polyfit(x, y, 1), dtype=np.float64))[0]
    return slope * 10


def anchor_mean(months: list[Month]) -> float:
    """Average July 2005 to June 2015, the period EBAF is anchored to."""
    first, last = ANCHOR
    inside = [each.value for each in months if first <= (each.year, each.month) <= last]
    expected = (last[0] - first[0]) * MONTHS + last[1] - first[1] + 1
    if len(inside) != expected:
        msg = f"expected {expected} months in the anchor period, got {len(inside)}"
        raise ValueError(msg)
    return sum(inside) / len(inside)


def _round(value: float) -> float:
    return round(value, 2) + 0.0  # no -0.0


def imbalance_file(months: list[Month]) -> dict[str, Json]:
    """Build the file the web app reads: credit, monthly and yearly values, trend."""
    years = yearly(months)
    first, last = months[0], months[-1]
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "units": "W/m²",
        "label": "CERES EBAF Ed4.2.1, top-of-atmosphere net flux",
        "url": "https://doi.org/10.5067/TERRA-AQUA-NOAA20/CERES/EBAF-TOA_L3B004.2.1",
        "licence": "CC BY 4.0",
        "note": (
            "Positive: the Earth gains heat. The changes are measured; the level is set so "
            "that July 2005 to June 2015 matches the heat taken up by the ocean, land, ice "
            "and air (0.71 W/m²)."
        ),
        "period": f"{first.year}-{first.month:02d}/{last.year}-{last.month:02d}",
        "anchorMean": _round(anchor_mean(months)),
        "trendPerDecade": _round(trend_per_decade(months)),
        "monthly": {
            "time": [_round(_decimal(each)) for each in months],
            "values": [_round(each.value) for each in months],
        },
        "yearly": {
            "years": [year for year, _ in years],
            "values": [_round(value) for _, value in years],
        },
    }


def write_imbalance(months: list[Month], folder: Path) -> int:
    """Write ``imbalance.json``; return how many months it holds."""
    folder.mkdir(parents=True, exist_ok=True)
    body = json.dumps(imbalance_file(months), separators=(",", ":"), ensure_ascii=False)
    _ = (folder / "imbalance.json").write_text(body + "\n")
    return len(months)


def _download(source: Source, what: str) -> bytes:  # pragma: no cover - needs network access
    # The URL is the pinned constant above.
    request = urllib.request.Request(source.url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
    with urllib.request.urlopen(request, timeout=600) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{source.url}: expected bytes"
        raise TypeError(msg)
    return verified(body, source.sha256, what)


def fetch_imbalance(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download the CERES grid (checked against its pinned checksum) and write the file."""
    return write_imbalance(read_ceres(_download(CERES, "CERES EBAF Ed4.2.1 net flux")), folder)
