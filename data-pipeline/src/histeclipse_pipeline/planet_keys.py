"""The colour keys for the height views (#334): which colour stands for which height.

USGS publishes no legend for its colour shaded reliefs of Mars (MOLA) and the Moon (LOLA), so
their keys are measured: the colours of the very maps the site shows, read against the
altimetry heights at the same places (the MOLA MEGDR and the LOLA LDEM, 4 pixels a degree, from
the PDS Geosciences Node), and summed up as one colour a kilometre of height. The shading in
those maps darkens slopes facing away from its light; the lit half of each kilometre's pixels
gives its colour. Within 70° of the equator only, where the maps and grids are least stretched.

Venus's map comes with its legend (USGS Astrogeology): a bar from 3 km below to 11 km above a
radius of 6,051 km. Its key is read off that bar, a colour at each kilometre's tick.

Each source is pinned by checksum. The keys go to one JSON file, loaded when a height view
shows.
"""

from __future__ import annotations

import json
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
    path.parent.mkdir(parents=True, exist_ok=True)
    data = {"schemaVersion": 1, "keys": keys}
    _ = path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n")
    return len(keys)
