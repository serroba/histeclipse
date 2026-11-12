"""Sea level to 2150 under the IPCC AR6 projections, global and on a 1° grid (#524).

Garner et al. (2021), *IPCC AR6 Sea Level Projections*, version 20210809 (Zenodo,
doi:10.5281/zenodo.5914709), the data behind chapter 9 of the Working Group I report
(Fox-Kemper et al. 2021) made with the FACTS framework (Kopp et al. 2023). Licensed CC BY 4.0 by
its authors; the dataset asks users to cite all three, which ``CREDIT`` does.

Sea-level change is in metres against 1995-2014, every ten years from 2020 to 2150, as quantiles
of each projection's distribution. AR6 gives two kinds of projection:

- medium confidence, the assessed *likely* range (17th-83rd percentile), for SSP1-1.9, SSP1-2.6,
  SSP2-4.5, SSP3-7.0 and SSP5-8.5;
- low confidence, which adds ice-sheet processes whose onset and size are poorly known (marine
  ice-cliff instability, structured expert judgement), for SSP1-2.6, SSP2-4.5 and SSP5-8.5. Its
  SSP5-8.5 upper range is the report's *low-likelihood, high-impact* storyline (its 83rd
  percentile 1.6 m by 2100, 4.8 m by 2150): it cannot be ruled out, but is not a likely range.
  Its files go on to 2300; only the years to 2150 are kept, as for the others.

Only the ``confidence_output_files`` are read, each a single file out of a zip archive by HTTP
range requests (the archives are 0.9 and 9.2 GB), checked against a pinned checksum:

- global: the 5th, 17th, 50th, 83rd and 95th percentiles of the total, for every projection;
- regional: relative sea-level change (ocean plus land moving up or down) on AR6's 1° grid,
  which sits on the site's node-registered 1° grid (``krapp.regrid``'s nodes). For SSP1-2.6,
  SSP2-4.5, SSP5-8.5 and the low-confidence SSP5-8.5, in 2050, 2100 and 2150. AR6 leaves most of
  the land out of the grid; the image spreads the sea's values a few nodes inland
  (``krapp.dilate``) so that a coast reads the sea beside it. The 1,030 tide-gauge sites are
  left out.

Each map is an RGBA image, north at the top, from 180° W to 180° E, each channel a byte from
``LOWEST`` (0, -3 m and below) to ``HIGHEST`` (255, +7 m and above), about 4 cm a step:

- R: the median;
- G: the 17th percentile;
- B: the 83rd percentile;
- A: 255 where AR6 has a value, 0 where the value is spread inland or there is none.
"""

import io
import json
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

import h5py
import numpy as np
import numpy.typing as npt
from PIL import Image

from histeclipse_pipeline.icesheets import read_member
from histeclipse_pipeline.krapp import Grid, channels
from histeclipse_pipeline.paleotemp import COLUMNS, ROWS
from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from collections.abc import Callable, Iterable
    from pathlib import Path

    #: Read ``length`` bytes of an archive from ``start``.
    type Fetch = Callable[[int, int], bytes]

SOURCE = "https://doi.org/10.5281/zenodo.5914709"
RECORD = "https://zenodo.org/records/6382554"
GLOBAL_URL = "https://zenodo.org/api/records/6382554/files/ar6.zip/content"
REGIONAL_URL = "https://zenodo.org/api/records/6382554/files/ar6-regional-confidence.zip/content"
LICENCE = "CC BY 4.0"
CREDIT = (
    "IPCC AR6 Sea Level Projections (Garner et al. 2021, version 20210809, Zenodo, "
    "doi:10.5281/zenodo.5914709), CC BY 4.0; Fox-Kemper et al. 2021, Ocean, Cryosphere and Sea "
    "Level Change, IPCC AR6 WGI chapter 9; Kopp et al. 2023, FACTS v1.0, Geoscientific Model "
    "Development 16, 7461; quantiles of the total sea-level change against 1995-2014, the "
    "regional maps packed into 8-bit images for this site"
)
BASELINE = "1995\u20132014"
#: The global quantiles kept: the 5-95% and likely (17-83%) ranges and the median.
QUANTILES = (0.05, 0.17, 0.5, 0.83, 0.95)
#: The last year kept: the low-confidence files go on to 2300, the medium ones stop here.
LAST_YEAR = 2150
#: The years mapped, and each map's quantiles: the median, then the likely range.
MAP_YEARS = (2050, 2100, 2150)
MAP_QUANTILES = (0.5, 0.17, 0.83)
#: The maps' byte scale, metres: 0 is this or lower, 255 this or higher. Near the ice sheets
#: (Greenland, Antarctica, Arctic Canada) relative sea level falls by up to 17 m as the ice's pull
#: weakens and the land rebounds; those nodes are clipped, so the coasts elsewhere keep 4 cm steps.
LOWEST = -3.0
HIGHEST = 7.0
#: AR6's grid points are numbered from here; lower numbers are tide gauges.
GRID_LOCATIONS = 1_000_000_000
#: The fill value of the sea-level variable.
_FILL = -32768
_MM = 1000.0
#: How far a quantile or year read as float32 may be from the one wanted.
_ROUNDING = 1e-6
#: Ranges are read in pieces of this many bytes, so one dropped connection costs little.
_PIECE = 16 << 20


