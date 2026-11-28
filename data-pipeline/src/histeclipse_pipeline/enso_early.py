"""El Niño and La Niña before NOAA's indices: 1854 to 1949, from two reconstructions (#894).

NOAA's Climate Prediction Center publishes its indices from 1950 only. Before then, this site
computes the Relative Oceanic Niño Index itself, by CPC's method, from two reconstructions of the
sea's surface:

- NOAA's ERSST v6 (Huang et al. 2025), monthly on a 2° grid from 1850, the field both of CPC's
  indices are computed from; used from 1854, as NOAA's own ERSST products are;
- the Met Office Hadley Centre's HadISST 1.1 (Rayner et al. 2003), monthly on a 1° grid from
  1870, reconstructed differently; where the two part, the early sea is uncertain.

The method, CPC's for RONI: the area-weighted (cos latitude) mean of Niño 3.4 (5°N-5°S,
170°W-120°W) and of the whole tropics (20°N-20°S), each against its own calendar month's mean
over 1991-2020; Niño 3.4 less the tropics, scaled so its spread over 1950 onwards matches Niño
3.4's; a centred three-month running mean, placed at its middle month. Recomputed this way from
ERSST v6 for 1950-2026, it matches CPC's published RONI to 0.03 °C (root mean square), 0.15 °C
at most. Episodes follow NOAA's rule (``enso.episodes``) on the whole series; those that begin
before 1950 are kept, cut at December 1949.

The ERSST months before OISST's (January 1854 to August 1981) are also written as sea maps,
each against its calendar month's 1991-2020 mean, packed as ``enso_sst`` packs OISST's but on
ERSST's own 2° grid, its cell centres being the nodes of a 2° grid (91 rows by 181 columns,
90°N first, 180°W first, the last column repeating the first).
"""

import datetime as dt
import gzip
import io
import json
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

import h5py
import numpy as np
import numpy.typing as npt
from PIL import Image

from histeclipse_pipeline.enso import (
    Described,
    Index,
    episode_json,
    episodes,
    month_text,
    months_from,
)
from histeclipse_pipeline.enso_sst import BOUND, sha256_of
from histeclipse_pipeline.netcdf3 import read_netcdf3
from histeclipse_pipeline.sky import Json
from histeclipse_pipeline.water_cycle import month_dates, text

if TYPE_CHECKING:
    from pathlib import Path

    from histeclipse_pipeline.krapp import Grid

ERSST_URL = "https://downloads.psl.noaa.gov/Datasets/noaa.ersst.v6/sst.mnmean.nc"
#: PSL's file of 5 November 2026, January 1850 to October 2026. It grows every month.
ERSST_SHA256 = "4c0e94963a021b8e5458ee3c727087bfd82244b5a3e3159eda6f8c6321c4f4f2"
HADISST_URL = "https://www.metoffice.gov.uk/hadobs/hadisst/data/HadISST_sst.nc.gz"
#: The Met Office's file of 2 November 2026. It grows every month.
HADISST_SHA256 = "eb0a402520ec4a9f0089a0c5471d7a04e4fc83dbdcb5e2d624de9fcd60670d45"
BASE = (1991, 2020)
#: The years whose spread sets the scaling of Niño 3.4 less the tropics.
SCALED_FROM = 1950
#: The first year shown; NOAA's own ERSST products start here.
FIRST_YEAR = 1854
#: The last month of this file's indices: NOAA's begin the month after.
LAST = (1949, 12)
#: The last month of the sea maps: OISST begins the month after.
LAST_MAP = (1981, 8)
MONTHS = 12
#: Anything this large is a fill value; HadISST marks sea ice -1000 °C.
_MISSING_FROM = 999.0
#: The 2° grid of the maps.
STEP = 2
ROWS = 180 // STEP + 1
COLUMNS = 360 // STEP + 1

