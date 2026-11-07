"""The tree of life, trimmed to what the site shows: Open Tree of Life's synthetic tree (#279).

Open Tree of Life publishes its synthetic tree (release 16.1, about 2.4 million tips) and the
taxonomy beneath it (OTT 3.7.3) with a CC0 waiver. The whole tree is far too big for a browser,
so this keeps:

- every group ranked order or above (the backbone of life);
- the groups the site already shows: the fossil genera and their four groups (from the
  Paleobiology Database file), and our species with Neanderthals and Denisovans;
- every ancestor that joins them, named ancestors always, unnamed branch points only where
  two kept lines meet.

Most fossil genera are not in the synthetic tree: synthesis leaves out extinct names no
phylogeny places. Those are hung on the tree by the taxonomy instead, through its own parents
(families and so on) to the nearest group the tree has, and flagged as placed by taxonomy
alone. Each node says whether published phylogenies support it, as the synthesis records.

Names are matched to the taxonomy within each fossil group's clade; the genera that do not
match, or match twice, are listed in the file rather than guessed. The taxonomy treats
Neanderthals and Denisovans as kinds of Homo sapiens, following NCBI; other sources rank
Neanderthals a species of their own.
"""

import datetime as dt
import json
import re
import shutil
import tarfile
import urllib.request
from dataclasses import dataclass
from typing import IO, TYPE_CHECKING

from histeclipse_pipeline.planet_maps import checked

if TYPE_CHECKING:
    from collections.abc import Iterable, Iterator, Mapping
    from pathlib import Path

    from histeclipse_pipeline.sky import Json

USER_AGENT = "histeclipse-pipeline (https://github.com/serroba/histeclipse)"
FILES = "https://files.opentreeoflife.org"
SYNTHESIS = "opentree16.1"
TAXONOMY = "ott3.7.3"


@dataclass(frozen=True)
class Download:
    """A release file: where it is and its pinned checksum."""

    url: str
    sha256: str


TREE = Download(
    url=f"{FILES}/synthesis/{SYNTHESIS}/{SYNTHESIS}_tree.tgz",
    sha256="c447c83e49f0cf61fa96d9a02c6135b809abf315ad384fdb26b88359a28da12c",
)
OTT = Download(
    url=f"{FILES}/ott/{TAXONOMY}/{TAXONOMY}.tgz",
    sha256="7603aeb68ff45749773b4885811b1280d057f8c178b93bd903849fb7f237dfb3",
)
TREE_MEMBER = f"{SYNTHESIS}_tree/labelled_supertree/labelled_supertree.tre"
ANNOTATIONS_MEMBER = f"{SYNTHESIS}_tree/annotations.json"
TAXONOMY_MEMBER = f"{TAXONOMY}/taxonomy.tsv"

#: Ranks kept wherever they are: the backbone of life down to order.
BACKBONE_RANKS = frozenset(
    {
        "domain",
        "superkingdom",
        "kingdom",
        "subkingdom",
        "phylum",
        "subphylum",
        "superclass",
        "class",
        "subclass",
        "infraclass",
        "superorder",
        "order",
    }
)
#: Each fossil group's clade in the taxonomy (OTT ids), within which its genera are matched.
FOSSIL_CLADES = {
    "trilobites": 5298260,  # Trilobita
    "ammonoids": 5424465,  # Ammonoidea
    "dinosaurs": 90215,  # Dinosauria
    "mammals": 244265,  # Mammalia
}
#: The people the site shows, by OTT id.
HUMANS = {
    "sapiens": 770315,  # Homo sapiens
    "neanderthal": 83926,  # Homo sapiens neanderthalensis
    "denisovan": 933436,  # Homo sapiens subsp. 'Denisova'
}
#: The taxonomy's ranks a genus may carry: many fossil genera are entered without one.
GENUS_RANKS = frozenset({"genus", "no rank"})

#: Flag bits on each node.
EXTINCT = 1
PHYLOGENY = 2
TAXONOMY_ONLY = 4

_TOKEN = re.compile(r"[(),;]|[^(),;]+")
_OTT_LABEL = re.compile(r"ott(\d+)")


@dataclass(frozen=True)
class Taxon:
    """A row of the taxonomy: its parent (0 at the root), name, rank and flags."""

    parent: int
    name: str
    rank: str
    flags: frozenset[str]


@dataclass(frozen=True)
class Tree:
    """A tree as flat lists: each node's parent index (-1 at the root) and label, if any."""

    parents: list[int]
    labels: list[str | None]


