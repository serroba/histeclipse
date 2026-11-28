"""El Niño and La Niña since 1950: NOAA's two indices of the tropical Pacific, side by side (#886).

NOAA's Climate Prediction Center (CPC) publishes two indices of the El Niño-Southern
Oscillation (ENSO), both three-month running means of the sea surface temperature anomaly in the
Niño 3.4 region (5°N-5°S, 120°-170°W) from ERSST v6:

- the **Relative Oceanic Niño Index (RONI)**, CPC's official index since 1 February 2026 (NWS
  Public Information Statement 26-05): the Niño 3.4 anomaly against 1991-2020 minus the mean
  anomaly of the whole tropics (20°N-20°S), rescaled to Niño 3.4's variance. Taking the
  tropics' mean out keeps the warming of the whole ocean from reading as El Niño;
- the **Oceanic Niño Index (ONI)**, the official index before that, which CPC still updates:
  the Niño 3.4 anomaly against centred 30-year base periods updated every five years.

Both name an El Niño (La Niña) episode where the index is at or above +0.5 °C (at or below
-0.5 °C) for at least five overlapping seasons running. CPC's tables print the index to a
tenth of a degree and colour the episodes from those printed values, so the threshold is
applied here to the values rounded to a tenth; the values themselves are kept to the hundredth
the files give. The two indices disagree most in the recent warm years, when the whole tropical
ocean is warm: the site shows both, and where they differ, rather than pick one.

Each value is the mean of three months and is placed at its middle month: DJF 1950 (December
1949 to February 1950) at January 1950. CPC revises the last two months as later data come in
(a high-frequency filter applied to ERSST v6), so those are marked provisional.

The files are US Government works, with no licence stated; credited as CPC asks. They are living
files, updated each month at the same address (``living_pins.py``).
"""

import datetime as dt
import json
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal

from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from collections.abc import Sequence
    from pathlib import Path

#: The seasons as CPC names them, in order; a season's middle month is its index plus one.
SEASONS = ("DJF", "JFM", "FMA", "MAM", "AMJ", "MJJ", "JJA", "JAS", "ASO", "SON", "OND", "NDJ")
MONTHS = 12
#: An episode: at or beyond this many °C, rounded to a tenth...
THRESHOLD = 0.5
#: ...for at least this many overlapping seasons running.
RUN = 5
#: CPC revises the last values this many months on.
PROVISIONAL_MONTHS = 2

RONI_URL = "https://www.cpc.ncep.noaa.gov/data/indices/RONI.ascii.txt"
#: The file of 3 November 2026, to ASO 2026. CPC updates it each month.
RONI_SHA256 = "1297887f581b6190e459cbbf8bdec9a703ff65c1a229e2de4dd94285254f35c8"
ONI_URL = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt"
#: The file of 3 November 2026, to ASO 2026 (ERSST v6). CPC updates it each month.
ONI_SHA256 = "118c563331335c8649cdc2677e6be7ae89d1259d901345fcddbc2857af280f7f"

SOURCE = "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/"
CREDIT = (
    "NOAA Climate Prediction Center, Relative Oceanic Niño Index (RONI) and Oceanic Niño Index "
    "(ONI), from ERSST v6, US Government work, no licence stated; seasons placed at their "
    "middle month and episodes found for this site"
)
LICENCE = "none stated (US Government work)"

type Phase = Literal["elNino", "laNina"]


@dataclass(frozen=True)
class Index:
    """One index as published: its first value's middle month and its values, °C."""

    first: tuple[int, int]
    values: list[float]


@dataclass(frozen=True)
class Episode:
    """A run of seasons beyond the threshold: its phase, first and last months, and peak."""

    phase: Phase
    first: tuple[int, int]
    last: tuple[int, int]
    peak: float
    peak_at: tuple[int, int]
    #: Runs on to the last value: may yet go on, or (if provisional) change.
    ongoing: bool


@dataclass(frozen=True)
class Described:
    """What the site says about an index beside its values."""

    id: str
    label: str
    official: str
    method: str
    baseline: str
    url: str


RONI = Described(
    id="roni",
    label="Relative Oceanic Niño Index (RONI)",
    official="NOAA's official index since 1 February 2026",
    method=(
        "Niño 3.4 sea surface temperature anomaly minus the mean anomaly of the tropics "
        "(20°N\u201320°S), rescaled to Niño 3.4's variance; three-month running mean (ERSST v6)"
    ),
    baseline="1991\u20132020",
    url=SOURCE,
)
ONI = Described(
    id="oni",
    label="Oceanic Niño Index (ONI)",
    official="NOAA's official index until January 2026, still updated",
    method="Niño 3.4 sea surface temperature anomaly; three-month running mean (ERSST v6)",
    baseline="centred 30-year periods, updated every 5 years",
    url="https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/oni/v6/",
)


def next_month(month: tuple[int, int]) -> tuple[int, int]:
    """Give the month after ``(year, month)``."""
    year, number = month
    return (year + 1, 1) if number == MONTHS else (year, number + 1)


def month_text(month: tuple[int, int]) -> str:
    """Write a month as ``YYYY-MM``."""
    return f"{month[0]:04d}-{month[1]:02d}"


