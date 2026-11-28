"""How much of marine animal life each stage of the Phanerozoic lost, for each extinction (#1269).

The Paleobiology Database (https://paleobiodb.org): every marine animal occurrence identified
to a genus, Cambrian to Neogene, with its age range. Its data service states the download's
licence as CC0; the database asks to be credited, and is. The database grows, so a download is
not pinned by checksum: the file records when it was accessed and how many occurrences were read.

Each occurrence is placed in a stage only where its age range lies within that one stage (the
stages are the PBDB's, of the International Chronostratigraphic Chart). For each stage, the
share of its genera lost three ways:

- **Last found**: genera whose last occurrence is in the stage, of all whose range, first find
  to last, spans it. The raw record, as usually counted: a stage followed by one poorly sampled
  loses more than it did.
- **Three-timer** (Alroy 2008, PNAS 105, 11536-11542): of the genera found in the stage before
  and in this one, the share not found in the next, corrected by how often the record finds a
  genus in a stage it lived through (part-timers against three-timers, over all stages).
- **Gap-filler** (Alroy 2014, Paleobiology 40, 374-397): as the three-timer, but a genus found
  again two stages on is counted as having survived, though missed in the next.

A stage's rate counts all its losses, the steady background of a stage millions of years long
as well as its crisis; estimates that set the background apart (Stanley 2016) give less.

Pure, but for the download (``write_rates``).
"""

import csv
import datetime as dt
import io
import json
import math
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Iterable, Sequence
    from pathlib import Path

OCCURRENCES = (
    "https://paleobiodb.org/data1.2/occs/list.csv?base_name=Animalia&envtype=marine"
    "&interval=Cambrian,Neogene&idreso=genus&idqual=certain&pres=regular"
    "&show=class,genus,ref&datainfo"
)
STAGES = (
    "https://paleobiodb.org/data1.2/occs/diversity.csv?base_name=Animalia&envtype=marine"
    "&count=genera&time_reso=stage&interval=Cambrian,Neogene"
)
CREDIT = (
    "The Paleobiology Database (paleobiodb.org): marine animal occurrences identified to genus, "
    "counted by stage for this site; extinction by three-timer (Alroy 2008) and gap-filler "
    "(Alroy 2014) rates"
)
#: Leeway, Myr, in matching an occurrence's range to a stage's bounds (rounding in the data).
LEEWAY = 0.01
#: Gap-fillers look two stages on, so the last two stages have no rate.
LOOK_AHEAD = 2


@dataclass(frozen=True)
class Stage:
    """A stage of the International Chronostratigraphic Chart."""

    name: str
    #: Its base and top, Ma.
    base: float
    top: float


@dataclass(frozen=True)
class Occurrence:
    """A find of a genus, and its age range, Ma."""

    genus: str
    oldest: float
    youngest: float


def read_records(text: str) -> list[dict[str, str]]:
    """Read the records of a PBDB csv, skipping a ``datainfo`` header before them."""
    lines = text.splitlines()
    start = next(
        index
        for index, line in enumerate(lines)
        if line.startswith(('"occurrence_no"', '"interval_no"'))
    )
    return list(csv.DictReader(io.StringIO("\n".join(lines[start:]))))


def stages_of(records: Iterable[dict[str, str]]) -> list[Stage]:
    """Read the stages, oldest first."""
    stages = [Stage(r["interval_name"], float(r["max_ma"]), float(r["min_ma"])) for r in records]
    return sorted(stages, key=lambda stage: -stage.base)


def occurrences_of(records: Iterable[dict[str, str]]) -> list[Occurrence]:
    """Read the occurrences named to a genus."""
    return [
        Occurrence(r["genus"], float(r["max_ma"]), float(r["min_ma"]))
        for r in records
        if r["genus"]
    ]


def stage_index(occurrence: Occurrence, stages: Sequence[Stage]) -> int | None:
    """Find the one stage `occurrence`'s age range lies within, if any."""
    for index, stage in enumerate(stages):
        if occurrence.oldest <= stage.base + LEEWAY and occurrence.youngest >= stage.top - LEEWAY:
            return index
    return None


def found(occurrences: Iterable[Occurrence], stages: Sequence[Stage]) -> list[set[str]]:
    """Gather the genera found in each stage, leaving out occurrences spanning more than one."""
    genera: list[set[str]] = [set() for _ in stages]
    for occurrence in occurrences:
        index = stage_index(occurrence, stages)
        if index is not None:
            genera[index].add(occurrence.genus)
    return genera


