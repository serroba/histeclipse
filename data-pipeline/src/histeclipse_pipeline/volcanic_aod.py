"""Volcanic stratospheric aerosol optical depth at 550 nm, from ice-core reconstructions (#536).

The sulfur an eruption puts into the stratosphere (``natural_forcing.py``'s eVolv2k file) becomes
a veil of sulfate aerosol that dims the Sun. Its stratospheric aerosol optical depth (SAOD) at
550 nm is what climate models are driven with. This writes it as annual means, global and by
latitude band, so that reconstructions can be set side by side rather than merged:

- ``volcanic-aod-holvol.json``: HolVol v1.0 (Sigl et al. 2022, Earth Syst. Sci. Data 14, 3167,
  doi:10.5194/essd-14-3167-2022; data on PANGAEA, doi:10.1594/PANGAEA.928646, CC BY 4.0). The
  authors ran the Easy Volcanic Aerosol model (EVA v1.2; Toohey et al. 2016, Geosci. Model
  Dev. 9, 4049) on HolVol's sulfur injections, giving monthly zonal-mean SAOD on the 96
  latitudes of ECHAM's T63 grid from 9500 BCE to 1900 CE. EVA adds a constant pre-industrial
  background (its ``piBG`` parameter set), so no year reads zero. The file is a 100 MB classic
  NetCDF-3 file: it is downloaded, reduced and discarded. Years are those of the ice-core
  chronology and most eruptions' months are placeholders, so a veil can begin a year after the
  eruption itself (Krakatau, August 1883, shows from 1884).

Means over latitude weight each grid latitude by its cosine (the share of the Earth's surface it
stands for; ECHAM's Gaussian weights differ from this by under 0.1%). Each year is the plain mean
of its twelve months. Years are the file's: astronomical, with a year 0.

The eVolv2k v3 SAOD, the PMIP4 past1000 forcing, is only on WDC-Climate behind an account and is
not on input4MIPs, so it is not read here. The CMIP6 historical stratospheric aerosol
(input4MIPs IACETH-SAGE3lambda) gives no optical depth, only extinction profiles that a model
integrates from its own tropopause, so it is not read either.
"""

import datetime as dt
import json
import math
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

import numpy as np
import numpy.typing as npt

from histeclipse_pipeline.netcdf3 import read_netcdf3
from histeclipse_pipeline.sky import verified

if TYPE_CHECKING:
    from pathlib import Path

    from histeclipse_pipeline.sky import Json

type Grid = npt.NDArray[np.float64]

USER_AGENT = "histeclipse-pipeline (https://github.com/serroba/histeclipse)"

HOLVOL_URL = "https://download.pangaea.de/dataset/928646/files/HolVol_SAOD_-9500_1900_v1.0.nc"
HOLVOL_SHA256 = "affdcdb20129ebbfe15b7991f86953524b6f597a920a245ce09f7bda8f4ea4e3"
HOLVOL_SOURCE = "https://doi.org/10.1594/PANGAEA.928646"
HOLVOL_CREDIT = (
    "HolVol v1.0 stratospheric aerosol optical depth (Sigl et al. 2022, Earth Syst. Sci. Data), "
    "PANGAEA, CC BY 4.0"
)

#: Latitude bands, south to north edges in degrees; a latitude on an edge goes to the tropics.
BANDS: tuple[tuple[str, float, float], ...] = (
    ("north", 30.0, 90.0),
    ("tropics", -30.0, 30.0),
    ("south", -90.0, -30.0),
)
_DECIMALS = 4
_MONTHS = 12


@dataclass(frozen=True)
class Annual:
    """Annual means: the first year, the global series, and one series per band."""

    first_year: int
    global_mean: list[float]
    bands: dict[str, list[float]]


def _weighted(aod: Grid, latitudes: Grid, keep: npt.NDArray[np.bool_]) -> Grid:
    """Mean over the kept latitudes (last axis), each weighted by its cosine."""
    weights: Grid = np.where(keep, np.cos(np.radians(latitudes)), 0.0)
    total = float(weights.sum())
    if total == 0:
        msg = "no latitudes in the band"
        raise ValueError(msg)
    return np.asarray(aod @ (weights / total), dtype=np.float64)


