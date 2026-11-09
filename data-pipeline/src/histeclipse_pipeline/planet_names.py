"""The place names on Mercury, Venus, the Moon and Mars (#334): the IAU's, for the largest features.

The names come from the Gazetteer of Planetary Nomenclature (USGS Astrogeology, for the IAU).

The gazetteer publishes each body's features as a shapefile of centre points; its table gives
each one's name, kind, centre and size. Kept: the kinds that make a landmark on a globe (craters,
mountains, plains, seas, valleys, canyons, and so on), largest first, so the site can name the
largest it has room for and more as it zooms in. Ridges, scarps, fossae and the like (long and
thin) and lettered satellite craters are left out, as are Mars's albedo features (the classical
names for its light and dark markings, which overlap the landforms named since).

The gazetteer rebuilds its downloads daily, so each is pinned by checksum and kept in the
cache: a fresh download needs a fresh pin. Longitudes are east, 0 to 360, as the IAU gives them
for all four.
"""

from __future__ import annotations

import io
import json
import zipfile
from typing import TYPE_CHECKING

from histeclipse_pipeline.archaeoglobe import dbf_rows
from histeclipse_pipeline.planet_maps import checked, download

if TYPE_CHECKING:
    from pathlib import Path

GAZETTEER = "https://asc-planetarynames-data.s3.us-west-2.amazonaws.com"
#: Each body's centre points, pinned as downloaded on 2026-11-09.
ARCHIVES = {
    "mercury": "4af1bb8de2865469a9f76f38892b3186b45fad306fce8ad09cf4638bca5e1280",
    "venus": "79eebe808fe2430ece46bfaf69c00916ae5752a7b662bc63a1853134fbcfa719",
    "moon": "ec58b22d0236fb81b74745c3d27c6a9fff7954d8de319fa50aba136cedeb4806",
    "mars": "32e51774ac882643c3d7b3d674cef2e3cf0aefa9dd20a41aba5680f96247687a",
}
#: The kinds kept, by the gazetteer's descriptor code, and what each is in plain words.
KINDS = {
    "AA": "crater",
    "CH": "chaos (broken ground)",
    "CM": "canyon",
    "CR": "corona (a ring of ridges)",
    "LC": "lake (a small plain of lava)",
    "ME": "sea (a plain of lava)",
    "MO": "mountain",
    "OC": "ocean (a great plain of lava)",
    "PA": "marsh (a small plain of lava)",
    "PE": "volcanic crater",
    "PL": "plain",
    "PM": "plateau",
    "RE": "region",
    "SI": "bay (a small plain of lava)",
    "TA": "highland",
    "TE": "tessera (ridged, folded ground)",
    "TH": "dome",
    "VA": "valley",
    "VS": "lowland",
}
#: Names kept a body: enough for the Moon's Tycho and Mars's Gale crater.
KEPT = 400


def archive_url(body: str) -> str:
    """Give the address of the gazetteer's centre points for ``body``."""
    return f"{GAZETTEER}/{body.upper()}_nomenclature_center_pts.zip"


def table(archive: bytes) -> bytes:
    """Take the features' table out of a body's archive."""
    with zipfile.ZipFile(io.BytesIO(archive)) as zipped:
        name = next(name for name in zipped.namelist() if name.endswith(".dbf"))
        return zipped.read(name)


def landmarks(rows: list[dict[str, str]], kept: int = KEPT) -> list[list[object]]:
    """Pick the ``kept`` largest adopted features of the kinds kept, largest first.

    Each is ``[name, latitude, east longitude, diameter km, kind]``, the angles to 0.01°.
    """
    features = [row for row in rows if row["approval"] == "Adopted by IAU" and row["code"] in KINDS]
    features.sort(key=lambda row: (-float(row["diameter"]), row["clean_name"]))
    return [
        [
            row["clean_name"],
            round(float(row["center_lat"]), 2),
            round(float(row["center_lon"]) % 360, 2),
            round(float(row["diameter"])),
            KINDS[row["code"]],
        ]
        for row in features[:kept]
    ]


def fetch_planet_names(path: Path, cache: Path) -> int:  # pragma: no cover - needs network access
    """Download each body's archive once into ``cache``, and write its landmarks to ``path``."""
    bodies: dict[str, list[list[object]]] = {}
    for body, sha256 in ARCHIVES.items():
        file = cache / f"{body}.zip"
        if not file.exists():
            download(archive_url(body), file)
        rows = dbf_rows(table(checked(file, sha256).read_bytes()), "utf-8")
        bodies[body] = landmarks(rows)
    data = {
        "schemaVersion": 1,
        "source": "https://planetarynames.wr.usgs.gov/",
        "names": bodies,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n")
    return sum(len(names) for names in bodies.values())