def last_found(seen: Sequence[set[str]]) -> list[tuple[int, int]]:
    """Count each stage's genera last found in it, and all whose range spans it."""
    first: dict[str, int] = {}
    final: dict[str, int] = {}
    for index, genera in enumerate(seen):
        for genus in genera:
            _ = first.setdefault(genus, index)
            final[genus] = index
    spanning = [0] * len(seen)
    last = [0] * len(seen)
    for genus, start in first.items():
        end = final[genus]
        for index in range(start, end + 1):
            spanning[index] += 1
        last[end] += 1
    return list(zip(last, spanning, strict=True))


def lost(rate: float) -> float:
    """Turn an extinction rate, per stage, into the share lost."""
    return 1 - math.exp(-rate)


@dataclass(frozen=True)
class Rates:
    """Each stage's share of genera lost, where its neighbours let it be counted."""

    three_timer: list[float | None]
    gap_filler: list[float | None]


def extinction_rates(seen: Sequence[set[str]]) -> Rates:
    """Work out extinction in each stage from the genera found in it and the stages around it.

    For stage i: two-timers are found in i-1 and i; three-timers in i-1, i and i+1;
    part-timers in i-1 and i+1, not i; gap-fillers in i-1 and i+2, not i+1. The first stage
    and the last two have no rate.
    """
    count = len(seen)
    empty: set[str] = set()

    def at(index: int) -> set[str]:
        return seen[index] if 0 <= index < count else empty

    three_total = sum(len(at(i - 1) & at(i) & at(i + 1)) for i in range(count))
    part_total = sum(len((at(i - 1) & at(i + 1)) - at(i)) for i in range(count))
    # How often the record finds a genus in a stage it lived through: all, where nothing says.
    sampling = three_total / (three_total + part_total) if three_total + part_total else 1.0
    three_timer: list[float | None] = []
    gap_filler: list[float | None] = []
    for i in range(count):
        two = len(at(i - 1) & at(i))
        three = len(at(i - 1) & at(i) & at(i + 1))
        part = len((at(i - 1) & at(i + 1)) - at(i))
        gap = len((at(i - 1) & at(i + LOOK_AHEAD)) - at(i + 1))
        edge = i == 0 or i >= count - LOOK_AHEAD
        survived = three + part + gap
        three_timer.append(
            None if edge or three == 0 else max(0.0, lost(math.log(two * sampling / three)))
        )
        gap_filler.append(
            None if edge or survived == 0 else lost(math.log((two + part) / survived))
        )
    return Rates(three_timer, gap_filler)


def rounded(share: float | None) -> float | None:
    """Round a share to a tenth of a percent."""
    return None if share is None else round(share, 3)


def stage_rates(
    stages: Sequence[Stage], occurrences: Iterable[Occurrence]
) -> list[dict[str, object]]:
    """List each stage, oldest first, with its genera and its share of them lost three ways."""
    seen = found(occurrences, stages)
    raw = last_found(seen)
    rates = extinction_rates(seen)
    rows: list[dict[str, object]] = []
    for index, stage in enumerate(stages):
        last, spanning = raw[index]
        rows.append(
            {
                "stage": stage.name,
                "base": stage.base,
                "top": stage.top,
                "genera": spanning,
                "lastFound": rounded(last / spanning) if spanning else None,
                "threeTimer": rounded(rates.three_timer[index]),
                "gapFiller": rounded(rates.gap_filler[index]),
            }
        )
    return rows


def fetch_text(url: str) -> str:  # pragma: no cover - needs network access
    """Download `url` as text."""
    request = urllib.request.Request(url, headers={"User-Agent": "histeclipse-pipeline/1.0"})  # noqa: S310
    with urllib.request.urlopen(request, timeout=1800) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{url}: expected bytes"
        raise TypeError(msg)
    return body.decode("utf-8")


def write_rates(out: Path, cache: Path) -> int:  # pragma: no cover - needs network access
    """Download (or reuse) the PBDB files in `cache` and write each stage's losses to `out`."""
    cache.mkdir(parents=True, exist_ok=True)
    texts: dict[str, str] = {}
    for name, url in (("stages.csv", STAGES), ("occurrences.csv", OCCURRENCES)):
        path = cache / name
        if not path.exists():
            _ = path.write_text(fetch_text(url), encoding="utf-8")
        texts[name] = path.read_text(encoding="utf-8")
    stages = stages_of(read_records(texts["stages.csv"]))
    occurrences = occurrences_of(read_records(texts["occurrences.csv"]))
    accessed = dt.datetime.fromtimestamp((cache / "occurrences.csv").stat().st_mtime, dt.UTC)
    document = {
        "credit": CREDIT,
        "source": "https://paleobiodb.org",
        "licence": "CC0, as the PBDB data service states it",
        "accessed": accessed.date().isoformat(),
        "occurrences": len(occurrences),
        "stages": stage_rates(stages, occurrences),
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    _ = out.write_text(json.dumps(document, ensure_ascii=False) + "\n", encoding="utf-8")
    return len(stages)
