"""How people lived around the world over the last 10,000 years: ArchaeoGLOBE.

ArchaeoGLOBE Project (2019), *Archaeological assessment reveals Earth's early transformation
through land use*, Science 365, 897-902 (doi:10.1126/science.aax1192); data on Harvard
Dataverse, CC0 1.0: regions (doi:10.7910/DVN/CQWUBI) and the regional assessments
(doi:10.7910/DVN/CNCANQ). For 146 regions, archaeologists rated how widespread five ways of
life were (foraging, pastoralism, extensive and intensive agriculture, urban centres) at ten
moments from 10,000 years ago to 1850 CE: none, minimal, common or widespread. Their consensus
is kept, with the simplified region outlines taken from the Eckert IV projection back to
longitude and latitude.
"""

import csv
import io
import json
import math
import struct
import urllib.request
import zipfile
from typing import TYPE_CHECKING

from histeclipse_pipeline.empires import simplify
from histeclipse_pipeline.iceoutlines import polygon_rings, unwrapped
from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from pathlib import Path

CONSENSUS_URL = "https://dataverse.harvard.edu/api/access/datafile/3442650?format=original"
CONSENSUS_SHA256 = "0ae798f79a9887b665ce40bba034c9fa23156e04de8cf2f8ad044c62f5413c4d"
REGIONS_URL = "https://dataverse.harvard.edu/api/access/datafile/3354433"
REGIONS_SHA256 = "b6a2889f04f484bbe63b77e7fe1de50bc8dbc3d609dfe1806e0ccde60f94dae5"
SOURCE = "https://doi.org/10.1126/science.aax1192"
CREDIT = (
    "ArchaeoGLOBE Project (2019), Science 365, 897; Harvard Dataverse, CC0 1.0; consensus "
    "assessments, with region outlines simplified for this site"
)
#: The moments rated, as calendar years (BP is before 1950).
MOMENTS: tuple[tuple[str, int], ...] = (
    ("10KBP", -8050),
    ("8KBP", -6050),
    ("6KBP", -4050),
    ("4KBP", -2050),
    ("3KBP", -1050),
    ("2KBP", -50),
    ("1KBP", 950),
    ("1500CE", 1500),
    ("1750CE", 1750),
    ("1850CE", 1850),
)
#: Each way of life: its identifier and the consensus file's column prefixes (they vary).
WAYS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("foraging", ("FHG",)),
    ("pastoralism", ("PAS",)),
    ("extensive", ("EXAGR", "EXAG")),
    ("intensive", ("INAG",)),
    ("urban", ("URBAN",)),
)
LEVELS = {"None": 0, "Minimal": 1, "Common": 2, "Widespread": 3}
TOLERANCE = 0.1
MIN_RING_AREA = 0.05

# Eckert IV, on the sphere of the WGS 84 semi-major axis (as Esri's projection uses).
_R = 6378137.0
_X_SCALE = 2 / math.sqrt(math.pi * (4 + math.pi))
_Y_SCALE = 2 * math.sqrt(math.pi / (4 + math.pi))


def from_eckert_iv(x: float, y: float) -> tuple[float, float]:
    """Eckert IV metres (central meridian 0) to longitude and latitude (Snyder 1993)."""
    theta = math.asin(max(-1.0, min(1.0, y / (_Y_SCALE * _R))))
    phi = math.asin(
        (theta + math.sin(theta) * math.cos(theta) + 2 * math.sin(theta)) / (2 + math.pi / 2)
    )
    lam = x / (_X_SCALE * _R * (1 + math.cos(theta)))
    return (math.degrees(lam), math.degrees(phi))


def to_eckert_iv(lon: float, lat: float) -> tuple[float, float]:
    """Project degrees forward, for checking the inverse (Newton's method for theta)."""
    phi = math.radians(lat)
    target = (2 + math.pi / 2) * math.sin(phi)
    theta = phi / 2
    for _ in range(30):
        f = theta + math.sin(theta) * math.cos(theta) + 2 * math.sin(theta) - target
        df = 2 * math.cos(theta) * (1 + math.cos(theta))
        if abs(df) < 1e-12:  # noqa: PLR2004
            break
        theta -= f / df
    return (
        _X_SCALE * _R * math.radians(lon) * (1 + math.cos(theta)),
        _Y_SCALE * _R * math.sin(theta),
    )


def dbf_rows(data: bytes) -> list[dict[str, str]]:
    """Read a dBASE table's rows, as text."""
    count, header_length, record_length = struct.unpack("<IHH", data[4:12])
    fields: list[tuple[str, int]] = []
    position = 32
    while data[position] != 0x0D:  # noqa: PLR2004
        name = data[position : position + 11].split(b"\0")[0].decode("latin-1")
        fields.append((name, data[position + 16]))
        position += 32
    rows: list[dict[str, str]] = []
    for index in range(count):
        record = data[
            header_length + index * record_length : header_length + (index + 1) * record_length
        ]
        offset = 1
        row: dict[str, str] = {}
        for name, length in fields:
            row[name] = record[offset : offset + length].decode("latin-1").strip()
            offset += length
        rows.append(row)
    return rows


