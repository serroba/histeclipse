"""Northern Hemisphere ice-sheet outlines through the Quaternary, from Batchelor et al. (2019).

Batchelor, Margold, Krapp, Murton, Dalton, Gibbard, Stokes, Murton & Manica (2019), *The
configuration of Northern Hemisphere ice sheets through the Quaternary*, Nature
Communications 10, 3713 (doi:10.1038/s41467-019-11601-2). Shapefiles on the Open Science
Framework (https://osf.io/7jen3/), which states no licence; used with the site owner's
approval and credited.

For 17 time slices before the Last Glacial Maximum the authors give a minimum, a best
estimate and a maximum extent; for the LGM, a best estimate. Each shapefile is read, taken
from the north-polar Lambert azimuthal equal-area projection (WGS 84) back to longitude and
latitude, and simplified for the globe. Each one is checked against a pinned checksum.
"""

import itertools
import json
import math
import struct
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal

from histeclipse_pipeline.empires import ring_area, simplify
from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from collections.abc import Iterator
    from pathlib import Path

type Point = tuple[float, float]
type Hypothesis = Literal["min", "best", "max"]

SOURCE = "https://osf.io/7jen3/"
CREDIT = (
    "Batchelor et al. (2019), Nature Communications 10, 3713; shapefiles on OSF (no licence "
    "stated); reprojected to longitude and latitude and simplified for this site"
)
#: Simplified to about 10 km; rings under about 0.15 square degrees are dropped.
TOLERANCE = 0.1
MIN_RING_AREA = 0.15
ROUNDING = 100

# WGS 84.
_A = 6378137.0
_E2 = 0.00669437999014
_E = math.sqrt(_E2)


@dataclass(frozen=True)
class TimeSlice:
    """A time slice: its name, and its span in thousands of years ago."""

    name: str
    from_ka: float
    to_ka: float


#: The time slices, youngest first. A slice dated to one moment shows within 2.5 ka of it.
SLICES: tuple[TimeSlice, ...] = (
    TimeSlice("LGM", 24.0, 29.0),
    TimeSlice("30 ka", 27.5, 32.5),
    TimeSlice("35 ka", 32.5, 37.5),
    TimeSlice("40 ka", 37.5, 42.5),
    TimeSlice("45 ka", 42.5, 47.5),
    TimeSlice("MIS 4", 58.0, 72.0),
    TimeSlice("MIS 5a", 72.0, 86.0),
    TimeSlice("MIS 5b", 86.0, 92.0),
    TimeSlice("MIS 5c", 92.0, 108.0),
    TimeSlice("MIS 5d", 108.0, 117.0),
    TimeSlice("MIS 6", 132.0, 190.0),
    TimeSlice("MIS 8", 243.0, 279.0),
    TimeSlice("MIS 10", 337.0, 365.0),
    TimeSlice("MIS 12", 429.0, 477.0),
    TimeSlice("MIS 16", 622.0, 677.0),
    TimeSlice("MIS 20-24", 790.0, 928.0),
    TimeSlice("Early Matuyama Chron", 1780.0, 2600.0),
    TimeSlice("Late Gauss Chron", 2600.0, 3590.0),
)