ERSST = Described(
    id="ersst",
    label="Relative Niño 3.4 from ERSST v6 (ours)",
    official="computed for this site by CPC's RONI method; NOAA publishes none before 1950",
    method=(
        "Niño 3.4 sea surface temperature anomaly minus the mean anomaly of the tropics "
        "(20°N\u201320°S), rescaled to Niño 3.4's spread since 1950; three-month running mean "
        "(NOAA ERSST v6, 2°)"
    ),
    baseline="1991\u20132020",
    url="https://psl.noaa.gov/data/gridded/data.noaa.ersst.v6.html",
)
HADISST = Described(
    id="hadisst",
    label="Relative Niño 3.4 from HadISST (ours)",
    official="computed for this site by CPC's RONI method; NOAA publishes none before 1950",
    method=(
        "as from ERSST, on the Met Office Hadley Centre's HadISST 1.1 reconstruction (1°), "
        "from 1870"
    ),
    baseline="1991\u20132020",
    url="https://www.metoffice.gov.uk/hadobs/hadisst/",
)


@dataclass(frozen=True)
class Record:
    """A monthly record of the sea's surface: its months, fields (NaN on land) and axes."""

    dates: list[tuple[int, int]]
    fields: Grid
    latitude: Grid
    longitude: Grid


def cleaned(values: Grid) -> Grid:
    """Turn fill values and sea-ice markers into NaN."""
    return np.asarray(np.where(np.fabs(values) >= _MISSING_FROM, np.nan, values), np.float64)


def read_record(opened: h5py.File, field: str = "sst") -> Record:
    """Read a CF NetCDF-4 record (ERSST's ``lat``/``lon``, or HadISST's ``latitude``)."""
    time = opened["time"]
    units = text(time.attrs["units"], "time units")
    dates = month_dates(units, np.asarray(time[()], dtype=np.float64).tolist())  # pyright: ignore[reportAny]
    names = ("lat", "lon") if "lat" in opened else ("latitude", "longitude")
    return Record(
        dates,
        cleaned(np.asarray(opened[field][()], dtype=np.float64)),
        np.asarray(opened[names[0]][()], dtype=np.float64),
        np.asarray(opened[names[1]][()], dtype=np.float64),
    )


def read_classic(data: bytes) -> Record:
    """Read HadISST's classic NetCDF-3 file (``latitude``, ``longitude``, ``sst``)."""
    variables, _ = read_netcdf3(data)
    time = variables["time"]
    units = time.attributes.get("units")
    if not isinstance(units, str):
        msg = "HadISST: time has no units"
        raise TypeError(msg)
    return Record(
        month_dates(units, time.values.tolist()),  # pyright: ignore[reportAny]
        cleaned(variables["sst"].values),
        variables["latitude"].values,
        variables["longitude"].values,
    )


def box_mean(record: Record, north: float, south: float, west: float, east: float) -> Grid:
    """Each month's area-weighted mean over a box; longitudes east of Greenwich, 0-360."""
    rows = (record.latitude <= north) & (record.latitude >= south)
    east_of = np.mod(record.longitude, 360)
    columns = (east_of >= west) & (east_of <= east)
    picked = record.fields[:, rows][:, :, columns]
    weights = np.cos(np.radians(record.latitude[rows]))[:, None] * np.ones(int(columns.sum()))
    known = np.isfinite(picked)
    total = np.where(known, picked, 0.0) * weights
    return np.asarray(total.sum(axis=(1, 2)) / (known * weights).sum(axis=(1, 2)), np.float64)


def anomalies(dates: list[tuple[int, int]], series: Grid, base: tuple[int, int] = BASE) -> Grid:
    """Each month less its calendar month's mean over ``base``."""
    months = np.array([month for _, month in dates])
    years = np.array([year for year, _ in dates])
    out = series.copy()
    for month in range(1, MONTHS + 1):
        same: npt.NDArray[np.bool_] = np.equal(months, month)
        usual = series[same & (years >= base[0]) & (years <= base[1])]
        if usual.size != base[1] - base[0] + 1:
            msg = f"the record does not cover {base[0]}-{base[1]}"
            raise ValueError(msg)
        out[same] = series[same] - usual.mean()
    return out


