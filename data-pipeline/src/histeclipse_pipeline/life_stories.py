"""An animal's story through time, place and climate: PBDB finds crossed with Scotese's maps.

A prototype. For each fossil group this writes one file a browser can tell a lineage's story
from without any other: the Paleobiology Database's classification (CC BY 4.0) as the lines
through time keep it (`time_tree`), each name's common name where PBDB has one, and each genus's
sites every 5 million years, as `time_tree` groups them, with two things more for each site:

- the part of today's world its finds are in (North America, Africa…), from the finds' places
  today. A site is where it lay then; the region says which land carried it there, so a reader
  can be told "first found in Eurasia" on a map where Eurasia sat elsewhere;
- the mean annual surface temperature there then, read from Scotese's (2022) map of that age at
  the site's place on the same PALEOMAP reconstruction (`paleotemp`).

Regions are boxes drawn on today's map, good to a continent and no finer: a find on an island
between two may fall to either. The 65 Ma temperature map is far colder than its neighbours
(see `paleotemp.NOTES`), so sites of that step carry no temperature.

The downloads are read from a cache folder (`taxa-<group>.csv`, `occs-<group>.csv`), fetched
with `curl -4` as the pipeline's downloads hang on IPv6 here:

    taxa/list.csv?base_name=<q>&rel=all_children&taxon_status=valid&show=app,parent,common
    occs/list.csv?base_name=<q>&show=paleoloc,coords&pgm=scotese
"""

import csv
import datetime as dt
import io
import json
import math
from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import TYPE_CHECKING

import numpy as np
from PIL import Image

from histeclipse_pipeline.fossils import STEP_MA, WIDEST_SPAN_MA
from histeclipse_pipeline.paleotemp import COLDEST, NOTES, WARMEST
from histeclipse_pipeline.time_tree import (
    CREDIT,
    SITE_KM,
    SOURCE,
    Taxon,
    distance_km,
    genus_of,
    middle_of,
    parse_taxa,
    tree_file,
)

if TYPE_CHECKING:
    from pathlib import Path

    from histeclipse_pipeline.sky import Json

#: The groups a story can be told of, with their own name in PBDB.
GROUPS: tuple[tuple[str, str, str], ...] = (
    ("mammals", "Mammals", "Mammalia"),
    ("dinosaurs", "Non-avian dinosaurs", "Dinosauria"),
)
REGIONS: tuple[str, ...] = (
    "North America",
    "South America",
    "Europe",
    "Africa",
    "Asia",
    "Oceania",
    "Antarctica",
)
NORTH_AMERICA, SOUTH_AMERICA, EUROPE, AFRICA, ASIA, OCEANIA, ANTARCTICA = range(7)


@dataclass(frozen=True)
class Placed:
    """A find: its genus (PBDB's number), its step, where it lay then and where it is today."""

    genus: int
    step: int
    then: tuple[float, float]
    today: tuple[float, float]


def region_of(latitude: float, longitude: float) -> int:  # noqa: PLR0911
    """Name the part of today's world a place (today's latitude and longitude) is in."""
    if latitude < -60:
        return ANTARCTICA
    if longitude < -30:
        # Panama's narrowest land is the join: east of it and south of the Caribbean, the south.
        return SOUTH_AMERICA if latitude < 12.5 and longitude > -82 else NORTH_AMERICA
    if longitude > 110 and latitude < -10 or longitude > 130 and latitude < 0:
        return OCEANIA
    arabia = longitude >= 35 and latitude >= 12.5
    aegean = latitude > 34 and longitude > 20
    in_africa = -20 <= longitude <= 52 and (
        latitude < 35.5 or (latitude < 37.5 and -1 <= longitude <= 11.5)
    )
    if in_africa and not arabia and not aegean:
        return AFRICA
    if latitude >= 34 and (longitude < 26 or (longitude < 60 and latitude > 42)):
        return EUROPE
    return ASIA


def _number(text: str | None) -> float | None:
    try:
        value = float(text or "")
    except ValueError:
        return None
    return value if math.isfinite(value) else None


def parse_common(text: str) -> dict[int, str]:
    """Read each valid name's common name, by PBDB number, where it has one."""
    common: dict[int, str] = {}
    for row in csv.DictReader(io.StringIO(text)):
        number = _number(row.get("orig_no"))
        name = (row.get("common_name") or "").strip()
        if number is not None and name and _number(row.get("accepted_no")) == number:
            common[int(number)] = name
    return common


def parse_living(text: str) -> set[int]:
    """Read which valid names PBDB marks as living today.

    The lines through time call a genus living when its last find is of the Holocene, which
    makes the mammoths living; here PBDB's own mark is read. It is wrong for a few names, and
    the non-avian dinosaurs' file takes none from it.
    """
    living: set[int] = set()
    for row in csv.DictReader(io.StringIO(text)):
        number = _number(row.get("orig_no"))
        if number is not None and row.get("is_extant") == "extant":
            living.add(int(number))
    return living


def parse_placed(text: str, taxa: dict[int, Taxon]) -> list[Placed]:
    """Read the finds with a genus, an age range narrow enough, and a place then and today."""
    placed: list[Placed] = []
    for row in csv.DictReader(io.StringIO(text)):
        names = ("accepted_no", "max_ma", "min_ma", "paleolat", "paleolng", "lat", "lng")
        number, max_ma, min_ma, paleolat, paleolng, lat, lng = (
            _number(row.get(name)) for name in names
        )
        if number is None or max_ma is None or min_ma is None:
            continue
        if paleolat is None or paleolng is None or lat is None or lng is None:
            continue
        if max_ma - min_ma > WIDEST_SPAN_MA:
            continue
        genus = genus_of(int(number), taxa)
        if genus is None:
            continue
        step = round((max_ma + min_ma) / 2 / STEP_MA) * STEP_MA
        placed.append(Placed(genus, step, (paleolat, paleolng), (lat, lng)))
    return placed


