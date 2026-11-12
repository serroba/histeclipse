"""Ocean oxygen loss since 2004, from GOBAI-O₂ (#531).

The ocean has been losing dissolved oxygen as it warms (warmer water holds less, and mixes
less with the deep). Schmidtko et al. 2017 (Nature 542) estimated some 2% lost since 1960, but
deposited no gridded data; this module uses the open, gridded product instead:

- **GOBAI-O₂** (Gridded Ocean Biogeochemistry from Artificial Intelligence - Oxygen; Sharp,
  Fassbender, Carter, Johnson, Schultz & Dunne, NCEI Accession 0259304,
  doi:10.25921/z72m-yz67; method: Sharp et al. 2023, Earth System Science Data 15, 4481,
  doi:10.5194/essd-15-4481-2023), version 2.3 (NCEI revision 5, September 2025). Neural networks
  trained on shipboard and Biogeochemical-Argo float oxygen, applied to Argo's gridded
  temperature and salinity (Roemmich & Gilson 2009). 1° cells from 64.5°S to 79.5°N, 58 levels
  from 2.5 to 1975 dbar, 2004-2024, with each cell's total uncertainty. Released under CC0 1.0
  (the licence file in the accession).

Of its files, the annual means (``GOBAI-O2-ann-v2.3.nc``, about 1 GB) are read; the monthly
file is 11 GB and adds nothing to a yearly curve. The file is downloaded to a temporary folder,
checked against its pinned SHA-256 and never kept.

From it come:

- the oxygen inventory, year by year, of 0-2000 dbar and of three layers (0-200, 200-1000,
  1000-2000 dbar), in Pmol (10¹⁵ mol), over the cells the product covers in every year, with
  its least-squares trend per decade (significance as in ``water_cycle``). A layer's mass is
  its pressure thickness over gravity (normal gravity at the cell's latitude), so no density
  is needed; levels split between layers by the share of their thickness in each;
- the mass-weighted mean concentration, in µmol/kg;
- an uncertainty for each: the cells' uncertainties summed as if fully correlated. That bounds
  how far off the level could be; it is far wider than the uncertainty of the change, since
  most of the error is shared from year to year (Sharp et al. do not give an inventory error);
- a map of the trend in the 0-2000 dbar column (mol/m² per decade) on the site's 1° nodes,
  packed as ``water_cycle`` packs its trend maps.

What it cannot show: GOBAI-O₂ starts in 2004, with the Argo era, so it shows the recent
decline, not the loss since the 1960s; it reaches 2000 dbar, not the deep ocean; it leaves out
the Arctic and the ocean south of 64.5°S; and it is a machine-learning reconstruction, so in
years and places with few oxygen floats it leans on how oxygen relates to temperature and
salinity elsewhere.

The site's ``public/data/ocean-oxygen/`` holds ``index.json`` and ``column-trend.png``.
"""

import datetime as dt
import json
import math
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

import h5py
import numpy as np

from histeclipse_pipeline.paleotemp import COLUMNS, ROWS
from histeclipse_pipeline.planet_maps import checked, download
from histeclipse_pipeline.sky import Json
from histeclipse_pipeline.water_cycle import LEVEL, layer, symmetric_bound, to_nodes, to_png, trend

if TYPE_CHECKING:
    from collections.abc import Sequence

    from histeclipse_pipeline.krapp import Grid
    from histeclipse_pipeline.water_cycle import Mask


@dataclass(frozen=True)
class Download:
    """A pinned file: where it is, and its SHA-256."""

    url: str
    sha256: str