def relative_index(record: Record) -> Index:
    """CPC's RONI, recomputed from a record: see the module's notes. From its second month."""
    nino = anomalies(record.dates, box_mean(record, 5, -5, 190, 240))
    tropics = anomalies(record.dates, box_mean(record, 20, -20, 0, 360))
    relative = nino - tropics
    recent = np.array([year >= SCALED_FROM for year, _ in record.dates])
    scale = float(np.std(nino[recent]) / np.std(relative[recent]))
    scaled = relative * scale
    # A centred three-month mean: the first and last months have no season of their own.
    seasons = (scaled[:-2] + scaled[1:-1] + scaled[2:]) / 3
    listed: list[float] = seasons.tolist()  # pyright: ignore[reportAny]
    values = [round(value, 2) for value in listed]
    return Index(record.dates[1], values)


def until(index: Index, last: tuple[int, int], first_year: int) -> Index:
    """Keep an index's values from January of ``first_year`` to ``last``."""
    months = months_from(index.first, len(index.values))
    kept = [at for at, month in enumerate(months) if first_year <= month[0] and month <= last]
    return Index(months[kept[0]], [index.values[at] for at in kept])


def early_json(described: Described, whole: Index, first_year: int) -> dict[str, Json]:
    """Describe an index before 1950, its episodes found on the whole series, cut at 1949."""
    shown = until(whole, LAST, first_year)
    found: list[Json] = []
    for episode in episodes(whole):
        if episode.first > LAST or episode.last < shown.first:
            continue
        out = episode_json(episode)
        _ = out.pop("ongoing", None)
        if episode.last > LAST:
            out["last"] = month_text(LAST)
            out["cut"] = True
        found.append(out)
    return {
        "id": described.id,
        "label": described.label,
        "official": described.official,
        "method": described.method,
        "baseline": described.baseline,
        "url": described.url,
        "first": month_text(shown.first),
        "values": list[Json](shown.values),
        "episodes": found,
    }


def early_file(indices: list[Json], accessed: str) -> dict[str, Json]:
    """Build the manifest of the early indices, laid out as ``enso/index.json`` is."""
    return {
        "schemaVersion": 1,
        "sources": ["huang2025ersst6", "rayner2003hadisst", "cpcRoni"],
        "credit": (
            "Computed for this site by NOAA CPC's RONI method from NOAA ERSST v6 (Huang et al. "
            "2025; NOAA PSL) and the Met Office Hadley Centre's HadISST 1.1 (Rayner et al. "
            "2003; Open Government Licence)"
        ),
        "source": "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/",
        "licence": "ERSST: none stated (US Government work); HadISST: Open Government Licence v3",
        "accessed": accessed,
        "changes": (
            "The index computed for this site by NOAA CPC's RONI method from each analysis; "
            "seasons placed at their middle month"
        ),
        "units": "°C",
        "placed": "each three-month season at its middle month",
        "threshold": 0.5,
        "seasons": 5,
        "provisionalMonths": 0,
        "indices": indices,
    }


def on_nodes(field: Grid, latitude: Grid, longitude: Grid) -> Grid:
    """Place a 2° field whose cell centres are even degrees on the 2° nodes (see the notes)."""
    grid = np.full((ROWS, COLUMNS), np.nan)
    rows = np.rint((90 - latitude) / STEP).astype(np.int64)
    columns = np.rint(np.mod(longitude + 180, 360) / STEP).astype(np.int64)
    grid[rows[:, None], columns[None, :]] = field
    grid[:, COLUMNS - 1] = grid[:, 0]
    return grid


def png(anomaly: Grid) -> bytes:
    """Pack a 2° map as ``enso_sst`` packs its maps: R the anomaly, G zero, B 255, A sea."""
    known = np.isfinite(anomaly)
    scaled = (np.clip(np.where(known, anomaly, 0.0), -BOUND, BOUND) + BOUND) / (2 * BOUND)
    value = np.round(scaled * 255).astype(np.uint8)
    zero = np.full(value.shape, 128, dtype=np.uint8)
    flag = np.full(value.shape, 255, dtype=np.uint8)
    mask = np.where(known, 255, 0).astype(np.uint8)
    out = io.BytesIO()
    Image.fromarray(np.stack([value, zero, flag, mask], axis=-1)).save(out, "PNG", optimize=True)
    return out.getvalue()


