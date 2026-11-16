"""The ozone layer as a surface round the Earth, each day from July to December (#804).

The Copernicus Atmosphere Monitoring Service draws the ozone hole as the surface where the
partial pressure of ozone is 12 mPa, coloured by the total ozone above the ground: the layer as
a shell about the Earth, with an opening where no height holds that much ozone. This writes the
same surface for the site to draw.

The source is the CAMS global reanalysis, EAC4 (Inness et al. 2019, Atmos. Chem. Phys. 19, 3515,
doi:10.5194/acp-19-3515-2019), from the Copernicus Atmosphere Data Store
(doi:10.24381/d58bbf47), CC BY 4.0: the ozone mass mixing ratio on pressure levels and the total
column, at 12:00 UTC each day, asked for every three degrees. It is a reanalysis: measurements
taken into a model of the air, which carries the ozone where nothing was measured.

For each column of air, each day:

- the partial pressure of ozone at each level is its mixing ratio by mass, turned to one by
  volume (the air's molar mass over ozone's), times the level's pressure;
- the surface's lower and upper heights are where that crosses 12 mPa, going up from the lowest
  level and down from the highest, taken as a straight line between the levels either side;
  where no level reaches 12 mPa there is no surface;
- a level's height is the log-pressure height, 7 km for each fall of the pressure by e from
  1000 hPa: within about a kilometre of the true height in the stratosphere, which changes
  with the season and the place.

Ten levels from 200 to 5 hPa (some 11 to 37 km) are read, three to five kilometres apart: the
surface's heights are no finer than that.

Written: one PNG a year, its days one under the other, each pixel a column of air (red its
lower height, green its upper, blue its total ozone; red 0 where there is no surface), and
``shell.json`` naming them, with each day's area of the south under 220 Dobson units.

Fetching needs the same account and key as ``ozone-msr``, with the Atmosphere Data Store's terms
accepted. The store makes each file afresh, so a season is pinned by a checksum over its
numbers, not its bytes.
"""

from __future__ import annotations

import hashlib
import io
import json
import math
import time
import urllib.request
import zipfile
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import TYPE_CHECKING

import h5py
import numpy as np
from PIL import Image

if TYPE_CHECKING:
    from histeclipse_pipeline.sky import Json

type Grid = np.typing.NDArray[np.float64]

DATASET = "cams-global-reanalysis-eac4"
API = "https://ads.atmosphere.copernicus.eu/api/retrieve/v1"
SOURCE = "https://doi.org/10.24381/d58bbf47"
LICENCE = "CC BY 4.0"
CREDIT = (
    "CAMS global reanalysis, EAC4 (Inness et al. 2019, Atmos. Chem. Phys. 19, 3515,"
    " doi:10.5194/acp-19-3515-2019), Copernicus Atmosphere Monitoring Service, Atmosphere Data"
    " Store (doi:10.24381/d58bbf47), CC BY 4.0; the surface where ozone's partial pressure is"
    " 12 mPa and the total ozone, each day at 12:00 UTC every three degrees, worked out for this"
    " site. Contains modified Copernicus Atmosphere Monitoring Service information; neither the"
    " European Commission nor ECMWF is responsible for any use of it"
)

#: The years written, and each one's days: 1 July to 31 December.
YEARS = range(2003, 2026)
FIRST_DAY = (7, 1)
LAST_DAY = (12, 31)
#: The levels read, hPa, lowest first.
LEVELS = (200.0, 150.0, 100.0, 70.0, 50.0, 30.0, 20.0, 10.0, 7.0, 5.0)
STEP_DEG = 3.0
ROWS, COLUMNS = 61, 120

#: The surface drawn: where ozone's partial pressure is this, mPa.
SURFACE_MPA = 12.0
#: The log-pressure height: this many km for each fall of the pressure by e from 1000 hPa.
SCALE_HEIGHT_KM = 7.0
SURFACE_HPA = 1000.0
#: The molar masses of dry air and of ozone, g/mol.
AIR_G_MOL = 28.9644
OZONE_G_MOL = 47.9982
#: One Dobson unit of ozone, kg/m².
DOBSON_KG_M2 = 2.1415e-5

