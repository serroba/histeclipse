"""The great mass extinctions' places, and where each lay at its time.

Each extinction is marked where its main cause lay, where one is known or argued (the Siberian
and Emeishan Traps, the Central Atlantic Magmatic Province, Chicxulub, the Deccan and Viluy
Traps), and where it is dated: the boundary's reference section (its GSSP), or for the
end-Ordovician, the ice sheet's deposits in the Sahara. Places are approximate, to a tenth of a
degree or so: enough to mark a site on a globe, not to find it in the field.

Each place is carried back to where it lay every 5 million years, to the step past its
extinction, on the PALEOMAP reconstruction (Scotese), the model behind the deep-time surface
maps, by the GPlates Web Service (EarthByte, https://gws.gplates.org), as the impact craters are.
At its extinction each is placed on a second model too, Merdith et al. (2021), so a card can say
how far the two disagree (#1231): positions then differ by hundreds of kilometres between models.
"""

import datetime as dt
import json
import math
from dataclasses import dataclass
from typing import TYPE_CHECKING

from histeclipse_pipeline.impacts import STEP_MA, Position, Reconstruct, reconstruct_points

if TYPE_CHECKING:
    from collections.abc import Callable
    from pathlib import Path

    from histeclipse_pipeline.sky import Json

CREDIT = (
    "Places compiled for this site from the studies each extinction's card cites; places when "
    "they formed from the PALEOMAP model (Scotese) by the GPlates Web Service (EarthByte), "
    "compared at each extinction with Merdith et al. (2021)"
)

#: The second plate model each site is placed on at its extinction (#1231), and its name.
COMPARED_MODEL = "MERDITH2021"
COMPARED_NAME = "Merdith et al. 2021"
SOURCE = "https://gws.gplates.org"


@dataclass(frozen=True)
class Site:
    """A place an extinction is marked: its cause, or where it is dated."""

    id: str
    #: The extinction's id, as the site's milestones name it.
    extinction: str
    name: str
    #: ``cause``: what is held (or argued) to have caused it; ``record``: where it is dated.
    role: str
    latitude: float
    longitude: float
    #: When it lay where it is marked, Ma: the extinction's age.
    ma: float


SITES: tuple[Site, ...] = (
    Site(
        "hirnantian-ice",
        "end-ordovician-extinction",
        "Hirnantian ice sheet, Tassili n\u2019Ajjer",
        "cause",
        25.7,
        8.2,
        444.0,
    ),
    Site(
        "dobs-linn",
        "end-ordovician-extinction",
        "Dob\u2019s Linn, Scotland",
        "record",
        55.44,
        -3.27,
        444.0,
    ),
    # The Hirnantian's base, the Ordovician's last stage, its GSSP (Chen et al. 2006).
    Site(
        "wangjiawan",
        "end-ordovician-extinction",
        "Wangjiawan, China",
        "record",
        30.98,
        111.42,
        444.0,
    ),
    Site(
        "viluy-traps",
        "late-devonian-extinction",
        "Viluy Traps, Yakutia",
        "cause",
        64.0,
        118.0,
        372.2,
    ),
    Site(
        "coumiac",
        "late-devonian-extinction",
        "Coumiac, Montagne Noire",
        "record",
        43.46,
        3.04,
        372.2,
    ),
    Site(
        "siberian-traps",
        "end-permian-extinction",
        "Siberian Traps, Putorana",
        "cause",
        68.5,
        94.0,
        251.9,
    ),
    Site(
        "norilsk", "end-permian-extinction", "Siberian Traps, Norilsk", "cause", 69.35, 88.2, 251.9
    ),
    Site(
        "emeishan-traps",
        "end-guadalupian-extinction",
        "Emeishan Traps, Sichuan",
        "cause",
        29.52,
        103.33,
        259.8,
    ),
    Site("meishan", "end-permian-extinction", "Meishan, China", "record", 31.08, 119.71, 251.9),
    # The extinction on land, in the south: Old Lootsberg Pass (Gastaldo et al. 2020, samples
    # near 31°47.7'S 24°48.3'E), and Frazer Beach (Fielding et al. 2019; McLoughlin et al. 2021).
    Site(
        "lootsberg",
        "end-permian-extinction",
        "Old Lootsberg Pass, Karoo Basin",
        "record",
        -31.8,
        24.81,
        251.9,
    ),
    Site(
        "frazer-beach",
        "end-permian-extinction",
        "Frazer Beach, Sydney Basin",
        "record",
        -33.19,
        151.62,
        251.9,
    ),
    Site(
        "camp-palisades",
        "end-triassic-extinction",
        "Central Atlantic Magmatic Province, Palisades",
        "cause",
        40.85,
        -73.95,
        201.5,
    ),
    Site(
        "camp-morocco",
        "end-triassic-extinction",
        "Central Atlantic Magmatic Province, High Atlas",
        "cause",
        31.5,
        -7.5,
        201.5,
    ),
    Site("kuhjoch", "end-triassic-extinction", "Kuhjoch, Austria", "record", 47.48, 11.53, 201.5),
    # Its sea and land together, the headland at St Audrie's Bay (Hesselbo et al. 2002).
    Site(
        "st-audries-bay",
        "end-triassic-extinction",
        "St Audrie\u2019s Bay, England",
        "record",
        51.18,
        -3.28,
        201.5,
    ),
    Site("chicxulub", "k-pg-extinction", "Chicxulub", "cause", 21.4, -89.52, 66.0),
    Site(
        "deccan-traps",
        "k-pg-extinction",
        "Deccan Traps, Western Ghats",
        "cause",
        17.92,
        73.66,
        66.0,
    ),
    Site("el-kef", "k-pg-extinction", "El Kef, Tunisia", "record", 36.15, 8.65, 66.0),
    # Where the boundary clay's iridium was first found (Alvarez et al. 1980).
    Site(
        "gubbio",
        "k-pg-extinction",
        "Bottaccione Gorge, Gubbio",
        "record",
        43.36,
        12.58,
        66.0,
    ),
)

