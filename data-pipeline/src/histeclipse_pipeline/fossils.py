"""Where four groups of animals lived, from the Paleobiology Database.

The Paleobiology Database (https://paleobiodb.org), CC BY 4.0: fossil occurrences of trilobites,
ammonoids, non-avian dinosaurs and mammals, each with its age range and its place at that age
on the PALEOMAP reconstruction (Scotese), the model behind this site's deep-time surface maps,
so a find sits on the land of its own time. The database grows, so a download is not pinned
by checksum: the file records when it was accessed and how many occurrences were read.

Each occurrence is counted at the middle of its age range, in 5-million-year steps and 5°
cells; one dated only to a span wider than 15 million years is left out, as it cannot be
placed at a moment.
"""

import csv
import datetime as dt
import io
import json
import math
import urllib.request
from collections import Counter
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pathlib import Path

    from histeclipse_pipeline.sky import Json

API = "https://paleobiodb.org/data1.2/occs/list.csv?base_name={taxon}&show=paleoloc&pgm=scotese&vocab=pbdb"
SOURCE = "https://paleobiodb.org"
CREDIT = (
    "The Paleobiology Database (paleobiodb.org), CC BY 4.0; places at their age on the "
    "PALEOMAP reconstruction (Scotese); counted by 5 Myr and 5° for this site"
)
#: Each group: identifier, name, and the PBDB taxon query (^ excludes: birds are dinosaurs).
GROUPS: tuple[tuple[str, str, str], ...] = (
    ("trilobites", "Trilobites", "Trilobita"),
    ("ammonoids", "Ammonoids", "Ammonoidea"),
    ("dinosaurs", "Non-avian dinosaurs", "Dinosauria%5EAves"),
    ("mammals", "Mammals", "Mammalia"),
)
STEP_MA = 5
CELL = 5
#: An occurrence dated only to a wider span than this cannot be placed at a moment.
WIDEST_SPAN_MA = 15


@dataclass(frozen=True)
class Occurrence:
    """A fossil: its age range (Ma) and its place at that age."""

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


def parse_occurrences(text: str) -> list[Occurrence]:
    """Read the occurrences that have both an age range and a reconstructed place."""
    found: list[Occurrence] = []
    for row in csv.DictReader(io.StringIO(text)):
        values = [_number(row.get(name)) for name in ("max_ma", "min_ma", "paleolat", "paleolng")]
        max_ma, min_ma, paleolat, paleolng = values
        if max_ma is None or min_ma is None or paleolat is None or paleolng is None:
            continue
        found.append(Occurrence(max_ma, min_ma, paleolat, paleolng))
    return found


def counts(occurrences: list[Occurrence]) -> Counter[tuple[int, int, int]]:
    """Occurrences by (step's start Ma, cell's south edge, cell's west edge)."""
    counted: Counter[tuple[int, int, int]] = Counter()
    for occurrence in occurrences:
        if occurrence.max_ma - occurrence.min_ma > WIDEST_SPAN_MA:
            continue
        middle = (occurrence.max_ma + occurrence.min_ma) / 2
        step = math.floor(middle / STEP_MA) * STEP_MA
        south = min(90 - CELL, math.floor(occurrence.paleolat / CELL) * CELL)
        west = min(180 - CELL, math.floor(occurrence.paleolng / CELL) * CELL)
        counted[step, south, west] += 1
    return counted


def fossils_file(
    groups: list[tuple[str, str, int, Counter[tuple[int, int, int]]]], accessed: str
) -> dict[str, Json]:
    """Build the site's file: each group with its counts as [step, south, west, count]."""
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "accessed": accessed,
        "stepMa": STEP_MA,
        "cellDegrees": CELL,
        "groups": [
            {
                "id": group_id,
                "name": name,
                "occurrences": read,
                "counts": [[*key, count] for key, count in sorted(counted.items())],
            }
            for group_id, name, read, counted in groups
        ],
    }


def _download(url: str) -> str:  # pragma: no cover - needs network access
    request = urllib.request.Request(url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
    with urllib.request.urlopen(request, timeout=600) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{url}: expected bytes"
        raise TypeError(msg)
    return body.decode("utf-8")


def fetch_fossils(path: Path) -> int:  # pragma: no cover - needs network access
    """Download each group's occurrences and write the site's file."""
    groups: list[tuple[str, str, int, Counter[tuple[int, int, int]]]] = []
    for group_id, name, taxon in GROUPS:
        occurrences = parse_occurrences(_download(API.format(taxon=taxon)))
        groups.append((group_id, name, len(occurrences), counts(occurrences)))
    accessed = dt.datetime.now(tz=dt.UTC).date().isoformat()
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_text(json.dumps(fossils_file(groups, accessed), separators=(",", ":")) + "\n")
    return sum(read for _, _, read, _ in groups)
