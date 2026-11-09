"""Every craft sent beyond Earth orbit, and those that set out but never left (#350).

The record is Jonathan McDowell's General Catalog of Artificial Space Objects (GCAT,
planet4589.org, CC BY 4.0: credited wherever it is shown), cross-checked against NASA NSSDCA's
Chronology of Lunar and Planetary Exploration (public domain):

- GCAT's Deep Space Catalog lists every object that left Earth orbit. Its payloads are the
  craft kept here (not rocket stages, covers or other parts), each with its phases: one for
  each stretch about one central body (Earth, the Sun, the Moon, a planet), with when it
  began and ended, the event that ended it (escape to another body's sphere, landing,
  impact, still in orbit…) and where it went next. The phases come from the Deep Space
  Catalog and GCAT's lunar-planetary and heliocentric registers; a landing's place, from its
  lander catalog. Craft that stayed far out in Earth orbit (Vela, IMP, Spektr-R) are left out.
- NSSDCA's chronology gives each lunar and planetary mission's objective and outcome in a
  phrase ("Mars Flyby (Contact Lost)"), kept with the craft it names. Its entries that never
  left Earth orbit (failures at launch, probes stranded in parking orbit) are kept too: they
  set out, and the record would be poorer without them.

GCAT's dates are kept as it writes them, to the minute where it knows them, a "?" where it
is unsure. Both sources change over time, so each is pinned by checksum and kept in the cache:
a fresh download needs fresh pins.
"""

from __future__ import annotations

import csv
import html
import io
import json
import re
from dataclasses import dataclass
from datetime import date
from typing import TYPE_CHECKING

from histeclipse_pipeline.planet_maps import checked, download

if TYPE_CHECKING:
    from pathlib import Path

GCAT = "https://planet4589.org/space/gcat/tsv/cat"
#: GCAT's files used, pinned as downloaded on 2026-11-09.
GCAT_FILES = {
    "deepcat.tsv": "3553aa248591d99bf66a796434436a3d7606e761bd9b135ba274e75418eb6400",
    "lprcat.tsv": "8c5ea4e63c4eed83b76e315c2cb4f13b13ad81ad20708e1be57923328a23e805",
    "hcocat.tsv": "f26a9b82f0148a420b9c4eed46c7c2646dbf4c151f9e4b4468d86ac8eccbc417",
    "landercat.tsv": "def7bc64aa180a27b81c85380b83462884522f2137f9950a2d7a693d3bc1d71d",
}
CHRONOLOGY = "https://nssdc.gsfc.nasa.gov/planetary/chronology.html"
CHRONOLOGY_SHA256 = "13aa1307faa5bdb15c09224fbe944041ca49d3563f128f6cd69ae1988279f0c7"
#: Where a craft that left Earth orbit was bound: GCAT's destinations beyond it.
BEYOND = {"Luna", "HCO", "SEL1", "SEL2", "EML1", "EML2"}
MONTHS = {
    name: index + 1
    for index, name in enumerate(
        ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    )
}
LONG_MONTHS = {
    name: index + 1
    for index, name in enumerate(
        [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
        ]
    )
}
#: Crewed flights neither source marks so: GCAT types Artemis II's Orion as any payload, and
#: NSSDCA's chronology ends before its flight (crewed, round the Moon, April 2026).
CREWED = {"2026-069A"}
#: Characters of an ISO date to the day: "1977-08-20".
ISO_DAY = 10
#: An outcome that means the craft never left Earth orbit: failed at launch, or "Attempted"
#: and found among no craft that left.
NEVER_LEFT = re.compile(r"launch failure|^attempted", re.IGNORECASE)
#: The chronology's Earth orbiters (Sputnik 1, Hubble), which are not ours.
EARTH_ORBITER = re.compile(r"earth orbit", re.IGNORECASE)


def gcat_rows(text: str) -> list[dict[str, str]]:
    """Read a GCAT table: its header row starts with '#', its notes with '# '."""
    lines = [line for line in text.splitlines() if not line.startswith("# ")]
    reader = csv.DictReader(io.StringIO("\n".join(lines)), delimiter="\t")
    return [
        {key.lstrip("#").strip(): (value or "").strip() for key, value in row.items() if key}
        for row in reader
    ]


def gcat_date(text: str) -> str | None:
    """Turn a GCAT vague date ("1977 Aug 22 0824", "1979 May?", "-") into ISO, "?" kept."""
    text = text.strip()
    if text in {"", "-"}:
        return None
    unsure = "?" if "?" in text else ""
    match = re.match(r"(\d{4})(?: (\w{3}))?(?: +(\d{1,2}))?(?: (\d{2})(\d{2}))?", text)
    if match is None:
        msg = f"not a GCAT date: {text!r}"
        raise ValueError(msg)
    year, month, day, hour, minute = match.groups()
    out = year
    if month is not None:
        out += f"-{MONTHS[month]:02d}"
        if day is not None:
            out += f"-{int(day):02d}"
            if hour is not None and minute is not None:
                out += f"T{hour}:{minute}"
    return out + unsure


