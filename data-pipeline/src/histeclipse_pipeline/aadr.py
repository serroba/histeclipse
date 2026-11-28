"""Dated ancient genomes, from the Allen Ancient DNA Resource (AADR).

Mallick, Micco, Mah, Ringbauer, Lazaridis, Olalde, Patterson & Reich (2024), *The Allen
Ancient DNA Resource (AADR): a curated compendium of ancient human genomes*, Scientific Data
11, 182 (doi:10.1038/s41597-024-03031-7); data on Harvard Dataverse (doi:10.7910/DVN/FFIDCW),
CC0 1.0. Only its annotation file is read, never the genotypes.

Kept: ancient individuals (a date before 1950) whose assessment passes, each once. Each is
given by a 2° cell, not its site, and its date; with the lab's group label (the lab's name for
a sample set, not a people) and the paper that published it. Present-day individuals are left
out. What a card lists of each person (`aadr_people`) goes in files of its own, read only when a
card opens.

The ice-age people (#1059) also go to the Humans layer, as the Ancient genomes layer shows only
the years from 9700 BCE on; less the archaic and earliest modern humans already on the Humans
list (`public/data/humans/genomes.json`, from their papers), left out by their lab group so none
is shown twice.
"""

import csv
import io
import json
import math
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

from histeclipse_pipeline.aadr_people import CHUNK, Person, people_files, person_of, person_row
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


#: The Holocene began 11,700 years before 2000: 11,650 years before 1950, the AADR's count.
HOLOCENE_BP = 11650

#: Lab groups whose individuals the Humans list already has, each from its paper.
COVERED_GROUPS = frozenset(
    {
        "Altai_Neanderthal",
        "Bulgaria_BachoKiroCave_IUP",
        "ChagyrskayaCave_Neanderthal",
        "Czechia_Zlatykun_IUP",
        "France_GrotteMandrin_Neanderthal",
        "Germany_Ranis_IUP",
        "Mezmaiskayacave_Neanderthal",
        "Romania_IUP",
        "Russia_Denisova",
        "Russia_DenisovaCave_MPleistocene",
        "Russia_Denisova_Neanderthal_Mix",
        "Russia_UstIshim_IUP",
        "VindijaCave_Neanderthal",
    }
)


@dataclass(frozen=True)
class Genome:
    """One ancient individual: its cell, date (years before 1950), lab label, paper, person."""

    cell: tuple[int, int]
    #: Its site's latitude and longitude, to 0.01°, as the AADR gives it.
    point: tuple[float, float]
    bp: int
    group: str
    publication: str
    doi: str
    person: Person


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
                point=(round(latitude, 2), round(longitude, 2)),
                bp=round(bp / DATE_STEP) * DATE_STEP,
                group=row[_GROUP].strip(),
                publication=row[_PUBLICATION].strip(),
                doi=row[_DOI].strip(),
                person=person_of(row),
            )
        )
    return genomes


def in_order(genomes: list[Genome]) -> list[Genome]:
    """Put the genomes in the files' order: by cell, then oldest last."""
    return sorted(genomes, key=lambda genome: (genome.cell, genome.bp))


def genomes_file(genomes: list[Genome]) -> dict[str, Json]:
    """Build the site's file: tables of cells, labels and papers, then a row per individual."""
    cells = sorted({genome.cell for genome in genomes})
    groups = sorted({genome.group for genome in genomes})
    papers = sorted({(genome.publication, genome.doi) for genome in genomes})
    cell_index = {cell: index for index, cell in enumerate(cells)}
    group_index = {group: index for index, group in enumerate(groups)}
    paper_index = {paper: index for index, paper in enumerate(papers)}
    ordered = in_order(genomes)
    return {
        "schemaVersion": 1,
        "sources": ["aadr"],
        "credit": CREDIT,
        "source": SOURCE,
        "licence": "CC0 1.0",
        "accessed": "2026-11-21",
        "changes": (
            "Ancient individuals that pass its assessment, counted by 2° cell; the day given "
            "as accessed is the day this file was last written"
        ),
        "version": VERSION,
        "cellDegrees": CELL,
        # Row n's person is in people/{n // peopleChunk}.json.
        "peopleChunk": CHUNK,
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


def ice_age_file(genomes: list[Genome], credit: str, source: str) -> dict[str, Json]:
    """Build the Humans layer's file: the ice-age people not already on its list, oldest first."""
    kept = sorted(
        (
            genome
            for genome in genomes
            if genome.bp > HOLOCENE_BP and genome.group not in COVERED_GROUPS
        ),
        key=lambda genome: (-genome.bp, genome.person.individual),
    )
    return {
        "schemaVersion": 1,
        "sources": ["aadr"],
        "credit": credit,
        "source": source,
        "licence": "CC0 1.0",
        "accessed": "2026-11-21",
        "changes": (
            "The ice-age people not already on the Humans layer's list, oldest first; the day "
            "given as accessed is the day this file was last written"
        ),
        "people": [
            {
                "bp": genome.bp,
                "latitude": genome.point[0],
                "longitude": genome.point[1],
                "group": genome.group,
                "paper": {"name": genome.publication, "doi": genome.doi},
                "person": person_row(genome.person),
            }
            for genome in kept
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
    folder = path.parent / "people"
    folder.mkdir(exist_ok=True)
    people = [genome.person for genome in in_order(genomes)]
    for index, chunk in enumerate(people_files(people)):
        _ = (folder / f"{index}.json").write_text(
            json.dumps(chunk, separators=(",", ":"), ensure_ascii=False) + "\n"
        )
    # The ice-age people go to the Humans layer's folder, beside this one.
    humans = path.parent.parent / "humans" / "aadr-ice-age.json"
    humans.parent.mkdir(parents=True, exist_ok=True)
    _ = humans.write_text(
        json.dumps(ice_age_file(genomes, CREDIT, SOURCE), ensure_ascii=False, indent=1) + "\n"
    )
    return len(genomes)
