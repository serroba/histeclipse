"""Permafrost change: borehole temperatures 2007-2016 and the northern extent 1997-2023 (#529).

Two open, independent views of the same change, one measured in the ground and one modelled
from satellites:

- GTN-P boreholes (Biskaborn et al. 2019, *Permafrost is warming at a global scale*, Nature
  Communications 10, 264, doi:10.1038/s41467-018-08240-4; data GTN-P 2018, PANGAEA,
  doi:10.1594/PANGAEA.884711, CC BY 3.0): the mean annual ground temperature of 154 boreholes of
  the Global Terrestrial Network for Permafrost, each year from 2007 to 2016 it was measured,
  near the depth of zero annual amplitude (where the seasons no longer reach, mostly 10-20 m).
  Each borehole here also gets a straight-line trend in °C a decade, fitted over its own years
  when it has at least five. That trend is this site's, not the
  paper's: the paper compares each borehole against its 2007-2009 mean and weights the boreholes
  by permafrost zone. Its own figures (0.29 ± 0.12 °C globally from 2007 to 2016) are quoted
  alongside.
- ESA CCI Permafrost extent, version 5.0 (Westermann et al. 2025, NERC EDS CEDA,
  doi:10.5285/d235665772ec4b558e9a89ac85595e71): the share of each 0.01° cell of the northern
  hemisphere (25-85° N) underlain by permafrost, each year from 1997 to 2023, from the CryoGrid
  model driven by MODIS land-surface temperature (2003 on) or by bias-corrected ERA5 air
  temperature alone (1997-2002), so the series has a seam at 2003. The data are free and open
  under the ESA CCI terms, which ask that the ESA Climate Change Initiative, the Permafrost_cci
  project and the dataset DOI be credited. The shares come from an ensemble of seven model runs,
  so a cell's share moves in sevenths (14%, 29%, ...): the isolated zone (under 10%) is all but
  empty, and the zone areas are coarser than the IPA classes suggest. Each year's file (12 MB)
  is read and dropped; the site keeps the area underlain by permafrost and the area of each IPA
  zone, and a 0.5° map of the mean share for 2003-2007 and 2019-2023 (both MODIS-driven).

The site's ``public/data/permafrost/index.json`` holds both.
"""

import http.client
import io
import json
import math
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

import h5py
import numpy as np
import numpy.typing as npt

from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from pathlib import Path

#: A permafrost-share grid: uint8 percent, 255 where there is no data (sea, ice, outside).
Shares = npt.NDArray[np.uint8]
Floats = npt.NDArray[np.float64]
Bools = npt.NDArray[np.bool_]


@dataclass(frozen=True)
class Source:
    """A pinned download: where it is and the SHA-256 it must have."""

    url: str
    sha256: str


