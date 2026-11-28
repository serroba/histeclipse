"""The doors between the continents: when land joined them, read from the elevation maps.

For the animals' stories. A lineage found on one continent and then on another
either walked or crossed water; which, depends on whether land joined the two then. This reads
that from the same maps the deep-time globe draws (PALEOMAP PaleoDEMs, Scotese & Wright 2018,
as `paleodem` packs them), every 5 million years:

- a few places well inside each of today's lands are carried back to where they lay then, on
  the PALEOMAP plate model, by the GPlates Web Service (as the impact craters are);
- on the map of that age, two lands are *joined by land* when a path over cells above sea
  level runs from a place of one to a place of the other, and *by a shallow sea* when the path
  needs cells no deeper than the map's shallowest step (about 130 m: a shelf that a low sea
  level bares, as the ice ages bared Beringia);
- otherwise sea lay between them.

India is kept apart from Asia, and Arabia is left out of both Africa's and Asia's places, as
they sailed or split on their own. What this cannot see: the maps are smoothed to 0.2°, so a
narrow isthmus or strait may read the other way; they show one sea level for each 5 million
years, not its swings; and a place carried back may lie under an inland sea, when it is left
out. The answers are the maps' own, not a judgement of the literature: where the two differ,
the story should say so.
"""

import datetime as dt
import json
from collections import deque
from itertools import combinations
from typing import TYPE_CHECKING, cast

import numpy as np
from PIL import Image

from histeclipse_pipeline.fossils import STEP_MA
from histeclipse_pipeline.header import header
from histeclipse_pipeline.impacts import reconstruct_points
from histeclipse_pipeline.life_stories import REGIONS
from histeclipse_pipeline.paleodem import SEA_LEVEL_BYTE

if TYPE_CHECKING:
    from pathlib import Path

    import numpy.typing as npt

    from histeclipse_pipeline.sky import Json

#: The lands a door can join: the stories' regions, and India on its own.
LANDS: tuple[str, ...] = (*REGIONS, "India")
#: Places well inside each land today (latitude, longitude).
PLACES: dict[str, tuple[tuple[float, float], ...]] = {
    "North America": ((45, -100), (55, -105), (38, -90), (64, -150), (62, -135), (50, -75)),
    "South America": ((-10, -55), (-25, -60), (-40, -68), (4, -65), (-15, -45)),
    "Europe": ((50, 10), (55, 30), (45, 2), (60, 15), (52, 40)),
    "Africa": ((10, 20), (-10, 25), (-25, 25), (20, 0), (5, 38), (28, 25)),
    # With Iran and Anatolia, Eurasia's own southern edge, so that ground is not India's.
    "Asia": ((60, 100), (45, 90), (35, 105), (65, 140), (50, 70), (67, 172), (33, 55), (39, 33)),
    "Oceania": ((-25, 135), (-30, 145), (-22, 120)),
    "Antarctica": ((-80, 0), (-75, 100), (-80, -100), (-70, -65)),
    "India": ((22, 78), (15, 77), (25, 82)),
}
OLDEST_MA = 250
#: The shallowest step of the maps' sea: bytes this high or higher are land or shelf.
SHELF_BYTE = SEA_LEVEL_BYTE - 2
#: How far (cells) a place under water is moved to the nearest land or shelf before left out.
NEAR_CELLS = 5
APART, SHELF, LAND = 0, 1, 2

type Seeds = dict[str, list[tuple[float, float]]]


def cell_of(latitude: float, longitude: float, rows: int, columns: int) -> tuple[int, int]:
    """Find the map's cell at a place: north at the top, 180° W at the left."""
    row = min(rows - 1, max(0, round((90 - latitude) / 180 * (rows - 1))))
    column = round((longitude + 180) / 360 * (columns - 1)) % (columns - 1)
    return row, column


def _shape(grid: npt.NDArray[np.bool_] | npt.NDArray[np.uint8]) -> tuple[int, int]:
    rows, columns = map(int, grid.shape)
    return rows, columns


def touching(
    open_cells: npt.NDArray[np.bool_], starts: list[tuple[int, int]], owners: list[int]
) -> set[tuple[int, int]]:
    """Find which owners' ground touches.

    Each open cell goes to the owner whose start is nearest over open cells, and two owners
    touch where their cells do. So a door is between two lands themselves: North America
    reaches Europe by way of Asia only as two doors, not as one of its own. Cells touch along
    edges and corners, and the map wraps east to west; its last column repeats its first, and
    is left out.
    """
    rows, columns = _shape(open_cells)
    columns -= 1
    owner: npt.NDArray[np.int16] = np.full((rows, columns), -1, dtype=np.int16)
    queue: deque[tuple[int, int]] = deque()
    for (row, column), who in zip(starts, owners, strict=True):
        if open_cells[row, column] and owner[row, column] < 0:
            owner[row, column] = who
            queue.append((row, column))
    pairs: set[tuple[int, int]] = set()
    while queue:
        r, c = queue.popleft()
        mine = int(cast("np.int16", owner[r, c]))
        for dr in (-1, 0, 1):
            nr = r + dr
            if nr < 0 or nr >= rows:
                continue
            for dc in (-1, 0, 1):
                nc = (c + dc) % columns
                if not open_cells[nr, nc]:
                    continue
                theirs = int(cast("np.int16", owner[nr, nc]))
                if theirs < 0:
                    owner[nr, nc] = mine
                    queue.append((nr, nc))
                elif theirs != mine:
                    pairs.add((min(mine, theirs), max(mine, theirs)))
    return pairs


