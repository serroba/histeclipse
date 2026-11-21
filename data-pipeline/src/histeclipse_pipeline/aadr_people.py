"""Each ancient individual of the AADR as a person (#1059): what a genome card lists of them.

From the same annotation file as `aadr` (CC0): the individual's ID, place, skeletal element,
date and how it was got, genetic sex, Y and mitochondrial haplogroups, the kind of data and its
coverage, relatives found among the others, long runs of homozygosity, the archive holding the
reads, and the age at death. Values the file leaves blank ("..", "n/a") are left out (null).
"""

import math
import re
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from histeclipse_pipeline.sky import Json

# Columns of the annotation file, by position (its headers are long sentences).
_ELEMENT = 4
_REPOSITORY = 8
_DATE_METHOD = 9
_FULL_DATE = 12
_AGE = 13
_LOCALITY = 15
_COUNTRY = 16
_DATA_TYPE = 21
_COVERAGE = 23
_SNPS = 26
_SEX = 30
_FAMILY = 31
_ROH = 32
_Y_ISOGG = 35
_Y_MANUAL = 36
_MT = 38

#: Rows per file of people, so a card loads a small part.
CHUNK = 1000
#: Relatives listed by name before saying how many more.
KIN_LISTED = 4

_BLANK = re.compile(r"^(\.\.|n/a.*|unknown|no information.*|)$", re.IGNORECASE)
_ACCESSION = re.compile(r"\bPRJ[DEN][ABX]\d+\b")
_KIN = re.compile(r"^(\d+(?:\.\d+)?)d\s*([^:]*):(.*)$")
_DATA_NAMES = {
    "1240k": "1240k capture",
    "shotgun": "shotgun",
    "shotgun.diploid": "high-coverage shotgun",
    "twist1.4m": "Twist capture",
    "1240k,twist1.4m": "1240k and Twist capture",
    "1240k,shotgun": "1240k capture and shotgun",
}
_DEGREES = {1: "first-degree", 2: "second-degree", 3: "third-degree"}


@dataclass(frozen=True)
class Person:
    """What a card lists of one ancient individual; None where the file says nothing."""

    individual: str
    place: str
    element: str | None
    date: str | None
    dated_by: str | None
    sex: str | None
    y: str | None
    mt: str | None
    data: str | None
    coverage: float | None
    snps: int | None
    kin: str | None
    roh: float | None
    repository: str | None
    age: str | None


def _text(value: str, most: int = 120) -> str | None:
    clean = " ".join(value.split())
    return None if _BLANK.match(clean) else clean[:most]


def _number(value: str) -> float | None:
    try:
        number = float(value)
    except ValueError:
        return None
    return number if math.isfinite(number) else None


def place_of(locality: str, country: str) -> str:
    """Name the site, without the districts the file adds in brackets, and its country."""
    site = _text(locality.split(" (", maxsplit=1)[0])
    land = _text(country)
    return ", ".join(part for part in (site, land) if part is not None) or "Unknown place"


def dated_by(method: str) -> str | None:
    """How the date was got: radiocarbon on the bones themselves, or the layer they lay in."""
    first = method.strip().lower()
    if first.startswith("direct"):
        return "radiocarbon on the remains"
    if first.startswith("context"):
        return "archaeological context"
    return _text(method, 60)


def sex_of(value: str) -> str | None:
    """Genetic sex: female, male, or None where it could not be told."""
    first = value.strip()[:1].upper()
    return {"F": "female", "M": "male"}.get(first)


def data_of(value: str) -> str | None:
    """Name the kind of data: a capture of known sites (1240k, Twist), or whole-genome reads."""
    text = _text(value, 60)
    if text is None:
        return None
    lower = text.lower()
    if lower in _DATA_NAMES:
        return _DATA_NAMES[lower]
    if lower.startswith("shotgun"):
        return "shotgun"
    return "1240k capture" if "1240k" in lower else text


def kin_of(individual: str, family: str) -> str | None:
    """Relatives found among the others, first-degree by name: "brothers I123; and 2 more"."""
    named: list[str] = []
    others = 0
    for part in family.split(","):
        match = _KIN.match(part.strip())
        if match is None:
            continue
        degree, relation, pair = match.groups()
        other = next((who for who in pair.split(":") if who not in {"", individual}), None)
        if other is None:
            continue
        level = round(float(degree))
        if level == 1 and len(named) < KIN_LISTED:
            name = relation.replace("(orderUnknown)", "").strip() or _DEGREES[1]
            named.append(f"{name} {other}")
        else:
            others += 1
    if not named and others == 0:
        return None
    plural = "" if others == 1 else "s"
    more = (
        f"{others} more relative{plural}"
        if named
        else f"{others} relative{plural}, second-degree or further"
    )
    return "; ".join([*named, *([more] if others else [])])


def repository_of(value: str) -> str | None:
    """Find the archive's project accession (ENA, SRA, EBI), which the card links to; else None."""
    match = _ACCESSION.search(value)
    return None if match is None else match.group(0)


def person_of(row: list[str]) -> Person:
    """One annotation row as the person a card lists."""
    coverage = _number(row[_COVERAGE])
    snps = _number(row[_SNPS])
    roh = _number(row[_ROH])
    y = _text(row[_Y_MANUAL], 40) or _text(row[_Y_ISOGG], 40)
    return Person(
        individual=row[2].strip(),
        place=place_of(row[_LOCALITY], row[_COUNTRY]),
        element=_text(row[_ELEMENT], 60),
        date=_text(row[_FULL_DATE], 100),
        dated_by=dated_by(row[_DATE_METHOD]),
        sex=sex_of(row[_SEX]),
        y=y,
        mt=_text(row[_MT], 40),
        data=data_of(row[_DATA_TYPE]),
        coverage=None if coverage is None or coverage <= 0 else float(f"{coverage:.2g}"),
        snps=None if snps is None or snps <= 0 else round(snps),
        kin=kin_of(row[2].strip(), row[_FAMILY]),
        roh=None if roh is None or roh <= 0 else round(roh, 1),
        repository=repository_of(row[_REPOSITORY]),
        age=_text(row[_AGE], 60),
    )


def person_row(person: Person) -> list[Json]:
    """Give a person as the file's row, in the order the site reads it."""
    return [
        person.individual,
        person.place,
        person.element,
        person.date,
        person.dated_by,
        person.sex,
        person.y,
        person.mt,
        person.data,
        person.coverage,
        person.snps,
        person.kin,
        person.roh,
        person.repository,
        person.age,
    ]


def people_files(people: list[Person]) -> list[dict[str, Json]]:
    """Put the people in files of CHUNK rows, in the order of the genomes file's rows."""
    return [
        {
            "schemaVersion": 1,
            "first": start,
            "people": [person_row(person) for person in people[start : start + CHUNK]],
        }
        for start in range(0, len(people), CHUNK)
    ]
