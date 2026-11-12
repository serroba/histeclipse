"""Warm past analogues: surface air temperature change at the Last Interglacial and mid-Pliocene.

Two periods the IPCC (AR6) uses as analogues for a warmer near future: an analogue, not a
forecast. Each map is the change in near-surface air temperature from the pre-industrial
control run (CMIP6 ``piControl``, 1850 conditions), °C.

The Last Interglacial, 127,000 years ago: the CMIP6-PMIP4 ``lig127k`` runs of 16 models
(Otto-Bliesner et al. 2021, Climate of the Past 17, 63, doi:10.5194/cp-17-63-2021), each run's
change from its own model's control, as collated for the IPCC AR6 Interactive Atlas by Brierley
& Zhao (2022; doi:10.5281/zenodo.5931114, MIT licence; method in Zhao et al. 2022, GMD 15, 2475)
on a common 1° cell-centred grid. The orbit, not CO2, drives it, so the annual mean barely moves
(about 0 °C globally) while northern summers were far warmer: the June-August mean (from the
same atlas's calendar-adjusted monthly file) is kept as well as the annual one.

The mid-Pliocene Warm Period, about 3.2 million years ago, CO2 near 400 ppm, on the PRISM4
boundary conditions (Dowsett et al. 2016): the PlioMIP2 17-model ensemble mean (Haywood et al.
2020, Climate of the Past 16, 2095) as published with IPCC AR6 Figure 7.13 (Lunt 2023, CEDA,
doi:10.5285/4dbd3ccb85d747188586735133f1d3d9, CC BY 4.0), and the five CMIP6 models whose
``midPliocene-eoi400`` runs are in the same atlas as the Last Interglacial's.

Every model's map is kept beside the ensemble mean: models disagree, and the reader can see by
how much. Each map is regridded linearly onto the site's 1° node-registered grid (`cesm.regrid`)
and packed into an 8-bit greyscale PNG, from COLDEST (0) to WARMEST (255), about 0.2 °C a step.
A few models leave the pole rows empty; those take their neighbouring row's mean.

The index also carries each period's sea level above present from published reconstructions,
one entry per source, for the coastline shader to offer: they disagree too.
"""

import io
import json
import urllib.request
import warnings
from dataclasses import dataclass
from typing import TYPE_CHECKING

import h5py
import numpy as np
import numpy.typing as npt
from PIL import Image

from histeclipse_pipeline.cesm import read_netcdf3, regrid
from histeclipse_pipeline.paleotemp import COLUMNS, ROWS
from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from pathlib import Path

type Grid = npt.NDArray[np.float64]

SCHEMA_VERSION = 1
#: The span the byte encoding covers, °C of change.
COLDEST = -15.0
WARMEST = 35.0

ATLAS_RECORD = "https://doi.org/10.5281/zenodo.5931114"
#: The atlas repository at its v1.0 tag, which the Zenodo record archives.
ATLAS_BASE = (
    "https://raw.githubusercontent.com/pmip4/PMIP_for_AR6_Interactive_Atlas/"
    "fefcfa70efd23e2d6b135159661dac3a6fd0bbd7/netcdfs/ensemble_differences/"
)
LIG_ANNUAL_URL = ATLAS_BASE + "tas_annClim_PMIP4_lig127k-piControl.nc"
LIG_ANNUAL_SHA256 = "c6ce08cbd08e9b47cc799547f00842c29503c46c47dc534fc80482da96ef78cd"
LIG_MONTHLY_URL = ATLAS_BASE + "tas_monClim_PMIP4_lig127k-piControl.nc"
LIG_MONTHLY_SHA256 = "f8da718ecc33002b514b91c2eb5016db87f5b9de5aac1be608c44eb984fadb86"
PLIO_ANNUAL_URL = ATLAS_BASE + "tas_annClim_PMIP4_midPliocene-eoi400-piControl.nc"
PLIO_ANNUAL_SHA256 = "390e523598556aad2dbb308e9e52ef93f9fab67860a6f477e878ff9f1beca350"
PLIOMIP2_RECORD = "https://doi.org/10.5285/4dbd3ccb85d747188586735133f1d3d9"
PLIOMIP2_URL = (
    "https://data.ceda.ac.uk/badc/ar6_wg1/data/ch_07/inputdata_ch7_fig13/v20230118/"
    "Figure_7_13_mod/pliocene/ensmean_pl-pi_NearSurfaceTemperature.nc"
)
PLIOMIP2_SHA256 = "8454f3f7e59c84c0f2a1e34e9a94c7f3f02538cad95f4201018cae3235200e55"
PLIOMIP2_MODELS = 17