#: Each shapefile: its slice, hypothesis, OSF download code and SHA-256.
FILES: tuple[tuple[str, Hypothesis, str, str], ...] = (
    ("30 ka", "best", "3wpf5", "316488a080ecbdd81a8ca98358fb53b96cfded0226d53a6e127e1373deba3957"),
    ("30 ka", "max", "zn5q4", "83e7cf4f276a49c4b4ee53caf5d98153aa2b4051e303587b6f69a480f6b5d56e"),
    ("30 ka", "min", "8hujn", "0e9142b72aa317ca52664c025c38ba2bce06bcee96931789e10d46490dec6bff"),
    ("35 ka", "best", "dutnj", "9fb4666cb322f819f0aaddb86a82c89e7240c240e3500bb9587d4a529339a65c"),
    ("35 ka", "max", "buky6", "c3cb8524dc565d312aa7f3858012bff829f7266aa90f26881499967d5c26ab07"),
    (
        "35 ka",
        "min",
        "5d35c32da667db0018fb0e7b",
        "1379ded306d7e87490136abf273e1986c20b4e3b3ae2a41f720f231e0b9c735c",
    ),
    ("40 ka", "best", "cyn29", "c6caaea70a9310d128cc35eced65a2c1e6e75d96887d5b9fd8468c9f95f7c74f"),
    (
        "40 ka",
        "max",
        "5d35c5085d2cdc0019067a49",
        "909d4372a86ab696bc7b18ae65e841738c8be8f01cd10aa2744b6f4c0a350f41",
    ),
    (
        "40 ka",
        "min",
        "5d35c5155d2cdc001708c48d",
        "9736dda0426825f1d5c63a653c8a19511402a570880867bb711bdb207de8d7a0",
    ),
    ("45 ka", "best", "w7gpm", "fc33c7a22bd65bc8f35eb19553445afaac775ed7423c97493315f91a19706ca6"),
    (
        "45 ka",
        "max",
        "5d35c6c85d2cdc0019067ced",
        "50a55329aa54449d270f3b93a7d3308f7b4fb1f8e7e1b7dcc5d0081e3889ff65",
    ),
    (
        "45 ka",
        "min",
        "5d35c6d3251f0e0019078a88",
        "c86d5067d511359d2af8f64d3daa5adbc67b64c5d69e776343ae6859342634bf",
    ),
    ("MIS 4", "best", "4q9f2", "7664ef6042c9735f08a625551324a56a30624c0c7ac6038ab9ffe3363c8e7f84"),
    ("MIS 4", "max", "h7zep", "84aba0e2d80569e234528ed61ddae36cd8c500e599c26626ccd92d82b5f9cc96"),
    ("MIS 4", "min", "st3he", "7246eed59553c2c3d45215b3fbaa2bdc6d24185631cd5486a7f51e11410c6601"),
    ("MIS 5a", "best", "hd2sx", "02f3f1ede68c70deaa0da4e06017c2153f13c7587caebd61ad80ebca66e1221e"),
    (
        "MIS 5a",
        "max",
        "5d35cb3b835aff001a561e62",
        "a5da03cbc93121dd316adb730d43aae213ddf24221bf36801d9e59b7c26f6a5f",
    ),
    ("MIS 5a", "min", "52nj4", "1b201ec3d23040b9fb93654292dab8d1c74e15126b42564da6a3e457d60500a4"),
    ("MIS 5b", "best", "pnqgx", "f22daed882b15f28a8667a0f0dea60789427d5a0905920529be9d8977f1e2e25"),
    (
        "MIS 5b",
        "max",
        "5d35cc95835aff001a56200d",
        "943f3f08aae17c80d114e25cd5b74080dd78f6709e4a6734468f43172a88b42e",
    ),
    (
        "MIS 5b",
        "min",
        "5d35cca4835aff00195a26de",
        "26c8d2c7409feeaf939200c7bd2eb1e53a2200424b82a46300ed8b224ccad963",
    ),
    ("MIS 5c", "best", "twgje", "ad191a57d3c4b10ad968a2c8a43d298890f8045ce16a4f13593e7b23e344eefe"),
    (
        "MIS 5c",
        "max",
        "5d35cdbf5d2cdc001708d419",
        "1cf57c1dc5639e57c61384793a4970bfcb2a3980c24f5bd7271ebe88aaaaebb5",
    ),
    (
        "MIS 5c",
        "min",
        "5d35cdc6251f0e0017088dad",
        "4e0eb569b896656c2071032e6b31c3b44a06b1ed5d394ec9387f0b8865e25db7",
    ),
    ("MIS 5d", "best", "g6se4", "c0e38d89b952a0b2010d3f6e64c763e239a39ad9f9b8d51d8afd29c18583609b"),
    (
        "MIS 5d",
        "max",
        "5d35cf3c251f0e00160c2d99",
        "286aed40c2c4f4e41a05be12715cc193d2994dda12e4c2dac6379f5ac6f9fa28",
    ),
    ("MIS 5d", "min", "uqamg", "db6012ead6a0a8811a4d182d543f1164343c75b11317d483cb0e8f41a4893794"),
    ("MIS 6", "best", "hwt2g", "9cfaa7bff17739e10caf1fe970f098dd57f4360b3fa36e183a88d40ae73b4f5c"),
    ("MIS 6", "max", "mdkjh", "3fde79924b06ece6ad1e33965537945a50e6b6312543328000a7c0ec9a93227f"),
    ("MIS 6", "min", "rzyg9", "e407d6184d78726053067e2ef9212a8671ed6e1715127d4718210ca5a8798d12"),
    ("MIS 8", "best", "urfx2", "75807e46d747875c1dfd7e948ca428690fabc2b16159a60b0bdd0f54e33ac22a"),
    (
        "MIS 8",
        "max",
        "5d35d26e5d2cdc001a060359",
        "57de0881903ec9467086c6f409f6501103d778d724e57beabf1b5b9235df3b33",
    ),
    (
        "MIS 8",
        "min",
        "5d35d278251f0e00160c36bb",
        "803882bf4d2c20a8e5a0f94f17be62eea95a4e1822101e70ce03b3f4c109a822",
    ),
    ("MIS 10", "best", "8ujx7", "1763a61a053c346c6d97cf4c49aab5a87aac81eb8a90340eaac205ce2beb92bc"),
    ("MIS 10", "max", "6ah5b", "b5f633620a656993ca034c414f74606e56d058b7de99a7f33add3c605597a140"),
    ("MIS 10", "min", "92cvd", "e5928e5f2659554c89bc105d59747ffba5ef8c3505669fa306b065d76edbd7a5"),
    ("MIS 12", "best", "ezmkf", "d88dc8d2edf52770c45e22da0c56c031c40005a5fe5429e42fd95ace6f403e7f"),
    (
        "MIS 12",
        "max",
        "5d35d5aa251f0e0019079f59",
        "7b09e0003f6207bca5b3fc0b883f267373d7bc3c72a9bb992c708eb71b6f5b90",
    ),
    (
        "MIS 12",
        "min",
        "5d35d5b4a667db0017fe3471",
        "f343e6d4818196ca077abec496dd5292a16be9ae9d818102f002b48f9654e60b",
    ),
    ("MIS 16", "best", "uebhx", "47b525aad104ff95ffa1ada02ae43fffaca465061c588afe74b12cc9c7b2d265"),
    (
        "MIS 16",
        "max",
        "5d35d6c75d2cdc001a060877",
        "3b3c2ad20588ea9c1eb1d431602a82e4c988391731282c4f56fd1e3a76b513df",
    ),
    (
        "MIS 16",
        "min",
        "5d35d6cfa667db001af8f809",
        "3bcb8790dac7f8c40a0fcd1531ca837f980462c2f935b5f9c32a5f02f21e78fe",
    ),
    (
        "MIS 20-24",
        "best",
        "ws839",
        "54af6f32a230de7b899b6060187eecadd51dff34ce42f49d63f9e65bf38e20c3",
    ),
    (
        "MIS 20-24",
        "max",
        "srydu",
        "1d63baa81350883c3536be51023e86083b24823b2062ba2880f6b897b54e9d77",
    ),
    (
        "MIS 20-24",
        "min",
        "y2bw4",
        "21b45ac0e9a29c1acc956938812dabfe9097e085718153352bf64076502c7f94",
    ),
    (
        "Early Matuyama Chron",
        "best",
        "v859p",
        "e999b1ff776d20a5f05428e356991ab1a69c643292e6b71bafdb966fe7d33176",
    ),
    (
        "Early Matuyama Chron",
        "max",
        "zks8j",
        "9f8e378d91ac4f8ea441ba9cf73acd7917e8b627a4d6ff5bc8fa761a34d8fcb7",
    ),
    (
        "Early Matuyama Chron",
        "min",
        "3jfz7",
        "0cdffb9333ee4c7e7afa2ec7cb994835ff28e3200855bf04acee141cea314240",
    ),
    (
        "Late Gauss Chron",
        "best",
        "rj5z9",
        "bba77873177e52e3b43dd2a1a0cce35da2758151be3143a6612af872d176679b",
    ),
    (
        "Late Gauss Chron",
        "max",
        "gkhfw",
        "53b6a5cb8a0ee90c990c644ba092893fa3e6ad96e3721c234e70f7f282c8ea72",
    ),
    (
        "Late Gauss Chron",
        "min",
        "dcye2",
        "84ecd7d71717c051b173dc6086bf4c3d64d46f44f9e24c485c9d64d5ebc2b561",
    ),
    ("LGM", "best", "9yhdv", "a3e2dbf480f62e1bda37a96d734a617c1b38963d56fa706e2cb7b8dd32e4f271"),
)