def _in_band(latitudes: Grid, south: float, north: float) -> npt.NDArray[np.bool_]:
    if south < 0 < north:
        return (latitudes >= south) & (latitudes <= north)
    if north <= 0:
        return (latitudes >= south) & (latitudes < north)
    return (latitudes > south) & (latitudes <= north)


def annual_bands(time: Grid, latitudes: Grid, aod: Grid) -> Annual:
    """Average monthly zonal-mean AOD (time x latitude) into global and band annual means.

    ``time`` is fractional years, twelve steps to a year, starting in a year's first month.
    """
    if time.size == 0 or time.size % _MONTHS:
        msg = f"expected whole years of {_MONTHS} months, found {time.size} steps"
        raise ValueError(msg)
    stamps: list[float] = time.tolist()  # pyright: ignore[reportAny]
    steps = [math.floor(value + 1e-6) for value in stamps]
    years = steps[::_MONTHS]
    expected = [years[0] + index // _MONTHS for index in range(len(steps))]
    if steps != expected:
        msg = "months do not fall into consecutive whole years"
        raise ValueError(msg)

    def yearly(series: Grid) -> list[float]:
        grouped = np.asarray(series.reshape(-1, _MONTHS), dtype=np.float64)
        sums: list[float] = grouped.sum(axis=1).tolist()  # pyright: ignore[reportAny]
        return [round(value / _MONTHS, _DECIMALS) for value in sums]

    everywhere = np.ones(latitudes.shape, dtype=np.bool_)
    return Annual(
        first_year=years[0],
        global_mean=yearly(_weighted(aod, latitudes, everywhere)),
        bands={
            name: yearly(_weighted(aod, latitudes, _in_band(latitudes, south, north)))
            for name, south, north in BANDS
        },
    )


def read_holvol(data: bytes) -> Annual:
    """Read HolVol's SAOD file (NetCDF-3: time, lat, aod550) into annual means."""
    variables, _ = read_netcdf3(data)
    missing = {"time", "lat", "aod550"} - variables.keys()
    if missing:
        msg = f"the file lacks {sorted(missing)}"
        raise ValueError(msg)
    return annual_bands(
        variables["time"].values, variables["lat"].values, variables["aod550"].values
    )


def holvol_file(annual: Annual, accessed: str) -> dict[str, Json]:
    """Build the site's file: annual SAOD, global and by band, oldest first."""
    return {
        "schemaVersion": 1,
        "credit": HOLVOL_CREDIT,
        "source": HOLVOL_SOURCE,
        "paper": "https://doi.org/10.5194/essd-14-3167-2022",
        "accessed": accessed,
        "unit": "",
        "wavelength": 550,
        "what": (
            "stratospheric aerosol optical depth at 550 nm, annual mean, from the EVA model "
            "driven by HolVol's sulfur injections; includes EVA's constant pre-industrial "
            "background"
        ),
        "firstYear": annual.first_year,
        "global": [round(value, _DECIMALS) for value in annual.global_mean],
        "bands": [
            {
                "name": name,
                "south": south,
                "north": north,
                "aod": [round(value, _DECIMALS) for value in annual.bands[name]],
            }
            for name, south, north in BANDS
        ],
    }


def _download(url: str) -> bytes:  # pragma: no cover - needs network access
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})  # noqa: S310
    with urllib.request.urlopen(request, timeout=600) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{url}: expected bytes"
        raise TypeError(msg)
    return body


def _write(path: Path, built: dict[str, Json]) -> int:  # pragma: no cover - needs network access
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(built, separators=(",", ":"), ensure_ascii=False) + "\n"
    return path.write_text(text, encoding="utf-8")


def fetch_volcanic_aod(folder: Path) -> dict[str, int]:  # pragma: no cover - needs network
    """Download each reconstruction (checked against its checksum), reduce it, write its file."""
    accessed = dt.datetime.now(tz=dt.UTC).date().isoformat()
    holvol = read_holvol(verified(_download(HOLVOL_URL), HOLVOL_SHA256, "HolVol SAOD"))
    _ = _write(folder / "volcanic-aod-holvol.json", holvol_file(holvol, accessed))
    return {"volcanic-aod-holvol": len(holvol.global_mean)}
