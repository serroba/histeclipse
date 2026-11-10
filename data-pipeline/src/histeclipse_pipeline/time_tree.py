"""The fossil groups' trees through time and place, from the Paleobiology Database (#358).

The Paleobiology Database (https://paleobiodb.org), CC BY 4.0, classifies each group it holds:
every valid name with its parent, its rank, and the ages of its first and last finds. Its
occurrences carry each find's place at its age on the PALEOMAP reconstruction (Scotese), as the
site's fossil counts do. Together they draw each genus as a line through time that drifts with
its finds, joined to its family, order and so on up to the group.

For each genus with a placed find, this keeps:

- its first and last appearance (Ma), as PBDB computes them from all its finds (0 if living);
- its sites in each 5-million-year step, the step centred on a map's age (a find is counted at
  the middle of its age range, and one dated only to a span wider than 15 million years is left
  out, as for the fossil counts). Finds within 500 km of a site's first find are one site, at
  their middle; finds further apart stay apart. A genus found on two continents is shown on
  both, not at a middle in the sea between them, and nothing is drawn between steps: a genus
  found in Asia then in North America was found there, not seen crossing;
- how many valid species PBDB lists in it.

Names PBDB flags as for traces (footprints, burrows) or forms (eggs) are left out: they name
what an animal left, not the animal, and one maker can leave several kinds.

A find is matched to its genus by PBDB's number for the name it is accepted as (a synonym's
finds go to the senior name), up through species and subgenus. Each kept genus's ancestors up to
the group are kept with their ranks; a group spans its kept members, from the first appearance
of its oldest to the last of its youngest.

The database grows, so a download is not pinned by checksum: the file records when it was
accessed. Each group is a file of its own, as a browser loads one at a time.
"""

import csv
import datetime as dt
import io
import json
import math
from collections import defaultdict
from dataclasses import dataclass
from typing import TYPE_CHECKING

from histeclipse_pipeline.fossils import API as OCCURRENCES
from histeclipse_pipeline.fossils import STEP_MA, WIDEST_SPAN_MA
from histeclipse_pipeline.fossils import _download as download  # pyright: ignore[reportPrivateUsage]
from histeclipse_pipeline.sky import Json

if TYPE_CHECKING:
    from collections.abc import Iterable
    from pathlib import Path

TAXA = (
    "https://paleobiodb.org/data1.2/taxa/list.csv?base_name={taxon}&rel=all_children"
    "&taxon_status=valid&show=app,parent&vocab=pbdb"
)
SOURCE = "https://paleobiodb.org"
CREDIT = (
    "The Paleobiology Database (paleobiodb.org), CC BY 4.0: its classification and finds; "
    "places at their age on the PALEOMAP reconstruction (Scotese)"
)
#: Each group: identifier, name, the group's own name in PBDB, and the query (^ excludes).
GROUPS: tuple[tuple[str, str, str, str], ...] = (
    ("trilobites", "Trilobites", "Trilobita", "Trilobita"),
    ("ammonoids", "Ammonoids", "Ammonoidea", "Ammonoidea"),
    # PBDB hangs the game birds (Galliformes) beside Aves, under Ornithurae: both are left out.
    ("dinosaurs", "Non-avian dinosaurs", "Dinosauria", "Dinosauria%5EAves%5EOrnithurae"),
    ("mammals", "Mammals", "Mammalia", "Mammalia"),
)
#: The ranks a file names, from the group down; any other (an unranked clade) is "clade".
RANKS: tuple[str, ...] = (
    "class",
    "subclass",
    "infraclass",
    "superorder",
    "order",
    "suborder",
    "infraorder",
    "superfamily",
    "family",
    "subfamily",
    "tribe",
    "subtribe",
    "genus",
    "clade",
)
#: A genus last found this recently (Ma, the Holocene) is living.
LIVING_MA = 0.0117
#: Finds within this distance (km) of a site's first find are one site.
SITE_KM = 500.0
#: The Earth's mean radius (km).
EARTH_KM = 6371.0
#: Below this length, the places' summed directions cancel: they have no middle.
NO_MIDDLE = 1e-9
#: Ranks below a genus, through which a find is matched to its genus.
BELOW_GENUS = frozenset({"subgenus", "species", "subspecies"})


@dataclass(frozen=True)
class Taxon:
    """A valid name in PBDB's classification."""

    number: int
    name: str
    rank: str
    parent: int | None
    #: The oldest bound of its first appearance, and the youngest of its last (Ma).
    first_ma: float | None
    last_ma: float | None
    #: A name for traces (footprints, burrows) or a form (eggs), not for an animal's remains.
    trace: bool = False


@dataclass(frozen=True)
class Find:
    """An occurrence: the name it is accepted as (PBDB's number), its age range, its place then."""

    number: int
    max_ma: float
    min_ma: float
    paleolat: float
    paleolng: float


def _number(text: str | None) -> float | None:
    try:
        value = float(text or "")
    except ValueError:
        return None
    return value if math.isfinite(value) else None