def parse_taxonomy(lines: Iterable[str]) -> dict[int, Taxon]:
    r"""Read OTT's ``taxonomy.tsv``: fields split by ``\t|\t``, a header row first."""
    taxa: dict[int, Taxon] = {}
    for line in lines:
        fields = line.rstrip("\n").split("\t|\t")
        if not fields[0].isdigit():
            continue
        flags = fields[6].rstrip("\t|") if len(fields) > 6 else ""  # noqa: PLR2004
        taxa[int(fields[0])] = Taxon(
            parent=int(fields[1]) if fields[1] else 0,
            name=fields[2],
            rank=fields[3],
            flags=frozenset(flag for flag in flags.split(",") if flag),
        )
    return taxa


def parse_newick(text: str) -> Tree:
    """Read a Newick tree without branch lengths: nodes in the order they open."""
    parents: list[int] = []
    labels: list[str | None] = []
    open_nodes: list[int] = []
    closed: int | None = None
    for match in _TOKEN.finditer(text):
        piece = match.group().strip()
        if piece == "(":
            parents.append(open_nodes[-1] if open_nodes else -1)
            labels.append(None)
            open_nodes.append(len(parents) - 1)
            closed = None
        elif piece == ")":
            closed = open_nodes.pop()
        elif piece in {",", ";"}:
            closed = None
        elif piece:
            if closed is not None:
                labels[closed] = piece
            else:
                parents.append(open_nodes[-1] if open_nodes else -1)
                labels.append(piece)
            closed = None
    if open_nodes:
        msg = "the tree's brackets do not close"
        raise ValueError(msg)
    return Tree(parents=parents, labels=labels)


def ott_of(label: str | None) -> int | None:
    """Return the OTT id a label names (``ott123``); None for a branch point (``mrcaott1``)."""
    if label is None:
        return None
    found = _OTT_LABEL.fullmatch(label)
    return int(found.group(1)) if found else None


def ancestry(ott: int, taxa: Mapping[int, Taxon]) -> Iterator[int]:
    """Yield the taxonomy's parents of ``ott``, nearest first, to the root."""
    seen: set[int] = set()
    parent = taxa[ott].parent if ott in taxa else 0
    while parent and parent in taxa and parent not in seen:
        seen.add(parent)
        yield parent
        parent = taxa[parent].parent


@dataclass(frozen=True)
class Matches:
    """Names matched to one OTT id each, and those matched twice or not at all."""

    found: dict[str, int]
    ambiguous: list[str]
    missing: list[str]


def match_genera(names: Iterable[str], taxa: Mapping[int, Taxon], clades: Iterable[int]) -> Matches:
    """Match genus names to the taxonomy, counting only entries within one of ``clades``."""
    within = frozenset(clades)
    wanted = set(names)
    by_name: dict[str, list[int]] = {}
    for ott, taxon in taxa.items():
        if taxon.name in wanted and taxon.rank in GENUS_RANKS:
            by_name.setdefault(taxon.name, []).append(ott)
    found: dict[str, int] = {}
    ambiguous: list[str] = []
    missing: list[str] = []
    for name in sorted(wanted):
        inside = [
            ott
            for ott in by_name.get(name, [])
            if any(parent in within for parent in ancestry(ott, taxa))
        ]
        if len(inside) == 1:
            found[name] = inside[0]
        elif inside:
            ambiguous.append(name)
        else:
            missing.append(name)
    return Matches(found=found, ambiguous=ambiguous, missing=missing)


@dataclass(frozen=True)
class Node:
    """A node of the trimmed tree."""

    ott: int | None
    name: str
    rank: str
    parent: int
    flags: int


def _node_flags(taxon: Taxon | None, *, supported: bool, taxonomy_only: bool) -> int:
    extinct = taxon is not None and any(flag.startswith("extinct") for flag in taxon.flags)
    return (
        (EXTINCT if extinct else 0)
        | (PHYLOGENY if supported else 0)
        | (TAXONOMY_ONLY if taxonomy_only else 0)
    )