#: GOBAI-O₂ v2.3's annual means, NCEI Accession 0259304 revision 5.5 (12 September 2025).
GOBAI = Download(
    (
        "https://www.ncei.noaa.gov/data/oceans/archive/arc0207/0259304/5.5/data/0-data/"
        "GOBAI-O2-ann-v2.3.nc"
    ),
    "b91e4f7d83c313922fba4e58f8befb4d398602de5bcbe4d83ab7436ce5f07593",
)
VERSION = "v2.3"
SOURCE = "https://doi.org/10.25921/z72m-yz67"
LICENCE = "CC0 1.0"
CREDIT = (
    "GOBAI-O₂ v2.3 (Sharp, Fassbender, Carter, Johnson, Schultz & Dunne, NOAA NCEI "
    "Accession 0259304, doi:10.25921/z72m-yz67; method: Sharp et al. 2023, Earth System Science "
    "Data 15, 4481), CC0 1.0; inventories, trends and the trend map computed for this site"
)
#: The bottom of the deepest layer, dbar: the product reaches 2 km (its last level is 1975).
BOTTOM = 2000.0
#: The layers whose inventories are given, dbar; the first is the whole column.
BANDS: tuple[tuple[str, float, float], ...] = (
    ("0-2000", 0.0, BOTTOM),
    ("0-200", 0.0, 200.0),
    ("200-1000", 200.0, 1000.0),
    ("1000-2000", 1000.0, BOTTOM),
)
#: Pascals in a decibar.
PA_PER_DBAR = 1e4
#: The Earth's mean radius, m.
RADIUS = 6_371_000.0
#: Mol in a Pmol, and µmol in a mol.
PMOL = 1e15
MICRO = 1e-6
#: The file's fill value, 9.97e36; anything this large is no data.
_NO_DATA_ABOVE = 1e30
#: Colour steps of the trend map, mol/m² per decade.
STEP = 1.0


def normal_gravity(latitude: Grid) -> Grid:
    """Gravity at sea level by latitude, m/s² (the 1980 international formula)."""
    sine = np.sin(np.radians(latitude))
    double = np.sin(np.radians(2 * latitude))
    return np.asarray(9.780327 * (1 + 0.0053024 * sine**2 - 0.0000058 * double**2), np.float64)


def cell_areas(latitude: Grid, width: float) -> Grid:
    """Measure the area of a cell of ``width`` degrees centred on each latitude, m²."""
    half = math.radians(width / 2)
    middle = np.radians(latitude)
    band = np.sin(middle + half) - np.sin(middle - half)
    return np.asarray(RADIUS**2 * math.radians(width) * band, dtype=np.float64)


def layer_edges(pressure: Grid) -> Grid:
    """Each level's top and bottom, dbar: half way to its neighbours, from 0 to ``BOTTOM``."""
    middles = (pressure[1:] + pressure[:-1]) / 2
    return np.asarray(np.concatenate([[0.0], middles, [BOTTOM]]), dtype=np.float64)


def band_thickness(pressure: Grid, top: float, bottom: float) -> Grid:
    """How much of each level's layer lies between ``top`` and ``bottom``, dbar."""
    edges = layer_edges(pressure)
    upper = np.maximum(edges[:-1], top)
    lower = np.minimum(edges[1:], bottom)
    return np.asarray(np.maximum(lower - upper, 0.0), dtype=np.float64)


def cleaned(values: Grid) -> Grid:
    """Return the values as float64, with the file's fill values as NaN."""
    out = np.asarray(values, dtype=np.float64)
    return np.where(np.isfinite(out) & (out < _NO_DATA_ABOVE), out, np.nan)


def column(oxygen: Grid, thickness: Grid, latitude: Grid) -> Grid:
    """Oxygen per square metre over the levels (``thickness``, dbar), mol/m², NaN if none.

    ``oxygen`` is µmol/kg, levels first, then latitude and longitude; a level's mass per
    square metre is its pressure thickness over gravity.
    """
    mass = thickness[:, None] * PA_PER_DBAR / normal_gravity(latitude)[None, :]  # kg/m²
    known = np.isfinite(oxygen)
    total = (np.where(known, oxygen, 0.0) * mass[:, :, None]).sum(axis=0) * MICRO
    return np.where(known.any(axis=0), total, np.nan)