#: GTN-P's compilation as PANGAEA serves it as text.
BOREHOLES = Source(
    "https://doi.pangaea.de/10.1594/PANGAEA.884711?format=textfile",
    "4e4e38fd157b695886d5b3fb2df6f97648390563a3e457511578bb1d4c4aca9f",
)
#: Where the yearly northern-hemisphere extent files are, one folder a year.
CCI_BASE = (
    "https://dap.ceda.ac.uk/neodc/esacci/permafrost/data/permafrost_extent/L4/area4/pp/v05.0/"
    "northern_hemisphere"
)
#: The model's forcing: ERA5 alone to 2002, MODIS land-surface temperature from 2003.
ERA5_ONLY = "ERA5_MODISLST_BIASCORRECTED"
MODIS = "MODISLST_CRYOGRID"
#: The first year forced by MODIS.
MODIS_FROM = 2003
#: The checksum of each year's file (v5.0, published 28 August 2025).
CCI_SHA256: dict[int, str] = {
    1997: "78520947964a1119349deb7a64af74659827186f4c3bf19239e150f7d20347eb",
    1998: "31a29a37272b01dbc7f5d211b2ae5ec0498f64a67754ca8795eed41dc0f0d7b0",
    1999: "026ab22551671dabec6355fa92de5aaa5c2d8c580bd5b33d61dc2233a044c34b",
    2000: "b59ff96bc1f25eb028727ad59bf39a35b3c3b3710af635c93dd618b566d294da",
    2001: "a182af32cfa96dd1754095be9acd43ff55c4dffe38c56cd11b2889c177826cf0",
    2002: "3d9886438da16ca3e89e8e0898b9da7f66101da254cb2eb7066ac3eaf0474288",
    2003: "9ad49895186f8f94cd78eaaa92b6cbb83f7d0e40d566f365f1a031dbd85bbaad",
    2004: "e2c42300e6b8e3f13074a2ae60a81b6f05589a4f87c79bd092ec6e5c2d4c3b0c",
    2005: "b586625c1a075458b1a88b206f97717177373c137d659044d5791ce5223c9599",
    2006: "a858f0394422c252478eca024e2a5aafa10509263891bfe97cf48e248e6210d7",
    2007: "94fbc9b669af79809f0d110796a5fdde74fd307887d77d1b9e637e09b7c1bb64",
    2008: "b08b3ec0e3d19952d7df555bb98e4d080a48fdd357006ee8f77bd4a50cc71e51",
    2009: "83d61c0ce4d31e816bc890dbdfddda7e5c5f90a74d1c89d394cddc47efb55c54",
    2010: "32d0849903fd2c240cac622a1954fcd500d95884dc4aa63e83aac03d29a2dad2",
    2011: "8c0b939b2ffeec0b8ff90dfab43da9c3ac2ad07692841a6fb96a9fcfdc7cd6c5",
    2012: "453fa549761afe0ebddb8c6a7c73d28aebcd20da55ea106a18eaff00297c4f27",
    2013: "e6c4000a422a48148b81d8b33ae9a118c44b9974b10c868d5fe25dec91867aab",
    2014: "09def9a77135f5255110582e8d01ec3ede8cb63962f1ae1346a8c0c79e82c740",
    2015: "f375cbaef0c28e178a8f975a1b4f607df294491c79c91266d1e994e7d67953d9",
    2016: "dcc681f97dfb62240bdb91798c6402e2cfe6e5b1d6f6072747aa56efef22425c",
    2017: "185ecb52550a7c13eee6b59bbe74098f6aef035a384daeace9eb38eb7199d56e",
    2018: "a5a5163d18b6d27c05afaa8eae1a9a631ee80696d0f3db64cf77369d3f721613",
    2019: "c87e68ce331220822b66393718ac19059b735704ebde40bfc09763c9271c47de",
    2020: "edd53f7663ab52b0788ffeb77f308262f66786c150580c968b13612b2b904006",
    2021: "1bbda8302638ffca558709daa6b13286788c298757d1dfeefd24e094d9b4bf7b",
    2022: "333c13000b71a1d42c04c25c7354f1505212fbc0dab8777b59b29e2e99fa39ac",
    2023: "be024ac8fda10f124932122271d4c41ba2685a0bb1b3c4768866ad382dc50f36",
}

SOURCE = "https://doi.org/10.1594/PANGAEA.884711"
CREDIT = (
    "Permafrost temperature: GTN-P boreholes (Biskaborn et al. 2019, Nature Communications 10, "
    "264; data GTN-P 2018, PANGAEA, CC BY 3.0). Permafrost extent: ESA Climate Change "
    "Initiative, Permafrost_cci, extent for the Northern Hemisphere v5.0 (Westermann et al. 2025, "
    "NERC EDS CEDA). Borehole trends, areas and the 0.5° map computed for this site"
)
#: The borehole table's first and last years.
FIRST_YEAR, LAST_YEAR = 2007, 2016
#: A borehole's trend needs this many years measured.
MIN_YEARS = 5
#: The paper's own results (abstract and Fig. 2), 2007-2016, quoted as given.
PAPER = (
    ("Global mean", 0.29, 0.12),
    ("Continuous permafrost zone", 0.39, 0.15),
    ("Discontinuous permafrost zone", 0.20, 0.10),
    ("Mountain permafrost", 0.19, 0.05),
    ("Antarctica", 0.37, 0.10),
)
#: The IPA zones by share of the ground underlain by permafrost, in percent: [low, high).
ZONES = (
    ("continuous", 90, 101),
    ("discontinuous", 50, 90),
    ("sporadic", 10, 50),
    ("isolated", 1, 10),
)
#: The source's no-data value.
FILL = 255
#: Cells per degree in the source, and in the map kept here.
SOURCE_PER_DEGREE = 100
MAP_PER_DEGREE = 2
#: The source's southern edge and how many degrees of latitude it spans.
SOUTH, SPAN = 25.0, 60
#: The two periods the map compares.
MAP_PERIODS = ((2003, 2007), (2019, 2023))
#: The WGS 84 authalic radius, km: cell areas use a sphere of the ellipsoid's area.
RADIUS_KM = 6371.0072
#: Rows read at a time, to bound memory.
BAND = 1000


@dataclass(frozen=True)
class Borehole:
    """One borehole: where, how deep, and its mean annual ground temperature each year (°C)."""

    id: str
    name: str
    country: str
    latitude: float
    longitude: float
    elevation: float | None
    depth: float | None
    zaa: float | None
    temperatures: list[float | None]