#: How far either side of its extinction a site is marked, Ma: its positions reach the step past.
AROUND_MA = 5


def steps_needed(site: Site) -> int:
    """How many 5-million-year steps back its position is wanted: to the step past its time."""
    return math.ceil((site.ma + AROUND_MA) / STEP_MA) + 1


def positions_then(sites: tuple[Site, ...], reconstruct: Reconstruct) -> dict[str, list[Position]]:
    """Each site's place (latitude, longitude) at every step back to the one past its time."""
    then: dict[str, list[Position]] = {site.id: [(site.latitude, site.longitude)] for site in sites}
    last = max(steps_needed(site) for site in sites)
    for step in range(1, last):
        wanted = [site for site in sites if steps_needed(site) > step]
        placed = reconstruct([(site.latitude, site.longitude) for site in wanted], step * STEP_MA)
        for site, position in zip(wanted, placed, strict=True):
            then[site.id].append(position)
    return then


def positions_compared(
    sites: tuple[Site, ...],
    reconstruct: Callable[[list[tuple[float, float]], float], list[Position]],
) -> dict[str, Position]:
    """Each site's place at its own extinction on the second model, asked once for each age."""
    by_age: dict[float, list[Site]] = {}
    for site in sites:
        by_age.setdefault(site.ma, []).append(site)
    placed: dict[str, Position] = {}
    for ma, group in sorted(by_age.items()):
        points = [(site.latitude, site.longitude) for site in group]
        for site, position in zip(group, reconstruct(points, ma), strict=True):
            placed[site.id] = position
    return placed


def _flat(position: Position) -> Json:
    if position is None:
        return None
    return [round(position[0] * 100), round(position[1] * 100)]


def extinctions_file(
    sites: tuple[Site, ...],
    then: dict[str, list[Position]],
    compared: dict[str, Position],
    accessed: str,
) -> dict[str, Json]:
    """Build the site's file: each place, its places then and on the second model, x 100."""
    return {
        "schemaVersion": 1,
        "sources": ["gplates", "merdith2021", "paleodem"],
        "credit": CREDIT,
        "source": SOURCE,
        "accessed": accessed,
        "licence": (
            "none stated (GPlates Web Service); none stated (Merdith et al. 2021); CC BY 4.0 "
            "(PALEOMAP)"
        ),
        "changes": (
            "Places compiled for this site from the studies each extinction's card cites; "
            "where each was when it formed worked out by the GPlates Web Service"
        ),
        "stepMa": STEP_MA,
        "scale": 100,
        "compared": {"model": COMPARED_MODEL, "name": COMPARED_NAME},
        "sites": [
            {
                "id": site.id,
                "extinction": site.extinction,
                "name": site.name,
                "role": site.role,
                "then": [_flat(position) for position in then[site.id]],
                "other": _flat(compared.get(site.id)),
            }
            for site in sites
        ],
    }


def fetch_extinctions(path: Path) -> int:  # pragma: no cover - needs network access
    """Carry each site back through time and write the site's file."""
    then = positions_then(SITES, reconstruct_points)
    compared = positions_compared(
        SITES, lambda points, ma: reconstruct_points(points, ma, COMPARED_MODEL)
    )
    accessed = dt.datetime.now(tz=dt.UTC).date().isoformat()
    data = extinctions_file(SITES, then, compared, accessed)
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n")
    return len(SITES)