#: A height's byte b stands for ``HEIGHT_OFFSET_KM + b * HEIGHT_STEP_KM``; 0 for no surface.
HEIGHT_OFFSET_KM = 10.0
HEIGHT_STEP_KM = 0.1
#: Total ozone's byte b stands for ``OFFSET_DU + b * STEP_DU``.
OFFSET_DU = 100.0
STEP_DU = 2.0
HOLE_DU = 220.0
HOLE_NORTHMOST = -40.0
EARTH_KM = 6371.0
NOON = 12

#: Each season's checksum over its numbers (``digest``), by year.
PINS: dict[int, str] = {
    2003: "d4d864790e1a2b9dc375363ab8fefeecb404a04ae3ed129a484c46ed33451716",
    2004: "f981caba8ea83d35bc311116a440a6321687314a8d0de00eb8394425d6f84260",
    2005: "dd99c5c68bc9f52f53f84f308b5d09c70402a1f2be8c4102d4dfa64f19bddc5f",
    2006: "077036f6c6c985019575ac1f939d136a57b5cf4c266e53b12ab21ee38335da50",
    2007: "0c00022ec4553c111b56fa6fdccc4a1243dca0a479eadcb1b5b87ddea3e3fa18",
    2008: "8c38b1277a248f70e3dc714cb068f59696b314981e14b22411d971f6544f5f85",
    2009: "4b150f3cff916b8540bbfc3434ad6ec1b73ff6a9fc6b7de1337b1ec4ca1d0f21",
    2010: "e0a627e649945f06c32dab3569580ebf788c03829c05a230b264c5068a390ab0",
    2011: "2f8f2ec2cac78a8163d9ce149dad3c0efb969e4cb00348d29ef8ce8dbebac0fc",
    2012: "b8036a508d679166d3bc3d2afef36ecb66f927571f4e0b7d27fc8d7d57912e70",
    2013: "f11b1d3836a2513f22db8be77153d184dce339a5a697b7d10103ed6e7eb82865",
    2014: "0bd96a375df91965cd90883d6739d19f10cfa91855a9ef284978a8fc657dd58b",
    2015: "71b89e512c8f0ef389ac3bddc077fce539d9ec168300332557ab501fed6a5099",
    2016: "cf48a529e76819b822a9fee3b7e798f1817b05401f238e784537ce565286b9b7",
    2017: "11ba454f0d1124cee5994fa1ad85d33efd6cc815b0da2a77d25f3e4446c3b3f0",
    2018: "3a1daa74e6df8109729e9811ce489124b67fd575bf88663bb5fbf7445b20b473",
    2019: "67082f61dcbc6518febebf9897ea37440a4a6faefe3c6d15cafbcea4e039e323",
    2020: "126c1e35f4d0c119e68ab2b48ac2f238a9844adeac11f918fe21702d8a39f7f8",
    2021: "f9379abe568bf9d21b771b36093d3bd52b2e264ea89f9a1502cd5ec6219359e2",
    2022: "a38e428717c6124929c05d798fe146090db4a782fb0b4d1e51efa23bc7eac674",
    2023: "2ef645aec9c6512c7eae85bd3feb9d5ef6ac2f12096a73cf705d7d5a6aee95da",
    2024: "d9399edfbfd3e2a7b0e3957d3ec0cc126f7bf8b646486d0007c9d304c0943468",
    2025: "d28e7d074f60c92e788c5e48f5c8d1ef028a3cbee0a46566d129691b7cb80166",
}


def request(year: int) -> dict[str, Json]:
    """Give what the Atmosphere Data Store is asked for: a year's season, every three degrees."""
    first, last = date(year, *FIRST_DAY), date(year, *LAST_DAY)
    return {
        "variable": ["ozone", "total_column_ozone"],
        "pressure_level": [f"{level:g}" for level in LEVELS],
        "date": [f"{first.isoformat()}/{last.isoformat()}"],
        "time": ["12:00"],
        "grid": [f"{STEP_DEG}", f"{STEP_DEG}"],
        "data_format": "netcdf_zip",
    }