def trim(
    tree: Tree, taxa: Mapping[int, Taxon], supported: frozenset[str], wanted: Iterable[int]
) -> tuple[list[Node], dict[int, int]]:
    """Keep the backbone, the ``wanted`` OTT ids and what joins them.

    Return the nodes in order (each after its parent) and where each wanted id landed.
    """
    where = {ott: i for i, label in enumerate(tree.labels) if (ott := ott_of(label)) is not None}
    keep = {i for ott, i in where.items() if ott in taxa and taxa[ott].rank in BACKBONE_RANKS}
    # Wanted ids off the tree hang on it by the taxonomy's parents, to the nearest it has.
    hung: dict[int, list[int]] = {}
    for ott in wanted:
        if ott in where:
            keep.add(where[ott])
            continue
        chain = [ott]
        for parent in ancestry(ott, taxa):
            if parent in where:
                keep.add(where[parent])
                hung.setdefault(where[parent], []).extend(reversed(chain))
                break
            chain.append(parent)
    # The ancestors joining them; unnamed branch points stay only where two kept lines meet.
    lines: dict[int, int] = {}
    for start in keep:
        i = tree.parents[start]
        while i != -1:
            lines[i] = lines.get(i, 0) + 1
            if lines[i] > 1:
                break
            i = tree.parents[i]
    shown = keep | {i for i in lines if ott_of(tree.labels[i]) is not None or lines[i] > 1}
    shown |= {i for i, parent in enumerate(tree.parents) if parent == -1}
    return _ordered(
        tree, taxa=taxa, supported=supported, shown=shown, hung=hung, wanted=frozenset(wanted)
    )


def _ordered(  # noqa: PLR0913
    tree: Tree,
    *,
    taxa: Mapping[int, Taxon],
    supported: frozenset[str],
    shown: set[int],
    hung: dict[int, list[int]],
    wanted: frozenset[int],
) -> tuple[list[Node], dict[int, int]]:
    def shown_parent(i: int) -> int:
        parent = tree.parents[i]
        while parent != -1 and parent not in shown:
            parent = tree.parents[parent]
        return parent

    children: dict[int, list[int]] = {}
    roots: list[int] = []
    for i in sorted(shown):
        parent = shown_parent(i)
        if parent == -1:
            roots.append(i)
        else:
            children.setdefault(parent, []).append(i)
    nodes: list[Node] = []
    landed: dict[int, int] = {}
    stack = [(i, -1) for i in reversed(roots)]
    while stack:
        i, parent = stack.pop()
        label = tree.labels[i]
        ott = ott_of(label)
        taxon = taxa.get(ott) if ott is not None else None
        index = len(nodes)
        nodes.append(
            Node(
                ott=ott,
                name=taxon.name if taxon else "",
                rank=taxon.rank if taxon else "",
                parent=parent,
                flags=_node_flags(taxon, supported=label in supported, taxonomy_only=False),
            )
        )
        if ott in wanted:
            landed[ott] = index
        _hang(nodes, landed, hung.get(i, []), index, taxa)
        stack.extend((child, index) for child in reversed(children.get(i, [])))
    return nodes, landed


def _hang(
    nodes: list[Node],
    landed: dict[int, int],
    chain: list[int],
    attach: int,
    taxa: Mapping[int, Taxon],
) -> None:
    """Add taxonomy-only nodes below ``attach``: each chain runs from the nearest ancestor down."""
    placed: dict[int, int] = {}
    for ott in chain:
        if ott in landed:
            placed[ott] = landed[ott]
            continue
        taxon = taxa[ott]
        parent = placed.get(taxon.parent, attach)
        placed[ott] = len(nodes)
        landed[ott] = len(nodes)
        nodes.append(
            Node(
                ott=ott,
                name=taxon.name,
                rank=taxon.rank,
                parent=parent,
                flags=_node_flags(taxon, supported=False, taxonomy_only=True),
            )
        )


def tree_file(  # noqa: PLR0913
    nodes: list[Node],
    landed: Mapping[int, int],
    *,
    genera: Matches,
    groups: Mapping[str, int],
    humans: Mapping[str, int],
    accessed: str,
) -> dict[str, Json]:
    """Build the site's file: the nodes as columns, and where the site's own taxa are."""
    ranks = sorted({node.rank for node in nodes})
    rank_index = {rank: i for i, rank in enumerate(ranks)}
    return {
        "schemaVersion": 1,
        "accessed": accessed,
        "credit": (
            f"Open Tree of Life, synthetic tree {SYNTHESIS} and taxonomy {TAXONOMY} "
            "(CC0), trimmed for this site"
        ),
        "source": "https://tree.opentreeoflife.org",
        "synthesis": SYNTHESIS,
        "taxonomy": TAXONOMY,
        "flags": {"extinct": EXTINCT, "phylogeny": PHYLOGENY, "taxonomyOnly": TAXONOMY_ONLY},
        "ranks": list(ranks),
        "ott": [node.ott or 0 for node in nodes],
        "name": [node.name for node in nodes],
        "rank": [rank_index[node.rank] for node in nodes],
        "parent": [node.parent for node in nodes],
        "nodeFlags": [node.flags for node in nodes],
        "ours": {
            "fossilGenera": {
                name: landed[ott] for name, ott in sorted(genera.found.items()) if ott in landed
            },
            "fossilGroups": {group: landed[ott] for group, ott in groups.items() if ott in landed},
            "humans": {key: landed[ott] for key, ott in humans.items() if ott in landed},
        },
        "unmatched": {"ambiguous": list(genera.ambiguous), "missing": list(genera.missing)},
    }


