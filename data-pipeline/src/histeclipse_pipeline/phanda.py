"""Global mean surface temperature over 485 million years, by data assimilation (PhanDA).

Judd et al. (2024), *A 485-million-year history of Earth's surface temperature*, Science 385,
eadk3705 (doi:10.1126/science.adk3705): proxy sea-surface temperatures (the PhanSST database)
assimilated into HadCM3L climate simulations (the PhanDA model priors, Zenodo 8237751, CC BY
4.0), one solution per geological stage, 85 in all. The authors' repository
(github.com/EJJudd/PhanDA) publishes the result as ``5_Outputs/PhanDA_GMSTandCO2_percentiles.csv``:
each stage's period, epoch and name, its upper and lower age and their mean (Ma), and the 5th,
16th, 50th, 84th and 95th percentiles of the ensemble's GMST (°C) and CO2 (ppm). The file is
read at a pinned commit. The repository states no licence; the paper is credited.

Every stage is kept (there are only 85); the CO2 columns are left out.
"""

import csv
import io
import json
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from pathlib import Path

COMMIT = "49ff8759ce09c4e62a239fd39eea8ba01c843cac"
DATA_URL = (
    f"https://raw.githubusercontent.com/EJJudd/PhanDA/{COMMIT}/5_Outputs/"
    "PhanDA_GMSTandCO2_percentiles.csv"
)
DATA_SHA256 = "22cad7964bac3b679ad83bf8a9c83eb66e995898a01eb9e93142087b2d4f6e1f"
SOURCE = "https://doi.org/10.1126/science.adk3705"
REPOSITORY = f"https://github.com/EJJudd/PhanDA/tree/{COMMIT}/5_Outputs"
CREDIT = (
    "Judd, Tierney, Lunt, Montañez, Huber, Wing & Valdes (2024), A 485-million-year history "
    "of Earth's surface temperature, Science 385, eadk3705, doi:10.1126/science.adk3705; "
    "GMST percentiles from github.com/EJJudd/PhanDA (no licence stated)"
)
#: The percentiles the file gives, in its column order.
PERCENTILES = (5, 16, 50, 84, 95)


@dataclass(frozen=True)
class Stage:
    """One assimilated stage: names, ages (Ma), and GMST percentiles (°C)."""

    period: str
    epoch: str
    stage: str
    top: float
    base: float
    mid: float
    gmst: tuple[float, ...]


def read_percentiles(text: str) -> list[Stage]:
    """Read each stage's names, ages and GMST percentiles, youngest first."""
    stages = [
        Stage(
            period=row["Period"].strip(),
            epoch=row["Epoch"].strip(),
            stage=row["Stage"].strip(),
            top=float(row["UpperAge"]),
            base=float(row["LowerAge"]),
            mid=float(row["AverageAge"]),
            gmst=tuple(float(row[f"GMST_{p:02d}"]) for p in PERCENTILES),
        )
        for row in csv.DictReader(io.StringIO(text))
    ]
    for each in stages:
        if list(each.gmst) != sorted(each.gmst):
            msg = f"PhanDA {each.stage}: percentiles out of order {each.gmst}"
            raise ValueError(msg)
    return sorted(stages, key=lambda each: each.mid)


def _round(value: float, places: int) -> float:
    return round(value, places) + 0.0  # + 0.0 turns -0.0 into 0.0


def phanda_file(stages: list[Stage]) -> dict[str, Json]:
    """Build the site's file: credit, units, and one row per stage."""
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "repository": REPOSITORY,
        "age": "Ma (millions of years before present); stage ages as the source gives them",
        "units": {"gmst": "°C"},
        "note": (
            "Global mean surface temperature, one value per geological stage (not a time "
            "series sampled evenly). The band is the ensemble's spread: 16th-84th percentile "
            "(about one sigma) and 5th-95th. The source gives the PETM a row of its own, "
            "56.0-55.7 Ma, between the Thanetian and the Ypresian."
        ),
        "percentiles": list[Json](PERCENTILES),
        "columns": ["ma", "top", "base", "p5", "p16", "p50", "p84", "p95"],
        "names": [[each.period, each.epoch, each.stage] for each in stages],
        "stages": [
            [
                _round(each.mid, 5),
                _round(each.top, 5),
                _round(each.base, 5),
                *(_round(value, 2) for value in each.gmst),
            ]
            for each in stages
        ],
    }


def write_phanda(stages: list[Stage], path: Path) -> int:
    """Write the site's file; return how many stages it holds."""
    path.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(phanda_file(stages), separators=(",", ":"), ensure_ascii=False)
    _ = path.write_text(body + "\n")
    return len(stages)


def fetch_phanda(path: Path) -> int:  # pragma: no cover - needs network access
    """Download the percentiles (checked against the pinned checksum) and write the file."""
    request = urllib.request.Request(DATA_URL, headers={"User-Agent": "histeclipse-pipeline"})
    with urllib.request.urlopen(request, timeout=120) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{DATA_URL}: expected bytes"
        raise TypeError(msg)
    text = verified(body, DATA_SHA256, "PhanDA GMST percentiles").decode("utf-8")
    return write_phanda(read_percentiles(text), path)
