"""Where it rains more, and less, than it did: two records of precipitation side by side (#530).

Two independent records, shown together so where they disagree is plain:

- GPCC, the Global Precipitation Climatology Centre at the Deutscher Wetterdienst: *GPCC
  Precipitation Analysis Monthly Version 2025* at 2.5° (Rustemeier, Finger, Schirmeister &
  Ziese 2025, doi:10.5676/DWD_GPCC/MONTHLY_V2025_250), monthly totals over land from rain
  gauges, 1891-2024, with each cell's number of gauges. DWD's open data, CC BY 4.0
  (https://www.dwd.de/EN/service/legal_notice/legal_notice.html).
- GPCP, the Global Precipitation Climatology Project: the NOAA Climate Data Record of monthly
  precipitation, version 2.3 (Adler et al. 2018, *The Global Precipitation Climatology Project
  (GPCP) Monthly Analysis (New Version 2.3) and a Review of 2017 Global Precipitation*,
  Atmosphere 9, 138; data doi:10.7289/V56971M6), satellites merged with GPCC's gauges, over land
  and sea from 1979, as NOAA PSL keeps it in one file. Public, with no restrictions on use
  (NOAA's CDR use agreement). PSL extends that file every month, so the pinned checksum below
  changes with it and is updated when the data are next made.

Over land the two are not independent: GPCP's land is calibrated to GPCC's gauges. They still
differ, most where gauges are few, and GPCP alone covers the oceans.

Each year's total (mm) is counted where all twelve months have data. From those come:

- trend maps (mm per year, per decade), with significance (see ``water_cycle``): GPCC over
  1951-2024, and both over 1980-2024, the years they share;
- curves of the land-mean anomaly against 1981-2010 (mm per year) for both, over the same
  land (GPCC's), GPCP's global mean too, and the share of that land with at least one gauge
  every month: the rest of GPCC's land is interpolated from farther away, and its early years
  lean on few gauges.
"""

import calendar
import gzip
import io
import json
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

import h5py
import numpy as np

from histeclipse_pipeline.netcdf3 import Variable, read_netcdf3
from histeclipse_pipeline.paleotemp import COLUMNS, ROWS
from histeclipse_pipeline.sky import Json, verified
from histeclipse_pipeline.water_cycle import (
    Mask,
    anomalies,
    area_share,
    curve,
    layer,
    month_dates,
    symmetric_bound,
    text,
    to_nodes,
    to_png,
    trend,
)

if TYPE_CHECKING:
    from collections.abc import Callable, Sequence
    from pathlib import Path

    from histeclipse_pipeline.krapp import Grid
    from histeclipse_pipeline.water_cycle import Trend