def _number(cell: str) -> float | None:
    return float(cell) if cell.strip() else None


def boreholes(text: str) -> list[Borehole]:
    """Read PANGAEA's table: the metadata header ends at ``*/``, then one row a borehole."""
    lines = text.splitlines()
    start = lines.index("*/") + 1
    header = lines[start].split("\t")
    years = [f"MAGT [°C] ({year})" for year in range(FIRST_YEAR, LAST_YEAR + 1)]
    depth = header.index("Depth sed [m] (depth of MAGT measurement)")
    zaa = header.index("Depth sed [m] (depth of zero annual amplitude)")
    out: list[Borehole] = []
    for line in lines[start + 1 :]:
        if not line.strip():
            continue
        cells = dict(zip(header, line.split("\t"), strict=True))
        values = line.split("\t")
        out.append(
            Borehole(
                id=cells["Event"],
                name=cells["Event 2"].strip(),
                country=cells["Country"],
                latitude=float(cells["Latitude"]),
                longitude=float(cells["Longitude"]),
                elevation=_number(cells["Elevation [m]"]),
                depth=_number(values[depth]),
                zaa=_number(values[zaa]),
                temperatures=[_number(cells[year]) for year in years],
            )
        )
    return out


def trend(temperatures: list[float | None]) -> float | None:
    """Least-squares trend of the years measured, °C a decade; None with too few years."""
    pairs = [
        (FIRST_YEAR + index, value) for index, value in enumerate(temperatures) if value is not None
    ]
    if len(pairs) < MIN_YEARS:
        return None
    mean_year = sum(year for year, _ in pairs) / len(pairs)
    mean_value = sum(value for _, value in pairs) / len(pairs)
    spread = sum((year - mean_year) ** 2 for year, _ in pairs)
    slope = sum((year - mean_year) * (value - mean_value) for year, value in pairs) / spread
    return round(slope * 10, 2) + 0.0  # no -0.0


def median(values: list[float]) -> float:
    """Give the middle value (the mean of the two middle ones for an even count)."""
    ordered = sorted(values)
    half = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[half]
    return (ordered[half - 1] + ordered[half]) / 2


def borehole_json(hole: Borehole) -> dict[str, Json]:
    """One borehole as the web app reads it."""
    return {
        "id": hole.id,
        "name": hole.name,
        "country": hole.country,
        "lat": hole.latitude,
        "lon": hole.longitude,
        "elevation": hole.elevation,
        "depth": hole.depth,
        "zaa": hole.zaa,
        "magt": list[Json](hole.temperatures),
        "trend": trend(hole.temperatures),
    }


def borehole_summary(holes: list[Borehole]) -> dict[str, Json]:
    """How many boreholes have a trend, how many warmed or cooled, and the median trend."""
    trends = [each for each in (trend(hole.temperatures) for hole in holes) if each is not None]
    return {
        "boreholes": len(holes),
        "withTrend": len(trends),
        "warming": sum(1 for each in trends if each > 0),
        "cooling": sum(1 for each in trends if each < 0),
        "medianTrend": round(median(trends), 2) if trends else None,
    }


def cell_areas(latitudes: Floats, step: float) -> Floats:
    """Area of a ``step``-degree cell centred on each latitude, km²."""
    half = math.radians(step) / 2
    middle = np.radians(latitudes)
    return RADIUS_KM**2 * math.radians(step) * (np.sin(middle + half) - np.sin(middle - half))


@dataclass(frozen=True)
class Extent:
    """One year's areas (km²): underlain by permafrost, and of each zone; and its 0.5° map."""

    year: int
    permafrost: float
    zones: dict[str, float]
    map: Floats