def parse_taxa(text: str) -> dict[int, Taxon]:
    """Read the classification's valid names, by PBDB number; synonyms' rows are left out."""
    taxa: dict[int, Taxon] = {}
    for row in csv.DictReader(io.StringIO(text)):
        number = _number(row.get("orig_no"))
        # A synonym is listed as a row of its own, numbered apart from the name it is accepted as.
        if number is None or _number(row.get("accepted_no")) != number:
            continue
        parent = _number(row.get("parent_no"))
        last = _number(row.get("lastapp_min_ma"))
        taxa[int(number)] = Taxon(
            number=int(number),
            name=row.get("accepted_name") or row.get("taxon_name") or "",
            rank=row.get("accepted_rank") or row.get("taxon_rank") or "",
            parent=None if parent is None or parent == 0 else int(parent),
            first_ma=_number(row.get("firstapp_max_ma")),
            # Still living: found in the last 11,700 years (PBDB's own "extant" flag is
            # sometimes set on long-extinct genera, so it is not read).
            last_ma=0.0 if last is not None and last <= LIVING_MA else last,
            trace=bool({"I", "F"} & set(row.get("flags") or "")),
        )
    return taxa


def parse_finds(text: str) -> list[Find]:
    """Read the occurrences with an accepted name, an age range and a reconstructed place."""
    found: list[Find] = []
    for row in csv.DictReader(io.StringIO(text)):
        names = ("accepted_no", "max_ma", "min_ma", "paleolat", "paleolng")
        number, max_ma, min_ma, paleolat, paleolng = (_number(row.get(name)) for name in names)
        if number is None or max_ma is None or min_ma is None:
            continue
        if paleolat is None or paleolng is None:
            continue
        found.append(Find(int(number), max_ma, min_ma, paleolat, paleolng))
    return found


def genus_of(number: int, taxa: dict[int, Taxon]) -> int | None:
    """Find the genus a name is, or is in (through species and subgenus); None above a genus."""
    taxon = taxa.get(number)
    while taxon is not None and taxon.rank in BELOW_GENUS and taxon.parent is not None:
        taxon = taxa.get(taxon.parent)
    return taxon.number if taxon is not None and taxon.rank == "genus" else None


type Point = tuple[int, float, float, int]


def tracks(finds: Iterable[Find], taxa: dict[int, Taxon]) -> dict[int, list[Point]]:
    """Each genus's sites by step: (step's middle Ma, latitude, longitude, how many finds).

    A step is centred on a map's age, so a step's finds are those of the map shown with it.
    """
    placed: dict[int, dict[int, list[tuple[float, float]]]] = defaultdict(lambda: defaultdict(list))
    for find in finds:
        if find.max_ma - find.min_ma > WIDEST_SPAN_MA:
            continue
        genus = genus_of(find.number, taxa)
        if genus is None:
            continue
        step = round((find.max_ma + find.min_ma) / 2 / STEP_MA) * STEP_MA
        placed[genus][step].append((find.paleolat, find.paleolng))
    return {
        genus: [
            (step, *middle_of(site), len(site))
            for step, places in sorted(steps.items())
            for site in sites_of(places)
        ]
        for genus, steps in placed.items()
    }


def distance_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Measure the great-circle distance between two places (latitude, longitude), in km."""
    phi1, phi2 = math.radians(a[0]), math.radians(b[0])
    half_phi = (phi2 - phi1) / 2
    half_lam = math.radians(b[1] - a[1]) / 2
    h = math.sin(half_phi) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(half_lam) ** 2
    return 2 * EARTH_KM * math.asin(min(1.0, math.sqrt(h)))


def sites_of(places: list[tuple[float, float]]) -> list[list[tuple[float, float]]]:
    """Group places into sites: each place joins the first site whose first place is near.

    Places are taken in order (south to north, then west to east) so the grouping does not
    depend on the order PBDB lists them in; sites come most finds first.
    """
    sites: list[list[tuple[float, float]]] = []
    for place in sorted(places):
        for site in sites:
            if distance_km(site[0], place) <= SITE_KM:
                site.append(place)
                break
        else:
            sites.append([place])
    return sorted(sites, key=lambda site: (-len(site), site[0]))


def middle_of(places: list[tuple[float, float]]) -> tuple[float, float]:
    """Find the middle of places on the sphere (latitude, longitude), to a tenth of a degree."""
    x = y = z = 0.0
    for latitude, longitude in places:
        phi, lam = math.radians(latitude), math.radians(longitude)
        x += math.cos(phi) * math.cos(lam)
        y += math.cos(phi) * math.sin(lam)
        z += math.sin(phi)
    if math.hypot(x, y, z) < NO_MIDDLE:
        latitude, longitude = places[0]
    else:
        latitude = math.degrees(math.atan2(z, math.hypot(x, y)))
        longitude = math.degrees(math.atan2(y, x))
    return round(latitude, 1), round(longitude, 1)


def species_counts(taxa: dict[int, Taxon]) -> dict[int, int]:
    """How many valid species PBDB lists under each genus."""
    counted: dict[int, int] = defaultdict(int)
    for taxon in taxa.values():
        if taxon.rank == "species":
            genus = genus_of(taxon.number, taxa)
            if genus is not None:
                counted[genus] += 1
    return counted


def _lines(
    top: int, taxa: dict[int, Taxon], found: dict[int, list[Point]]
) -> tuple[dict[int, int | None], dict[int, list[Point]]]:
    """Each placed genus's line up to the group; one that does not reach it is left out."""
    parent_of: dict[int, int | None] = {top: None}
    genera: dict[int, list[Point]] = {}
    for number, points in sorted(found.items()):
        taxon = taxa.get(number)
        if taxon is None or taxon.trace or taxon.first_ma is None or taxon.last_ma is None:
            continue
        line: list[int] = []
        at: int | None = number
        while at is not None and at not in parent_of:
            line.append(at)
            at = taxa[at].parent if at in taxa else None
        if at is None:
            continue
        genera[number] = points
        for child in line:
            parent_of[child] = taxa[child].parent
    return parent_of, genera


