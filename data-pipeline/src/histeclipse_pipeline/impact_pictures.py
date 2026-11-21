"""Pictures of the impact craters, for their cards: each crater's Wikipedia page and lead photo.

Each crater of the Impact Earth Database (``public/data/impacts.json``) is found on English
Wikipedia: first among Wikidata's impact craters on Earth, the nearest whose name begins as the
database's does and lies within reach of it (the crater's radius and some); else by its name
with "crater" or "impact structure", where the page says it is a crater or an impact and places
it within the same reach; else by a few names the two spell differently (``RENAMED``). Its page's
lead image, when on Wikimedia Commons with a free licence (see ``pictures``), is kept if it is
a photograph of the place: not a map, a diagram or a drawing. Keyed by the database's id.
"""

import datetime as dt
import json
import math
import re
import unicodedata
import urllib.parse
from typing import TYPE_CHECKING, cast

from histeclipse_pipeline.pictures import SUMMARY, Picture, picture, pictures_file

if TYPE_CHECKING:
    from collections.abc import Callable
    from pathlib import Path

    from histeclipse_pipeline.sky import Json

type Fetch = Callable[[str], object]
type Point = tuple[float, float]

WIKIDATA = "https://query.wikidata.org/sparql?format=json&query={query}"
#: Impact craters (and their subclasses) with a place, on Earth, that have an English page.
CRATERS_QUERY = """
SELECT ?coord ?article WHERE {
  ?item wdt:P31/wdt:P279* wd:Q55818 ; wdt:P625 ?coord .
  FILTER NOT EXISTS { ?item wdt:P376 ?body . FILTER(?body != wd:Q2) }
  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
}
"""
#: The database's names that Wikipedia spells otherwise, beyond a shared beginning.
RENAMED = {
    "Barringer": "Meteor Crater",
    "B.P. Structure": "BP Impact Structure",
}
#: How far from the database's place a page may put the crater, besides its radius, km.
REACH_KM = 60.0
#: Words in a file's name that say it is not a photograph of the crater on the land: a map or a
#: diagram, a meteorite in a museum (but "meteorite crater" is the place), a stamp or a sign, or a
#: close-up of its rocks.
_NOT_A_PHOTO_WORDS = [
    "map",
    "location",
    "locator",
    "diagram",
    "schem",
    "sketch",
    "drawing",
    "geolog",
    "cross.?section",
    "relief",
    "carte",
    "regions",
    "ordovician",
    "meteorite(?![_ ,-]*crater)",
    "stamp",
    "marker",
    "breccia",
    "suevit",
    "shatter",
    "lapilli",
    "boulder",
    "deformation",
    r"\.svg$",
]
NOT_A_PHOTO = re.compile("|".join(_NOT_A_PHOTO_WORDS), re.IGNORECASE)
#: Pictures looked at and left out, by file: not a photograph of the crater on the land.
NOT_OF_IT = frozenset(
    {
        "ISS061-E-139042_-_View_of_India.jpg",  # Ramgarh: an astronaut's view of all of India
        "Decorah_crater.jpg",  # a map of Iowa
        "Iso-Naakkima_(kraatteri).png",  # a map
        "Lumparn.png",  # a map of Åland
        "Mansonimpact.jpg",  # a map of Iowa
        "Gardnos.jpg",  # a monument
        "Astrobleme.Norway.Mjolnir.JPG",  # a 3D model of the sea floor
        "Импактное_стекло_Жаманшинит.jpg",  # Zhamanshin: a piece of its impact glass
    }
)
EARTH_RADIUS_KM = 6371.0
_POINT = re.compile(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)")


def plain_name(name: str) -> str:
    """Spell a name in plain letters, to compare: "Mjølnir crater" is "mjolnircrater"."""
    spelled = name.replace("ø", "o").replace("Ø", "O").replace("æ", "ae")
    ascii_only = unicodedata.normalize("NFD", spelled).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z]", "", ascii_only.lower())


def distance_km(a: Point, b: Point) -> float:
    """How far apart two places are, along the ground."""
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    half = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(min(1.0, half)))


def reach(diameter_km: float | None) -> float:
    """How far from the database's place its page may put a crater."""
    return REACH_KM + (diameter_km or 0.0) / 2


