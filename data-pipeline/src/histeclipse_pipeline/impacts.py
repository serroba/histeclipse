"""Impact craters and impact deposits on Earth, and where each lay when it struck.

The Impact Earth Database (Western University, https://impact.uwo.ca; Osinski et al. 2022,
*Impact Earth: A review of the terrestrial impact record*, Earth-Science Reviews 232, 104112):
confirmed hypervelocity impact craters, impact craters with meteorite fragments, and impact
deposits, each with its place, size, target rock and age as the database gives it. The
database is read as its own map reads it, one request per kind; it changes as craters are
confirmed, so a download is not pinned by checksum: the file records when it was accessed.

Ages are kept as the database writes them, and read into the oldest and youngest they allow
(millions of years): ``66.038 ± 0.098``, ``450 - 650``, ``<66`` (younger than 66) or ``~85``.
An age given only in words (``Middle Cambrian``) or not at all is kept as text, with no range.

Each place is carried back to where it lay every 5 million years, to 540 million years ago, on
the PALEOMAP reconstruction (Scotese), the model behind the deep-time surface maps, by the
GPlates Web Service (EarthByte, https://gws.gplates.org). A place on no plate at a time (on
ocean floor not yet formed) has no position then.
"""

import datetime as dt
import json
import math
import re
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING, cast

if TYPE_CHECKING:
    from collections.abc import Callable
    from pathlib import Path

    from histeclipse_pipeline.sky import Json

DATABASE_URL = "https://impact.uwo.ca/wp-admin/admin-ajax.php"
GWS_URL = "https://gws.gplates.org/reconstruct/reconstruct_points/"
SOURCE = "https://impact.uwo.ca"
CREDIT = (
    "Impact Earth Database (Western University; Osinski et al. 2022, Earth-Science Reviews 232, "
    "104112); places when they struck from the PALEOMAP model (Scotese) by the GPlates Web "
    "Service (EarthByte)"
)
#: The database's kinds: its category, and the identifier kept here.
KINDS: tuple[tuple[str, str], ...] = (
    ("hypervelocity", "hypervelocity"),
    ("impact", "crater"),
    ("deposit", "deposit"),
)
STEP_MA = 5
OLDEST_MA = 540
#: Earth's age: an age older than this is in years, not millions of years.
EARTH_AGE_MA = 4600
#: Countries whose land lies wholly south of the equator, or wholly north of it.
SOUTHERN = frozenset({"Australia", "South Africa", "Namibia", "Botswana", "Argentina", "Chile"})
NORTHERN = frozenset({"United States of America", "Canada", "Russia", "China", "Mexico"})


@dataclass(frozen=True)
class Impact:
    """A crater or deposit: its place, its age as written and as a range, and its size."""

    id: int
    kind: str
    name: str
    country: str
    region: str
    target: str
    latitude: float
    longitude: float
    age: str
    older_ma: float | None
    younger_ma: float | None
    diameter_km: float | None


_NUMBER = r"\d+(?:\.\d+)?"


def _ma(value: float) -> float:
    return value / 1e6 if value > EARTH_AGE_MA else value


def age_range(text: str) -> tuple[float, float] | None:
    """Read the oldest and youngest an age allows, Ma; None when it gives no number."""
    # The database sometimes writes a thin space, a tilde operator or an en dash.
    clean = re.sub(r"\(.*?\)", "", text).replace("\u2009", " ").replace("\u223c", "~")
    clean = clean.replace("\u2013", "-")
    clean = re.sub(r"\s*Ma\b|\?", "", clean).strip()
    if re.fullmatch(r"Recent(\s*-.*)?", clean):
        return (0.0, 0.0)
    if match := re.fullmatch(rf"({_NUMBER})\s*±\s*({_NUMBER})", clean):
        middle, error = float(match[1]), float(match[2])
        return (_ma(middle + error), _ma(max(0.0, middle - error)))
    if match := re.fullmatch(rf"~?\s*({_NUMBER})\s*-\s*({_NUMBER})", clean):
        first, second = float(match[1]), float(match[2])
        return (_ma(max(first, second)), _ma(min(first, second)))
    if match := re.fullmatch(rf"[<≤]\s*({_NUMBER})", clean):
        return (_ma(float(match[1])), 0.0)
    if match := re.fullmatch(rf"~?\s*({_NUMBER})", clean):
        value = _ma(float(match[1]))
        return (value, value)
    return None


def diameter(text: str) -> float | None:
    """Read a diameter in kilometres (the larger of a range); None when none is given."""
    numbers = [float(found) for found in cast("list[str]", re.findall(_NUMBER, text))]
    return max(numbers) if numbers else None