@dataclass(frozen=True)
class Projection:
    """One scenario at one confidence level, and the files AR6 gives for it."""

    scenario: str
    confidence: str

    @property
    def id(self) -> str:
        """Name it, e.g. ``ssp245-medium``."""
        return f"{self.scenario}-{self.confidence}"

    @property
    def label(self) -> str:
        """Name the scenario as the report does, e.g. ``SSP2-4.5``."""
        digits = self.scenario.removeprefix("ssp")
        return f"SSP{digits[0]}-{digits[1]}.{digits[2]}"

    def member(self, scope: str) -> str:
        """Give the confidence output file's path in the global or regional archive."""
        folder = "ar6/global" if scope == "global" else "ar6-regional-confidence/regional"
        level = f"{self.confidence}_confidence"
        return (
            f"{folder}/confidence_output_files/{level}/{self.scenario}/"
            f"total_{self.scenario}_{level}_values.nc"
        )


GLOBAL = (
    *(Projection(each, "medium") for each in ("ssp119", "ssp126", "ssp245", "ssp370", "ssp585")),
    *(Projection(each, "low") for each in ("ssp126", "ssp245", "ssp585")),
)
REGIONAL = (
    Projection("ssp126", "medium"),
    Projection("ssp245", "medium"),
    Projection("ssp585", "medium"),
    Projection("ssp585", "low"),
)
#: Each file's SHA-256, by projection id.
GLOBAL_SHA256 = {
    "ssp119-medium": "5ee911e60b278280e9bfbd8607de11d3534275e738f6d13c39846a8aa631a02d",
    "ssp126-medium": "f71e543638310e12c6f72868740f2f51ffda6cd9aedb58f8d0e7d5b1c61fec8f",
    "ssp245-medium": "9313b7bb543a951914d40c8c54c1b9734fddb8e69ba5c69a07ec42577ae10991",
    "ssp370-medium": "c2009cbe8872bdd209e734949b28acf507a153b81504d509d6f0a5aeae167471",
    "ssp585-medium": "f696fd089e534c2a1d2d0eb3799c4d5a0d8f0803cefc35d387cc59e1b5bff1f8",
    "ssp126-low": "1eaf1eca33a1d45aeceae1735ecc8622097dea05e31ed5a1d82a83e7d99f36c0",
    "ssp245-low": "43d8a784ee82b799c555aa58e1f282713853cae921f1a5417124a09a8683e715",
    "ssp585-low": "a0ecd4d96759c861944684d0c52c738753dd043ebf94aee0a720fcd5cb93ea07",
}
REGIONAL_SHA256 = {
    "ssp126-medium": "28ca163c13470047aefb75ae8f4a8bc6e06c3e44b824ff37e8743ca8d3a1b716",
    "ssp245-medium": "3f31aadb53b7962a729a839cd58e841f171e72575f9e2b802399be6656aa8cb8",
    "ssp585-medium": "b3bcf98c6a17b43fbb24d0e60ede382886f3487883022aa88b513ea582a607e0",
    "ssp585-low": "06836ceb1eb43316b31787c3fe16bfdf60b77a75b9e3a5c703ab8d9a52b1898a",
}


@dataclass(frozen=True)
class Curve:
    """A projection's global quantiles, metres, by year (one list per quantile in QUANTILES)."""

    projection: Projection
    years: list[int]
    quantiles: list[list[float]]


@dataclass(frozen=True)
class Map:
    """A projection's relative sea level in one year, metres on the 1° nodes, by quantile."""

    projection: Projection
    year: int
    #: The median, the 17th and the 83rd percentiles; NaN where AR6 has no value.
    grids: tuple[Grid, Grid, Grid]


