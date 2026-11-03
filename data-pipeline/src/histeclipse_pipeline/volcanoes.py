"""Volcanoes of the Holocene and their dated eruptions, from the Smithsonian's GVP.

Global Volcanism Program, Smithsonian Institution, *Volcanoes of the World* database
(https://volcano.si.edu; cite as https://volcano.si.edu/gvp_cite.cfm asks), read from its web
feature service as GeoJSON. Its content is offered for non-commercial use with credit (the
Smithsonian's terms of use); this site is non-commercial and credits it. The database is
updated as eruptions happen, so a download is not pinned by checksum: the file records when it
was accessed.

Kept per volcano: its number, name, type, country, place, elevation, last known eruption and
its primary photo's address, caption and credit (the photo itself is not copied). Kept per
eruption: its start year (with the database's uncertainty), month and day where known, VEI,
whether it is confirmed, and how it was dated. The GVP writes years before the common era as
negative numbers with no year zero; they become astronomical years here (1 BCE is 0). Each
volcano's geological summary and photo go to a second file, read only when a card opens.
"""

import datetime as dt
import json
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING, cast

from histeclipse_pipeline.sky import Json

if TYPE_CHECKING:
    from pathlib import Path

WFS = (
    "https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=2.0.0"
    "&request=GetFeature&outputFormat=application/json&typeNames=GVP-VOTW:{layer}"
)
VOLCANOES_LAYER = "Smithsonian_VOTW_Holocene_Volcanoes"
ERUPTIONS_LAYER = "Smithsonian_VOTW_Holocene_Eruptions"
SOURCE = "https://volcano.si.edu"
CREDIT = (
    "Global Volcanism Program, Smithsonian Institution: Volcanoes of the World database "
    "(volcano.si.edu), Holocene volcanoes and eruptions; non-commercial use with credit"
)

type Properties = dict[str, object]


@dataclass(frozen=True)
class Volcano:
    """A Holocene volcano: its number, name, kind, place and photo."""

    number: int
    name: str
    kind: str
    country: str
    latitude: float
    longitude: float
    elevation_m: int | None
    last_year: int | None
    photo: tuple[str, str, str] | None
    summary: str


@dataclass(frozen=True)
class Eruption:
    """A dated eruption: its volcano, start (astronomical year), size and how it is known."""

    volcano: int
    year: int
    uncertainty: int
    month: int
    day: int
    vei: int | None
    confirmed: bool
    evidence: str


def astronomical(year: int) -> int:
    """Turn a GVP year (BCE negative, no year zero) into an astronomical year."""
    return year + 1 if year < 0 else year