@dataclass(frozen=True)
class Season:
    """A season's days as read: the first day, and each day's fields from 90°N and 0°E."""

    first: date
    #: The levels' pressures, hPa, lowest (highest pressure) first.
    levels: Grid
    #: Ozone's mass mixing ratio, kg/kg: day, level, row, column.
    ozone: Grid
    #: Total ozone, kg/m²: day, row, column.
    column: Grid


def _axes(opened: h5py.File, what: str) -> None:
    latitude = np.asarray(opened["latitude"][()], dtype=np.float64)
    longitude = np.asarray(opened["longitude"][()], dtype=np.float64)
    wanted_latitude = np.linspace(90.0, -90.0, ROWS)
    wanted_longitude = np.arange(COLUMNS) * STEP_DEG
    if latitude.shape != wanted_latitude.shape or longitude.shape != wanted_longitude.shape:
        msg = f"{what}: not the three-degree grid"
        raise ValueError(msg)
    if not (np.allclose(latitude, wanted_latitude) and np.allclose(longitude, wanted_longitude)):
        msg = f"{what}: the grid does not run from 90°N and 0°E"
        raise ValueError(msg)


def _days(opened: h5py.File, what: str) -> date:
    seconds = np.asarray(opened["valid_time"][()], dtype=np.int64).tolist()  # pyright: ignore[reportAny]
    moments = [datetime.fromtimestamp(int(each), tz=UTC) for each in seconds]  # pyright: ignore[reportAny]
    for index, moment in enumerate(moments):
        if moment.hour != NOON or moment.date() != moments[0].date() + timedelta(days=index):
            msg = f"{what}: not one field a day at 12:00 UTC"
            raise ValueError(msg)
    return moments[0].date()


def read_season(archive: bytes) -> Season:
    """Read a season's archive: the levels' file and the total column's."""
    with zipfile.ZipFile(io.BytesIO(archive)) as packed:
        levels_file = packed.read("data_plev.nc")
        column_file = packed.read("data_sfc.nc")
    with h5py.File(io.BytesIO(levels_file), "r") as opened:
        _axes(opened, "the levels")
        first = _days(opened, "the levels")
        levels = np.asarray(opened["pressure_level"][()], dtype=np.float64)
        ozone = np.asarray(opened["go3"][()], dtype=np.float64)
    with h5py.File(io.BytesIO(column_file), "r") as opened:
        _axes(opened, "the total column")
        if _days(opened, "the total column") != first:
            msg = "the total column starts on another day than the levels"
            raise ValueError(msg)
        column = np.asarray(opened["gtco3"][()], dtype=np.float64)
    if levels.tolist() != list(LEVELS):
        msg = f"the levels are {levels.tolist()}, not {list(LEVELS)}"
        raise ValueError(msg)
    if ozone.shape != (column.shape[0], len(LEVELS), ROWS, COLUMNS) or column.shape[1:] != (
        ROWS,
        COLUMNS,
    ):
        msg = "the fields are not a day by the levels by the grid"
        raise ValueError(msg)
    return Season(first, levels, ozone, column)


def digest(season: Season) -> str:
    """Give one checksum over a season's numbers, whatever file they came in."""
    total = hashlib.sha256(season.first.isoformat().encode())
    total.update(season.levels.astype("<f8").tobytes())
    total.update(season.ozone.astype("<f4").tobytes())
    total.update(season.column.astype("<f4").tobytes())
    return total.hexdigest()


def height_km(pressure_hpa: Grid) -> Grid:
    """Give the log-pressure height of a pressure: 7 km for each fall by e from 1000 hPa."""
    heights: Grid = SCALE_HEIGHT_KM * np.log(SURFACE_HPA / pressure_hpa)
    return heights


def partial_pressure(ozone: Grid, levels: Grid) -> Grid:
    """Turn ozone's mass mixing ratio on levels (hPa, the second axis) to its pressure, mPa."""
    by_volume = ozone * (AIR_G_MOL / OZONE_G_MOL)
    # hPa to mPa: 100 Pa in a hPa, 1000 mPa in a Pa.
    pressures: Grid = by_volume * levels[None, :, None, None] * 1e5
    return pressures