def nearest(values: npt.NDArray[np.float64], wanted: float) -> int:
    """Find ``wanted`` among ``values``, which must hold it (to rounding); return its index."""
    distance = np.abs(values - wanted)
    if not np.any(distance <= _ROUNDING):
        msg = f"{wanted} is not among the file's values"
        raise ValueError(msg)
    return int(np.argmin(distance))


def metres(millimetres: Grid) -> Grid:
    """Turn AR6's millimetres (stored as int16, -32768 for none) into metres, NaN for none."""
    return np.where(np.equal(millimetres, _FILL), np.nan, np.divide(millimetres, _MM))


def rounded(row: Grid) -> list[float]:
    """Round metres to the millimetre, as plain floats."""
    values: list[float] = np.round(row, 3).tolist()  # pyright: ignore[reportAny]
    return values


def read_curve(data: bytes, projection: Projection) -> Curve:
    """Read a global confidence output file: the kept quantiles of the total, every year."""
    with h5py.File(io.BytesIO(data), "r") as opened:
        quantiles = np.asarray(opened["quantiles"][()], dtype=np.float64)
        every: list[int] = np.asarray(opened["years"][()], dtype=np.int64).tolist()  # pyright: ignore[reportAny]
        years = [year for year in every if year <= LAST_YEAR]
        change = opened["sea_level_change"]
        rows = [
            metres(np.asarray(change[nearest(quantiles, each), : len(years), 0], dtype=np.float64))
            for each in QUANTILES
        ]
    return Curve(projection, years, [rounded(row) for row in rows])


def to_nodes(values: Grid, latitude: Grid, longitude: Grid) -> Grid:
    """Place AR6's grid points on the 1° nodes, 90° N to 90° S, 180° W to 180° E (both edges)."""
    grid = np.full((ROWS, COLUMNS), np.nan)
    rows = np.rint(90 - latitude).astype(np.int64)
    columns = np.rint(longitude + 180).astype(np.int64) % 360
    grid[rows, columns] = values
    grid[:, COLUMNS - 1] = grid[:, 0]
    return grid


def read_maps(data: bytes, projection: Projection) -> list[Map]:
    """Read a regional confidence output file's grid points in each mapped year."""
    with h5py.File(io.BytesIO(data), "r") as opened:
        quantiles = np.asarray(opened["quantiles"][()], dtype=np.float64)
        years = np.asarray(opened["years"][()], dtype=np.float64)
        on_grid = np.asarray(opened["locations"][()], dtype=np.int64) >= GRID_LOCATIONS
        latitude = np.asarray(opened["lat"][()], dtype=np.float64)[on_grid]
        longitude = np.asarray(opened["lon"][()], dtype=np.float64)[on_grid]
        change = opened["sea_level_change"]
        maps: list[Map] = []
        for year in MAP_YEARS:
            column = nearest(years, year)
            median, low, high = (
                to_nodes(
                    metres(
                        np.asarray(change[nearest(quantiles, each), column, :], np.float64)[on_grid]
                    ),
                    latitude,
                    longitude,
                )
                for each in MAP_QUANTILES
            )
            maps.append(Map(projection, year, (median, low, high)))
    return maps


def to_png(grids: tuple[Grid, Grid, Grid]) -> bytes:
    """Pack a map's median, 17th and 83rd percentiles and its mask into an RGBA PNG."""
    median, median_mask = channels(grids[0], LOWEST, HIGHEST)
    low, _ = channels(grids[1], LOWEST, HIGHEST)
    high, _ = channels(grids[2], LOWEST, HIGHEST)
    out = io.BytesIO()
    packed = np.stack([median, low, high, median_mask], axis=-1)
    Image.fromarray(packed).save(out, format="PNG", optimize=True)
    return out.getvalue()


def file_name(map_: Map) -> str:
    """Name a map's image, e.g. ``ssp245-medium-2100.png``."""
    return f"{map_.projection.id}-{map_.year}.png"


def ocean_mean(grid: Grid) -> float:
    """Area-weighted (cos latitude) mean over the nodes with data, metres."""
    body = grid[:, :-1]  # the last column repeats the first
    latitudes = np.linspace(90.0, -90.0, ROWS)
    weights = np.broadcast_to(np.cos(np.radians(latitudes))[:, None], body.shape)
    valid = np.isfinite(body) & (weights > 0)
    mean: np.float64 = np.average(body[valid], weights=weights[valid])
    return float(mean)