SOURCE = ATLAS_RECORD
CREDIT = (
    "Last Interglacial: CMIP6-PMIP4 lig127k runs (Otto-Bliesner et al. 2021, Climate of the "
    "Past 17, 63), as collated by Brierley & Zhao (2022), PMIP for AR6 Interactive Atlas v1.0, "
    "Zenodo, MIT licence. Mid-Pliocene: PlioMIP2 ensemble mean (Haywood et al. 2020, Climate of "
    "the Past 16, 2095) from IPCC AR6 WG1 Figure 7.13 input data (Lunt 2023, CEDA, CC BY 4.0), "
    "and CMIP6 midPliocene-eoi400 runs from the same atlas. Change from each model's "
    "pre-industrial control; regridded to 1° and packed into 8-bit images for this site"
)

#: June, July and August, months counted from 0.
_SUMMER = slice(5, 8)
#: The files' fill value is 9.97e36; anything this large is no data.
_NO_DATA_ABOVE = 1e30


@dataclass(frozen=True, slots=True)
class Models:
    """One atlas file: each model's change, cell-centred, latitude ascending."""

    latitude: Grid
    longitude: Grid
    names: tuple[str, ...]
    #: (model, lat, lon) for annual files; (model, month, lat, lon) for monthly ones.
    change: Grid
    years: tuple[str, ...]
    control_years: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class Field:
    """One map on its source grid, before regridding."""

    id: str
    label: str
    season: str
    source: str
    values: Grid
    models: int
    years: str | None = None
    control_years: str | None = None


@dataclass(frozen=True, slots=True)
class SeaLevel:
    """A period's global mean sea level above present, as one source gives it, m."""

    source: str
    low: float | None
    high: float | None
    best: float | None
    note: str

    def as_json(self) -> Json:
        """Return the index entry, with only the numbers the source gives."""
        numbers = (("low", self.low), ("high", self.high), ("best", self.best))
        entry: dict[str, Json] = {"source": self.source}
        entry |= {key: value for key, value in numbers if value is not None}
        entry["note"] = self.note
        return entry


@dataclass(frozen=True, slots=True)
class Period:
    """A warm period: what it is, its maps and its sea levels."""

    id: str
    name: str
    years_ago: int
    experiment: str
    fields: tuple[Field, ...]
    sea_level: tuple[SeaLevel, ...]


LIG_SEA_LEVEL = (
    SeaLevel(
        "dutton2015",
        6.0,
        9.0,
        None,
        "Peak global mean sea level of marine isotope stage 5e, above present.",
    ),
)
PLIOCENE_SEA_LEVEL = (
    SeaLevel(
        "dumitru2019",
        5.6,
        19.2,
        16.2,
        (
            "Mid-Piacenzian global mean sea level above present, from Mallorcan cave deposits; "
            "most likely value and 68% range."
        ),
    ),
    SeaLevel(
        "dutton2015",
        None,
        None,
        None,
        (
            "Ice sheets were smaller, but the mantle's dynamic topography moves coasts by tens "
            "of metres over millions of years, so no precise Pliocene peak can yet be given."
        ),
    ),
)


def read_models(data: bytes) -> Models:
    """Read an atlas ensemble-difference file (NetCDF-4): axes, models and changes."""
    with h5py.File(io.BytesIO(data), "r") as opened:
        change = np.asarray(opened["tas"][()], dtype=np.float64)
        models = Models(
            latitude=np.asarray(opened["lat"][()], dtype=np.float64),
            longitude=np.asarray(opened["lon"][()], dtype=np.float64),
            names=tuple(opened["model_name"].asstr()[()]),
            change=np.where(change > _NO_DATA_ABOVE, np.nan, change),
            years=tuple(opened["years_averaged"].asstr()[()]),
            control_years=tuple(opened["piControl_years_averaged"].asstr()[()]),
        )
    if len(models.names) != len(models.change):
        msg = f"{len(models.names)} model names for {len(models.change)} maps"
        raise ValueError(msg)
    return models


def read_pliomip2(data: bytes) -> tuple[Grid, Grid, Grid]:
    """Latitude, longitude and the PlioMIP2 ensemble-mean change from the AR6 file (NetCDF-3)."""
    variables = read_netcdf3(data)
    change = np.squeeze(variables["tas"], axis=0)
    return variables["latitude"], variables["longitude"], change


