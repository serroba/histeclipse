"""Where each time zone is, for opening the globe over the reader's own region.

The tz database (IANA, public domain) gives every zone a representative place in ``zone.tab``
and ``zone1970.tab``, as ISO 6709 coordinates (``+4230+00131``, or with seconds); ``backward``
names older aliases (``Asia/Calcutta`` for ``Asia/Kolkata``), which browsers may still report.
This writes one small file: each name, alias or not, to its zone's latitude and longitude.
"""

from __future__ import annotations

import datetime as dt
import json
import re
import urllib.request
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pathlib import Path

TZDB = "https://data.iana.org/time-zones/tzdb"
SCHEMA_VERSION = 1

_COORDINATES = re.compile(r"^([+-])(\d{2})(\d{2})(\d{2})?([+-])(\d{3})(\d{2})(\d{2})?$")


def parse_coordinates(text: str) -> tuple[float, float]:
    """Latitude and longitude, in degrees, of ISO 6709 ``±DDMM[SS]±DDDMM[SS]``."""
    match = _COORDINATES.match(text)
    if match is None:
        msg = f"not ISO 6709 coordinates: {text!r}"
        raise ValueError(msg)
    lat_sign, lat_d, lat_m, lat_s, lon_sign, lon_d, lon_m, lon_s = match.groups()

    def degrees(sign: str, d: str, m: str, s: str | None) -> float:
        value = int(d) + int(m) / 60 + (int(s) if s is not None else 0) / 3600
        return -value if sign == "-" else value

    return degrees(lat_sign, lat_d, lat_m, lat_s), degrees(lon_sign, lon_d, lon_m, lon_s)


def read_zone_tab(text: str) -> dict[str, tuple[float, float]]:
    """Each zone's place, from ``zone.tab`` or ``zone1970.tab`` (comments and blanks skipped)."""
    zones: dict[str, tuple[float, float]] = {}
    for line in text.splitlines():
        if not line or line.startswith("#"):
            continue
        fields = line.split("\t")
        if len(fields) < 3:  # noqa: PLR2004 - codes, coordinates, zone
            msg = f"too few fields: {line!r}"
            raise ValueError(msg)
        zones[fields[2]] = parse_coordinates(fields[1])
    return zones


def read_links(text: str) -> dict[str, str]:
    """Each alias's zone, from ``Link TARGET ALIAS`` lines (as in ``backward``)."""
    links: dict[str, str] = {}
    for line in text.splitlines():
        fields = line.split("#", 1)[0].split()
        if len(fields) >= 3 and fields[0] == "Link":  # noqa: PLR2004 - Link, target, alias
            links[fields[2]] = fields[1]
    return links


def place_of(
    name: str, zones: dict[str, tuple[float, float]], links: dict[str, str]
) -> tuple[float, float] | None:
    """Find a zone's place, following aliases (and aliases of aliases) to a zone with one."""
    seen: set[str] = set()
    while name not in zones:
        if name in seen or name not in links:
            return None
        seen.add(name)
        name = links[name]
    return zones[name]


def zone_places(
    zones: dict[str, tuple[float, float]], links: dict[str, str]
) -> dict[str, list[float]]:
    """Give every zone and alias with a place its latitude and longitude, to 0.1°."""
    places = {name: place_of(name, zones, links) for name in sorted({*zones, *links})}
    return {
        name: [round(place[0], 1), round(place[1], 1)]
        for name, place in places.items()
        if place is not None
    }


def timezones_file(
    zones: dict[str, tuple[float, float]], links: dict[str, str], version: str, accessed: str
) -> dict[str, object]:
    """Make the site's file: where it comes from, and each zone's and alias's place."""
    return {
        "schemaVersion": SCHEMA_VERSION,
        "credit": f"The tz database (IANA), version {version}, public domain: each zone's place",
        "source": f"{TZDB}/",
        "accessed": accessed,
        "zones": zone_places(zones, links),
    }


def _text(url: str) -> str:  # pragma: no cover - needs network access
    request = urllib.request.Request(url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
    with urllib.request.urlopen(request, timeout=60) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{url}: expected bytes"
        raise TypeError(msg)
    return body.decode("utf-8")


def fetch_timezones(path: Path) -> int:  # pragma: no cover - needs network access
    """Download the tz database's tables; write each zone's and alias's place."""
    zones = {
        **read_zone_tab(_text(f"{TZDB}/zone.tab")),
        **read_zone_tab(_text(f"{TZDB}/zone1970.tab")),
    }
    links = read_links(_text(f"{TZDB}/backward"))
    version = _text(f"{TZDB}/version").strip()
    accessed = dt.datetime.now(tz=dt.UTC).date().isoformat()
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_text(
        json.dumps(timezones_file(zones, links, version, accessed), separators=(",", ":")) + "\n"
    )
    return len(zone_places(zones, links))