def _q(sin_phi: float) -> float:
    """Snyder's q (eq. 3-12) for the ellipsoid."""
    one = 1 - _E2 * sin_phi * sin_phi
    return (1 - _E2) * (
        sin_phi / one - math.log((1 - _E * sin_phi) / (1 + _E * sin_phi)) / (2 * _E)
    )


_QP = _q(1.0)


def to_lon_lat(x: float, y: float) -> Point:
    """North-polar Lambert azimuthal equal-area (WGS 84) to degrees (Snyder 1987, ch. 24)."""
    rho = math.hypot(x, y)
    q = _QP - (rho / _A) ** 2
    beta = math.asin(max(-1.0, min(1.0, q / _QP)))
    e4, e6 = _E2 * _E2, _E2 * _E2 * _E2
    phi = (
        beta
        + (_E2 / 3 + 31 * e4 / 180 + 517 * e6 / 5040) * math.sin(2 * beta)
        + (23 * e4 / 360 + 251 * e6 / 3780) * math.sin(4 * beta)
        + (761 * e6 / 45360) * math.sin(6 * beta)
    )
    return (math.degrees(math.atan2(x, -y)), math.degrees(phi))


def from_lon_lat(lon: float, lat: float) -> tuple[float, float]:
    """Project degrees forward, for checking the inverse."""
    rho = _A * math.sqrt(_QP - _q(math.sin(math.radians(lat))))
    lam = math.radians(lon)
    return (rho * math.sin(lam), -rho * math.cos(lam))


