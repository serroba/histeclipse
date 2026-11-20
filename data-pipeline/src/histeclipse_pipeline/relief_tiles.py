"""Today's land and sea-floor heights in tiles, for the ice-age globe close up (#1015).

The ice ages' geography is today's ground with the sea moved and the ice laid on it, so one map
of today's heights serves all of them. The globe's own map (the PaleoDEM for today, 0.2°, 8 bits)
softens it to about 22 km and 50-90 m a step; these tiles carry it at 2' (about 3.7 km) to the
metre, and the site fetches only those for the ground in view, as it does the Blue Marble's.

The source is ETOPO 2022 (NOAA National Centers for Environmental Information 2022,
doi:10.25921/fd45-gt74), its surface heights at 60" (the top of the ice sheets and of the sea
floor), in the public domain. Each 2' cell is the mean of the four 60" cells in it; level 2 halves
that again, to 4'. Lakes and land come from Natural Earth's 1:10m maps (public domain).

The tiles form the Blue Marble's pyramid (``earth_tiles.py``): level ``z`` is ``2**(z + 1)`` tiles
across and ``2**z`` down, ``x`` east from 180° W and ``y`` south from the north pole, each with
``TILE_SIZE`` cells a side. Around them is a ``BORDER`` of the neighbours' cells (wrapping east and
west, repeating the last row at the poles), so heights blend and slopes are taken across a tile's
edge without a seam.

Each cell is three bytes, written as a lossless WebP's red, green and blue:

- red and green: the height plus ``OFFSET`` metres, high byte then low, one metre a step;
- blue: where water is. ``OCEAN`` is sea floor joined to the deep sea, which a falling sea lays
  bare and a rising one covers. ``LAKE`` is a natural lake (Natural Earth's lakes, less the
  reservoirs, which the ice ages did not have) or an inland sea: ground
  below today's sea level that Natural Earth's land leaves out, as the Caspian. Elsewhere
  (``LAND``) the ground stays land even below today's sea level: the Caspian depression's
  shores, the Qattara Depression, Death Valley.
"""

import json
from dataclasses import dataclass
from typing import TYPE_CHECKING

import numpy as np
import numpy.typing as npt
from PIL import Image, ImageDraw

from histeclipse_pipeline.archaeoglobe import dbf_rows, read_regions, rings_by_record
from histeclipse_pipeline.earth_tiles import cached
from histeclipse_pipeline.today_ice import signed_area

if TYPE_CHECKING:
    from collections.abc import Iterable, Iterator
    from pathlib import Path

type Heights = npt.NDArray[np.float32]
type Classes = npt.NDArray[np.uint8]
type Ring = list[tuple[float, float]]

ETOPO_URL = (
    "https://www.ngdc.noaa.gov/thredds/fileServer/global/ETOPO2022/60s/"
    "60s_surface_elev_netcdf/ETOPO_2022_v1_60s_N90W180_surface.nc"
)
ETOPO_SHA256 = "74bbc5c23e85188d93f0beba8116babf69e1a8f160e8dc9f053bf8df01b197b6"
LAKES_URL = "https://naciscdn.org/naturalearth/10m/physical/ne_10m_lakes.zip"
LAKES_SHA256 = "0803a06f9c3cb4671d89b68c48b142aad9366ba40f665245e12a913fbc61722a"
LAND_URL = "https://naciscdn.org/naturalearth/10m/physical/ne_10m_land.zip"
LAND_SHA256 = "e547d749445eaa0964aba76738090ec88f5e63c4585122170f98c67a7ea922dc"
SOURCE = "https://doi.org/10.25921/fd45-gt74"
CREDIT = (
    "ETOPO 2022 (NOAA National Centers for Environmental Information 2022), surface heights at "
    "60 arc-seconds averaged to 2 and 4 arc-minutes, public domain; lakes and land from "
    "Natural Earth 1:10m (public domain)"
)