def member(archive: tarfile.TarFile, name: str) -> IO[bytes]:
    """Open a file inside a release archive, without unpacking it."""
    file = archive.extractfile(name)
    if file is None:
        msg = f"{name} is not a file in the archive"
        raise ValueError(msg)
    return file


def _download(url: str, path: Path) -> None:  # pragma: no cover - needs network access
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})  # noqa: S310
    path.parent.mkdir(parents=True, exist_ok=True)
    partial = path.with_suffix(path.suffix + ".part")
    with urllib.request.urlopen(request, timeout=300) as response, partial.open("wb") as file:  # noqa: S310  # pyright: ignore[reportAny]
        shutil.copyfileobj(response, file)  # pyright: ignore[reportAny]
    _ = partial.replace(path)


def _fetched(source: Download, cache: Path) -> Path:  # pragma: no cover - needs network access
    path = cache / source.url.rsplit("/", 1)[-1]
    if not path.exists():
        _download(source.url, path)
    return checked(path, source.sha256)


def fetch_tree_of_life(  # pragma: no cover - needs network access
    fossils: Path, out: Path, cache: Path
) -> int:
    """Download the release once into ``cache``, check it, trim it and write the site's file."""
    with tarfile.open(_fetched(OTT, cache), "r:gz") as archive:
        taxa = parse_taxonomy(line.decode() for line in member(archive, TAXONOMY_MEMBER))
    with tarfile.open(_fetched(TREE, cache), "r:gz") as archive:
        tree = parse_newick(member(archive, TREE_MEMBER).read().decode())
        annotations: object = json.load(member(archive, ANNOTATIONS_MEMBER))  # pyright: ignore[reportAny]
    supported = supported_labels(annotations)
    names: object = json.loads(fossils.read_text())  # pyright: ignore[reportAny]
    genera = match_genera(genus_names(names), taxa, FOSSIL_CLADES.values())
    wanted = [*genera.found.values(), *FOSSIL_CLADES.values(), *HUMANS.values()]
    nodes, landed = trim(tree, taxa, supported, wanted)
    made = dt.datetime.now(tz=dt.UTC).date().isoformat()
    out.parent.mkdir(parents=True, exist_ok=True)
    built = tree_file(
        nodes, landed, genera=genera, groups=FOSSIL_CLADES, humans=HUMANS, accessed=made
    )
    _ = out.write_text(json.dumps(built, separators=(",", ":"), ensure_ascii=False) + "\n")
    return len(nodes)


def supported_labels(annotations: object) -> frozenset[str]:
    """Return the labels of nodes published phylogenies support, from the annotations."""
    if not isinstance(annotations, dict):
        msg = "annotations: expected an object"
        raise TypeError(msg)
    nodes: object = annotations.get("nodes")  # pyright: ignore[reportUnknownMemberType, reportUnknownVariableType]
    if not isinstance(nodes, dict):
        msg = "annotations: expected nodes"
        raise TypeError(msg)
    return frozenset(
        str(label)  # pyright: ignore[reportUnknownArgumentType]
        for label, about in nodes.items()  # pyright: ignore[reportUnknownVariableType]
        if isinstance(about, dict) and "supported_by" in about
    )


def genus_names(fossils: object) -> list[str]:
    """Return the fossil file's genus names."""
    if not isinstance(fossils, dict):
        msg = "fossils: expected an object"
        raise TypeError(msg)
    genera: object = fossils.get("genera")  # pyright: ignore[reportUnknownMemberType, reportUnknownVariableType]
    if not isinstance(genera, list) or not all(isinstance(name, str) for name in genera):  # pyright: ignore[reportUnknownVariableType]
        msg = "fossils: expected a list of genus names"
        raise TypeError(msg)
    return [str(name) for name in genera]  # pyright: ignore[reportUnknownVariableType, reportUnknownArgumentType]
