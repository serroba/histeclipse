"""The ocean's currents each month since 1940, near the surface and at 1,500 m (#927).

IAP's gridded geostrophic currents (Cheng and Zhu 2016 and the IAP ocean analysis; the velocity
in balance with the pressure field its temperature and salinity give) are one classic NetCDF-3
file a month, January 1940 to December 2021, about 21 MB each with 41 depths to 2,000 m. The two
kept here are the AMOC's two limbs: near the surface (1 m), where warm water flows north in the
Gulf Stream, and 1,500 m, where cold water returns south along the western boundary.

Each file is read in memory and only those two depths kept (``.cache/ocean-currents/``, about
1 MB a month), so the raw 21 GB never sits on the disk; the files are pinned together by one
checksum of their names and SHA-256s (:func:`manifest`), as ``ocean_heat_map`` pins its months.

Geostrophy fails near the equator, where the Coriolis force goes to zero: IAP's velocities there
run to tens of metres a second. Within ``EQUATOR`` degrees of it the currents are left out.

Each month and depth is one image on the site's node-registered 1° grid (``krapp.regrid``): R
the eastward current and G the northward, each from ``-bound`` (0) to ``+bound`` (255) m/s,
clipped beyond; B 128; A 255 where there is a current. The site moves particles along them.
"""

import datetime as dt
import hashlib
import io
import json
import urllib.request
import zipfile
from dataclasses import dataclass
from typing import TYPE_CHECKING, cast

import numpy as np
from PIL import Image

from histeclipse_pipeline.krapp import regrid
from histeclipse_pipeline.netcdf3 import read_netcdf3
from histeclipse_pipeline.paleotemp import COLUMNS, ROWS

if TYPE_CHECKING:
    from collections.abc import Iterable
    from pathlib import Path

    import numpy.typing as npt
    from numpy.lib.npyio import NpzFile

    from histeclipse_pipeline.krapp import Grid
    from histeclipse_pipeline.sky import Json

#: An array as kept in the cache, any dtype; an archive of them as ``np.load`` opens it.
type Stored = npt.NDArray[np.float32 | np.float64 | np.str_]
type Archive = NpzFile[np.float32 | np.float64 | np.str_]

BASE_URL = "http://www.ocean.iap.ac.cn/ftp/cheng/IAP_Ocean_geostrophic_current_0_2000m/"
SOURCE = "http://www.ocean.iap.ac.cn/pages/dataService/dataService.html"
#: The SHA-256 of the manifest of all 984 files (January 1940 to December 2021), as served on
#: 20 November 2026; IAP last changed them in May 2022.
MANIFEST_SHA256 = "f071a9ad7228af82bb3e270ca649ff8b2c9fb3cfaa76584f365ed04c8b4b49a4"
FIRST = (1940, 1)
LAST = (2021, 12)
MONTHS = 12
#: The depths kept: name, metres, and the colour and packing bound, m/s.
DEPTHS: tuple[tuple[str, float, float], ...] = (("surface", 1.0, 1.0), ("1500m", 1500.0, 0.2))
#: Degrees either side of the equator where geostrophic currents are left out.
EQUATOR = 3.0
#: Anything this large is a fill value or a blow-up, m/s.
_MISSING_FROM = 50.0
CREDIT = (
    "IAP gridded geostrophic currents, 0-2000 m (Cheng and Zhu 2016, Journal of Climate 29, "
    "5393; Institute of Atmospheric Physics, Chinese Academy of Sciences), no licence stated; "
    "two depths kept, left out near the equator, averaged onto a 1° grid and packed into 8-bit "
    "images for this site"
)
LICENCE = "none stated; freely available from the IAP, credited"


def month_name(year: int, month: int) -> str:
    """Name IAP's file for a month, e.g. ``CZ16_1_2000m_GV_year_1940_month_1.nc``."""
    return f"CZ16_1_2000m_GV_year_{year}_month_{month}.nc"


def all_months() -> list[tuple[int, int]]:
    """Every month from ``FIRST`` to ``LAST``."""
    return [
        (year, month)
        for year in range(FIRST[0], LAST[0] + 1)
        for month in range(1, MONTHS + 1)
        if FIRST <= (year, month) <= LAST
    ]