@dataclass(frozen=True)
class Chronicle:
    """An entry of NSSDCA's chronology: the craft, its launch, objective and outcome."""

    name: str
    launch: str
    about: str
    #: NSSDCA's identifier: the COSPAR one for craft that reached orbit.
    nssdc: str | None
    #: The craft it names in its text too, each linked: Venera 9's orbiter and lander.
    parts: tuple[str, ...] = ()


def chronicles(text: str) -> list[Chronicle]:
    """Read NSSDCA's chronology: a linked name, then "- 23 September 1958 - objective"."""
    entries: list[Chronicle] = []
    # The outcome follows in brackets in its own <font> tag; the entry ends at <br>, a line
    # or more on where it links its parts ("Venus <a>Orbiter</a> and <a>Lander</a>").
    link = r'<a href="[^"]*?(?:id=([^"&]+))?"[^>]*>([^<]+)</a>\s*(?:<[^>]+>\s*)*-\s*'
    launched = r"(\d{1,2})?\s*([A-Z][a-z]+)\s+(\d{4})\s*-\s*([\s\S]+?)<br>"
    pattern = re.compile(link + launched)
    for match in pattern.finditer(text):
        nssdc, name, day, month, year, about = match.groups()
        if month not in LONG_MONTHS:
            continue
        launch = f"{year}-{LONG_MONTHS[month]:02d}" + (f"-{int(day):02d}" if day else "")
        entries.append(
            Chronicle(
                name=html.unescape(name).strip(),
                launch=launch,
                about=re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", about))).strip(),
                nssdc=nssdc.strip() if nssdc else None,
                parts=tuple(re.findall(r'id=([^"&]+)"', about)),
            )
        )
    return entries


def coordinate(text: str) -> float | None:
    """Read a landing's latitude or longitude: "-" where unknown, "2?" where unsure."""
    value = text.strip().rstrip("?")
    return None if value in {"", "-"} else float(value)


def phase(row: dict[str, str]) -> list[object]:
    """Write a phase as the site reads it: [body, start, end, how it ended, where next]."""
    return [
        row["Primary"],
        gcat_date(row["SDate"]),
        gcat_date(row["DDate"]),
        row["Status"],
        row["Dest"],
    ]


def craft_record(
    deep: list[dict[str, str]],
    registers: list[dict[str, str]],
    landings: list[dict[str, str]],
    chronology: list[Chronicle],
) -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    """Gather each craft that left Earth orbit with its phases, and those that never left.

    A craft NSSDCA's chronology names is kept even if it never left Earth's sphere: Zond 4
    and Peregrine flew out to the Moon's distance and fell back. The chronology's mission
    name ("Apollo 11") goes to the craft, to the parts it set loose (Sojourner), and, for a
    crewed mission, to all its craft (Columbia, Eagle); not to others that shared its rocket
    (the CubeSats launched with Artemis I have their own).
    """
    phases: dict[str, list[dict[str, str]]] = {}
    for row in [*deep, *registers]:
        phases.setdefault(row["JCAT"], []).append(row)
    landed = {row["JCAT"]: row for row in landings}
    payloads: list[dict[str, object]] = []
    seen: set[str] = set()
    for row in deep:
        jcat = row["JCAT"]
        if not row["Type"].startswith("P") or jcat in seen:
            continue
        seen.add(jcat)
        payloads.append(craft_entry(row, phases[jcat], landed.get(jcat)))
    kept = {str(entry["id"]) for entry in payloads if entry.pop("left")}
    piloted = {str(entry["id"]) for entry in payloads if entry.pop("piloted")}
    never: list[dict[str, object]] = []
    for chronicle in chronology:
        found = matching(chronicle, payloads)
        if found is not None:
            kept.add(str(found["id"]))
            _ = found.setdefault("about", chronicle.about)
            crewed = "crewed" in chronicle.about.lower()
            for entry in payloads:
                ours = entry is found or bool(entry["part"]) or crewed
                if entry["launchTag"] == found["launchTag"] and ours:
                    _ = entry.setdefault("mission", chronicle.name)
                    if crewed and entry["id"] in piloted:
                        entry["crewed"] = True
            continue
        if EARTH_ORBITER.search(chronicle.about) or NEVER_LEFT.search(chronicle.about) is None:
            continue
        never.append(
            {
                "name": chronicle.name,
                "launch": chronicle.launch,
                "about": chronicle.about,
                "nssdc": chronicle.nssdc,
            }
        )
    craft = [entry for entry in payloads if entry["id"] in kept]
    return craft, never