def projection_json(projection: Projection) -> dict[str, Json]:
    """Name a projection as the web app shows it."""
    return {
        "id": projection.id,
        "scenario": projection.label,
        "confidence": projection.confidence,
    }


def index_file(curves: Iterable[Curve], maps: list[tuple[Map, float]]) -> dict[str, Json]:
    """Build the manifest the web app reads: credit, baseline, curves, and the maps' encoding."""
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "record": RECORD,
        "licence": LICENCE,
        "units": "m",
        "baseline": BASELINE,
        "quantiles": list[Json](QUANTILES),
        "curves": [
            {
                **projection_json(curve.projection),
                "years": list[Json](curve.years),
                "values": [list[Json](row) for row in curve.quantiles],
            }
            for curve in curves
        ],
        "columns": COLUMNS,
        "rows": ROWS,
        "lowest": LOWEST,
        "highest": HIGHEST,
        "mapQuantiles": list[Json](MAP_QUANTILES),
        "maps": [
            {
                **projection_json(map_.projection),
                "year": map_.year,
                "file": file_name(map_),
                "mean": round(mean, 2),
            }
            for map_, mean in maps
        ],
    }


def write_projections(curves: list[Curve], maps: list[Map], folder: Path) -> int:
    """Write each map's image and ``index.json``; return how many images."""
    folder.mkdir(parents=True, exist_ok=True)
    for map_ in maps:
        _ = (folder / file_name(map_)).write_bytes(to_png(map_.grids))
    means = [(map_, ocean_mean(map_.grids[0])) for map_ in maps]
    index = index_file(curves, means)
    _ = (folder / "index.json").write_text(json.dumps(index, separators=(",", ":")) + "\n")
    return len(maps)


def build(
    fetch_global: Fetch, global_size: int, fetch_regional: Fetch, regional_size: int, folder: Path
) -> int:
    """Read each file out of the two archives, check it, and write the curves and maps."""
    curves = [
        read_curve(
            verified(
                read_member(fetch_global, global_size, each.member("global")),
                GLOBAL_SHA256[each.id],
                f"AR6 global {each.id}",
            ),
            each,
        )
        for each in GLOBAL
    ]
    maps = [
        map_
        for each in REGIONAL
        for map_ in read_maps(
            verified(
                read_member(fetch_regional, regional_size, each.member("regional")),
                REGIONAL_SHA256[each.id],
                f"AR6 regional {each.id}",
            ),
            each,
        )
    ]
    return write_projections(curves, maps, folder)


def _ranges(url: str) -> tuple[Fetch, int]:  # pragma: no cover - needs network access
    """Return a reader of byte ranges of ``url`` (in pieces, each retried), and its size."""
    # Each URL is one of the pinned constants above, all https.
    agent = {"User-Agent": "histeclipse-pipeline"}
    head = urllib.request.Request(url, method="HEAD", headers=agent)  # noqa: S310
    with urllib.request.urlopen(head, timeout=60) as response:  # noqa: S310  # pyright: ignore[reportAny]
        total = int(str(response.headers["Content-Length"]))  # pyright: ignore[reportAny]

    def piece(start: int, length: int) -> bytes:
        for _ in range(5):
            request = urllib.request.Request(  # noqa: S310
                url,
                headers={
                    "User-Agent": "histeclipse-pipeline",
                    "Range": f"bytes={start}-{start + length - 1}",
                },
            )
            try:
                with urllib.request.urlopen(request, timeout=300) as response:  # noqa: S310  # pyright: ignore[reportAny]
                    body: object = response.read()  # pyright: ignore[reportAny]
            except OSError:
                continue
            if isinstance(body, bytes) and len(body) == length:
                return body
        msg = f"{url}: could not read {length} bytes from {start}"
        raise OSError(msg)

    def fetch(start: int, length: int) -> bytes:
        end = start + length
        return b"".join(piece(at, min(_PIECE, end - at)) for at in range(start, end, _PIECE))

    return fetch, total


def fetch_ar6_sealevel(folder: Path) -> int:  # pragma: no cover - needs network access
    """Read the files out of AR6's archives (each checked against its checksum); write them."""
    fetch_global, global_size = _ranges(GLOBAL_URL)
    fetch_regional, regional_size = _ranges(REGIONAL_URL)
    return build(fetch_global, global_size, fetch_regional, regional_size, folder)