def manifest(entries: Iterable[tuple[str, str]]) -> bytes:
    """List each file's name and SHA-256, one a line, in the order given; pinned as a whole."""
    return "".join(f"{name} {sha256}\n" for name, sha256 in entries).encode()


@dataclass(frozen=True)
class Currents:
    """One month's eastward and northward currents at each depth kept (m/s, NaN where none)."""

    u: dict[str, Grid]
    v: dict[str, Grid]
    latitude: Grid
    longitude: Grid


def cleaned(values: Grid, latitude: Grid) -> Grid:
    """Leave out fill values, blow-ups and the band round the equator."""
    near = np.fabs(latitude)[:, None] < EQUATOR
    bad = ~np.isfinite(values) | (np.fabs(values) >= _MISSING_FROM) | near
    return np.asarray(np.where(bad, np.nan, values), np.float64)


def read_currents(data: bytes) -> Currents:
    """Read one of IAP's monthly files, keeping the depths in ``DEPTHS``."""
    variables, _ = read_netcdf3(data)
    latitude = variables["lat"].values
    longitude = variables["lon"].values
    depths: list[float] = variables["depth"].values.tolist()  # pyright: ignore[reportAny]
    u: dict[str, Grid] = {}
    v: dict[str, Grid] = {}
    for name, metres, _ in DEPTHS:
        if metres not in depths:
            msg = f"no level at {metres} m"
            raise ValueError(msg)
        at = depths.index(metres)
        u[name] = cleaned(np.asarray(variables["u"].values[:, :, at], np.float64), latitude)
        v[name] = cleaned(np.asarray(variables["v"].values[:, :, at], np.float64), latitude)
    return Currents(u, v, latitude, longitude)


def pack(u: Grid, v: Grid, bound: float) -> bytes:
    """Pack a depth's currents: R eastward, G northward, from -bound to +bound; A where known."""
    known = np.isfinite(u) & np.isfinite(v)

    def byte(values: Grid) -> Grid:
        scaled = (np.clip(np.where(known, values, 0.0), -bound, bound) + bound) / (2 * bound)
        return np.asarray(np.round(scaled * 255), np.float64)

    rgba = np.stack(
        [
            byte(u).astype(np.uint8),
            byte(v).astype(np.uint8),
            np.full(u.shape, 128, dtype=np.uint8),
            np.where(known, 255, 0).astype(np.uint8),
        ],
        axis=-1,
    )
    out = io.BytesIO()
    Image.fromarray(rgba).save(out, "PNG", optimize=True)
    return out.getvalue()


def stamp(year: int, month: int) -> str:
    """Write a month as ``YYYY-MM``."""
    return f"{year:04d}-{month:02d}"


def write_month(currents: Currents, when: tuple[int, int], folder: Path) -> None:
    """Write a month's image at each depth, on the 1° nodes."""
    for name, _, bound in DEPTHS:
        u = regrid(currents.u[name], currents.latitude, currents.longitude)
        v = regrid(currents.v[name], currents.latitude, currents.longitude)
        place = folder / name
        place.mkdir(parents=True, exist_ok=True)
        _ = (place / f"{stamp(*when)}.png").write_bytes(pack(u, v, bound))


def index_file(accessed: str) -> dict[str, Json]:
    """Build the manifest the web app reads."""
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "paper": "https://doi.org/10.1175/JCLI-D-15-0730.1",
        "licence": LICENCE,
        "accessed": accessed,
        "units": "m/s",
        "encoding": "R eastward, G northward, each from -bound to +bound; B 128; A current",
        "files": "<depth>/YYYY-MM.png",
        "first": stamp(*FIRST),
        "last": stamp(*LAST),
        "equator": EQUATOR,
        "columns": COLUMNS,
        "rows": ROWS,
        "depths": [
            {"id": name, "metres": metres, "bound": bound} for name, metres, bound in DEPTHS
        ],
    }


def cached_month(cache: Path, name: str) -> tuple[Currents, str] | None:
    """Read a month's kept depths and its file's SHA-256 from the cache, if there."""
    path = cache / f"{name}.npz"
    if not path.exists():
        return None
    try:
        return _read_cached(path)
    except OSError, ValueError, KeyError, EOFError:
        # A file cut short (by a run stopped before files were written whole): fetch it again.
        return None