GPCC_SOURCE = "https://doi.org/10.5676/DWD_GPCC/MONTHLY_V2025_250"
GPCC_BASE = (
    "https://opendata.dwd.de/climate_environment/GPCC/GPCC_Precipitation_Analysis_Monthly/"
    "Version_2025/250_degree/"
)
#: The release's files to 2024, by the years each covers, and their SHA-256.
GPCC_FILES: tuple[tuple[str, str], ...] = (
    ("1891_1895", "be2203bfbd8beb52c130c2af7beb7a20f049d08d59eeb59c382891ad418f786d"),
    ("1896_1900", "442af23b64e7a9b875e49ed42b06c58e6256561496ee1bc58710ce06e2b3ba14"),
    ("1901_1905", "fc67e29b831a9069d8c9e1f50815f74311bff995562d8f6a4d9654513f48d5ad"),
    ("1906_1910", "86934b2e292d933d78301cb593b784a46e6d837085642ba39e34de851879b600"),
    ("1911_1915", "675bfcfb5a3ae5e1ccb12a52cc5bdba05b097ba0e383a320d778f57adc3a560f"),
    ("1916_1920", "0aeb4a7338e8817e2c3bef440b9c8681c72e4b89e862febb352f721dc84fe4b0"),
    ("1921_1925", "040b1a60fb08b52a8380554471d4555e80190cfa1992600d65d60175065f9a1e"),
    ("1926_1930", "1fee749d49108707ed2cebdae37f123d4be412154a49538ad0a3f335ff0ff4b9"),
    ("1931_1935", "9593ddc7bca29e1bc9374a6f5e0e1570369284667052259126cfc113e0f894a4"),
    ("1936_1940", "9253664d5b6aaad80400427f9f2c43df79d5491bc554e4364e9d66f426aeacc5"),
    ("1941_1945", "9b3d5fd7cd237c4800f7eb0ab55774ca43bf549e615279de3dbbaadcaf1c3b80"),
    ("1946_1950", "cf300d09c4145da8b6e8aa1f0dd032e8dca8ace00268357f76b6c3670ef9732f"),
    ("1951_1955", "38055de32a73ad63526ff2311af583e2b34c4937aef779d7466c4f002dc8191f"),
    ("1956_1960", "eb1c77c2423c7ebeb4f02726da7e5ae1154004c9a93dea1a63823dc4040a9be0"),
    ("1961_1965", "642d440d60b7a32b7205b1c28385839d094cece0d7331edfc77ab36e10feaf07"),
    ("1966_1970", "572bfe1148e6c092e612419b9933d3c2bd1034fcc1fb40d4f64affc5c350882c"),
    ("1971_1975", "9fed29da7ed5036a67ae7ab6b3fe3e73e5c945cb14bfae28cd5d663dbfb0713a"),
    ("1976_1980", "c79962a62e2b0d3eab0f420ae209fce5201ecb995e6b1504a4d33bec81cf392b"),
    ("1981_1985", "bb369b4dc5609c1de4482e10c0cfc2de6d6e23a8d008cbd4db95ca17c4d4eaff"),
    ("1986_1990", "728fe086a940afe137d6f91ca45c17dda5be4139f66310f237cc5541aa39f76d"),
    ("1991_1995", "d5561d84b1944bd9a995df8577243cdb1cf76838a991817fda2a8a6ec50e26f0"),
    ("1996_2000", "ce4fdf8710c6f569711c1f9df30de193aa677cbdf5bc1ba86c0c323bed6197bf"),
    ("2001_2005", "d7148ff7369b39466079216800eca7176ad0ef490e7b733dfb7d921ba892117d"),
    ("2006_2010", "699ca1cb648881b0e553a0f7f2ce7fd33e540e2adb58f26eb922ec283853d012"),
    ("2011_2015", "bca6fa35941d749486c1720f0ba6495a390e34dc8c49fce1439c4eecde6a1c71"),
    ("2016_2020", "d35da330ff6e533f19a28cc3cf3eb1a24329e16f75a060baafdfce14d8b3b979"),
    ("2021_2024", "eb734eea6e0ee2c9371a77f322b94e6c502a22094617406749fffc451d1547fb"),
)
GPCC_CREDIT = (
    "GPCC Precipitation Analysis Monthly Version 2025 at 2.5° (Rustemeier, Finger, Schirmeister "
    "& Ziese 2025, Global Precipitation Climatology Centre at the Deutscher Wetterdienst, "
    "doi:10.5676/DWD_GPCC/MONTHLY_V2025_250), CC BY 4.0; yearly totals, trends and land means "
    "computed for this site"
)
GPCP_SOURCE = "https://doi.org/10.7289/V56971M6"
GPCP_URL = "https://downloads.psl.noaa.gov/Datasets/gpcp/precip.mon.mean.nc"
#: PSL's file as of November 2026, through October 2026. It grows every month.
GPCP_SHA256 = "f82d867432102665f9203ba01ef367c68463a37b81c23917f940dd1d8ccb8027"
GPCP_CREDIT = (
    "GPCP Monthly Precipitation Climate Data Record, version 2.3 (Adler et al. 2018, Atmosphere "
    "9, 138; NOAA NCEI, doi:10.7289/V56971M6), as provided by NOAA PSL; public, no restrictions "
    "on use; yearly totals, trends and means computed for this site"
)

#: The trend windows: GPCC's long one, and the years both records share.
LONG = (1951, 2024)
SHARED = (1980, 2024)
BASE = (1981, 2010)
#: Of the base period's years, the share a node needs for an anomaly.
BASE_NEEDED = 0.8
MONTHS = 12
#: GPCP's rates above this many mm a day are not rain but its missing marker's kin.
_MOST = 1e3
#: Which record each map is from, and what it covers.
COVERAGE: dict[str, dict[str, Json]] = {
    "gpcc": {"source": "GPCC", "coverage": "land"},
    "gpcp": {"source": "GPCP", "coverage": "land and sea"},
}
#: Colour bounds are rounded to this many mm per year, per decade.
STEP = 10.0


@dataclass(frozen=True)
class Yearly:
    """A record's yearly totals (mm), years first, on the source's cells, and its axes."""

    years: list[int]
    totals: Grid
    latitude: Grid
    longitude: Grid