def nearest_open(
    open_cells: npt.NDArray[np.bool_], cell: tuple[int, int]
) -> tuple[int, int] | None:
    """Move a cell to the nearest open one within `NEAR_CELLS`; None if there is none."""
    rows, columns = _shape(open_cells)
    columns -= 1
    row, column = cell
    for reach in range(NEAR_CELLS + 1):
        for dr in range(-reach, reach + 1):
            for dc in range(-reach, reach + 1):
                r, c = row + dr, (column + dc) % columns
                if 0 <= r < rows and max(abs(dr), abs(dc)) == reach and open_cells[r, c]:
                    return r, c
    return None


def joined(heights: npt.NDArray[np.uint8], seeds: Seeds) -> dict[tuple[str, str], int]:
    """Say which lands touched on a map: over land, or over a shelf; the others stood apart."""
    out: dict[tuple[str, str], int] = {}
    rows, columns = _shape(heights)
    for state, floor in ((SHELF, SHELF_BYTE), (LAND, SEA_LEVEL_BYTE)):
        open_cells = heights >= floor
        starts: list[tuple[int, int]] = []
        owners: list[int] = []
        for land, places in seeds.items():
            for latitude, longitude in places:
                cell = nearest_open(open_cells, cell_of(latitude, longitude, rows, columns))
                if cell is not None:
                    starts.append(cell)
                    owners.append(LANDS.index(land))
        for a, b in touching(open_cells, starts, owners):
            out[LANDS[a], LANDS[b]] = state
    return out


def doors_file(by_step: dict[int, dict[tuple[str, str], int]], accessed: str) -> dict[str, Json]:
    """Build the site's file: each pair of lands ever joined, and how it stood at each step."""
    steps = sorted(by_step)
    pairs = [
        pair for pair in combinations(LANDS, 2) if any(pair in by_step[step] for step in steps)
    ]
    return {
        **header(
            version=1,
            sources=["paleodem", "gplates"],
            credit=(
                "Read for this site from the PALEOMAP PaleoDEMs (Scotese & Wright 2018, "
                "CC BY 4.0), with places carried back on the PALEOMAP model by the GPlates "
                "Web Service"
            ),
            licence="CC BY 4.0 for the maps; none stated for the GPlates Web Service",
            accessed=accessed,
            changes=(
                "Derived, not copied: on each map, every cell above sea level given to the "
                "land whose place is nearest over such cells, and two lands called joined "
                "where their cells touch; a shallow sea between where they touch only with "
                "cells up to about 130 m deep counted too"
            ),
        ),
        "source": "https://zenodo.org/records/5460860",
        "stepMa": STEP_MA,
        "lands": [str(land) for land in LANDS],
        "steps": [int(step) for step in steps],
        "shelfMetres": 130,
        # Each door: its two lands (indices), and at each step 0 apart, 1 a shallow sea
        # between, 2 joined by land.
        "doors": [
            {
                "a": LANDS.index(a),
                "b": LANDS.index(b),
                "states": [by_step[step].get((a, b), APART) for step in steps],
            }
            for a, b in pairs
        ],
    }


def seeds_then(cache: Path) -> dict[int, Seeds]:  # pragma: no cover - needs network access
    """Carry each land's places back to each step, keeping the answers in the cache."""
    kept: dict[str, Seeds] = json.loads(cache.read_text()) if cache.exists() else {}
    flat = [(land, place) for land, places in PLACES.items() for place in places]
    for ma in range(0, OLDEST_MA + 1, STEP_MA):
        if str(ma) in kept:
            continue
        then = (
            [place for _, place in flat]
            if ma == 0
            else reconstruct_points([place for _, place in flat], ma)
        )
        seeds: Seeds = {}
        for (land, _), position in zip(flat, then, strict=True):
            if position is not None:
                seeds.setdefault(land, []).append((position[0], position[1]))
        kept[str(ma)] = seeds
        cache.parent.mkdir(parents=True, exist_ok=True)
        _ = cache.write_text(json.dumps(kept))
        print(f"doors: places at {ma} Ma", flush=True)  # noqa: T201
    return {
        int(ma): {land: [(p[0], p[1]) for p in places] for land, places in seeds.items()}
        for ma, seeds in kept.items()
    }


def write_life_doors(
    maps: Path, cache: Path, out: Path
) -> int:  # pragma: no cover - needs network access
    """Write the doors' file from the elevation maps; count the doors."""
    by_step: dict[int, dict[tuple[str, str], int]] = {}
    for ma, seeds in sorted(seeds_then(cache).items()):
        path = maps / f"{ma}.png"
        if path.exists():
            by_step[ma] = joined(np.asarray(Image.open(path), dtype=np.uint8), seeds)
    accessed = dt.datetime.now(tz=dt.UTC).date().isoformat()
    built = doors_file(by_step, accessed)
    _ = out.write_text(json.dumps(built, separators=(",", ":")) + "\n")
    doors = built["doors"]
    return len(doors) if isinstance(doors, list) else 0