def craft_entry(
    row: dict[str, str], rows: list[dict[str, str]], landing: dict[str, str] | None
) -> dict[str, object]:
    """One craft as the site reads it, with whether it left Earth orbit (taken out after)."""
    ordered = sorted(rows, key=lambda r: gcat_date(r["SDate"]) or "")
    entry: dict[str, object] = {
        "id": row["JCAT"],
        "name": row["Name"],
        "cospar": row["Piece"],
        "launchTag": row["Launch_Tag"],
        "launch": gcat_date(row["LDate"]),
        "owner": row["Owner"],
        "state": row["State"],
        # Crewed: GCAT marks a craft that carried people with "H" second; a crewed vehicle that
        # can (a lunar module) with "P", crewed on a crewed mission (`craft_record`).
        "crewed": row["Type"][1:2] == "H" or row["Piece"] in CREWED,
        "piloted": row["Type"][1:2] == "P",
        # A part of a craft, carried and set loose (a lander, a probe, a cruise stage).
        "part": row["Type"][1:2] == "X",
        # A craft carried and set loose by another (Huygens by Cassini), and the other.
        "parent": row["Parent"] if row["Parent"].startswith("D") else None,
        "phases": [phase(r) for r in ordered],
        "left": any(
            r["Primary"] != "Earth" or r["Dest"] in BEYOND or r["Status"] in {"EO", "EAO"}
            for r in rows
        ),
    }
    if landing is not None:
        entry["landing"] = {
            "world": landing["World"],
            "lat": coordinate(landing["Lat"]),
            "lon": coordinate(landing["Lon"]),
            "date": gcat_date(landing["LandDate"]),
            "site": landing["LSite"],
        }
    return entry


def words(name: str) -> set[str]:
    """Give a name's words, lower case, for matching names written differently."""
    return {word for word in re.split(r"[^a-z0-9]+", name.lower()) if len(word) > 1}


def matching(chronicle: Chronicle, craft: list[dict[str, object]]) -> dict[str, object] | None:
    """Find the craft a chronicle is about: by designation, else by launch day and name.

    GCAT writes the early craft's designations the old way ("1959 MU 1"), and NSSDCA gives
    recent ones its own ("PEREGRN-1"), so those are found by their launch day, a day either
    side for time zones. Of several that day: the crewed one, for a crewed mission; else one
    named alike that is not a part of another (Apollo 13's experiments are named "Apollo 13"
    too); else the first that is not a part (a cruise stage, a lander).
    """
    keys = {chronicle.nssdc, *chronicle.parts}
    by_designation = [c for c in craft if c["cospar"] in keys]
    if by_designation:
        return by_designation[0]
    day = [c for c in craft if near_day(str(c["launch"]), chronicle.launch)]
    if not day:
        return None
    crewed = "crewed" in chronicle.about.lower()

    def rank(c: dict[str, object]) -> tuple[bool, bool, bool]:
        named = bool(words(str(c["name"])) & words(chronicle.name))
        return (crewed and bool(c["crewed"]), named and not c["part"], not c["part"])

    return max(day, key=rank)


def near_day(launch: str, day: str) -> bool:
    """Whether a launch (ISO, maybe with a time) falls within a day of ``day`` (ISO date)."""
    if len(day) < ISO_DAY or len(launch) < ISO_DAY:
        return launch.startswith(day)
    one = date.fromisoformat(launch[:ISO_DAY])
    other = date.fromisoformat(day[:ISO_DAY])
    return abs((one - other).days) <= 1


def fetch_spacecraft(path: Path, cache: Path) -> tuple[int, int]:  # pragma: no cover - network
    """Download the sources once into ``cache`` and write the record to ``path``."""
    texts: dict[str, str] = {}
    for name, sha256 in GCAT_FILES.items():
        file = cache / name
        if not file.exists():
            download(f"{GCAT}/{name}", file)
        texts[name] = checked(file, sha256).read_text(encoding="utf-8")
    page = cache / "chronology.html"
    if not page.exists():
        download(CHRONOLOGY, page)
    chronology = chronicles(checked(page, CHRONOLOGY_SHA256).read_text(encoding="latin-1"))
    craft, never = craft_record(
        gcat_rows(texts["deepcat.tsv"]),
        gcat_rows(texts["lprcat.tsv"]) + gcat_rows(texts["hcocat.tsv"]),
        gcat_rows(texts["landercat.tsv"]),
        chronology,
    )
    data = {
        "schemaVersion": 1,
        "sources": {"gcat": "https://planet4589.org/space/gcat/", "nssdca": CHRONOLOGY},
        "craft": craft,
        "neverLeft": never,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n")
    return len(craft), len(never)