def _crossing(low: Grid, high: Grid, z_low: Grid, z_high: Grid) -> Grid:
    """Give the height where the pressure crosses the surface's, between two levels."""
    span = high - low
    share: Grid = np.divide(SURFACE_MPA - low, span, out=np.zeros_like(low), where=span != 0)  # pyright: ignore[reportAny]
    heights: Grid = z_low + np.clip(share, 0.0, 1.0) * (z_high - z_low)
    return heights


def surface(pressures: Grid, levels: Grid) -> tuple[Grid, Grid]:
    """Give the surface's lower and upper heights, km, for each day and column; NaN where none.

    ``pressures`` is ozone's partial pressure, mPa: day, level (lowest first), row, column.
    """
    heights = height_km(levels)
    holds = pressures >= SURFACE_MPA
    reached = holds.any(axis=1)
    count = len(levels)
    lowest = np.argmax(holds, axis=1)
    highest = count - 1 - np.argmax(holds[:, ::-1], axis=1)

    def at(index: np.typing.NDArray[np.intp]) -> tuple[Grid, Grid]:
        picked: Grid = np.take_along_axis(pressures, index[:, None], axis=1)[:, 0]
        return picked, heights[index]

    below, z_below = at(np.maximum(lowest - 1, 0))
    first, z_first = at(lowest)
    last, z_last = at(highest)
    above, z_above = at(np.minimum(highest + 1, count - 1))
    # At the lowest or highest level read, the surface is put at that level.
    lower = np.where(lowest == 0, z_first, _crossing(below, first, z_below, z_first))  # pyright: ignore[reportAny]
    upper = np.where(highest == count - 1, z_last, _crossing(above, last, z_above, z_last))  # pyright: ignore[reportAny]
    return np.where(reached, lower, np.nan), np.where(reached, upper, np.nan)


def dobson(column: Grid) -> Grid:
    """Turn total ozone from kg/m² to Dobson units."""
    units: Grid = column / DOBSON_KG_M2
    return units


def below_mkm2(units: Grid) -> list[float]:
    """Give each day's area of the south under 220 Dobson units, million km²."""
    latitude = np.linspace(90.0, -90.0, ROWS)
    half = STEP_DEG / 2
    edges: Grid = np.sin(
        np.radians(np.clip(np.linspace(90.0 + half, -90.0 - half, ROWS + 1), -90, 90))
    )
    cell: Grid = EARTH_KM**2 * math.radians(STEP_DEG) * (edges[:-1] - edges[1:])
    south = latitude <= HOLE_NORTHMOST
    under = (units < HOLE_DU) & south[None, :, None]
    areas: Grid = (under * cell[None, :, None]).sum(axis=(1, 2)) / 1e6
    return [round(float(area), 1) for area in areas.tolist()]  # pyright: ignore[reportAny]


def _height_bytes(heights: Grid) -> np.typing.NDArray[np.uint8]:
    steps = np.rint((heights - HEIGHT_OFFSET_KM) / HEIGHT_STEP_KM)
    return np.where(np.isnan(heights), 0, np.clip(steps, 1, 255)).astype(np.uint8)


def to_png(lower: Grid, upper: Grid, units: Grid) -> bytes:
    """Pack a season: its days one under the other; red lower, green upper, blue total ozone."""
    ozone = np.clip(np.rint((units - OFFSET_DU) / STEP_DU), 1, 255).astype(np.uint8)
    pixels = np.stack([_height_bytes(lower), _height_bytes(upper), ozone], axis=-1)
    days = pixels.shape[0]  # pyright: ignore[reportAny]
    out = io.BytesIO()
    Image.fromarray(pixels.reshape(days * ROWS, COLUMNS, 3), mode="RGB").save(  # pyright: ignore[reportAny]
        out, format="PNG", optimize=True
    )
    return out.getvalue()


def season_entry(season: Season, units: Grid) -> dict[str, Json]:
    """Describe one season for the index."""
    year = season.first.year
    areas: list[Json] = list(below_mkm2(units))
    return {
        "year": year,
        "file": f"shell-{year}.png",
        "first": season.first.isoformat(),
        "days": int(season.column.shape[0]),  # pyright: ignore[reportAny]
        "belowMkm2": areas,
    }


