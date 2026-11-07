"""Volcanic eruptions of the Holocene as the ice cores record them: HolVol v1.0 (#274).

Sigl et al. (2022) stacked sulfate records from Greenland and Antarctic ice cores, dated on the
WD2014 chronology, into 1,384 eruptions from 9500 BCE to 1900 CE, each with the sulfur it put
into the stratosphere (Tg S) and its 1-sigma uncertainty. PANGAEA publishes it (CC BY 4.0) as a
small netCDF-4 (HDF5) file, pinned here by checksum.

Most eruptions are known only from the ice: the authors give those a typical latitude for the
region the sulfate's spread points to (5° N for the tropics, 48° N or 37° S for the northern or
southern extratropics, 64° N for long Icelandic episodes). Any other latitude is a volcano they
matched, but the file gives no name and rounds the latitude to a degree, so names cannot be read
from it; the site names only those its sources state. Months are January for nearly all, a
placeholder, so only the year is kept. Years are astronomical (with a year 0), as the site's.
"""

import datetime as dt
import io
import json
import urllib.request
from typing import TYPE_CHECKING

import h5py
import numpy as np

from histeclipse_pipeline.sky import verified

if TYPE_CHECKING:
    from pathlib import Path

    from histeclipse_pipeline.sky import Json

HOLVOL_URL = (
    "https://download.pangaea.de/dataset/928646/files/"
    "HolVol_volcanic_stratospheric_sulfur_injection_v1.0.nc"
)
HOLVOL_SHA256 = "11cead518f906343f7bbc45d264d246c1a13755a93f40160f62a58de5d27d6cd"
USER_AGENT = "histeclipse-pipeline (https://github.com/serroba/histeclipse)"

#: The latitudes the authors give eruptions with no known volcano, and what each means.
PLACEHOLDER_REGIONS = {5.0: "tropics", 48.0: "north", -37.0: "south", 64.0: "iceland"}


def region_of(latitude: float) -> str:
    """Where the ice cores place an eruption: a region, or ``located`` for a matched volcano."""
    return PLACEHOLDER_REGIONS.get(latitude, "located")


def read_holvol(data: bytes) -> list[dict[str, Json]]:
    """Read the eruptions, oldest first: year, latitude, region, sulfur and its sigma."""
    with h5py.File(io.BytesIO(data)) as file:
        columns: list[list[float]] = [
            file[name][()].astype(np.float64).tolist()
            for name in ("year", "lat", "vssi", "sigma_vssi")
        ]
    years, latitudes, sulfurs, sigmas = columns
    eruptions = sorted(
        zip(years, latitudes, sulfurs, sigmas, strict=True),
        key=lambda row: (row[0], -row[2]),
    )
    if not eruptions:
        msg = "no eruptions in the file"
        raise ValueError(msg)
    return [
        {
            "year": round(year),
            "latitude": latitude,
            "region": region_of(latitude),
            "sulfur": round(sulfur, 2),
            "sigma": round(sigma, 2),
        }
        for year, latitude, sulfur, sigma in eruptions
    ]


def eruptions_file(rows: list[dict[str, Json]], accessed: str) -> dict[str, Json]:
    """Build the site's file: the eruptions as columns, oldest first."""
    regions = sorted({str(row["region"]) for row in rows})
    return {
        "schemaVersion": 1,
        "accessed": accessed,
        "credit": (
            "HolVol v1.0 (Sigl, Toohey, McConnell, Cole-Dai & Severi 2021), PANGAEA, CC BY 4.0"
        ),
        "source": "https://doi.org/10.1594/PANGAEA.928646",
        "regions": list(regions),
        "year": [row["year"] for row in rows],
        "latitude": [row["latitude"] for row in rows],
        "region": [regions.index(str(row["region"])) for row in rows],
        "sulfur": [row["sulfur"] for row in rows],
        "sigma": [row["sigma"] for row in rows],
    }


def _download(url: str) -> bytes:  # pragma: no cover - needs network access
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})  # noqa: S310
    with urllib.request.urlopen(request, timeout=120) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{url}: expected bytes"
        raise TypeError(msg)
    return body


def fetch_eruptions(path: Path) -> int:  # pragma: no cover - needs network access
    """Download HolVol, check it against its pinned checksum, and write the site's file."""
    rows = read_holvol(verified(_download(HOLVOL_URL), HOLVOL_SHA256, "HolVol"))
    made = dt.datetime.now(tz=dt.UTC).date().isoformat()
    path.parent.mkdir(parents=True, exist_ok=True)
    built = eruptions_file(rows, made)
    _ = path.write_text(json.dumps(built, separators=(",", ":")) + "\n")
    return len(rows)