def sea_maps(record: Record, folder: Path, accessed: str) -> int:
    """Write a map a month from ``FIRST_YEAR`` to ``LAST_MAP``, and their index; count them."""
    folder.mkdir(parents=True, exist_ok=True)
    months = np.array([month for _, month in record.dates])
    years = np.array([year for year, _ in record.dates])
    base = (years >= BASE[0]) & (years <= BASE[1])
    usual: list[Grid] = [
        np.asarray(np.mean(record.fields[base & (months == month)], axis=0), np.float64)
        for month in range(1, 13)
    ]
    written: list[tuple[int, int]] = []
    for at, (year, month) in enumerate(record.dates):
        if year < FIRST_YEAR or (year, month) > LAST_MAP:
            continue
        field: Grid = record.fields[at]  # pyright: ignore[reportAny]
        anomaly = np.asarray(field - usual[month - 1], dtype=np.float64)
        nodes = on_nodes(anomaly, record.latitude, record.longitude)
        _ = (folder / f"{month_text((year, month))}.png").write_bytes(png(nodes))
        written.append((year, month))
    index: dict[str, Json] = {
        "schemaVersion": 1,
        "sources": ["huang2025ersst6"],
        "credit": (
            "NOAA ERSST v6 (Huang et al. 2025), from NOAA PSL; anomalies computed for this site"
        ),
        "source": "https://psl.noaa.gov/data/gridded/data.noaa.ersst.v6.html",
        "paper": "https://doi.org/10.1175/JCLI-D-23-0707.1",
        "licence": "none stated (US Government work); acknowledged as NOAA PSL asks",
        "accessed": accessed,
        "changes": (
            "Anomalies against the baseline computed for this site and packed into 8-bit images"
        ),
        "units": "°C",
        "baseline": f"{BASE[0]}\N{EN DASH}{BASE[1]}, each calendar month against its own mean",
        "bound": BOUND,
        "encoding": "R anomaly from -bound to +bound; G zero; B 255; A sea",
        "files": "YYYY-MM.png",
        "first": month_text(written[0]),
        "last": month_text(written[-1]),
        "columns": COLUMNS,
        "rows": ROWS,
    }
    _ = (folder / "index.json").write_text(
        json.dumps(index, separators=(",", ":"), ensure_ascii=False) + "\n"
    )
    return len(written)


def _cached(url: str, sha256: str, path: Path) -> Path:  # pragma: no cover - needs network access
    """Download ``url`` to ``path`` unless it is there already; check it against its pin."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or sha256_of(path) != sha256:
        if not url.startswith("https://"):
            msg = f"{url}: not https"
            raise ValueError(msg)
        request = urllib.request.Request(url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
        with urllib.request.urlopen(request, timeout=3600) as response, path.open("wb") as out:  # noqa: S310  # pyright: ignore[reportAny]
            while chunk := response.read(1 << 20):  # pyright: ignore[reportAny]
                _ = out.write(chunk)  # pyright: ignore[reportAny]
    found = sha256_of(path)
    if found != sha256:
        msg = f"{url}: SHA-256 {found}, pinned {sha256}"
        raise ValueError(msg)
    return path


def fetch_enso_early(
    enso_folder: Path, maps_folder: Path, cache: Path
) -> tuple[int, int]:  # pragma: no cover - needs network access
    """Download both records (checked against their pins); write the indices and the maps."""
    accessed = dt.datetime.now(tz=dt.UTC).date().isoformat()
    with h5py.File(str(_cached(ERSST_URL, ERSST_SHA256, cache / "sst.mnmean.nc")), "r") as opened:
        ersst = read_record(opened)
    zipped = _cached(HADISST_URL, HADISST_SHA256, cache / "HadISST_sst.nc.gz")
    with gzip.open(zipped) as source:
        hadisst = read_classic(source.read())
    indices: list[Json] = [
        early_json(ERSST, relative_index(ersst), FIRST_YEAR),
        early_json(HADISST, relative_index(hadisst), hadisst.dates[0][0]),
    ]
    enso_folder.mkdir(parents=True, exist_ok=True)
    _ = (enso_folder / "early.json").write_text(
        json.dumps(early_file(indices, accessed), separators=(",", ":"), ensure_ascii=False) + "\n"
    )
    count = sum(
        len(episodes)
        for each in indices
        if isinstance(each, dict) and isinstance(episodes := each["episodes"], list)
    )
    return count, sea_maps(ersst, maps_folder, accessed)
