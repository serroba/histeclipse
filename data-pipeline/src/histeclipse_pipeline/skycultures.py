"""Constellations as other cultures drew them, from Stellarium's sky cultures.

The sky culture files are copied unchanged into ``public/skycultures/<culture>/``, each under
its own licence (CC BY-SA, CC BY-ND or GPL, stated in its ``description.md``). The web app
reads them as they are; nothing here edits or converts them, so the no-derivatives terms hold.

The figures name their stars by Hipparcos number. ``public/data/hip-stars.json`` gives, for each
star they use, its J2000 position, proper motion, parallax and magnitude from the Hipparcos
main catalogue (ESA 1997, via NASA's HEASARC), so the app can place them in any century.
"""

import gzip
import json
import math
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING, cast

from histeclipse_pipeline.sky import Json, parse_json, verified

if TYPE_CHECKING:
    from pathlib import Path

STELLARIUM_COMMIT = "e84ca6da77de85dd73093ca8fe98e37c849e6ad3"
STELLARIUM_URL = (
    f"https://raw.githubusercontent.com/Stellarium/stellarium/{STELLARIUM_COMMIT}/skycultures"
)
HIPPARCOS_URL = (
    "https://heasarc.gsfc.nasa.gov/FTP/heasarc/dbase/tdat_files/heasarc_hipparcos.tdat.gz"
)
HIPPARCOS_SHA256 = "e0e1e94344ada0010a1843c03cd4fc0e5276d28c5e2770bd86b7361ecc0fe10d"
HIPPARCOS_CREDIT = "Hipparcos main catalogue (ESA 1997, Perryman et al.), via NASA's HEASARC"
#: Years from the Hipparcos epoch (J1991.25) to J2000.
EPOCH_SHIFT_YEARS = 8.75
MAS = math.pi / 180 / 3_600_000

#: Each culture's files and their SHA-256 at the pinned commit.
CULTURES: dict[str, dict[str, str]] = {
    "babylonian_mulapin": {
        "index.json": "fd666166659129430b01486a7d6368579defe025e1823428840cd54a75ee5b05",
        "description.md": "ab6cd0a666154ab8ea28c02a043247a9edd6ff5f96b6c0a09056bbff83d5fb3e",
    },
    "babylonian_seleucid": {
        "index.json": "68a8647bb459257c877faf232daa169cd02b0fee6a400a54cf6ad45cc6d1d15a",
        "description.md": "1f13bf1743eb6afaddceda8882f2decd9fb1466685cde80fbfec9de9dc5b0ea9",
    },
    "egyptian": {
        "index.json": "f114e5ea42c8684dc1f12d3e67db33430eaf084cbcb97d6fd15df83a836396d8",
        "description.md": "f206b19ef9ad9e15d6c48c4b725f39eff50b02ed6bea3297300ed1330435b58a",
    },
    "greek_almagest": {
        "index.json": "6bd5152343bd3634988c67d9b1cd71a4a685e014ed20a6cae647233388847bc0",
        "description.md": "ca41da91c73a7e1f50c99cd63303693f2042220d028ef84021153fd1dbf8754b",
    },
    "chinese": {
        "index.json": "426118e6238ae69edb319c91d1a74b705eaa758222e962206e58c49b9dac9d8a",
        "description.md": "f0dec3d4fb115bb8d5667e96fb9af0450f33489ec02747c8229903c15b3a2cac",
    },
    "indian": {
        "index.json": "315064d1c41bb5cb20db27e0101bf86e64e6c20277101d102777ee8d2b4d3878",
        "description.md": "4b8b9461edf78f2359b15e01b2c7490ac5e986d4356f6854207a513a43e814ce",
    },
    "arabic_al-sufi": {
        "index.json": "f414bde8214d7277af27f9b3ee9f0eab9f2e8ea315af7ab627f16dbeb72eeab0",
        "description.md": "4477917767b7a3323be014aabfea40961ba61bb442bda59550c275c2d2a2777e",
    },
}


def referenced_stars(index: Json) -> set[int]:
    """Hipparcos numbers a culture's figures use; clusters and Gaia stars are left out."""
    stars: set[int] = set()
    constellations = cast("list[dict[str, Json]]", cast("dict[str, Json]", index)["constellations"])
    for constellation in constellations:
        for run in cast("list[list[Json]]", constellation.get("lines", [])):
            # Hipparcos numbers stop below 120,000; bigger numbers are Gaia sources.
            stars.update(star for star in run if isinstance(star, int) and 0 < star < 200_000)  # noqa: PLR2004
    return stars


@dataclass(frozen=True)
class HipStar:
    """A Hipparcos star at J2000: degrees, mas/yr, mas and magnitude."""

    hip: int
    ra: float
    dec: float
    pm_ra: float
    pm_dec: float
    parallax: float | None
    vmag: float


def _number(text: str) -> float | None:
    text = text.strip()
    return float(text) if text else None


def parse_hipparcos(lines: list[str]) -> dict[int, HipStar]:
    """Read HEASARC's Hipparcos table (``tdat``): fields named in its ``line[1]`` header."""
    fields: list[str] = []
    stars: dict[int, HipStar] = {}
    in_data = False
    for line in lines:
        if line.startswith("line[1] = "):
            fields = line.removeprefix("line[1] = ").split()
        elif line.startswith("<DATA>"):
            in_data = True
        elif line.startswith("<END>"):
            break
        elif in_data and line.strip():
            row = dict(zip(fields, line.split("|"), strict=False))
            star = _star(row)
            if star is not None:
                stars[star.hip] = star
    return stars