def craters_from(answer: object) -> dict[str, Point]:
    """Wikidata's answer as each English page's title and the crater's place."""
    rows = cast("dict[str, dict[str, list[dict[str, dict[str, str]]]]]", answer)
    craters: dict[str, Point] = {}
    for row in rows["results"]["bindings"]:
        point = _POINT.match(row["coord"]["value"])
        if point is None:
            continue
        slug = row["article"]["value"].split("/wiki/", 1)[1]
        title = urllib.parse.unquote(slug).replace("_", " ")
        _ = craters.setdefault(title, (float(point.group(2)), float(point.group(1))))
    return craters


def nearest(
    name: str, place: Point, diameter_km: float | None, craters: dict[str, Point]
) -> str | None:
    """Find the nearest crater in reach whose name begins as this one's (four letters)."""
    start = plain_name(name)[:4]
    found = [
        (distance_km(place, where), title)
        for title, where in craters.items()
        if plain_name(title).startswith(start) and distance_km(place, where) <= reach(diameter_km)
    ]
    return min(found)[1] if found else None


def guessed(name: str, place: Point, diameter_km: float | None, fetch: Fetch) -> str | None:
    """Find a page by the crater's name, if it says it is a crater or an impact, and is in reach."""
    for title in (RENAMED.get(name), f"{name} crater", f"{name} impact structure", name):
        if title is None:
            continue
        summary = cast(
            "dict[str, object]",
            # Every character escaped: a name may hold a slash ("Senzeille/Hony").
            fetch(SUMMARY.format(title=urllib.parse.quote(title.replace(" ", "_"), safe=""))),
        )
        words = f"{summary.get('description') or ''} {summary.get('extract') or ''}"
        where = cast("dict[str, float] | None", summary.get("coordinates"))
        titles = cast("dict[str, str]", summary.get("titles") or {})
        if (
            summary.get("type") == "standard"
            and re.search(r"crater|impact", words, re.IGNORECASE)
            and where is not None
            and distance_km(place, (where["lat"], where["lon"])) <= reach(diameter_km)
            and "canonical" in titles
        ):
            return titles["canonical"].replace("_", " ")
    return None


def free_to_show(licence: str | None) -> bool:
    """Whether a picture is under a Creative Commons licence or in the public domain."""
    return licence is not None and (licence.startswith("CC") or licence == "Public domain")


def photo_only(found: Picture) -> Picture | None:
    """Keep a CC or public-domain photograph of the place; else only its page.

    A list of craters is not one crater's page: nothing.
    """
    if "/wiki/List_of" in found.page:
        return None
    if found.file_page is None:
        return found
    file = urllib.parse.unquote(found.file_page.rsplit("File:", 1)[-1])
    if NOT_A_PHOTO.search(file) or file in NOT_OF_IT or not free_to_show(found.licence):
        return Picture(page=found.page)
    return found


def impact_pictures(impacts: object, craters: dict[str, Point], fetch: Fetch) -> dict[str, Picture]:
    """Each impact's page and photo, by the database's id, for those found on Wikipedia."""
    rows = cast("dict[str, list[dict[str, object]]]", impacts)["impacts"]
    found: dict[str, Picture] = {}
    for row in rows:
        then = cast("list[list[int]]", row["then"])
        name = cast("str", row["name"])
        diameter = cast("float | None", row.get("diameterKm"))
        # The first position is today's, in hundredths of a degree.
        place = (then[0][0] / 100, then[0][1] / 100)
        title = RENAMED.get(name) or nearest(name, place, diameter, craters)
        title = title or guessed(name, place, diameter, fetch)
        page = None if title is None else picture(title, fetch)
        kept = None if page is None else photo_only(page)
        if kept is not None:
            found[str(row["id"])] = kept
    return found


def fetch_impact_pictures(
    source: Path, path: Path, fetch: Fetch
) -> int:  # pragma: no cover - needs network access
    """Look up every crater in ``source`` and write the pictures file; how many have a photo."""
    craters = craters_from(fetch(WIKIDATA.format(query=urllib.parse.quote(CRATERS_QUERY))))
    found = impact_pictures(cast("object", json.loads(source.read_text())), craters, fetch)
    made = dt.datetime.now(tz=dt.UTC).date().isoformat()
    data: dict[str, Json] = pictures_file(found, made)
    _ = path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n")
    return sum(1 for each in found.values() if each.src is not None)