def ring_area(ring: list[tuple[float, float]]) -> float:
    """Absolute shoelace area, square degrees."""
    total = 0.0
    for (x1, y1), (x2, y2) in zip(ring, [*ring[1:], ring[0]], strict=True):
        total += x1 * y2 - x2 * y1
    return abs(total) / 2


def region_outlines(shp: bytes, dbf: bytes) -> dict[int, list[list[tuple[float, float]]]]:
    """Each region's rings in degrees, simplified, by its ArchaeoGLOBE identifier."""
    rows = dbf_rows(dbf)
    outlines: dict[int, list[list[tuple[float, float]]]] = {}
    for row, rings in zip(rows, _rings_by_record(shp), strict=True):
        region = int(row["Archaeo_ID"])
        for projected in rings:
            ring = unwrapped([from_eckert_iv(x, y) for x, y in projected])
            if ring_area(ring) < MIN_RING_AREA:
                continue
            simplified = simplify(ring, TOLERANCE)
            if len(simplified) >= 4:  # noqa: PLR2004
                outlines.setdefault(region, []).append(simplified)
    return outlines


def _rings_by_record(shp: bytes) -> list[list[list[tuple[float, float]]]]:
    """Read the rings of each record of a polygon shapefile, record by record."""
    records: list[list[list[tuple[float, float]]]] = []
    position = 100
    while position + 8 <= len(shp):
        _number, words = struct.unpack(">ii", shp[position : position + 8])
        content = shp[position : position + 8 + 2 * words]
        # One record framed as a shapefile of its own, so polygon_rings can read it.
        records.append(list(polygon_rings(bytes(100) + content)))
        position += 8 + 2 * words
    return records


def assessments(text: str) -> dict[int, dict[str, list[int]]]:
    """Each region's levels (0 none to 3 widespread) per way of life, at each moment."""
    found: dict[int, dict[str, list[int]]] = {}
    for row in csv.DictReader(io.StringIO(text)):
        region = int(row["Region"])
        levels: dict[str, list[int]] = {}
        for way, prefixes in WAYS:
            values: list[int] = []
            for moment, _year in MOMENTS:
                cell = next(
                    (
                        row[key]
                        for prefix in prefixes
                        for key in (f"{prefix}_{moment}", f"{prefix}_{moment.lower()}")
                        if key in row
                    ),
                    "None",
                )
                values.append(LEVELS.get(cell.strip(), 0))
            levels[way] = values
        found[region] = levels
    return found


def _flat(ring: list[tuple[float, float]]) -> Json:
    return [round(value * 100) for point in ring for value in point]


def ways_file(
    names: dict[int, str],
    outlines: dict[int, list[list[tuple[float, float]]]],
    levels: dict[int, dict[str, list[int]]],
) -> dict[str, Json]:
    """Build the site's file: the moments, the ways of life, each region's outline and levels."""
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "scale": 100,
        "years": [year for _, year in MOMENTS],
        "ways": [way for way, _ in WAYS],
        "regions": [
            {
                "id": region,
                "name": names.get(region, str(region)),
                "rings": [_flat(ring) for ring in outlines[region]],
                "levels": {way: list[Json](values) for way, values in levels[region].items()},
            }
            for region in sorted(levels)
            if region in outlines
        ],
    }


def _download(url: str) -> bytes:  # pragma: no cover - needs network access
    request = urllib.request.Request(url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
    with urllib.request.urlopen(request, timeout=120) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{url}: expected bytes"
        raise TypeError(msg)
    return body


def read_regions(archive: bytes) -> tuple[bytes, bytes]:
    """Take the shapefile's geometry and its table out of the regions' archive."""
    with zipfile.ZipFile(io.BytesIO(archive)) as zipped:
        names = zipped.namelist()
        shp = next(name for name in names if name.endswith(".shp"))
        dbf = next(name for name in names if name.endswith(".dbf"))
        return zipped.read(shp), zipped.read(dbf)


def fetch_ways(path: Path) -> int:  # pragma: no cover - needs network access
    """Download the regions and consensus (checked against their checksums); write the file."""
    shp, dbf = read_regions(
        verified(_download(REGIONS_URL), REGIONS_SHA256, "ArchaeoGLOBE regions")
    )
    text = verified(_download(CONSENSUS_URL), CONSENSUS_SHA256, "ArchaeoGLOBE consensus").decode(
        "cp1252"
    )
    names = {int(row["Archaeo_ID"]): row["Archaeo_RG"] for row in dbf_rows(dbf)}
    data = ways_file(names, region_outlines(shp, dbf), assessments(text))
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n")
    return len(names)
