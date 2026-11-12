"""The Cenozoic deep-sea benthic isotope record, CENOGRID (Westerhold et al. 2020).

Westerhold et al. (2020), *An astronomically dated record of Earth's climate and its
predictability over the last 66 million years*, Science 369, 1383-1387
(doi:10.1126/science.aba6853). Its reference splice, *S34. Binned and LOESS smoothed Cenozoic
deep-sea benthic foraminifer stable carbon and oxygen isotope reference splice*
(doi:10.1594/PANGAEA.917717, CC BY 4.0), part of the CENOGRID series on PANGAEA
(doi:10.1594/PANGAEA.917503), is read as PANGAEA's tab-separated text file.

The splice is binned every 2,000 years back to 34 Ma and every 5,000 years before that, on an
astronomically tuned age scale (Ma). Each bin gives the benthic foraminifer δ¹⁸O and δ¹³C
(‰ VPDB), a LOESS smooth of each (over 10 or 5 bins), and a long-term LOESS smooth (over 500
or 250 bins). δ¹⁸O is not a temperature: it mixes deep-water temperature with the ice stored
on land, and higher means colder or more ice. It is kept as published, not converted.

The LOESS smooth is thinned to means of 10,000-year bins (short enough to keep the 41,000-year
obliquity cycles), and the long-term smooth to means of 100,000-year bins.
"""

import json
import math
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

from histeclipse_pipeline.sky import Json, verified

if TYPE_CHECKING:
    from pathlib import Path

DATA_URL = "https://doi.pangaea.de/10.1594/PANGAEA.917717?format=textfile"
DATA_SHA256 = "c149bacb6b0f14b0dc3c7c5204306350df177c8b30221d7f4efa55d35324d2a3"
SOURCE = "https://doi.org/10.1594/PANGAEA.917717"
CREDIT = (
    "Westerhold et al. (2020), Science 369, 1383-1387, doi:10.1126/science.aba6853; "
    "CENOGRID reference splice, doi:10.1594/PANGAEA.917717, CC BY 4.0; "
    "thinned to 10,000-year and 100,000-year means for this site"
)
#: Bin widths the two smooths are thinned to, Ma.
SHORT_BIN = 0.01
LONG_BIN = 0.1

#: The columns read, by the name in brackets at the end of PANGAEA's heading.
_AGE = "Tuned time [Ma]"
_D18O = "ISOBENd18oLOESSsmooth"
_D13C = "ISOBENd13cLOESSsmooth"
_D18O_LONG = "ISOBENd18oLOESSsmoothLongTerm"
_D13C_LONG = "ISOBENd13cLOESSsmoothLongTerm"


@dataclass(frozen=True)
class Row:
    """One bin of the splice: age (Ma), and δ¹⁸O and δ¹³C (‰), each smooth then long-term."""

    ma: float
    d18o: float
    d13c: float
    d18o_long: float
    d13c_long: float


def _column(heading: list[str], name: str) -> int:
    for at, cell in enumerate(heading):
        if cell == name or cell.endswith(f"({name})"):
            return at
    msg = f"CENOGRID: no column {name!r}"
    raise ValueError(msg)


def read_splice(text: str) -> list[Row]:
    """Read every row with an age and all four smooths from PANGAEA's text file."""
    _, _, body = text.partition("*/")
    lines = [line for line in body.splitlines() if line.strip()]
    heading = lines[0].split("\t")
    columns = [_column(heading, name) for name in (_AGE, _D18O, _D13C, _D18O_LONG, _D13C_LONG)]
    rows: list[Row] = []
    for line in lines[1:]:
        cells = line.split("\t")
        values = [cells[at].strip() if at < len(cells) else "" for at in columns]
        if all(values):
            ma, d18o, d13c, d18o_long, d13c_long = (float(value) for value in values)
            rows.append(Row(ma, d18o, d13c, d18o_long, d13c_long))
    return rows


def _round(value: float, places: int) -> float:
    return round(value, places) + 0.0  # + 0.0 turns -0.0 into 0.0


def binned(points: list[tuple[float, float, float]], width: float) -> list[list[float]]:
    """Mean age and values of each bin ``width`` Ma wide, youngest first."""
    bins: dict[int, list[tuple[float, float, float]]] = {}
    for point in points:
        # A small nudge keeps an age on a bin's edge (0.01, 0.02…) in the bin it opens.
        bins.setdefault(math.floor(point[0] / width + 1e-9), []).append(point)
    out: list[list[float]] = []
    for key in sorted(bins):
        members = bins[key]
        means = [sum(each[at] for each in members) / len(members) for at in range(3)]
        out.append([_round(means[0], 3), _round(means[1], 3), _round(means[2], 3)])
    return out


def thinned(rows: list[Row]) -> tuple[list[list[float]], list[list[float]]]:
    """Thin the LOESS smooth to 10,000-year bins and the long-term smooth to 100,000-year."""
    short = binned([(row.ma, row.d18o, row.d13c) for row in rows], SHORT_BIN)
    long = binned([(row.ma, row.d18o_long, row.d13c_long) for row in rows], LONG_BIN)
    return short, long


def cenogrid_file(short: list[list[float]], long: list[list[float]]) -> dict[str, Json]:
    """Build the site's file: credit, units, and the two smooths, thinned."""
    return {
        "schemaVersion": 1,
        "credit": CREDIT,
        "source": SOURCE,
        "paper": "https://doi.org/10.1126/science.aba6853",
        "age": "Ma (millions of years before present), astronomically tuned",
        "units": {"d18O": "‰ VPDB", "d13C": "‰ VPDB"},
        "note": (
            "Benthic foraminifer δ18O mixes deep-sea temperature and land ice: higher is "
            "colder or more ice. It is not converted to a temperature here."
        ),
        "thinning": (
            "smooth: means of 10,000-year bins of the LOESS smooth (10 bins of 2 kyr to "
            "34 Ma, 5 bins of 5 kyr before); longTerm: means of 100,000-year bins of the "
            "long-term LOESS smooth"
        ),
        "columns": ["ma", "d18O", "d13C"],
        "smooth": [list[Json](point) for point in short],
        "longTerm": [list[Json](point) for point in long],
    }


def write_cenogrid(rows: list[Row], path: Path) -> int:
    """Write the site's file; return how many thinned points it holds."""
    short, long = thinned(rows)
    path.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(cenogrid_file(short, long), separators=(",", ":"), ensure_ascii=False)
    _ = path.write_text(body + "\n")
    return len(short) + len(long)


def fetch_cenogrid(path: Path) -> int:  # pragma: no cover - needs network access
    """Download the splice (checked against its pinned checksum) and write the site's file."""
    request = urllib.request.Request(DATA_URL, headers={"User-Agent": "histeclipse-pipeline"})
    with urllib.request.urlopen(request, timeout=300) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{DATA_URL}: expected bytes"
        raise TypeError(msg)
    text = verified(body, DATA_SHA256, "CENOGRID reference splice").decode("utf-8")
    return write_cenogrid(read_splice(text), path)