def _read_cached(path: Path) -> tuple[Currents, str]:
    """Read one cached month."""
    with cast("Archive", np.load(path)) as held:
        currents = Currents(
            {each: np.asarray(held[f"u_{each}"], np.float64) for each, _, _ in DEPTHS},
            {each: np.asarray(held[f"v_{each}"], np.float64) for each, _, _ in DEPTHS},
            np.asarray(held["latitude"], np.float64),
            np.asarray(held["longitude"], np.float64),
        )
        return currents, str(held["sha256"])


def keep_month(cache: Path, name: str, currents: Currents, sha256: str) -> None:
    """Keep a month's two depths (float32) and its file's SHA-256 in the cache."""
    cache.mkdir(parents=True, exist_ok=True)
    arrays: dict[str, Stored] = {
        **{f"u_{each}": currents.u[each].astype(np.float32) for each, _, _ in DEPTHS},
        **{f"v_{each}": currents.v[each].astype(np.float32) for each, _, _ in DEPTHS},
        "latitude": currents.latitude,
        "longitude": currents.longitude,
        "sha256": np.array(sha256),
    }
    # Written whole under another name, then renamed: a run stopped midway leaves no half file.
    # The archive is what ``np.savez_compressed`` writes, one ``.npy`` member an array.
    partial = cache / f"{name}.partial"
    with zipfile.ZipFile(partial, "w", zipfile.ZIP_DEFLATED) as out:
        for key, array in arrays.items():
            with out.open(f"{key}.npy", "w") as member:
                np.lib.format.write_array(member, array)
    _ = partial.replace(cache / f"{name}.npz")


def write_index(folder: Path, accessed: str) -> None:
    """Write the index, which makes the maps usable: only once every month is in and pinned."""
    folder.mkdir(parents=True, exist_ok=True)
    _ = (folder / "index.json").write_text(
        json.dumps(index_file(accessed), separators=(",", ":"), ensure_ascii=False) + "\n"
    )


def _download(name: str) -> bytes:  # pragma: no cover - needs network access
    # The URL is the pinned BASE_URL; the manifest's checksum guards the files.
    url = BASE_URL + name
    request = urllib.request.Request(url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
    with urllib.request.urlopen(request, timeout=600) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: bytes = response.read()  # pyright: ignore[reportAny]
    return body


#: Files fetched at once: IAP's server gives each connection little, but serves several.
WORKERS = 12


def prefetch(cache: Path) -> None:  # pragma: no cover - needs network access
    """Fetch the months not yet cached, several at a time, keeping their two depths."""
    from concurrent.futures import ThreadPoolExecutor  # noqa: PLC0415

    def one(name: str) -> None:
        if cached_month(cache, name) is not None:
            return
        data = _download(name)
        keep_month(cache, name, read_currents(data), hashlib.sha256(data).hexdigest())

    names = [month_name(year, month) for year, month in all_months()]
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for _ in pool.map(one, names):
            pass


def fetch_ocean_currents(folder: Path, cache: Path) -> int:  # pragma: no cover - needs network
    """Write every month's maps, then write the index once the manifest matches its pin.

    Each month comes from the cache, else from IAP (and is then cached).
    """
    prefetch(cache)
    entries: list[tuple[str, str]] = []
    for year, month in all_months():
        name = month_name(year, month)
        held = cached_month(cache, name)
        if held is None:
            data = _download(name)
            currents = read_currents(data)
            sha256 = hashlib.sha256(data).hexdigest()
            keep_month(cache, name, currents, sha256)
        else:
            currents, sha256 = held
        write_month(currents, (year, month), folder)
        entries.append((name, sha256))
    found = hashlib.sha256(manifest(entries)).hexdigest()
    if found != MANIFEST_SHA256:
        msg = f"IAP geostrophic currents: manifest SHA-256 {found}, pinned {MANIFEST_SHA256!r}"
        raise ValueError(msg)
    write_index(folder, dt.datetime.now(tz=dt.UTC).date().isoformat())
    return len(entries)