class Temperatures:
    """Scotese's maps as the site packs them (`public/data/paleotemp`), read at a place."""

    def __init__(self, folder: Path) -> None:
        self._folder = folder
        index = json.loads((folder / "index.json").read_text())
        self.means: dict[int, float] = {
            int(frame["ma"]): float(frame["mean"]) for frame in index["frames"]
        }
        self._maps: dict[int, np.ndarray | None] = {}

    def at(self, ma: int, latitude: float, longitude: float) -> float | None:
        """Read the temperature (°C) at a place on the map of `ma`; None where there is no map."""
        if ma in NOTES or ma not in self.means:
            return None
        if ma not in self._maps:
            path = self._folder / f"{ma}.png"
            self._maps[ma] = np.asarray(Image.open(path)) if path.exists() else None
        grid = self._maps[ma]
        if grid is None:
            return None
        row = min(180, max(0, round(90 - latitude)))
        column = min(360, max(0, round(longitude + 180)))
        return round(COLDEST + float(grid[row, column]) / 255 * (WARMEST - COLDEST), 1)


type Site = tuple[int, float, float, int, int, float | None]


def sites(placed: list[Placed], temperatures: Temperatures) -> dict[int, list[Site]]:
    """Each genus's sites by step: (Ma, latitude then, longitude then, finds, region, °C)."""
    by_genus: dict[int, dict[int, list[Placed]]] = defaultdict(lambda: defaultdict(list))
    for find in placed:
        by_genus[find.genus][find.step].append(find)
    out: dict[int, list[Site]] = {}
    for genus, steps in by_genus.items():
        rows: list[Site] = []
        for step, finds in sorted(steps.items()):
            groups: list[list[Placed]] = []
            for find in sorted(finds, key=lambda each: each.then):
                for group in groups:
                    if distance_km(group[0].then, find.then) <= SITE_KM:
                        group.append(find)
                        break
                else:
                    groups.append([find])
            for group in sorted(groups, key=lambda each: (-len(each), each[0].then)):
                latitude, longitude = middle_of([find.then for find in group])
                region = Counter(region_of(*find.today) for find in group).most_common(1)[0][0]
                rows.append(
                    (
                        step,
                        latitude,
                        longitude,
                        len(group),
                        region,
                        temperatures.at(step, latitude, longitude),
                    )
                )
        out[genus] = rows
    return out


def story_file(
    group: tuple[str, str, str],
    taxa: dict[int, Taxon],
    common: dict[int, str],
    living: set[int],
    found: dict[int, list[Site]],
    temperatures: Temperatures,
    accessed: str,
) -> dict[str, Json]:
    """Build a group's file: the lines' classification, common names, and each genus's sites."""
    group_id, name, root = group
    tree = tree_file(
        (group_id, name),
        root,
        taxa,
        {genus: [(s[0], s[1], s[2], s[3]) for s in rows] for genus, rows in found.items()},
        accessed,
    )
    order = tree["pbdb"]
    if not isinstance(order, list):
        msg = "the tree has no order"
        raise TypeError(msg)
    numbers = [int(number) for number in order if isinstance(number, int)]
    return {
        "schemaVersion": 1,
        "credit": (
            f"{CREDIT}; temperatures from Scotese (2022), Global Mean Surface Temperatures "
            "for 100 Phanerozoic Time Intervals, CC BY 4.0"
        ),
        "source": SOURCE,
        "accessed": accessed,
        "id": group_id,
        "name": name,
        "stepMa": STEP_MA,
        "ranks": tree["ranks"],
        "regions": list(REGIONS),
        "pbdb": tree["pbdb"],
        "names": tree["names"],
        "common": [common.get(number, "") for number in numbers],
        "living": [1 if number in living else 0 for number in numbers],
        "rank": tree["rank"],
        "parent": tree["parent"],
        "first": tree["first"],
        "last": tree["last"],
        # Each genus's sites as [Ma, latitude, longitude, finds, region, °C or null, …].
        "sites": [
            [value for site in found.get(number, []) for value in site] for number in numbers
        ],
        # The globe's mean temperature at each map's age, as the maps' index gives it.
        "globe": [
            [ma, mean] for ma, mean in sorted(temperatures.means.items()) if ma not in NOTES
        ],
    }


def write_life_stories(cache: Path, maps: Path, out: Path) -> int:
    """Write each group's file from the cached downloads; count the genera with sites."""
    accessed = dt.datetime.now(tz=dt.UTC).date().isoformat()
    temperatures = Temperatures(maps)
    out.mkdir(parents=True, exist_ok=True)
    total = 0
    for group in GROUPS:
        text = (cache / f"taxa-{group[0]}.csv").read_text()
        taxa = parse_taxa(text)
        found = sites(parse_placed((cache / f"occs-{group[0]}.csv").read_text(), taxa), temperatures)
        living = parse_living(text) if group[0] != "dinosaurs" else set[int]()
        built = story_file(group, taxa, parse_common(text), living, found, temperatures, accessed)
        kept = built["sites"]
        total += sum(1 for each in kept if each) if isinstance(kept, list) else 0
        _ = (out / f"{group[0]}.json").write_text(json.dumps(built, separators=(",", ":")) + "\n")
    return total


if __name__ == "__main__":  # pragma: no cover - a prototype's own entry
    import sys
    from pathlib import Path as _Path

    print(write_life_stories(_Path(sys.argv[1]), _Path(sys.argv[2]), _Path(sys.argv[3])))  # noqa: T201