@dataclass(frozen=True)
class Year:
    """One year's inventory of each band (mol) and its correlated uncertainty, and its mean."""

    inventory: dict[str, float]
    uncertainty: dict[str, float]
    #: Mass-weighted mean concentration over 0-2000 dbar, and its uncertainty, µmol/kg.
    mean: float
    mean_uncertainty: float


def year_totals(
    oxygen: Grid, uncertainty: Grid, pressure: Grid, latitude: Grid, width: float
) -> Year:
    """Sum one year's oxygen (and its uncertainty, fully correlated) over each band's mass."""
    area = cell_areas(latitude, width)[:, None]
    inventory: dict[str, float] = {}
    spread: dict[str, float] = {}
    for name, top, bottom in BANDS:
        thickness = band_thickness(pressure, top, bottom)
        inventory[name] = float(np.nansum(column(oxygen, thickness, latitude) * area))
        spread[name] = float(np.nansum(column(uncertainty, thickness, latitude) * area))
    # The water's mass, kg: a column of 1 µmol/kg holds its mass in µmol.
    ones = np.where(np.isfinite(oxygen), 1.0, np.nan)
    whole_mass = (
        float(np.nansum(column(ones, band_thickness(pressure, 0.0, BOTTOM), latitude) * area))
        / MICRO
    )
    whole = BANDS[0][0]
    return Year(
        inventory=inventory,
        uncertainty=spread,
        mean=inventory[whole] / whole_mass / MICRO,
        mean_uncertainty=spread[whole] / whole_mass / MICRO,
    )


@dataclass(frozen=True)
class Summary:
    """What is kept from the file: each year's totals, and each year's column on the nodes."""

    years: list[int]
    totals: list[Year]
    #: The 0-2000 dbar column on the 1° nodes, mol/m², years first.
    columns: Grid


def common_mask(opened: h5py.File, years: int) -> Mask:
    """Find the cells with oxygen in every year (levels, latitude, longitude)."""
    every: Mask = np.isfinite(_year(opened, "oxy", 0))
    for index in range(1, years):
        every &= np.isfinite(_year(opened, "oxy", index))
    return every


def wrapped(longitude: Grid) -> Grid:
    """Longitudes put in -180 to 180: the file runs from 20.5 to 379.5."""
    return np.asarray((longitude + 180.0) % 360.0 - 180.0, dtype=np.float64)


def _axis(opened: h5py.File, name: str) -> Grid:
    return np.asarray(opened[name][()], dtype=np.float64)


def _year(opened: h5py.File, name: str, index: int) -> Grid:
    """One year of a variable (levels, latitude, longitude), fill values as NaN."""
    return cleaned(np.asarray(opened[name][index], dtype=np.float64))


def summarise(path: Path) -> Summary:
    """Read GOBAI-O₂'s annual file one year at a time, over the cells it always covers."""
    with h5py.File(str(path), "r") as opened:
        years = [round(year) for year in _axis(opened, "time").tolist()]  # pyright: ignore[reportAny]
        pressure = _axis(opened, "pres")
        latitude = _axis(opened, "lat")
        longitude = _axis(opened, "lon")
        width = float(np.median(np.diff(latitude)))  # the cells are square
        mask = common_mask(opened, len(years))
        whole = band_thickness(pressure, 0.0, BOTTOM)
        totals: list[Year] = []
        fields: list[Grid] = []
        for index in range(len(years)):
            oxygen = np.where(mask, _year(opened, "oxy", index), np.nan)
            spread = np.where(mask, _year(opened, "uncer", index), np.nan)
            totals.append(year_totals(oxygen, spread, pressure, latitude, width))
            fields.append(column(oxygen, whole, latitude))
    nodes = to_nodes(np.stack(fields), latitude, wrapped(longitude))
    return Summary(years, totals, nodes)