def _text(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return ", ".join(part.strip() for part in value.split(",") if part.strip())


def read_impacts(kind: str, listing: dict[str, object]) -> list[Impact]:
    """Each crater or deposit of one kind, from the database's listing."""
    found: list[Impact] = []
    for raw in cast("list[dict[str, object]]", listing["list"]):
        age = _text(raw.get("age"))
        ages = age_range(age)
        target = _text(raw.get("type"))
        rock = _text(raw.get("sub_type"))
        found.append(
            Impact(
                id=int(str(raw["id"])),
                kind=kind,
                name=_text(raw.get("name")),
                country=_text(raw.get("country")),
                region=_text(raw.get("region")),
                target=f"{target} ({rock})" if rock and target else target,
                latitude=float(str(raw["lat"])),
                longitude=float(str(raw["lng"])),
                age=age,
                older_ma=None if ages is None else ages[0],
                younger_ma=None if ages is None else ages[1],
                diameter_km=diameter(_text(raw.get("radius"))),
            )
        )
    return found


def misplaced(impact: Impact) -> bool:
    """Whether a place lies in the wrong hemisphere for the country the database names."""
    return (impact.country in SOUTHERN and impact.latitude > 0) or (
        impact.country in NORTHERN and impact.latitude < 0
    )


def steps_needed(impact: Impact) -> int:
    """How many 5-million-year steps back its position is wanted: to the step past its age."""
    if impact.older_ma is None:
        return 0
    return min(OLDEST_MA // STEP_MA, math.ceil(impact.older_ma / STEP_MA)) + 1


type Position = tuple[float, float] | None
type Reconstruct = Callable[[list[tuple[float, float]], int], list[Position]]


def positions_then(impacts: list[Impact], reconstruct: Reconstruct) -> dict[int, list[Position]]:
    """Each impact's place (latitude, longitude) at every step back to the one past its age."""
    then: dict[int, list[Position]] = {
        impact.id: [(impact.latitude, impact.longitude)] for impact in impacts
    }
    for step in range(1, OLDEST_MA // STEP_MA + 1):
        wanted = [impact for impact in impacts if steps_needed(impact) > step]
        if not wanted:
            break
        placed = reconstruct(
            [(impact.latitude, impact.longitude) for impact in wanted], step * STEP_MA
        )
        for impact, position in zip(wanted, placed, strict=True):
            then[impact.id].append(position)
    return then


def _flat(position: Position) -> Json:
    if position is None:
        return None
    return [round(position[0] * 100), round(position[1] * 100)]


def impacts_file(
    impacts: list[Impact], then: dict[int, list[Position]], left_out: list[Impact], accessed: str
) -> dict[str, Json]:
    """Build the site's file: each impact, with its places then as [lat, lon] x 100."""
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "accessed": accessed,
        "stepMa": STEP_MA,
        "scale": 100,
        "impacts": [
            {
                "id": impact.id,
                "kind": impact.kind,
                "name": impact.name,
                "country": impact.country,
                "region": impact.region,
                "target": impact.target,
                "age": impact.age,
                "olderMa": impact.older_ma,
                "youngerMa": impact.younger_ma,
                "diameterKm": impact.diameter_km,
                "then": [_flat(position) for position in then[impact.id]],
            }
            for impact in impacts
        ],
        "leftOut": [
            {
                "name": impact.name,
                "kind": impact.kind,
                "why": (
                    f"its place ({impact.latitude:g}, {impact.longitude:g}) is not in "
                    f"{impact.country}, the country it names"
                ),
            }
            for impact in left_out
        ],
    }


def _post(url: str, fields: dict[str, str]) -> bytes:  # pragma: no cover - needs network access
    request = urllib.request.Request(  # noqa: S310
        url,
        data=urllib.parse.urlencode(fields).encode(),
        headers={"User-Agent": "histeclipse-pipeline"},
    )
    with urllib.request.urlopen(request, timeout=120) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{url}: expected bytes"
        raise TypeError(msg)
    return body


def _reconstruct(
    points: list[tuple[float, float]], ma: int
) -> list[Position]:  # pragma: no cover - needs network access
    coordinates = ",".join(f"{lon},{lat}" for lat, lon in points)
    body = _post(
        GWS_URL,
        {"points": coordinates, "time": str(ma), "model": "PALEOMAP", "return_null_points": ""},
    )
    placed = cast("dict[str, list[list[float] | None]]", json.loads(body))["coordinates"]
    time.sleep(1)  # One request a second: a shared, free service.
    return [None if point is None else (point[1], point[0]) for point in placed]


def fetch_impacts(path: Path) -> int:  # pragma: no cover - needs network access
    """Download each kind of impact, carry each back through time and write the site's file."""
    impacts: list[Impact] = []
    for category, kind in KINDS:
        body = _post(DATABASE_URL, {"action": "get_location", "crater_category": category})
        impacts.extend(read_impacts(kind, cast("dict[str, object]", json.loads(body))))
        time.sleep(1)
    kept = [impact for impact in impacts if not misplaced(impact)]
    left_out = [impact for impact in impacts if misplaced(impact)]
    then = positions_then(kept, _reconstruct)
    accessed = dt.datetime.now(tz=dt.UTC).date().isoformat()
    data = impacts_file(kept, then, left_out, accessed)
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n")
    return len(kept)