_NULL = 0
_POLYGONS = (5, 15, 25)  # Polygon, PolygonZ, PolygonM


def polygon_rings(shp: bytes) -> Iterator[list[tuple[float, float]]]:
    """Every ring of every polygon in a shapefile's .shp, in its projected coordinates."""
    position = 100
    while position + 8 <= len(shp):
        _number, words = struct.unpack(">ii", shp[position : position + 8])
        content = shp[position + 8 : position + 8 + 2 * words]
        position += 8 + 2 * words
        (kind,) = struct.unpack("<i", content[:4])
        if kind == _NULL:
            continue
        if kind not in _POLYGONS:
            msg = f"shape type {kind} is not a polygon"
            raise ValueError(msg)
        parts, points = struct.unpack("<ii", content[36:44])
        starts = [*struct.unpack(f"<{parts}i", content[44 : 44 + 4 * parts]), points]
        base = 44 + 4 * parts
        coords = struct.unpack(f"<{2 * points}d", content[base : base + 16 * points])
        for first, last in itertools.pairwise(starts):
            yield [(coords[2 * i], coords[2 * i + 1]) for i in range(first, last)]


def unwrapped(ring: list[Point]) -> list[Point]:
    """Longitudes made continuous, so a ring across the date line is not drawn round the world."""
    out: list[Point] = []
    shift = 0.0
    for lon, lat in ring:
        if out:
            step = lon + shift - out[-1][0]
            if step > 180:  # noqa: PLR2004
                shift -= 360
            elif step < -180:  # noqa: PLR2004
                shift += 360
        out.append((lon + shift, lat))
    return out


def is_geographic(shp: bytes) -> bool:
    """Whether a shapefile is in degrees already: a few of the files are, not projected."""
    west, south, east, north = (float(value) for value in struct.unpack("<4d", shp[36:68]))
    return -180.001 <= west <= east <= 180.001 and -90.001 <= south <= north <= 90.001  # noqa: PLR2004


def outline_rings(shp: bytes) -> list[list[Point]]:
    """Read a shapefile's rings in degrees, simplified for the globe, the small ones dropped."""
    rings: list[list[Point]] = []
    geographic = is_geographic(shp)
    for projected in polygon_rings(shp):
        points = projected if geographic else [to_lon_lat(x, y) for x, y in projected]
        ring = unwrapped(points)
        if ring_area(ring) < MIN_RING_AREA:
            continue
        simplified = simplify(ring, TOLERANCE)
        if len(simplified) >= 4:  # noqa: PLR2004
            rings.append(simplified)
    return rings


def _flat(ring: list[Point]) -> Json:
    return [round(value * ROUNDING) for point in ring for value in point]


def outlines_file(outlines: dict[tuple[str, Hypothesis], list[list[Point]]]) -> dict[str, Json]:
    """Build the site's file: each time slice with its hypotheses' rings, as integers."""

    def rings(name: str, hypothesis: Hypothesis) -> Json:
        return [_flat(ring) for ring in outlines.get((name, hypothesis), [])]

    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "scale": ROUNDING,
        "slices": [
            {
                "name": time_slice.name,
                "fromKa": time_slice.from_ka,
                "toKa": time_slice.to_ka,
                "min": rings(time_slice.name, "min"),
                "best": rings(time_slice.name, "best"),
                "max": rings(time_slice.name, "max"),
            }
            for time_slice in SLICES
        ],
    }


def _download(code: str) -> bytes:  # pragma: no cover - needs network access
    url = f"https://osf.io/download/{code}/"
    request = urllib.request.Request(url, headers={"User-Agent": "histeclipse-pipeline"})
    with urllib.request.urlopen(request, timeout=120) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{url}: expected bytes"
        raise TypeError(msg)
    return body


def fetch_outlines(path: Path) -> int:  # pragma: no cover - needs network access
    """Download each shapefile (checked against its checksum); write the site's file."""
    outlines: dict[tuple[str, Hypothesis], list[list[Point]]] = {}
    for name, hypothesis, code, sha256 in FILES:
        shp = verified(_download(code), sha256, f"Batchelor {name} {hypothesis}")
        outlines[name, hypothesis] = outline_rings(shp)
    text = json.dumps(outlines_file(outlines), separators=(",", ":"))
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_text(text + "\n")
    return len(FILES)