def masked(variable: Variable) -> Grid:
    """Return the values, NaN where the file marks them missing."""
    values = variable.values
    for name in ("_FillValue", "missing_value"):
        marker = variable.number(name)
        if marker is not None:
            values = np.where(np.equal(values, float(np.float32(marker))), np.nan, values)
    return np.asarray(values, dtype=np.float64)


def yearly(
    dates: Sequence[tuple[int, int]], months: Grid, to_total: Callable[[int, int], float]
) -> tuple[list[int], Grid]:
    """Sum each year's twelve months (``to_total`` scales a month); NaN where any is missing.

    Years without all twelve months in the file are left out.
    """
    by_year: dict[int, list[int]] = {}
    for index, (year, _month) in enumerate(dates):
        by_year.setdefault(year, []).append(index)
    years = [year for year, rows in sorted(by_year.items()) if len(rows) == MONTHS]
    totals = [
        np.sum(
            [months[row] * to_total(*dates[row]) for row in by_year[year]],
            axis=0,
        )
        for year in years
    ]
    return years, np.asarray(totals, dtype=np.float64).reshape((len(years), *months.shape[1:]))


def _whole_months(_year: int, _month: int) -> float:
    return 1.0


def _days(year: int, month: int) -> float:
    return float(calendar.monthrange(year, month)[1])


def read_gpcc(files: Sequence[bytes]) -> tuple[Yearly, Mask]:
    """Read GPCC's gzipped NetCDF-3 files, in order, into yearly totals and gauged cells.

    The mask is True where a cell had at least one gauge in every month of the year.
    """
    dates: list[tuple[int, int]] = []
    precip: list[Grid] = []
    gauge: list[Grid] = []
    latitude = longitude = np.empty(0)
    for data in files:
        variables, _ = read_netcdf3(gzip.decompress(data))
        time = variables["time"]
        units = time.attributes.get("units")
        if not isinstance(units, str):
            msg = "GPCC: time has no units"
            raise TypeError(msg)
        dates.extend(month_dates(units, time.values.tolist()))  # pyright: ignore[reportAny]
        precip.append(masked(variables["precip"]))
        gauge.append(masked(variables["gauge"]))
        latitude, longitude = variables["lat"].values, variables["lon"].values
    years, totals = yearly(dates, np.concatenate(precip), _whole_months)
    counts = np.concatenate(gauge)
    with np.errstate(invalid="ignore"):
        gauged_months = np.where(np.isfinite(counts), (counts >= 1).astype(np.float64), np.nan)
    _, gauged = yearly(dates, gauged_months, _whole_months)
    return Yearly(years, totals, latitude, longitude), np.asarray(gauged >= MONTHS)


def read_gpcp(data: bytes) -> Yearly:
    """Read PSL's GPCP file (NetCDF-4, mm per day each month) into yearly totals."""
    with h5py.File(io.BytesIO(data), "r") as opened:
        time = opened["time"]
        units = text(time.attrs["units"], "GPCP time units")
        times = np.asarray(time[()], dtype=np.float64)
        rates = np.asarray(opened["precip"][()], dtype=np.float64)
        latitude = np.asarray(opened["lat"][()], dtype=np.float64)
        longitude = np.asarray(opened["lon"][()], dtype=np.float64)
    rates = np.where((rates < 0) | (rates > _MOST), np.nan, rates)  # missing: -9.97e36
    dates = month_dates(units, times.tolist())  # pyright: ignore[reportAny]
    years, totals = yearly(dates, rates, _days)
    return Yearly(years, totals, latitude, longitude)


def window(record: Yearly, nodes: Grid, period: tuple[int, int]) -> Trend:
    """Fit the record's trend over ``period``, from its yearly fields on the nodes."""
    first, last = period
    picked = [index for index, year in enumerate(record.years) if first <= year <= last]
    if len(picked) != last - first + 1:
        msg = f"the record does not cover {first}-{last}"
        raise ValueError(msg)
    return trend([record.years[index] for index in picked], nodes[picked])


