"""The International Chronostratigraphic Chart, from its official machine-readable form.

International Commission on Stratigraphy, chart v2026-06 (Cohen, Harper, Gibbard & Car 2025,
updated, Episodes 48: 105-115), as RDF (SKOS/Turtle) in https://github.com/i-c-stratigraphy/chart,
CC BY 4.0. Each unit (eon, era, period, epoch, age) is kept with its English name, rank, parent,
start and end in millions of years ago with their margins of error, whether its start is marked
uncertain, and the chart's own colour.
"""

import json
import re
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

from rdflib import Graph, Literal, Namespace, URIRef
from rdflib.namespace import SKOS

from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from pathlib import Path

    from rdflib.term import Node

VERSION = "2026-06"
CHART_URL = (
    "https://raw.githubusercontent.com/i-c-stratigraphy/chart/"
    "81618a865cdb04998355a302f3e859908a080c0e/chart.ttl"
)
CHART_SHA256 = "8548707d66c383460b3bddc20afb7070cb5f3ea187ea1262418dc3a6f2d6e9f7"
SOURCE = "https://stratigraphy.org/chart"
CREDIT = (
    f"International Chronostratigraphic Chart v{VERSION}, International Commission on "
    "Stratigraphy (Cohen et al. 2025, Episodes 48: 105-115), CC BY 4.0"
)
RANKS = ("Super-Eon", "Eon", "Era", "Period", "Sub-Period", "Epoch", "Age")

_GTS = Namespace("http://resource.geosciml.org/ontology/timescale/gts#")
_TIME = Namespace("http://www.w3.org/2006/time#")
_SCHEMA = Namespace("https://schema.org/")
_GTSD = Namespace("https://data.stratigraphy.org/data/gts/")


@dataclass(frozen=True)
class Unit:
    """One unit of the chart: ages in millions of years ago, the margins 0 where none given."""

    id: str
    name: str
    rank: str
    parent: str | None
    base: float
    base_margin: float
    base_uncertain: bool
    top: float
    colour: str


def _local(node: Node | None) -> str | None:
    return None if node is None else str(node).rsplit("/", 1)[-1]


def _number(graph: Graph, node: Node | None, predicate: URIRef) -> float | None:
    value = None if node is None else graph.value(node, predicate)
    return float(value) if isinstance(value, Literal) else None


def _english(graph: Graph, subject: Node) -> str | None:
    for label in graph.objects(subject, SKOS.prefLabel):
        if isinstance(label, Literal) and label.language == "en":
            return str(label)
    return None


def _spaced(identifier: str | None) -> str | None:
    return None if identifier is None else re.sub(r"(?<=[a-z])(?=[A-Z])", " ", identifier)


def parse_chart(turtle: str) -> list[Unit]:
    """Read every ranked unit of the chart, oldest first."""
    graph = Graph()
    _ = graph.parse(data=turtle, format="turtle")
    units: list[Unit] = []
    for subject, _predicate, rank in graph.triples((None, _GTS.rank, None)):
        # A unit not yet named (as the Upper Pleistocene) goes by its identifier, spaced out.
        name = _english(graph, subject) or _spaced(_local(subject))
        beginning = graph.value(subject, _TIME.hasBeginning)
        end = graph.value(subject, _TIME.hasEnd)
        base = _number(graph, beginning, _GTSD.inMYA)
        top = _number(graph, end, _GTSD.inMYA)
        unit_id = _local(subject)
        rank_name = _local(rank)
        if name is None or base is None or top is None or unit_id is None or rank_name is None:
            continue
        note = None if beginning is None else graph.value(beginning, SKOS.note)
        units.append(
            Unit(
                id=unit_id,
                name=name,
                rank=rank_name,
                parent=_local(graph.value(subject, SKOS.broader)),
                base=base,
                base_margin=_number(graph, beginning, _SCHEMA.marginOfError) or 0.0,
                base_uncertain=note is not None and str(note) == "uncertain",
                top=top,
                colour=str(graph.value(subject, _SCHEMA.color) or "#cccccc"),
            )
        )
    return sorted(
        units, key=lambda unit: (-unit.base, RANKS.index(unit.rank) if unit.rank in RANKS else 99)
    )


def chart_file(units: list[Unit]) -> dict[str, Json]:
    """Build the site's file: the chart's units, oldest first."""
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "version": VERSION,
        "units": [
            {
                "id": unit.id,
                "name": unit.name,
                "rank": unit.rank,
                "parent": unit.parent,
                "base": unit.base,
                "baseMargin": unit.base_margin,
                "baseUncertain": unit.base_uncertain,
                "top": unit.top,
                "colour": unit.colour,
            }
            for unit in units
        ],
    }


def fetch_chart(path: Path) -> int:  # pragma: no cover - needs network access
    """Download the chart (checked against its checksum) and write the site's file."""
    request = urllib.request.Request(CHART_URL, headers={"User-Agent": "histeclipse-pipeline"})
    with urllib.request.urlopen(request, timeout=60) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{CHART_URL}: expected bytes"
        raise TypeError(msg)
    units = parse_chart(verified(body, CHART_SHA256, "ICS chart").decode("utf-8"))
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_text(json.dumps(chart_file(units), indent=1, ensure_ascii=False) + "\n")
    return len(units)
