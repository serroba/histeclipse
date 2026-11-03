"""Carbon dioxide and methane over the last 800,000 years, from Antarctic ice cores.

- CO2: the Antarctic composite revised by Bereiter et al. (2015), Geophysical Research Letters
  42, 542-549 (doi:10.1002/2014GL061957), with EPICA Dome C to 800 ka (Luthi et al. 2008).
- CH4: EPICA Dome C, Loulergue et al. (2008), Nature 453, 383-386 (doi:10.1038/nature06950).

Both from NOAA's World Data Center for Paleoclimatology, which asks that the original
publications be cited. Gas ages are years before 1950; each point keeps its 1 sigma. The
pre-industrial levels (1750) beside them are IPCC AR6 WGI's (Gulev et al. 2021, ch. 2): 278 ppm
CO2 and 729 ppb CH4.
"""

import json
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from pathlib import Path

CO2_URL = (
    "https://www.ncei.noaa.gov/pub/data/paleo/icecore/antarctica/antarctica2015co2composite.txt"
)
CO2_SHA256 = "de57b3967758725b9650717a71bd665ebc87e23d41d3d3ad05c9095a6e7e393f"
CH4_URL = "https://www.ncei.noaa.gov/pub/data/paleo/icecore/antarctica/epica_domec/edc-ch4-2008.txt"
CH4_SHA256 = "f4740dd8f69a50da3d6c0edd18dbc0afd8cc078a69360d697fe5349cc0887eaf"
SOURCE = "https://www.ncei.noaa.gov/access/paleo-search/study/17975"


@dataclass(frozen=True)
class Point:
    """A measurement: thousands of years ago (before 1950), the value and its 1 sigma."""

    ka: float
    value: float
    sigma: float


def parse_co2(text: str) -> list[Point]:
    """Read the CO2 composite: after its header line, age (yr BP), ppm and 1 sigma, by tabs."""
    points: list[Point] = []
    started = False
    for line in text.splitlines():
        if line.startswith("age_gas_calBP"):
            started = True
            continue
        if not started or line.startswith("#") or not line.strip():
            continue
        age, value, sigma = (float(field) for field in line.split("\t")[:3])
        points.append(Point(ka=age / 1000, value=value, sigma=sigma))
    return sorted(points, key=lambda point: point.ka)


def parse_ch4(text: str) -> list[Point]:
    """Read the CH4 record: after its header line, depth, gas age (yr BP), ppb, 1 sigma, lab."""
    points: list[Point] = []
    started = False
    for line in text.splitlines():
        if line.startswith("Depth"):
            started = True
            continue
        fields = line.split()
        if not started or len(fields) < 4:  # noqa: PLR2004
            continue
        points.append(
            Point(ka=float(fields[1]) / 1000, value=float(fields[2]), sigma=float(fields[3]))
        )
    return sorted(points, key=lambda point: point.ka)


def _series(points: list[Point]) -> list[Json]:
    return [[round(point.ka, 3), round(point.value, 2), round(point.sigma, 2)] for point in points]


def atmosphere_file(co2: list[Point], ch4: list[Point]) -> dict[str, Json]:
    """Build the site's file: each gas with its unit, sources and points (ka, value, 1 sigma)."""
    return {
        "schemaVersion": 1,
        "source": SOURCE,
        "gases": [
            {
                "id": "co2",
                "name": "Carbon dioxide",
                "unit": "ppm",
                "credit": (
                    "Bereiter et al. 2015 (Antarctic composite; EPICA Dome C, Lüthi et al. 2008), "
                    "NOAA WDC Paleoclimatology"
                ),
                "doi": "10.1002/2014GL061957",
                "preindustrial": 278,
                "points": _series(co2),
            },
            {
                "id": "ch4",
                "name": "Methane",
                "unit": "ppb",
                "credit": "Loulergue et al. 2008 (EPICA Dome C), NOAA WDC Paleoclimatology",
                "doi": "10.1038/nature06950",
                "preindustrial": 729,
                "points": _series(ch4),
            },
        ],
    }


def _download(url: str) -> bytes:  # pragma: no cover - needs network access
    request = urllib.request.Request(url, headers={"User-Agent": "histeclipse-pipeline"})  # noqa: S310
    with urllib.request.urlopen(request, timeout=60) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{url}: expected bytes"
        raise TypeError(msg)
    return body


def fetch_atmosphere(path: Path) -> int:  # pragma: no cover - needs network access
    """Download both records (checked against their checksums) and write the site's file."""
    co2 = parse_co2(verified(_download(CO2_URL), CO2_SHA256, "CO2 composite").decode("utf-8-sig"))
    ch4 = parse_ch4(verified(_download(CH4_URL), CH4_SHA256, "CH4 record").decode("latin-1"))
    path.parent.mkdir(parents=True, exist_ok=True)
    _ = path.write_text(json.dumps(atmosphere_file(co2, ch4), separators=(",", ":")) + "\n")
    return len(co2) + len(ch4)