def extent(year: int, shares: Shares, latitudes: Floats) -> Extent:
    """Add up one year's grid, row band by row band, and average it into 0.5° cells.

    ``shares`` is latitude by longitude at 0.01°, latitudes ascending from 25° N; the map is
    ``SPAN * 2`` rows from the south by 720 columns from 180° W, NaN where no cell has data.
    """
    block = SOURCE_PER_DEGREE // MAP_PER_DEGREE
    rows, columns = np.size(shares, 0), np.size(shares, 1)
    total = 0.0
    zones = dict.fromkeys((name for name, _, _ in ZONES), 0.0)
    sums = np.zeros((rows // block, columns // block))
    counts = np.zeros_like(sums)
    for first in range(0, rows, BAND):
        band = shares[first : first + BAND].astype(np.int16)
        areas = cell_areas(latitudes[first : first + BAND], 1 / SOURCE_PER_DEGREE)[:, None]
        valid: Bools = np.not_equal(band, FILL)
        values: Floats = np.where(valid, band, 0).astype(np.float64)
        total += float(np.sum(values * areas)) / 100
        for name, low, high in ZONES:
            inside: Bools = valid & np.greater_equal(band, low) & np.less(band, high)
            inside_areas: Floats = np.where(inside, areas, 0.0)
            zones[name] += float(np.sum(inside_areas))
        tall = np.size(band, 0) // block
        shaped = (tall, block, columns // block, block)
        sums[first // block : first // block + tall] = values.reshape(shaped).sum(axis=(1, 3))
        present = valid.astype(np.float64).reshape(shaped)
        counts[first // block : first // block + tall] = present.sum(axis=(1, 3))
    with np.errstate(invalid="ignore", divide="ignore"):
        mapped: Floats = np.where(counts > 0, sums / counts, np.nan)
    return Extent(year, total, zones, mapped)


def read_extent(year: int, data: bytes) -> Extent:
    """Read one year's NetCDF-4 file and reduce it."""
    with h5py.File(io.BytesIO(data), "r") as opened:
        latitudes = np.asarray(opened["lat"][()], dtype=np.float64)
        shares = np.asarray(opened["PFR"][0], dtype=np.uint8)
    if latitudes[0] > latitudes[-1]:
        latitudes, shares = latitudes[::-1], shares[::-1]
    return extent(year, shares, latitudes)


def _million(km2: float) -> float:
    return round(km2 / 1e6, 3)


def period_map(extents: list[Extent], first: int, last: int) -> Floats:
    """Average the yearly maps over ``first``-``last``."""
    chosen = [each.map for each in extents if first <= each.year <= last]
    if len(chosen) != last - first + 1:
        msg = f"expected {last - first + 1} years in {first}-{last}, got {len(chosen)}"
        raise ValueError(msg)
    with np.errstate(invalid="ignore"):
        return np.mean(np.stack(chosen), axis=0)


def map_json(extents: list[Extent]) -> dict[str, Json]:
    """Give the 0.5° map of both periods: only cells where either has permafrost.

    Each cell is ``[row, column, early %, late %]``, rows from 25° N and columns from 180° W.
    """
    (first_a, last_a), (first_b, last_b) = MAP_PERIODS
    early = period_map(extents, first_a, last_a)
    late = period_map(extents, first_b, last_b)
    keep: Bools = np.greater_equal(np.nan_to_num(early), 1) | np.greater_equal(
        np.nan_to_num(late), 1
    )
    where = np.nonzero(keep)
    rows: list[int] = where[0].tolist()
    columns: list[int] = where[1].tolist()
    firsts: list[float] = early[where].tolist()  # pyright: ignore[reportAny]
    lasts: list[float] = late[where].tolist()  # pyright: ignore[reportAny]
    cells: list[Json] = [
        [row, column, None if math.isnan(a) else round(a), None if math.isnan(b) else round(b)]
        for row, column, a, b in zip(rows, columns, firsts, lasts, strict=True)
    ]
    return {
        "cellDegrees": 1 / MAP_PER_DEGREE,
        "south": SOUTH,
        "west": -180.0,
        "rows": SPAN * MAP_PER_DEGREE,
        "columns": 360 * MAP_PER_DEGREE,
        "periods": [f"{first_a}\u2013{last_a}", f"{first_b}\u2013{last_b}"],
        "units": "percent of the ground underlain by permafrost",
        "cells": cells,
    }


def index_file(holes: list[Borehole], extents: list[Extent]) -> dict[str, Json]:
    """Build the file the web app reads."""
    ordered = sorted(extents, key=lambda each: each.year)
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "boreholes": {
            "label": "GTN-P boreholes (Biskaborn et al. 2019)",
            "source": "Biskaborn et al. 2019, Nature Communications 10, 264; GTN-P 2018, PANGAEA",
            "url": "https://doi.org/10.1594/PANGAEA.884711",
            "paper": "https://doi.org/10.1038/s41467-018-08240-4",
            "licence": "CC BY 3.0",
            "units": "°C",
            "years": list(range(FIRST_YEAR, LAST_YEAR + 1)),
            "what": (
                "mean annual ground temperature near the depth of zero annual amplitude; "
                "depth is where it was measured, zaa the depth of zero annual amplitude (m)"
            ),
            "trend": (
                f"this site's least-squares trend, °C a decade, over a borehole's own years "
                f"when it has at least {MIN_YEARS}"
            ),
            "paperResults": [
                {"label": label, "change": change, "plusMinus": error}
                for label, change, error in PAPER
            ],
            "paperResultsNote": (
                "the paper's change from 2007 to 2016, °C, with its stated uncertainty; it "
                "compares each borehole to its 2007-2009 mean, unlike the trends here"
            ),
            "summary": borehole_summary(holes),
            "sites": [borehole_json(hole) for hole in holes],
        },
        "extent": {
            "label": "ESA CCI Permafrost extent v5.0 (Westermann et al. 2025)",
            "source": "ESA Climate Change Initiative, Permafrost_cci; NERC EDS CEDA",
            "url": "https://doi.org/10.5285/d235665772ec4b558e9a89ac85595e71",
            "licence": "ESA CCI data policy: free and open, with credit",
            "region": "Northern Hemisphere, 25-85° N",
            "units": "million km²",
            "seam": (
                f"to {MODIS_FROM - 1} the model is driven by bias-corrected ERA5 air "
                f"temperature alone; from {MODIS_FROM} by MODIS land-surface temperature"
            ),
            "years": [each.year for each in ordered],
            "permafrost": [_million(each.permafrost) for each in ordered],
            "zones": {
                name: [_million(each.zones[name]) for each in ordered] for name, _, _ in ZONES
            },
            "zoneBounds": {name: [low, min(high, 100)] for name, low, high in ZONES},
            "zoneNote": (
                "a cell's share comes from seven model runs, so it moves in sevenths; "
                "the isolated zone (under 10%) is all but empty"
            ),
            "map": map_json(ordered),
        },
    }


def write_permafrost(holes: list[Borehole], extents: list[Extent], folder: Path) -> int:
    """Write ``index.json``; return how many borehole-years and extent-years it holds."""
    folder.mkdir(parents=True, exist_ok=True)
    body = json.dumps(index_file(holes, extents), separators=(",", ":"), ensure_ascii=False)
    _ = (folder / "index.json").write_text(body + "\n")
    measured = sum(1 for hole in holes for each in hole.temperatures if each is not None)
    return measured + len(extents)


def cci_url(year: int) -> str:
    """Where one year's extent file is."""
    forcing = ERA5_ONLY if year < MODIS_FROM else MODIS
    name = f"ESACCI-PERMAFROST-L4-PFR-{forcing}-AREA4_PP-{year}-fv05.0.nc"
    return f"{CCI_BASE}/{year}/{name}"


#: CEDA often drops a connection part-way; a download picks up where it stopped this many times.
ATTEMPTS = 8


def _download(url: str, sha256: str, what: str) -> bytes:  # pragma: no cover - needs network access
    body = b""
    for _ in range(ATTEMPTS):
        headers = {"User-Agent": "histeclipse-pipeline"}
        if body:
            headers["Range"] = f"bytes={len(body)}-"
        # Each URL is built from the pinned constants above.
        request = urllib.request.Request(url, headers=headers)  # noqa: S310
        try:
            with urllib.request.urlopen(request, timeout=600) as response:  # noqa: S310  # pyright: ignore[reportAny]
                partial = body and response.status == HTTP_PARTIAL  # pyright: ignore[reportAny]
                if not partial:
                    body = b""
                body += _read_all(response)  # pyright: ignore[reportAny]
            return verified(body, sha256, what)
        except http.client.IncompleteRead as error:
            body += error.partial
    msg = f"{url}: still incomplete after {ATTEMPTS} attempts"
    raise OSError(msg)


#: The status of a ranged (resumed) response.
HTTP_PARTIAL = 206


def _read_all(response: http.client.HTTPResponse) -> bytes:  # pragma: no cover - needs network
    """Read a response in pieces, so a dropped connection keeps what had arrived.

    A connection can also close quietly before the promised length; that counts as dropped.
    """
    length = response.getheader("Content-Length")
    out = bytearray()
    while True:
        try:
            piece = response.read(1 << 20)
        except http.client.IncompleteRead as error:
            raise http.client.IncompleteRead(bytes(out) + error.partial) from error
        except OSError as error:  # a reset or a timeout part-way
            raise http.client.IncompleteRead(bytes(out)) from error
        if not piece:
            if length is not None and len(out) < int(length):
                raise http.client.IncompleteRead(bytes(out), int(length) - len(out))
            return bytes(out)
        out += piece


def fetch_permafrost(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download the boreholes and each year's extent (checked, reduced, dropped); write."""
    holes = boreholes(_download(BOREHOLES.url, BOREHOLES.sha256, "GTN-P boreholes").decode())
    extents = [
        read_extent(year, _download(cci_url(year), sha256, f"Permafrost_cci extent {year}"))
        for year, sha256 in sorted(CCI_SHA256.items())
    ]
    return write_permafrost(holes, extents, folder)
