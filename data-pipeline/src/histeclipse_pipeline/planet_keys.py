"""The colour keys for the height views (#334): which colour stands for which height.

USGS publishes no legend for its colour shaded reliefs of Mars (MOLA) and the Moon (LOLA), so
their keys are measured: the colours of the very maps the site shows, read against the
altimetry heights at the same places (the MOLA MEGDR and the LOLA LDEM, 4 pixels a degree, from
the PDS Geosciences Node), and summed up as one colour a kilometre of height. The shading in
those maps darkens slopes facing away from its light; the lit half of each kilometre's pixels
gives its colour. Within 70° of the equator only, where the maps and grids are least stretched.

Venus's map comes with its legend (USGS Astrogeology): a bar from 3 km below to 11 km above a
radius of 6,051 km. Its key is read off that bar, a colour at each kilometre's tick.

The enhanced-colour maps (the Moon's Clementine colour ratios, Mercury's MESSENGER colour)
colour kinds of rock, not heights. Their keys are swatches: each kind, as its source describes
it, with the colour the map gives a place known for it (Mare Tranquillitatis, rich in
titanium), read off the map: the median colour within a few degrees of the place, gaps in the
coverage left out, and for a young crater, its brightest pixels, its fresh rock.

Each source is pinned by checksum. The keys go to one JSON file, loaded when a view with a key
shows.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from typing import TYPE_CHECKING

import numpy as np
from PIL import Image

from histeclipse_pipeline.arrays import as_floats, dims
from histeclipse_pipeline.planet_maps import checked, download

if TYPE_CHECKING:
    from pathlib import Path

    from histeclipse_pipeline.arrays import FloatArray

PDS = "https://pds-geosciences.wustl.edu"
#: The grids' size: 4 pixels a degree, 0° east on the left edge, north at the top.
GRID = (720, 1440)
#: Kept within this many degrees of the equator.
LATITUDE_KEPT = 70
#: A kilometre of height needs this many pixels for its colour to count.
FEWEST = 30


@dataclass(frozen=True)
class HeightGrid:
    """A body's altimetry grid, and the site's map of its heights to read the colours of."""

    body: str
    url: str
    sha256: str
    #: NumPy's name for the grid's numbers: big- or little-endian 16-bit integers.
    dtype: str
    #: Metres a step of the grid's numbers.
    scale: float
    #: The site's map, under the textures folder.
    texture: str
    #: What the heights are measured from.
    datum: str
    #: Whose heights, as the key credits them.
    credit: str


GRIDS = (
    HeightGrid(
        body="mars",
        url=f"{PDS}/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg004/megt90n000cb.img",
        sha256="25f16fb7aaf857898dcf98bc4f841341a24f8b9f7e98453ca083bc45d897ca2c",
        dtype=">i2",
        scale=1.0,
        texture="planets/mars-height-2048.jpg",
        datum="above the areoid, Mars\u2019s sea level",
        credit="measured against MOLA heights (MGS MOLA MEGDR, NASA PDS)",
    ),
    HeightGrid(
        body="moon",
        url=f"{PDS}/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_4.img",
        sha256="c04632eba6449af49e3108ed7c25b3b1c450600abd3690df4fc815853a1af476",
        dtype="<i2",
        scale=0.5,
        texture="moon-height-2048.jpg",
        datum="above a sphere of 1,737.4 km",
        credit="measured against LOLA heights (LRO LOLA LDEM, NASA PDS)",
    ),
)

VENUS_LEGEND = (
    "https://astrogeology.usgs.gov/ckan/dataset/f992cb3c-4f37-4e1a-a59d-4f29d8307d7d/resource/"
    "f6167969-09b2-42b3-b7dc-439ab9f53641/download/venus_magellan_c3-mdir_clrtopo_legend.png"
)
VENUS_LEGEND_SHA256 = "6761a432fb59ed6f8731670950be125c3bb63dfe1f32227fbf55588be06fc569"
#: The legend's bar: its -3 km and +11 km ticks (pixel columns), and the rows inside the bar.
VENUS_TICKS = (44, 737)
VENUS_KM = (-3, 11)
VENUS_ROWS = (88, 126)


@dataclass(frozen=True)
class Swatch:
    """A kind of rock, and a place known for it whose colour on the map stands for it."""

    kind: str
    place: str
    latitude: float
    #: East, as the IAU gives it (0 to 360).
    longitude: float
    #: Degrees about the place read.
    radius: float
    #: Only the brightest tenth: a young crater's fresh rock, not the older ground about it.
    brightest: bool = False


@dataclass(frozen=True)
class SwatchKey:
    """A map whose colours stand for kinds of rock, and the swatches that say which."""

    body: str
    texture: str
    credit: str
    source: str
    swatches: tuple[Swatch, ...]


READ_AT_PLACE = "each colour read off the map at the place named"
#: The places from the IAU's gazetteer (planet-names); the kinds as Lucey et al. (2000) and
#: the MESSENGER team describe them.
SWATCH_KEYS = (
    SwatchKey(
        body="moon",
        texture="moon-minerals-2048.jpg",
        credit=f"{READ_AT_PLACE}; the kinds as Lucey et al. (2000) describe them",
        source="https://doi.org/10.1029/1999JE001117",
        swatches=(
            Swatch("Highlands, poor in iron and titanium", "the far side", 0, 180, 25),
            Swatch("Seas richest in titanium", "Mare Tranquillitatis", 8.35, 30.83, 5),
            Swatch("Seas poorer in titanium, rich in iron", "Mare Serenitatis", 27.29, 18.36, 5),
            Swatch("Young craters, fresh rock", "Aristarchus", 23.73, 312.51, 1.5, brightest=True),
        ),
    ),
    SwatchKey(
        body="mercury",
        texture="planets/mercury-colour-2048.jpg",
        credit=f"{READ_AT_PLACE}; the kinds as the MESSENGER team describes them",
        source="https://science.nasa.gov/photojournal/enhanced-color-mercury-map",
        swatches=(
            Swatch("Smooth volcanic plains", "Borealis Planitia", 67.3, 32.6, 10),
            Swatch("Dark, low-reflectance material", "about Tolstoj", -16.3, 196.4, 8),
            Swatch("Young craters and their rays", "Hokusai", 57.8, 16.8, 1.5, brightest=True),
        ),
    ),
)
#: Pixels no brighter than this in any colour are gaps in the coverage, black on the map.
GAP = 30


def hex_colour(rgb: FloatArray) -> str:
    """Write an RGB triple as ``#rrggbb``."""
    red, green, blue = (round(value) for value in as_floats(rgb))
    return f"#{red:02x}{green:02x}{blue:02x}"