def build(gpcc: Yearly, gauged: Mask, gpcp: Yearly, folder: Path) -> int:
    """Write the three trend maps and the index with the curves; return the number of maps."""
    gpcc_nodes = to_nodes(gpcc.totals, gpcc.latitude, gpcc.longitude)
    gauged_nodes = to_nodes(gauged.astype(np.float64), gpcc.latitude, gpcc.longitude) > 0
    gpcp_nodes = to_nodes(gpcp.totals, gpcp.latitude, gpcp.longitude)
    maps: list[tuple[str, Trend, tuple[int, int]]] = [
        ("gpcc-1951", window(gpcc, gpcc_nodes, LONG), LONG),
        ("gpcc-1980", window(gpcc, gpcc_nodes, SHARED), SHARED),
        ("gpcp-1980", window(gpcp, gpcp_nodes, SHARED), SHARED),
    ]
    bound = symmetric_bound((found.slope for _, found, _ in maps), STEP)
    folder.mkdir(parents=True, exist_ok=True)
    for name, found, _ in maps:
        _ = (folder / f"{name}.png").write_bytes(to_png(found, bound))
    gpcc_anomaly = anomalies(gpcc.years, gpcc_nodes, BASE, BASE_NEEDED)
    gpcp_anomaly = anomalies(gpcp.years, gpcp_nodes, BASE, BASE_NEEDED)
    first, last = BASE
    in_base = [index for index, year in enumerate(gpcc.years) if first <= year <= last]
    land: Mask = np.isfinite(gpcc_nodes[in_base]).all(axis=0)
    everywhere: Mask = np.ones(land.shape, dtype=np.bool_)
    kept, values = curve(gpcc.years, gpcc_anomaly, land, digits=1)
    shares = [area_share(flags, land) for flags in np.unstack(gauged_nodes)]
    by_year = dict(zip(gpcc.years, shares, strict=True))
    gauged_share: list[Json] = [
        None if (share := by_year[year]) is None else round(share, 2) for year in kept
    ]
    gpcc_curve: dict[str, Json] = {
        "id": "gpcc-land",
        "source": "GPCC",
        "years": list[Json](kept),
        "values": list[Json](values),
        "gauged": gauged_share,
    }
    curves: list[Json] = [
        gpcc_curve,
        _curve("gpcp-land", "GPCP", gpcp.years, gpcp_anomaly, land),
        _curve("gpcp-global", "GPCP", gpcp.years, gpcp_anomaly, everywhere),
    ]
    layers: list[Json] = [
        {**layer(name, found, period, bound, 1), **COVERAGE[name.split("-")[0]]}
        for name, found, period in maps
    ]
    index = index_file(layers, curves)
    _ = (folder / "index.json").write_text(json.dumps(index, separators=(",", ":")) + "\n")
    return len(maps)


def _curve(
    name: str, source: str, years: Sequence[int], fields: Grid, where: Mask
) -> dict[str, Json]:
    kept, values = curve(years, fields, where, digits=1)
    return {"id": name, "source": source, "years": list[Json](kept), "values": list[Json](values)}


def index_file(layers: list[Json], curves: list[Json]) -> dict[str, Json]:
    """Build the manifest the web app reads: credits, units, encoding, maps and curves."""
    first, last = BASE
    return {
        "schemaVersion": 1,
        "credit": f"{GPCC_CREDIT}. {GPCP_CREDIT}",
        "source": GPCC_SOURCE,
        "sources": {
            "GPCC": {"credit": GPCC_CREDIT, "source": GPCC_SOURCE, "licence": "CC BY 4.0"},
            "GPCP": {
                "credit": GPCP_CREDIT,
                "source": GPCP_SOURCE,
                "licence": "Public (NOAA CDR, no restrictions on use)",
            },
        },
        "units": {"trend": "mm/yr per decade", "curve": "mm/yr"},
        "baseline": f"{first}\u2013{last}",
        "significance": 0.1,
        "encoding": "R trend from -bound to +bound; G no trend; B significant; A data",
        "columns": COLUMNS,
        "rows": ROWS,
        "maps": layers,
        "curves": curves,
    }


def _download(url: str) -> bytes:  # pragma: no cover - needs network access
    request = urllib.request.Request(url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
    with urllib.request.urlopen(request, timeout=900) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{url}: expected bytes"
        raise TypeError(msg)
    return body


def gpcc_url(span: str) -> str:
    """Return the URL of the release's file covering ``span`` (e.g. ``"1891_1895"``)."""
    return f"{GPCC_BASE}gpcc_precipitation_analysis_monthly_{span}_v2025_250.nc.gz"


def fetch_precipitation(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download both records (checked against their pinned checksums) and write the maps."""
    gpcc_files = [
        verified(_download(gpcc_url(span)), sha256, f"GPCC {span}") for span, sha256 in GPCC_FILES
    ]
    gpcc, gauged = read_gpcc(gpcc_files)
    gpcp = read_gpcp(verified(_download(GPCP_URL), GPCP_SHA256, "GPCP"))
    return build(gpcc, gauged, gpcp, folder)