def index_file(seasons: list[dict[str, Json]]) -> dict[str, Json]:
    """Make the index of the seasons written, with whom to credit and how to read them."""
    levels: list[Json] = list(LEVELS)
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "licence": LICENCE,
        "surfaceMPa": SURFACE_MPA,
        "holeDU": HOLE_DU,
        "levelsHPa": levels,
        "scaleHeightKm": SCALE_HEIGHT_KM,
        "grid": {"rows": ROWS, "columns": COLUMNS, "stepDeg": STEP_DEG, "north": 90.0, "west": 0.0},
        "encoding": {
            "heightOffsetKm": HEIGHT_OFFSET_KM,
            "heightStepKm": HEIGHT_STEP_KM,
            "offsetDU": OFFSET_DU,
            "stepDU": STEP_DU,
        },
        "seasons": list(seasons),
    }


def write_season(season: Season, folder: Path) -> dict[str, Json]:
    """Write a season's PNG to ``folder`` and describe it."""
    lower, upper = surface(partial_pressure(season.ozone, season.levels), season.levels)
    units = dobson(season.column)
    name = f"shell-{season.first.year}.png"
    _ = (folder / name).write_bytes(to_png(lower, upper, units))
    return season_entry(season, units)


def build(seasons: list[Season], folder: Path) -> int:
    """Write each season and the index to ``folder``; give how many seasons."""
    folder.mkdir(parents=True, exist_ok=True)
    entries = [write_season(season, folder) for season in seasons]
    text = json.dumps(index_file(entries), separators=(",", ":"), ensure_ascii=False)
    _ = (folder / "shell.json").write_text(text + "\n")
    return len(entries)


def _key() -> str:  # pragma: no cover - reads the user's own file
    for line in (Path.home() / ".cdsapirc").read_text().splitlines():
        name, _, value = line.partition(":")
        if name.strip() == "key":
            return value.strip()
    msg = "~/.cdsapirc has no key"
    raise ValueError(msg)


def _call(url: str, key: str, body: Json = None) -> dict[str, Json]:  # pragma: no cover - network
    asked = urllib.request.Request(  # noqa: S310
        url,
        data=None if body is None else json.dumps(body).encode(),
        headers={"PRIVATE-TOKEN": key, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(asked, timeout=120) as response:  # noqa: S310  # pyright: ignore[reportAny]
        answer: object = json.loads(response.read())  # pyright: ignore[reportAny]
    if not isinstance(answer, dict):
        msg = f"{url}: not an object"
        raise TypeError(msg)
    return answer  # pyright: ignore[reportUnknownVariableType]


def _retrieve(year: int, key: str) -> bytes:  # pragma: no cover - needs network access
    job = _call(f"{API}/processes/{DATASET}/execution", key, {"inputs": request(year)})
    while True:
        status = _call(f"{API}/jobs/{job['jobID']}", key)["status"]
        if status == "successful":
            break
        if status == "failed":
            msg = f"the Atmosphere Data Store could not make {year}"
            raise RuntimeError(msg)
        time.sleep(10)
    results = _call(f"{API}/jobs/{job['jobID']}/results", key)
    asset = results["asset"]
    if not isinstance(asset, dict) or not isinstance(asset["value"], dict):
        msg = "the Atmosphere Data Store's answer names no file"
        raise TypeError(msg)
    with urllib.request.urlopen(str(asset["value"]["href"]), timeout=1800) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = "the Atmosphere Data Store's file is not bytes"
        raise TypeError(msg)
    return body


def fetch_ozone_shell(folder: Path, cache: Path) -> int:  # pragma: no cover - needs network access
    """Fetch each season once into ``cache``, check it, and write the surfaces to ``folder``."""
    cache.mkdir(parents=True, exist_ok=True)
    seasons: list[Season] = []
    for year in YEARS:
        kept = cache / f"eac4-{year}.zip"
        if not kept.exists():
            _ = kept.write_bytes(_retrieve(year, _key()))
        season = read_season(kept.read_bytes())
        found = digest(season)
        if found != PINS.get(year):
            msg = f"{kept.name}: its numbers' SHA-256 {found} does not match the pinned one"
            raise ValueError(msg)
        seasons.append(season)
    return build(seasons, folder)
