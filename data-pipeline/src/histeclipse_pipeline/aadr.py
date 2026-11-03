"""Dated ancient genomes, from the Allen Ancient DNA Resource (AADR).

Mallick, Micco, Mah, Ringbauer, Lazaridis, Olalde, Patterson & Reich (2024), *The Allen
Ancient DNA Resource (AADR): a curated compendium of ancient human genomes*, Scientific Data
11, 182 (doi:10.1038/s41597-024-03031-7); data on Harvard Dataverse (doi:10.7910/DVN/FFIDCW),
CC0 1.0. Only its annotation file is read, never the genotypes.

Kept: ancient individuals (a date before 1950) whose assessment passes, each once. Each is
given by a 2° cell, not its site, and its date; with the lab's group label (the lab's name for
a sample set, not a people) and the paper that published it. Present-day individuals are left
out.
"""

import csv
import io
import json
import math
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from pathlib import Path

VERSION = "v66.p1"
ANNO_URL = "https://dataverse.harvard.edu/api/access/datafile/13994515"
ANNO_SHA256 = "4a8e15d0b8d5a8bd6c929ccab7ff83a17091dc91b5e0d8015d9896dd9a5f7f7a"
SOURCE = "https://doi.org/10.7910/DVN/FFIDCW"
CREDIT = (
    f"Allen Ancient DNA Resource {VERSION} (Mallick et al. 2024, Scientific Data 11, 182; "
    "Reich lab), CC0 1.0; ancient individuals that pass its assessment, by 2° cell"
)
#: Cells are this many degrees on a side: a region, not a site.
CELL = 2
#: Dates are kept to the decade.
DATE_STEP = 10

# Columns of the annotation file, by position (its headers are long sentences).
_INDIVIDUAL = 2
_PUBLICATION = 6
_DOI = 7
_DATE_BP = 10
_GROUP = 14
_LATITUDE = 17
_LONGITUDE = 18
_ASSESSMENT = 47


@dataclass(frozen=True)
class Genome:
    """One ancient individual: its cell, date (years before 1950), lab label and paper."""

    cell: tuple[int, int]
    bp: int
    group: str
    publication: str
    doi: str


def cell_of(latitude: float, longitude: float) -> tuple[int, int]:
    """Give the 2° cell holding a place, by its south-west corner."""
    return (
        min(90 - CELL, math.floor(latitude / CELL) * CELL),
        min(180 - CELL, math.floor(longitude / CELL) * CELL),
    )


def passes(assessment: str) -> bool:
    """Whether the AADR's assessment of a sample lets it be used (PASS, provisional or merged)."""
    first = assessment.strip().split(" ")[0].upper()
    return first in {"PASS", "PROVISIONAL_PASS", "MERGE_PASS"}


def _number(text: str) -> float | None:
    try:
        value = float(text)
    except ValueError:
        return None
    return value if math.isfinite(value) else None


def parse_anno(text: str) -> list[Genome]:
    """Read the ancient individuals that pass, each once (the first of its records)."""
    rows = csv.reader(io.StringIO(text), delimiter="\t")
    _ = next(rows, None)
    seen: set[str] = set()
    genomes: list[Genome] = []
    for row in rows:
        if len(row) <= _ASSESSMENT:
            continue
        bp = _number(row[_DATE_BP])
        latitude = _number(row[_LATITUDE])
        longitude = _number(row[_LONGITUDE])
        individual = row[_INDIVIDUAL].strip()
        if bp is None or bp <= 0 or latitude is None or longitude is None:
            continue
        if not passes(row[_ASSESSMENT]) or individual in seen or individual == "":
            continue
        seen.add(individual)
        genomes.append(
            Genome(
                cell=cell_of(latitude, longitude),
                bp=round(bp / DATE_STEP) * DATE_STEP,
                group=row[_GROUP].strip(),
                publication=row[_PUBLICATION].strip(),
                doi=row[_DOI].strip(),
            )
        )
    return genomes


def genomes_file(genomes: list[Genome]) -> dict[str, Json]:
    """Build the site's file: tables of cells, labels and papers, then a row per individual."""
    cells = sorted({genome.cell for genome in genomes})
    groups = sorted({genome.group for genome in genomes})
    papers = sorted({(genome.publication, genome.doi) for genome in genomes})
    cell_index = {cell: index for index, cell in enumerate(cells)}
    group_index = {group: index for index, group in enumerate(groups)}
    paper_index = {paper: index for index, paper in enumerate(papers)}
    ordered = sorted(genomes, key=lambda genome: (genome.cell, genome.bp))
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "version": VERSION,
        "cellDegrees": CELL,
        "cells": [[latitude, longitude] for latitude, longitude in cells],
        "groups": list(groups),
        "papers": [{"name": name, "doi": doi} for name, doi in papers],
        # Each: cell, years before 1950, lab label, paper.
        "genomes": [
            [
                cell_index[genome.cell],
                genome.bp,
                group_index[genome.group],
                paper_index[genome.publication, genome.doi],
            ]
            for genome in ordered
        ],
    }


def fetch_genomes(path: Path) -> int:  # pragma: no cover - needs network access
    """Download the annotation file (checked against its checksum) and write the site's file."""
    request = urllib.request.Request(ANNO_URL, headers={"User-Agent": "histeclipse-pipeline"})
    with urllib.request.urlopen(request, timeout=120) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{ANNO_URL}: expected bytes"
        raise TypeError(msg)
    text = verified(body, ANNO_SHA256, f"AADR {VERSION} annotation").decode("utf-8", "replace")
    genomes = parse_anno(text)
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_text(json.dumps(genomes_file(genomes), separators=(",", ":")) + "\n")
    return len(genomes)