def heights_km(data: bytes, dtype: str, scale: float) -> FloatArray:
    """Read a grid's heights in km, turned so 0° is in the middle, as the site's maps are."""
    grid = np.frombuffer(data, dtype=dtype).reshape(GRID).astype(np.float64) * scale / 1000
    return np.roll(grid, GRID[1] // 2, axis=1)


def measured_stops(heights: FloatArray, colours: FloatArray) -> list[tuple[float, str]]:
    """One colour a kilometre: the median of the lit half of the pixels at those heights.

    ``heights`` is (rows, columns) and ``colours`` (rows, columns, 3), on the same grid. Each
    stop is at the middle of its kilometre.
    """
    rows = dims(heights)[0]
    kept = [row for row in range(rows) if abs(90 - (row + 0.5) * 180 / rows) < LATITUDE_KEPT]
    height: FloatArray = np.ravel(heights[kept])
    colour: FloatArray = np.reshape(colours[kept], (-1, 3))
    floors = as_floats(np.floor(height))
    stops: list[tuple[float, str]] = []
    for low in range(int(min(floors)), int(max(floors)) + 1):
        inside = [index for index, floor in enumerate(floors) if floor == low]
        if len(inside) < FEWEST:
            continue
        these: FloatArray = colour[inside]
        brightness = as_floats(np.sum(these, axis=1))
        middle = float(np.median(brightness))
        lit: FloatArray = these[
            [index for index, value in enumerate(brightness) if value >= middle]
        ]
        stops.append((low + 0.5, hex_colour(np.median(lit, axis=0))))
    return stops


def legend_stops(legend: FloatArray) -> list[tuple[float, str]]:
    """Venus's key, read off its legend bar: the median colour about each kilometre's tick."""
    (left, right), (low, high), (top, bottom) = VENUS_TICKS, VENUS_KM, VENUS_ROWS
    step = (right - left) / (high - low)
    stops: list[tuple[float, str]] = []
    for km in range(low, high + 1):
        # Seven columns about the tick, kept clear of the bar's dark outline at either end.
        start = min(max(round(left + (km - low) * step) - 3, left + 4), right - 10)
        patch = legend[top:bottom, start : start + 7]
        stops.append((float(km), hex_colour(np.median(patch.reshape(-1, 3), axis=0))))
    return stops


def patch_colour(image: FloatArray, swatch: Swatch) -> str:
    """Read a swatch's colour off a map (rows of latitude, 0° east in the middle).

    The median of the pixels within ``swatch.radius`` degrees of its place, gaps left out; only
    the brightest tenth of them for a young crater.
    """
    rows, columns = dims(image)[:2]
    latitudes: FloatArray = np.radians(90 - (np.arange(rows) + 0.5) * 180 / rows)
    longitudes: FloatArray = np.radians(-180 + (np.arange(columns) + 0.5) * 360 / columns)
    lat, lon = math.radians(swatch.latitude), math.radians(swatch.longitude)
    sines: FloatArray = math.sin(lat) * np.sin(latitudes)
    cosines: FloatArray = math.cos(lat) * np.cos(latitudes)
    turned: FloatArray = np.cos(longitudes - lon)
    cosine: FloatArray = sines[:, None] + cosines[:, None] * turned[None, :]
    near = cosine >= math.cos(math.radians(swatch.radius))
    pixels: FloatArray = image[near]
    pixels = pixels[np.max(pixels, axis=1) > GAP]
    if swatch.brightest:
        brightness = np.sum(pixels, axis=1)
        pixels = pixels[brightness >= np.quantile(brightness, 0.9)]
    return hex_colour(np.median(pixels, axis=0))


def swatch_key(image: FloatArray, entry: SwatchKey) -> dict[str, object]:
    """Put a swatch key as the site reads it: each kind, its place, and its colour."""
    return {
        "credit": entry.credit,
        "source": entry.source,
        "swatches": [
            {"kind": each.kind, "place": each.place, "colour": patch_colour(image, each)}
            for each in entry.swatches
        ],
    }


def key(stops: list[tuple[float, str]], datum: str, credit: str, url: str) -> dict[str, object]:
    """Put a key as the site reads it: its stops (km, colour), datum, and where it comes from."""
    return {
        "datum": datum,
        "credit": credit,
        "source": url,
        "stops": [[km, colour] for km, colour in stops],
    }


def fetch_planet_keys(  # pragma: no cover - needs network access
    path: Path, textures: Path, cache: Path
) -> int:
    """Download the grids and the legend once into ``cache``, and write the keys to ``path``."""
    keys: dict[str, object] = {}
    for grid in GRIDS:
        file = cache / grid.url.rsplit("/", 1)[-1]
        if not file.exists():
            download(grid.url, file)
        heights = heights_km(checked(file, grid.sha256).read_bytes(), grid.dtype, grid.scale)
        with Image.open(textures / grid.texture) as image:
            shrunk = image.convert("RGB").resize((GRID[1], GRID[0]), Image.Resampling.BOX)
        colours: FloatArray = np.asarray(shrunk, dtype=np.float64)
        keys[grid.body] = key(measured_stops(heights, colours), grid.datum, grid.credit, grid.url)
    legend_file = cache / "venus-legend.png"
    if not legend_file.exists():
        download(VENUS_LEGEND, legend_file)
    with Image.open(checked(legend_file, VENUS_LEGEND_SHA256)) as image:
        legend: FloatArray = np.asarray(image.convert("RGB"), dtype=np.float64)
    keys["venus"] = key(
        legend_stops(legend),
        "above a radius of 6,051 km",
        "read off USGS Astrogeology\u2019s legend to the map",
        VENUS_LEGEND,
    )
    swatches: dict[str, object] = {}
    for entry in SWATCH_KEYS:
        with Image.open(textures / entry.texture) as image:
            pixels: FloatArray = np.asarray(image.convert("RGB"), dtype=np.float64)
        swatches[entry.body] = swatch_key(pixels, entry)
    path.parent.mkdir(parents=True, exist_ok=True)
    data = {"schemaVersion": 2, "keys": keys, "swatches": swatches}
    _ = path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n")
    return len(keys)