def parse_index(text: str) -> Index:
    """Read one of CPC's season files: a heading, then season, year, ..., anomaly on each line.

    The seasons must run on without a gap.
    """
    first: tuple[int, int] | None = None
    expected: tuple[int, int] | None = None
    values: list[float] = []
    for line in text.splitlines()[1:]:
        parts = line.split()
        if not parts:
            continue
        if parts[0] not in SEASONS:
            msg = f"unknown season in {line!r}"
            raise ValueError(msg)
        month = (int(parts[1]), SEASONS.index(parts[0]) + 1)
        if expected is not None and month != expected:
            msg = f"expected {month_text(expected)}, found {month_text(month)}"
            raise ValueError(msg)
        first = first or month
        values.append(float(parts[-1]))
        expected = next_month(month)
    if first is None:
        msg = "no seasons"
        raise ValueError(msg)
    return Index(first, values)


def phase_of(value: float) -> Phase | None:
    """Give the phase a value counts toward, from its value rounded to a tenth, as CPC prints it."""
    printed = round(value, 1)
    if printed >= THRESHOLD:
        return "elNino"
    if printed <= -THRESHOLD:
        return "laNina"
    return None


def months_from(first: tuple[int, int], count: int) -> list[tuple[int, int]]:
    """``count`` months from ``first`` on."""
    out = [first]
    while len(out) < count:
        out.append(next_month(out[-1]))
    return out[:count]


def episodes(index: Index) -> list[Episode]:
    """Every run of at least ``RUN`` seasons in one phase."""
    months = months_from(index.first, len(index.values))
    found: list[Episode] = []
    start = 0
    while start < len(index.values):
        phase = phase_of(index.values[start])
        end = start
        while end + 1 < len(index.values) and phase_of(index.values[end + 1]) == phase:
            end += 1
        if phase is not None and end - start + 1 >= RUN:
            run = index.values[start : end + 1]
            peak = max(run) if phase == "elNino" else min(run)
            found.append(
                Episode(
                    phase=phase,
                    first=months[start],
                    last=months[end],
                    peak=peak,
                    peak_at=months[start + run.index(peak)],
                    ongoing=end == len(index.values) - 1,
                )
            )
        start = end + 1
    return found


def episode_json(episode: Episode) -> dict[str, Json]:
    """One episode as the web app reads it."""
    out: dict[str, Json] = {
        "phase": episode.phase,
        "first": month_text(episode.first),
        "last": month_text(episode.last),
        "peak": episode.peak,
        "peakAt": month_text(episode.peak_at),
    }
    if episode.ongoing:
        out["ongoing"] = True
    return out


def index_json(described: Described, index: Index) -> dict[str, Json]:
    """One index, described, with its values from its first month and its episodes."""
    return {
        "id": described.id,
        "label": described.label,
        "official": described.official,
        "method": described.method,
        "baseline": described.baseline,
        "url": described.url,
        "first": month_text(index.first),
        "values": list[Json](index.values),
        "episodes": [episode_json(each) for each in episodes(index)],
    }


def index_file(indices: Sequence[tuple[Described, Index]], accessed: str) -> dict[str, Json]:
    """Build the manifest: credit, the rule for an episode, and each index side by side."""
    return {
        "schemaVersion": 1,
        "sources": ["cpcRoni", "cpcOni"],
        "credit": CREDIT,
        "source": SOURCE,
        "licence": LICENCE,
        "accessed": accessed,
        "changes": ("Seasons placed at their middle month and episodes found for this site"),
        "units": "°C",
        "placed": "each three-month season at its middle month",
        "threshold": THRESHOLD,
        "seasons": RUN,
        "provisionalMonths": PROVISIONAL_MONTHS,
        "indices": [index_json(described, index) for described, index in indices],
    }


def write_enso(indices: Sequence[tuple[Described, Index]], folder: Path, accessed: str) -> int:
    """Write ``index.json``; return how many episodes the indices name between them."""
    folder.mkdir(parents=True, exist_ok=True)
    body = json.dumps(index_file(indices, accessed), separators=(",", ":"), ensure_ascii=False)
    _ = (folder / "index.json").write_text(body + "\n")
    return sum(len(episodes(index)) for _, index in indices)


def _download(url: str, sha256: str, what: str) -> bytes:  # pragma: no cover - needs network access
    # Each URL is one of the pinned https constants above.
    request = urllib.request.Request(url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
    with urllib.request.urlopen(request, timeout=120) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{url}: expected bytes"
        raise TypeError(msg)
    return verified(body, sha256, what)


def fetch_enso(folder: Path) -> int:  # pragma: no cover - needs network access
    """Download both indices (each checked against its pinned checksum) and write them."""
    accessed = dt.datetime.now(tz=dt.UTC).date().isoformat()
    roni = parse_index(_download(RONI_URL, RONI_SHA256, "CPC RONI").decode())
    oni = parse_index(_download(ONI_URL, ONI_SHA256, "CPC ONI").decode())
    return write_enso([(RONI, roni), (ONI, oni)], folder, accessed)
