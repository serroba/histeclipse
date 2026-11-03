"""Named archaeological and historical periods, by place, from PeriodO.

PeriodO (https://perio.do), a gazetteer of period definitions, each taken from a published
source and dedicated to the public domain (CC0): its name, start and end years, and the places
it covers, as Wikidata identifiers (mostly today's countries). Countries are matched to Natural
Earth's 1:110m outlines (public domain), whose table names each country's Wikidata identifier.
PeriodO's dump grows, so it is not pinned by checksum: the file records when it was accessed.

Kept: the periods with whole start and end years that cover at least one of those countries,
each with a short citation of the source that defines it, since sources date the same name
differently.
"""

import datetime as dt
import json
import urllib.request
from compression import zstd
from typing import TYPE_CHECKING

from histeclipse_pipeline.archaeoglobe import dbf_rows, read_regions, rings_by_record
from histeclipse_pipeline.empires import simplify
from histeclipse_pipeline.iceoutlines import unwrapped
from histeclipse_pipeline.sky import Json, parse_json, verified

if TYPE_CHECKING:
    from pathlib import Path

PERIODO_URL = "https://data.perio.do/d.json"
COUNTRIES_URL = "https://naciscdn.org/naturalearth/110m/cultural/ne_110m_admin_0_countries.zip"
COUNTRIES_SHA256 = "0f243aeac8ac6cf26f0417285b0bd33ac47f1b5bdb719fd3e0df37d03ea37110"
SOURCE = "https://perio.do"
CREDIT = (
    "PeriodO (perio.do), CC0; country outlines from Natural Earth 1:110m (public domain); "
    "periods matched to countries by their Wikidata identifiers"
)
TOLERANCE = 0.2
WIKIDATA = "http://www.wikidata.org/entity/"

type Ring = list[tuple[float, float]]


def _get(value: Json, *path: str) -> Json:
    """Follow keys down a JSON value; None where one is missing."""
    for key in path:
        if not isinstance(value, dict):
            return None
        value = value.get(key)
    return value


def _list(value: Json) -> list[Json]:
    return value if isinstance(value, list) else []


def _year(bound: Json) -> int | None:
    """Read a period's start or stop as a whole year (ISO, so 0 is 1 BCE), or None."""
    for key in ("year", "earliestYear", "latestYear"):
        value = _get(bound, "in", key)
        if isinstance(value, str):
            try:
                return int(value)
            except ValueError:
                continue
    return None


def citation(authority: Json) -> str:
    """Cite an authority's source shortly: "King & Stager 2001", or its title."""
    source = _get(authority, "source")
    whole = _get(source, "partOf") or source
    names = [
        str(_get(creator, "name") or "").split(",")[0].strip()
        for creator in _list(_get(whole, "creators"))
    ]
    names = [name for name in names if name]
    year = _get(whole, "yearPublished")
    if len(names) == 1:
        who = names[0]
    elif len(names) == 2:  # noqa: PLR2004
        who = f"{names[0]} & {names[1]}"
    elif names:
        who = f"{names[0]} et al."
    else:
        who = str(_get(whole, "title") or "PeriodO")
    return f"{who} {'' if year is None else year}".strip()


def periods_of(dump: Json, countries: dict[str, int]) -> tuple[list[str], list[Json]]:
    """Gather the citations, and each kept period as [label, start, stop, citation, countries]."""
    citations: list[str] = []
    periods: list[Json] = []
    authorities = _get(dump, "authorities")
    none: list[Json] = []
    for authority in list(authorities.values()) if isinstance(authorities, dict) else none:
        cited: int | None = None
        found = _get(authority, "periods")
        for period in list(found.values()) if isinstance(found, dict) else none:
            start, stop = _year(_get(period, "start")), _year(_get(period, "stop"))
            ids = [
                str(_get(place, "id") or "").removeprefix(WIKIDATA)
                for place in _list(_get(period, "spatialCoverage"))
            ]
            places = sorted({countries[qid] for qid in ids if qid in countries})
            label = str(_get(period, "label") or "")
            if start is None or stop is None or stop < start or not places or not label:
                continue
            if cited is None:
                citations.append(citation(authority))
                cited = len(citations) - 1
            periods.append([label, start, stop, cited, list[Json](places)])
    return citations, periods


def country_outlines(shp: bytes, dbf: bytes) -> list[tuple[str, str, list[Ring]]]:
    """Each country's Wikidata identifier, name and simplified rings."""
    countries: list[tuple[str, str, list[Ring]]] = []
    # Natural Earth's tables are UTF-8.
    for row, rings in zip(dbf_rows(dbf, "utf-8"), rings_by_record(shp), strict=True):
        qid = row.get("WIKIDATAID", "")
        if not qid:
            continue
        kept = [simplify(unwrapped(ring), TOLERANCE) for ring in rings]
        countries.append((qid, row.get("NAME", qid), [ring for ring in kept if len(ring) >= 4]))  # noqa: PLR2004
    return countries


def periods_file(
    countries: list[tuple[str, str, list[Ring]]], dump: Json, accessed: str
) -> dict[str, Json]:
    """Build the site's file: countries, citations and periods."""
    index = {qid: number for number, (qid, _, _) in enumerate(countries)}
    citations, periods = periods_of(dump, index)
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "accessed": accessed,
        "countries": [
            {
                "name": name,
                "rings": [
                    [round(value * 100) for point in ring for value in point] for ring in rings
                ],
            }
            for _, name, rings in countries
        ],
        "citations": list[Json](citations),
        "periods": periods,
    }


def _download(url: str) -> bytes:  # pragma: no cover - needs network access
    headers = {"User-Agent": "histeclipse-pipeline", "Accept-Encoding": "zstd"}
    request = urllib.request.Request(url, headers=headers)  # noqa: S310
    with urllib.request.urlopen(request, timeout=300) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{url}: expected bytes"
        raise TypeError(msg)
    return body


def fetch_periods(path: Path) -> int:  # pragma: no cover - needs network access
    """Download PeriodO and the countries; write the site's file."""
    raw = _download(PERIODO_URL)
    text = zstd.decompress(raw) if raw[:4] == b"\x28\xb5\x2f\xfd" else raw
    dump = parse_json(text)
    shp, dbf = read_regions(
        verified(_download(COUNTRIES_URL), COUNTRIES_SHA256, "Natural Earth countries")
    )
    accessed = dt.datetime.now(tz=dt.UTC).date().isoformat()
    data = periods_file(country_outlines(shp, dbf), dump, accessed)
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n")
    periods = data["periods"]
    return len(periods) if isinstance(periods, list) else 0