def _star(row: dict[str, str]) -> HipStar | None:
    hip = _number(row.get("hip_number", ""))
    ra, dec = _number(row.get("ra_deg", "")), _number(row.get("dec_deg", ""))
    vmag = _number(row.get("vmag", ""))
    if hip is None or ra is None or dec is None or vmag is None:
        return None
    pm_ra = _number(row.get("pm_ra", "")) or 0.0
    pm_dec = _number(row.get("pm_dec", "")) or 0.0
    # Catalogue positions are for J1991.25; move them on to J2000 along the proper motion.
    years = EPOCH_SHIFT_YEARS
    dec2000 = dec + pm_dec * years * MAS * 180 / math.pi
    ra2000 = ra + pm_ra * years * MAS * 180 / math.pi / math.cos(math.radians(dec))
    parallax = _number(row.get("parallax", ""))
    return HipStar(
        hip=int(hip),
        ra=ra2000 % 360,
        dec=dec2000,
        pm_ra=pm_ra,
        pm_dec=pm_dec,
        parallax=parallax if parallax is not None and parallax > 0 else None,
        vmag=vmag,
    )


#: A Bright Star Catalogue star counts as the same star within this distance and magnitude.
MATCH_ARCSEC = 60.0
MATCH_MAGNITUDES = 0.7


def match_catalogue(stars: dict[int, HipStar], sky: Json) -> dict[int, int]:
    """Hipparcos number -> Harvard Revised number, for stars also in ``sky.json``."""
    columns = cast("dict[str, list[float]]", cast("dict[str, Json]", sky)["stars"])
    hr, ra, dec, vmag = columns["hr"], columns["ra"], columns["dec"], columns["vmag"]
    # Bucket the catalogue by whole degrees of declination to keep the search short.
    buckets: dict[int, list[int]] = {}
    for index, value in enumerate(dec):
        buckets.setdefault(math.floor(value), []).append(index)
    matches: dict[int, int] = {}
    for star in stars.values():
        band = math.floor(star.dec)
        nearby = [i for d in (band - 1, band, band + 1) for i in buckets.get(d, [])]
        best: tuple[float, int] | None = None
        for index in nearby:
            separation = _separation_arcsec(star.ra, star.dec, ra[index], dec[index])
            close = separation <= MATCH_ARCSEC
            alike = abs(vmag[index] - star.vmag) <= MATCH_MAGNITUDES
            if close and alike and (best is None or separation < best[0]):
                best = (separation, index)
        if best is not None:
            matches[star.hip] = int(hr[best[1]])
    return matches


def _separation_arcsec(ra1: float, dec1: float, ra2: float, dec2: float) -> float:
    a, b = math.radians(dec1), math.radians(dec2)
    dra = math.radians(ra2 - ra1)
    cosine = math.sin(a) * math.sin(b) + math.cos(a) * math.cos(b) * math.cos(dra)
    return math.degrees(math.acos(max(-1.0, min(1.0, cosine)))) * 3600


def hip_stars_file(
    stars: dict[int, HipStar], wanted: set[int], matches: dict[int, int]
) -> dict[str, Json]:
    """Columns for the stars the figures use, in Hipparcos order, with their HR if bright."""
    found = [stars[hip] for hip in sorted(wanted) if hip in stars]
    return {
        "schemaVersion": 1,
        "source": HIPPARCOS_CREDIT,
        "epoch": 2000,
        "hip": [star.hip for star in found],
        "hr": [matches.get(star.hip) for star in found],
        "ra": [round(star.ra, 6) for star in found],
        "dec": [round(star.dec, 6) for star in found],
        "pmRa": [round(star.pm_ra, 2) for star in found],
        "pmDec": [round(star.pm_dec, 2) for star in found],
        "parallax": [star.parallax for star in found],
        "vmag": [star.vmag for star in found],
    }


def _download(url: str) -> bytes:  # pragma: no cover - needs network access
    with urllib.request.urlopen(url, timeout=600) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
        if not isinstance(body, bytes):
            msg = f"{url}: expected bytes"
            raise TypeError(msg)
        return body


def fetch_skycultures(public: Path) -> tuple[int, int]:  # pragma: no cover - needs network
    """Copy the cultures unchanged and write the stars they use; return both counts."""
    wanted: set[int] = set()
    for culture, files in CULTURES.items():
        folder = public / "skycultures" / culture
        folder.mkdir(parents=True, exist_ok=True)
        for name, sha256 in files.items():
            data = verified(_download(f"{STELLARIUM_URL}/{culture}/{name}"), sha256, name)
            _ = (folder / name).write_bytes(data)
            if name == "index.json":
                wanted |= referenced_stars(parse_json(data))
    table = verified(_download(HIPPARCOS_URL), HIPPARCOS_SHA256, "Hipparcos")
    stars = parse_hipparcos(gzip.decompress(table).decode("latin-1").splitlines())
    sky = parse_json((public / "data" / "sky.json").read_bytes())
    result = hip_stars_file(stars, wanted, match_catalogue(stars, sky))
    path = public / "data" / "hip-stars.json"
    _ = path.write_text(json.dumps(result, separators=(",", ":"), allow_nan=False) + "\n")
    return len(CULTURES), len(cast("list[Json]", result["hip"]))