def _int(value: object) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def _str(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def _features(collection: object) -> list[Properties]:
    features = cast("list[dict[str, object]]", cast("dict[str, object]", collection)["features"])
    return [cast("Properties", feature["properties"]) for feature in features]


def read_volcanoes(collection: object) -> list[Volcano]:
    """Each volcano of the feature collection, by its properties."""
    found: list[Volcano] = []
    for row in _features(collection):
        link, caption, credit = (
            _str(row.get(key))
            for key in ("Primary_Photo_Link", "Primary_Photo_Caption", "Primary_Photo_Credit")
        )
        last = _int(row.get("Last_Eruption_Year"))
        found.append(
            Volcano(
                number=cast("int", row["Volcano_Number"]),
                name=_str(row.get("Volcano_Name")),
                kind=_str(row.get("Primary_Volcano_Type")),
                country=_str(row.get("Country")),
                latitude=float(cast("float", row["Latitude"])),
                longitude=float(cast("float", row["Longitude"])),
                elevation_m=_int(row.get("Elevation")),
                last_year=None if last is None else astronomical(last),
                photo=(link, caption, credit) if link.startswith("https://") else None,
                summary=_str(row.get("Geological_Summary")),
            )
        )
    return found


def read_eruptions(collection: object) -> list[Eruption]:
    """Each eruption with a start year, oldest first."""
    found: list[Eruption] = []
    for row in _features(collection):
        year = _int(row.get("StartDateYear"))
        if year is None:
            continue
        found.append(
            Eruption(
                volcano=cast("int", row["Volcano_Number"]),
                year=astronomical(year),
                uncertainty=_int(row.get("StartDateYearUncertainty")) or 0,
                month=_int(row.get("StartDateMonth")) or 0,
                day=_int(row.get("StartDateDay")) or 0,
                vei=_int(row.get("ExplosivityIndexMax")),
                confirmed=row.get("Activity_Type") == "Confirmed Eruption",
                evidence=_str(row.get("StartEvidenceMethod")),
            )
        )
    return sorted(found, key=lambda eruption: (eruption.year, eruption.volcano))


def volcanoes_file(
    volcanoes: list[Volcano], eruptions: list[Eruption], accessed: str
) -> dict[str, Json]:
    """Build the site's file: the volcanoes, then the eruptions as compact rows."""
    evidence = sorted({eruption.evidence for eruption in eruptions if eruption.evidence})
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "accessed": accessed,
        "evidence": list[Json](evidence),
        "volcanoes": [
            {
                "number": volcano.number,
                "name": volcano.name,
                "kind": volcano.kind,
                "country": volcano.country,
                "latitude": volcano.latitude,
                "longitude": volcano.longitude,
                "elevationM": volcano.elevation_m,
                "lastYear": volcano.last_year,
            }
            for volcano in volcanoes
        ],
        # Each: volcano number, start year, ± years, month, day (0 unknown), VEI (-1 unknown),
        # 1 if confirmed, and how it was dated (an index into evidence, -1 not said).
        "eruptions": [
            [
                eruption.volcano,
                eruption.year,
                eruption.uncertainty,
                eruption.month,
                eruption.day,
                -1 if eruption.vei is None else eruption.vei,
                1 if eruption.confirmed else 0,
                evidence.index(eruption.evidence) if eruption.evidence else -1,
            ]
            for eruption in eruptions
        ],
    }


def details_file(volcanoes: list[Volcano]) -> dict[str, Json]:
    """Build the second file, for the cards: each volcano's summary and photo, by its number."""
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "volcanoes": {
            str(volcano.number): {
                "summary": volcano.summary,
                "photo": None
                if volcano.photo is None
                else {
                    "src": volcano.photo[0],
                    "caption": volcano.photo[1],
                    "credit": volcano.photo[2],
                },
            }
            for volcano in volcanoes
            if volcano.summary or volcano.photo is not None
        },
    }


def _download(url: str) -> object:  # pragma: no cover - needs network access
    request = urllib.request.Request(url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
    with urllib.request.urlopen(request, timeout=300) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{url}: expected bytes"
        raise TypeError(msg)
    return cast("object", json.loads(body))


def fetch_volcanoes(path: Path) -> int:  # pragma: no cover - needs network access
    """Download the volcanoes and eruptions; write the site's file and the summaries beside it."""
    volcanoes = read_volcanoes(_download(WFS.format(layer=VOLCANOES_LAYER)))
    eruptions = read_eruptions(_download(WFS.format(layer=ERUPTIONS_LAYER)))
    known = {volcano.number for volcano in volcanoes}
    eruptions = [eruption for eruption in eruptions if eruption.volcano in known]
    accessed = dt.datetime.now(tz=dt.UTC).date().isoformat()
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_text(
        json.dumps(
            volcanoes_file(volcanoes, eruptions, accessed),
            separators=(",", ":"),
            ensure_ascii=False,
        )
        + "\n"
    )
    details = path.with_name("volcano-details.json")
    _ = details.write_text(
        json.dumps(details_file(volcanoes), separators=(",", ":"), ensure_ascii=False) + "\n"
    )
    return len(eruptions)