def _spans(
    top: int, taxa: dict[int, Taxon], genera: set[int], children: dict[int, list[int]]
) -> tuple[dict[int, float], dict[int, float]]:
    """Each name's first and last appearance: a genus's own, a group's from its members."""
    first: dict[int, float] = {}
    last: dict[int, float] = {}

    def settle(number: int) -> None:
        members = children.get(number, [])
        for child in members:
            settle(child)
        taxon = taxa[number]
        if number in genera and taxon.first_ma is not None and taxon.last_ma is not None:
            first[number], last[number] = taxon.first_ma, taxon.last_ma
        else:
            first[number] = max((first[child] for child in members), default=0.0)
            last[number] = min((last[child] for child in members), default=0.0)

    settle(top)
    return first, last


def tree_file(
    group: tuple[str, str],
    root: str,
    taxa: dict[int, Taxon],
    found: dict[int, list[Point]],
    accessed: str,
) -> dict[str, Json]:
    """Build a group's file: its placed genera, their ancestors, ages and tracks, parents first."""
    tops = [taxon.number for taxon in taxa.values() if taxon.name == root]
    if not tops:
        msg = f"{root} is not in the classification"
        raise ValueError(msg)
    top = tops[0]
    parent_of, genera = _lines(top, taxa, found)
    children: dict[int, list[int]] = defaultdict(list)
    for child, parent in parent_of.items():
        if parent is not None:
            children[parent].append(child)
    first, last = _spans(top, taxa, set(genera), children)

    order: list[int] = []
    queue = [top]
    while queue:
        number = queue.pop(0)
        order.append(number)
        # Oldest first, so a group's earliest line comes first.
        queue.extend(sorted(children.get(number, []), key=lambda n: (-first[n], taxa[n].name)))
    index = {number: at for at, number in enumerate(order)}
    species = species_counts(taxa)

    def rank_of(number: int) -> int:
        rank = taxa[number].rank
        return RANKS.index(rank) if rank in RANKS else RANKS.index("clade")

    return {
        "schemaVersion": 2,
        "credit": CREDIT,
        "source": SOURCE,
        "accessed": accessed,
        "id": group[0],
        "name": group[1],
        "stepMa": STEP_MA,
        "ranks": list[Json](RANKS),
        "pbdb": list[Json](order),
        "names": [taxa[number].name for number in order],
        "rank": [rank_of(number) for number in order],
        "parent": [
            -1 if (parent := parent_of[number]) is None else index[parent] for number in order
        ],
        "first": [round(first[number], 2) for number in order],
        "last": [round(last[number], 2) for number in order],
        "species": [species.get(number, 0) for number in order],
        # Each genus's sites as [step's middle Ma, latitude, longitude, finds, …], several to a
        # step where its finds lay far apart; empty for a group.
        "tracks": [
            [value for point in genera.get(number, []) for value in point] for number in order
        ],
    }


def fetch_time_trees(directory: Path) -> int:  # pragma: no cover - needs network access
    """Download each group's classification and finds and write its file; count the genera."""
    accessed = dt.datetime.now(tz=dt.UTC).date().isoformat()
    directory.mkdir(parents=True, exist_ok=True)
    total = 0
    for group_id, name, root, query in GROUPS:
        taxa = parse_taxa(download(TAXA.format(taxon=query)))
        found = tracks(parse_finds(download(OCCURRENCES.format(taxon=query))), taxa)
        built = tree_file((group_id, name), root, taxa, found, accessed)
        tracked = built["tracks"]
        total += sum(1 for track in tracked if track) if isinstance(tracked, list) else 0
        _ = (directory / f"{group_id}.json").write_text(
            json.dumps(built, separators=(",", ":")) + "\n"
        )
    return total