def _trend(years: Sequence[int], values: Sequence[float]) -> tuple[float, bool]:
    found = trend(years, np.asarray(values, dtype=np.float64).reshape(-1, 1))
    return float(found.slope.item(0)), bool(found.significant.item(0))


def band_series(summary: Summary, name: str, top: float, bottom: float) -> dict[str, Json]:
    """One band's inventory curve (Pmol), its uncertainty and its trend per decade."""
    values = [year.inventory[name] / PMOL for year in summary.totals]
    slope, significant = _trend(summary.years, values)
    first = values[0]
    return {
        "id": name,
        "top": top,
        "bottom": bottom,
        "values": list[Json]([round(value, 3) for value in values]),
        "uncertainty": list[Json](
            [round(year.uncertainty[name] / PMOL, 3) for year in summary.totals]
        ),
        "trendPerDecade": round(slope, 3),
        "trendPercentPerDecade": round(100 * slope / first, 3),
        "significant": significant,
    }


def index_file(summary: Summary, maps: list[Json], accessed: str) -> dict[str, Json]:
    """Build the manifest: credit, units, the curves, the mean and the trend map."""
    means = [year.mean for year in summary.totals]
    slope, significant = _trend(summary.years, means)
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "licence": LICENCE,
        "version": VERSION,
        "accessed": accessed,
        "units": {
            "inventory": "Pmol",
            "concentration": "µmol/kg",
            "trend": "mol/m² per decade",
        },
        "domain": (
            "64.5°S to 79.5°N, 0-2000 dbar, the 1° cells GOBAI-O₂ "
            "covers in every year (no Arctic Ocean, no ocean south of 64.5°S)"
        ),
        "uncertaintyNote": (
            "Each cell's total uncertainty summed as if fully correlated: a bound on how far "
            "off the level could be, far wider than the uncertainty of the change, since most "
            "of the error is shared from year to year."
        ),
        "caveat": (
            "Starts in 2004 with the Argo era: the recent decline, not the loss since the "
            "1960s (Schmidtko et al. 2017 estimate some 2%). A machine-learning reconstruction "
            "from temperature and salinity, trained on ship and float oxygen."
        ),
        "years": list[Json](summary.years),
        "inventory": [band_series(summary, *band) for band in BANDS],
        "concentration": {
            "values": list[Json]([round(value, 3) for value in means]),
            "uncertainty": list[Json]([round(year.mean_uncertainty, 3) for year in summary.totals]),
            "trendPerDecade": round(slope, 4),
            "significant": significant,
        },
        "significance": LEVEL,
        "encoding": "R trend from -bound to +bound; G no trend; B significant; A data",
        "columns": COLUMNS,
        "rows": ROWS,
        "maps": maps,
    }


def build(summary: Summary, folder: Path, accessed: str) -> int:
    """Write the column-trend map and the index; return how many curve points they hold."""
    found = trend(summary.years, summary.columns)
    bound = symmetric_bound([found.slope], STEP)
    folder.mkdir(parents=True, exist_ok=True)
    name = "column-trend"
    _ = (folder / f"{name}.png").write_bytes(to_png(found, bound))
    period = (summary.years[0], summary.years[-1])
    maps: list[Json] = [
        {**layer(name, found, period, bound, 2), "units": "mol/m² per decade"},
    ]
    index = index_file(summary, maps, accessed)
    body = json.dumps(index, separators=(",", ":"), ensure_ascii=False)
    _ = (folder / "index.json").write_text(body + "\n")
    return len(summary.years) * len(BANDS)


def fetch_ocean_oxygen(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download GOBAI-O₂'s annual file to a temporary folder, check it, and write the data."""
    accessed = dt.datetime.now(tz=dt.UTC).date().isoformat()
    with tempfile.TemporaryDirectory() as scratch:
        path = Path(scratch) / "GOBAI-O2-ann-v2.3.nc"
        download(GOBAI.url, path)
        summary = summarise(checked(path, GOBAI.sha256))
    return build(summary, folder, accessed)