def fill_gaps(field: Grid) -> Grid:
    """Give each empty cell its row's mean; a wholly empty row takes the nearest full row's."""
    known = np.isfinite(field)
    full = np.flatnonzero(known.any(axis=1))
    if len(full) == 0:
        msg = "a map with no values"
        raise ValueError(msg)
    row_means = nan_mean(field, axis=1)
    rows = np.arange(len(field))
    nearest = full[np.argmin(np.abs(full[np.newaxis, :] - rows[:, np.newaxis]), axis=1)]
    return np.asarray(np.where(known, field, row_means[nearest][:, np.newaxis]), dtype=np.float64)


def area_mean(field: Grid, latitude: Grid) -> float:
    """Area-weighted mean of a full cell-centred map, each row weighted by cos latitude."""
    weights = np.cos(np.radians(latitude))
    mean: np.float64 = np.average(field.mean(axis=1), weights=weights)
    return float(mean)


def to_nodes(field: Grid, latitude: Grid, longitude: Grid) -> Grid:
    """Regrid a cell-centred map onto the 1° nodes, after ordering longitude from 0° to 360°."""
    east = np.mod(longitude, 360)
    order = np.argsort(east)
    return regrid(field[:, order], latitude, east[order])


def encode(change: Grid) -> npt.NDArray[np.uint8]:
    """Pack °C of change into bytes, linearly from COLDEST (0) to WARMEST (255)."""
    scaled = (np.clip(change, COLDEST, WARMEST) - COLDEST) / (WARMEST - COLDEST)
    return np.round(scaled * 255).astype(np.uint8)


def decode(byte: int) -> float:
    """Return the change a byte stands for, °C (what the shader computes)."""
    return COLDEST + byte / 255 * (WARMEST - COLDEST)


def to_png(change: Grid) -> bytes:
    """Write a change map as an optimised 8-bit greyscale PNG, north at the top."""
    out = io.BytesIO()
    Image.fromarray(encode(change), mode="L").save(out, format="PNG", optimize=True)
    return out.getvalue()


def file_id(name: str) -> str:
    """Turn a model's name into a file name: lower case, dots as dashes."""
    return name.lower().replace(".", "-").replace("_", "-")


def model_fields(models: Models, source: str) -> list[Field]:
    """Each model's own annual map, in the file's order."""
    return [
        Field(
            id=file_id(name),
            label=name,
            season="annual",
            source=source,
            values=np.squeeze(models.change[index : index + 1], axis=0),
            models=1,
            years=models.years[index],
            control_years=models.control_years[index],
        )
        for index, name in enumerate(models.names)
    ]


def nan_mean(values: Grid, axis: int | tuple[int, ...]) -> Grid:
    """Average along ``axis`` the values present; where none is (a pole row), NaN."""
    with warnings.catch_warnings():
        # A cell with no value stays NaN until fill_gaps, without a warning.
        warnings.simplefilter("ignore", RuntimeWarning)
        return np.asarray(np.nanmean(values, axis=axis), dtype=np.float64)


def lig_period(annual: Models, monthly: Models) -> Period:
    """Gather the Last Interglacial: the ensemble's annual and June-August means, each model."""
    summer = nan_mean(nan_mean(monthly.change[:, _SUMMER], axis=1), axis=0)
    fields = (
        Field(
            "ensemble",
            "Ensemble mean",
            "annual",
            "pmipAtlas",
            nan_mean(annual.change, axis=0),
            len(annual.names),
        ),
        Field(
            "ensemble-jja",
            "Ensemble mean, June-August",
            "JJA",
            "pmipAtlas",
            summer,
            len(monthly.names),
        ),
        *model_fields(annual, "pmipAtlas"),
    )
    return Period("lig127k", "Last Interglacial", 127_000, "lig127k", fields, LIG_SEA_LEVEL)


def pliocene_period(pliomip2: tuple[Grid, Grid, Grid], annual: Models) -> tuple[Period, Grid, Grid]:
    """Gather the mid-Pliocene: PlioMIP2's mean (on its own grid), then each CMIP6 model."""
    latitude, longitude, change = pliomip2
    fields = (
        Field("pliomip2", "PlioMIP2 ensemble mean", "annual", "ar6Fig713", change, PLIOMIP2_MODELS),
        *model_fields(annual, "pmipAtlas"),
    )
    period = Period(
        "mpwp",
        "Mid-Pliocene Warm Period",
        3_205_000,
        "midPliocene-eoi400",
        fields,
        PLIOCENE_SEA_LEVEL,
    )
    return period, latitude, longitude