#: Cells a tile has a side, and of its neighbours' round it.
TILE_SIZE = 675
BORDER = 2
#: Metres added to a height before it is written: the deepest sea floor is about -10,950 m.
OFFSET = 11_000
OCEAN = 255
LAKE = 128
LAND = 0
#: Sea floor this deep is the open ocean, from which joined sea floor is traced (as shelf.py).
DEEP_SEA = -3000.0
#: Levels written, and how many 60" cells a side each one's cell averages.
LEVELS = {2: 4, 3: 2}
MANIFEST = "manifest.json"
SCHEMA_VERSION = 1


@dataclass(frozen=True)
class Level:
    """One level of the pyramid: ``columns`` (``2**(z + 1)``) by ``rows`` (``2**z``) tiles."""

    z: int

    @property
    def columns(self) -> int:
        """Tiles across."""
        return 1 << (self.z + 1)

    @property
    def rows(self) -> int:
        """Tiles down."""
        return 1 << self.z


def averaged(heights: Heights, factor: int) -> Heights:
    """Average square blocks of ``factor`` cells a side into one."""
    rows, columns = map(int, heights.shape)
    if rows % factor or columns % factor:
        msg = f"a {rows} by {columns} grid does not divide into blocks of {factor}"
        raise ValueError(msg)
    blocks = heights.reshape(rows // factor, factor, columns // factor, factor)
    return np.asarray(blocks.mean(axis=(1, 3), dtype=np.float64), dtype=np.float32)


def _spread_along_rows(ocean: npt.NDArray[np.bool_], below: npt.NDArray[np.bool_]) -> None:
    """Make every run of ``below`` along a row that touches ``ocean`` ocean, in place.

    A row wraps round: its first and last cells are neighbours, as 180° W and 180° E are.
    """
    rows, columns = map(int, below.shape)
    flat_below = below.ravel()
    # A run starts at a cell below sea level whose west neighbour is not, or at a row's start.
    starts = flat_below.copy()
    starts[1:] &= ~flat_below[:-1]
    starts[::columns] = flat_below[::columns]
    run = np.cumsum(starts) - 1
    run = np.where(flat_below, run, -1)
    inside = run[flat_below]
    counts = np.bincount(inside, weights=ocean.ravel()[flat_below], minlength=int(starts.sum()))
    touched: npt.NDArray[np.bool_] = np.append(counts > 0, False)
    # Across 180°: a run at a row's end and one at its start are one.
    first = run.reshape(rows, columns)[:, 0]
    last = run.reshape(rows, columns)[:, -1]
    joined: npt.NDArray[np.bool_] = (first >= 0) & (last >= 0)
    either: npt.NDArray[np.bool_] = touched[first[joined]] | touched[last[joined]]
    touched[first[joined]] = either
    touched[last[joined]] = either
    np.copyto(ocean, (flat_below & touched[run]).reshape(rows, columns))


def open_ocean(heights: Heights) -> npt.NDArray[np.bool_]:
    """Find sea floor joined to the deep sea through neighbours below sea level (four ways).

    Spread along whole rows and whole columns in turn until nothing changes: each sweep crosses
    any straight stretch at once, so it takes as many sweeps as the longest way has turns.
    """
    below: npt.NDArray[np.bool_] = np.less(heights, 0)
    ocean: npt.NDArray[np.bool_] = np.less(heights, DEEP_SEA)
    while True:
        before = int(ocean.sum())
        _spread_along_rows(ocean, below)
        columns = np.ascontiguousarray(ocean.T)
        below_t = np.ascontiguousarray(below.T)
        # Columns do not wrap: the poles are not neighbours. Cut each with a cell of land.
        cut = np.zeros((below_t.shape[0], 1), dtype=np.bool_)
        spread = np.hstack([columns, cut])
        _spread_along_rows(spread, np.hstack([below_t, cut]))
        ocean = np.ascontiguousarray(spread[:, :-1].T)
        if int(ocean.sum()) == before:
            return ocean


def polygon_mask(records: Iterable[list[Ring]], columns: int, rows: int) -> npt.NDArray[np.bool_]:
    """Mark the cells whose centres fall in the polygons, outside their holes.

    Cells are ``360 / columns`` degrees a side from 180° W and the north pole. A shapefile's outer
    rings run clockwise and its holes anticlockwise (see ``today_ice.rasterise``).
    """
    step = 360.0 / columns
    image = Image.new("1", (columns, rows), 0)
    draw = ImageDraw.Draw(image)

    def pixels(ring: Ring) -> list[tuple[float, float]]:
        # Pillow fills the pixels whose centres are inside; a pixel's centre is at +0.5.
        return [((lon + 180.0) / step - 0.5, (90.0 - lat) / step - 0.5) for lon, lat in ring]

    for rings in records:
        for ring in (ring for ring in rings if signed_area(ring) <= 0):
            draw.polygon(pixels(ring), fill=1)
        for ring in (ring for ring in rings if signed_area(ring) > 0):
            draw.polygon(pixels(ring), fill=0)
    return np.asarray(image, dtype=np.bool_)


def classes(heights: Heights, lakes: npt.NDArray[np.bool_], land: npt.NDArray[np.bool_]) -> Classes:
    """Where water is: the open ocean; lakes and inland seas elsewhere; and land."""
    ocean = open_ocean(heights)
    out = np.full(heights.shape, LAND, dtype=np.uint8)
    out[(lakes | (~land & (heights < 0))) & ~ocean] = LAKE
    out[ocean] = OCEAN
    return out


def encode(heights: Heights, water: Classes) -> npt.NDArray[np.uint8]:
    """Heights to the metre plus OFFSET, high byte and low, and the water classes: RGB bytes."""
    value = np.clip(np.rint(heights.astype(np.float64)) + OFFSET, 0, 0xFFFF).astype(np.uint16)
    return np.stack([(value >> 8).astype(np.uint8), (value & 0xFF).astype(np.uint8), water], -1)


def decode(rgb: npt.NDArray[np.uint8]) -> tuple[npt.NDArray[np.int32], Classes]:
    """Read encoded bytes back as the site does: heights (metres) and water classes."""
    value = rgb[..., 0].astype(np.int32) * 256 + rgb[..., 1].astype(np.int32)
    return value - OFFSET, rgb[..., 2]


def bordered(cells: npt.NDArray[np.uint8], border: int) -> npt.NDArray[np.uint8]:
    """Add ``border`` cells round a whole map: wrapped east and west, the last rows repeated."""
    wrapped = np.concatenate([cells[:, -border:], cells, cells[:, :border]], axis=1)
    return np.concatenate([wrapped[:1].repeat(border, 0), wrapped, wrapped[-1:].repeat(border, 0)])


def cut(
    cells: npt.NDArray[np.uint8], level: Level, tile_size: int, border: int
) -> Iterator[tuple[int, int, npt.NDArray[np.uint8]]]:
    """Cut a whole map (``bordered`` already) into a level's tiles, each with its border."""
    height, width = map(int, cells.shape[:2])
    rows, columns = height - 2 * border, width - 2 * border
    if (columns, rows) != (level.columns * tile_size, level.rows * tile_size):
        msg = f"a {columns} by {rows} map is not level {level.z} in {tile_size}-cell tiles"
        raise ValueError(msg)
    side = tile_size + 2 * border
    for x in range(level.columns):
        for y in range(level.rows):
            top, left = y * tile_size, x * tile_size
            yield x, y, cells[top : top + side, left : left + side]


def save_tiles(
    tiles: Iterable[tuple[int, int, npt.NDArray[np.uint8]]], folder: Path, z: int
) -> int:
    """Write tiles as lossless ``folder/z/x/y.webp``; return their bytes."""
    written = 0
    for x, y, tile in tiles:
        path = folder / str(z) / str(x) / f"{y}.webp"
        path.parent.mkdir(parents=True, exist_ok=True)
        Image.fromarray(tile, mode="RGB").save(path, "WEBP", lossless=True, quality=100, method=6)
        written += path.stat().st_size
    return written


def write_level(  # noqa: PLR0913 - a level's grids, where it goes, and how it is cut
    heights: Heights,
    lakes: npt.NDArray[np.bool_],
    land: npt.NDArray[np.bool_],
    folder: Path,
    *,
    z: int,
    tile_size: int,
) -> int:
    """Write one level from its heights (north at the top), lakes and land; return its bytes."""
    cells = bordered(encode(heights, classes(heights, lakes, land)), BORDER)
    return save_tiles(cut(cells, Level(z), tile_size, BORDER), folder, z)


def manifest(levels: Iterable[int], tile_size: int) -> dict[str, object]:
    """Describe how tiles are cut and read, the levels there are, and where they came from."""
    return {
        "schemaVersion": SCHEMA_VERSION,
        "credit": CREDIT,
        "source": SOURCE,
        "tileSize": tile_size,
        "border": BORDER,
        "path": "{z}/{x}/{y}.webp",
        "offset": OFFSET,
        "water": {"ocean": OCEAN, "lake": LAKE, "land": LAND},
        "levels": [
            {"z": z, "columns": Level(z).columns, "rows": Level(z).rows} for z in sorted(levels)
        ],
        "sources": [
            {"url": ETOPO_URL, "sha256": ETOPO_SHA256},
            {"url": LAKES_URL, "sha256": LAKES_SHA256},
            {"url": LAND_URL, "sha256": LAND_SHA256},
        ],
    }


def write_manifest(folder: Path, levels: Iterable[int], tile_size: int = TILE_SIZE) -> None:
    """Write ``manifest.json``."""
    folder.mkdir(parents=True, exist_ok=True)
    text = json.dumps(manifest(levels, tile_size), indent=2) + "\n"
    _ = (folder / MANIFEST).write_text(text, encoding="utf-8")


def rasterised(
    archive: bytes, columns: int, rows: int, *, leave_out: str | None = None
) -> npt.NDArray[np.bool_]:
    """Rasterise a Natural Earth polygon layer onto a grid of ``columns`` by ``rows`` cells.

    ``leave_out`` names a feature class (``featurecla``) whose records are not drawn.
    """
    shp, dbf = read_regions(archive)
    records = rings_by_record(shp)
    if leave_out is not None:
        kept = [row.get("featurecla", "").strip() != leave_out for row in dbf_rows(dbf, "utf-8")]
        records = [rings for rings, keep in zip(records, kept, strict=True) if keep]
    return polygon_mask(records, columns, rows)


def read_etopo(path: Path) -> Heights:  # pragma: no cover - reads the 478 MB file
    """ETOPO 2022's 60" surface heights, north at the top, 180° W at the left."""
    import h5py  # noqa: PLC0415 - only the fetch needs it

    with h5py.File(str(path), "r") as opened:
        latitude = np.asarray(opened["lat"][()], dtype=np.float64)
        heights = np.asarray(opened["z"][()], dtype=np.float32)
    if latitude[0] < latitude[-1]:
        heights = heights[::-1]
    return np.ascontiguousarray(heights)


def write_relief_tiles(  # pragma: no cover - needs the downloaded files
    etopo: Path, lakes: bytes, land: bytes, folder: Path
) -> int:
    """Write every level and the manifest from ETOPO's file and the lakes' and land's archives."""
    full = read_etopo(etopo)
    written = 0
    for z, factor in sorted(LEVELS.items()):
        heights = averaged(full, factor)
        rows, columns = map(int, heights.shape)
        water = rasterised(lakes, columns, rows, leave_out="Reservoir")
        ground = rasterised(land, columns, rows)
        written += write_level(heights, water, ground, folder, z=z, tile_size=TILE_SIZE)
    write_manifest(folder, LEVELS)
    return written


def fetch_relief_tiles(folder: Path, cache: Path) -> int:  # pragma: no cover - needs network access
    """Download ETOPO 2022 and Natural Earth's lakes and land once into ``cache``; tile them."""
    etopo = cached(ETOPO_URL, ETOPO_SHA256, cache)
    lakes = cached(LAKES_URL, LAKES_SHA256, cache).read_bytes()
    land = cached(LAND_URL, LAND_SHA256, cache).read_bytes()
    return write_relief_tiles(etopo, lakes, land, folder)