def write_field(folder: Path, period: str, field: Field, latitude: Grid, longitude: Grid) -> Json:
    """Write one map's PNG and return its index entry."""
    filled = fill_gaps(field.values)
    name = f"{period}/{field.id}.png"
    _ = (folder / name).write_bytes(to_png(to_nodes(filled, latitude, longitude)))
    entry: dict[str, Json] = {
        "id": field.id,
        "label": field.label,
        "file": name,
        "season": field.season,
        "source": field.source,
        "models": field.models,
        "mean": round(area_mean(filled, latitude), 2),
    }
    if field.years is not None:
        entry["years"] = field.years
    if field.control_years is not None:
        entry["controlYears"] = field.control_years
    return entry


def write_period(folder: Path, period: Period, grids: dict[str, tuple[Grid, Grid]]) -> Json:
    """Write a period's maps (each on the grid its source gives) and return its index entry."""
    (folder / period.id).mkdir(parents=True, exist_ok=True)
    maps = [write_field(folder, period.id, field, *grids[field.source]) for field in period.fields]
    return {
        "id": period.id,
        "name": period.name,
        "yearsAgo": period.years_ago,
        "experiment": period.experiment,
        "maps": maps,
        "seaLevel": [each.as_json() for each in period.sea_level],
    }


def index_file(periods: list[Json]) -> dict[str, Json]:
    """Build the manifest the web app reads: credit, encoding, grid shape and the periods."""
    return {
        "schemaVersion": SCHEMA_VERSION,
        "credit": CREDIT,
        "source": SOURCE,
        "licence": "MIT (atlas); CC BY 4.0 (AR6 Figure 7.13 data; CMIP6 model output)",
        "quantity": "near-surface air temperature change",
        "units": "°C",
        "baseline": "pre-industrial control (CMIP6 piControl, 1850 conditions)",
        "seaLevelUnits": "m above present",
        "caption": "An analogue, not a forecast.",
        "columns": COLUMNS,
        "rows": ROWS,
        "coldest": COLDEST,
        "warmest": WARMEST,
        "periods": periods,
    }


def build(
    lig_annual: bytes, lig_monthly: bytes, plio_annual: bytes, pliomip2: bytes, folder: Path
) -> int:
    """Write every map and ``index.json`` from the four files' bytes; return the map count."""
    annual = read_models(lig_annual)
    lig = lig_period(annual, read_models(lig_monthly))
    plio_models = read_models(plio_annual)
    plio, plio_lat, plio_lon = pliocene_period(read_pliomip2(pliomip2), plio_models)
    folder.mkdir(parents=True, exist_ok=True)
    periods = [
        write_period(folder, lig, {"pmipAtlas": (annual.latitude, annual.longitude)}),
        write_period(
            folder,
            plio,
            {
                "pmipAtlas": (plio_models.latitude, plio_models.longitude),
                "ar6Fig713": (plio_lat, plio_lon),
            },
        ),
    ]
    body = json.dumps(index_file(periods), separators=(",", ":"), ensure_ascii=False)
    _ = (folder / "index.json").write_text(body + "\n", encoding="utf-8")
    return len(lig.fields) + len(plio.fields)


def fetch_warm_past(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download the four files (each checked against its pinned checksum) and write the maps."""

    def fetch(url: str) -> bytes:
        if not url.startswith("https://"):
            msg = f"{url}: only https downloads"
            raise ValueError(msg)
        request = urllib.request.Request(url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310 - https only, checked above
        with urllib.request.urlopen(request, timeout=300) as response:  # noqa: S310  # pyright: ignore[reportAny]
            body: object = response.read()  # pyright: ignore[reportAny]
        if not isinstance(body, bytes):
            msg = f"{url}: expected bytes"
            raise TypeError(msg)
        return body

    return build(
        verified(fetch(LIG_ANNUAL_URL), LIG_ANNUAL_SHA256, "Last Interglacial annual file"),
        verified(fetch(LIG_MONTHLY_URL), LIG_MONTHLY_SHA256, "Last Interglacial monthly file"),
        verified(fetch(PLIO_ANNUAL_URL), PLIO_ANNUAL_SHA256, "mid-Pliocene annual file"),
        verified(fetch(PLIOMIP2_URL), PLIOMIP2_SHA256, "PlioMIP2 ensemble mean"),
        folder,
    )
