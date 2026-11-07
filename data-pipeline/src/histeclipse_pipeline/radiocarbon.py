"""The radiocarbon calibration curves: how much carbon-14 the air held, year by year, 55,000 years.

IntCal20 (Reimer et al. 2020) for the northern hemisphere and SHCal20 (Hogg et al. 2020) for the
southern, both CC BY 4.0, as the IntCal group publishes them (``.14c`` text files). Each row is a
calendar age (cal BP: years before 1950), the radiocarbon age the air then gives a sample, its
uncertainty, and the air's carbon-14 relative to the standard (Δ14C, per mille) with its own.
The files are pinned by checksum; the site's file keeps every row, as calibrating needs them.
"""

import datetime as dt
import json
import urllib.request
from dataclasses import dataclass
from typing import TYPE_CHECKING

from histeclipse_pipeline.sky import verified

if TYPE_CHECKING:
    from pathlib import Path

    from histeclipse_pipeline.sky import Json


@dataclass(frozen=True)
class CurveSource:
    """A curve: its key, where it is, its pinned checksum, and its citation."""

    key: str
    url: str
    sha256: str
    cite: str
    doi: str


CURVES = (
    CurveSource(
        key="intcal20",
        url="https://intcal.org/curves/intcal20.14c",
        sha256="974a66649f2ac8a53e6c99e256b019ac6982f999b12dcf7193162d4c1c09168e",
        cite=(
            "Reimer et al. (2020), The IntCal20 Northern Hemisphere radiocarbon age calibration "
            "curve (0-55 cal kBP), Radiocarbon 62, 725-757"
        ),
        doi="10.1017/RDC.2020.41",
    ),
    CurveSource(
        key="shcal20",
        url="https://intcal.org/curves/shcal20.14c",
        sha256="e214d987bc4dbddfbc91c0aca4573a71db22a17c93d8bc55fa609bb58ae39b0d",
        cite=(
            "Hogg et al. (2020), SHCal20 Southern Hemisphere calibration, 0-55,000 years cal BP, "
            "Radiocarbon 62, 759-778"
        ),
        doi="10.1017/RDC.2020.59",
    ),
)

COLUMNS = 5


@dataclass(frozen=True)
class Curve:
    """A curve's rows, youngest first: cal BP, 14C age and its sigma, Δ14C and its sigma."""

    cal_bp: tuple[int, ...]
    age: tuple[int, ...]
    sigma: tuple[int, ...]
    delta: tuple[float, ...]
    delta_sigma: tuple[float, ...]


def parse_curve(text: str) -> Curve:
    """Read a ``.14c`` file: comments start with ``#``; rows are five comma-separated values."""
    rows: list[tuple[int, int, int, float, float]] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        parts = [part.strip() for part in stripped.split(",")]
        if len(parts) != COLUMNS:
            msg = f"a row has {len(parts)} values, not {COLUMNS}: {stripped!r}"
            raise ValueError(msg)
        # "-0.0" in the source is plain zero (adding 0.0 turns -0.0 into 0.0).
        delta, delta_sigma = float(parts[3]) + 0.0, float(parts[4]) + 0.0
        rows.append((int(parts[0]), int(parts[1]), int(parts[2]), delta, delta_sigma))
    if not rows:
        msg = "no rows in the curve"
        raise ValueError(msg)
    rows.sort(key=lambda row: row[0])
    if len({row[0] for row in rows}) != len(rows):
        msg = "a calendar age appears twice"
        raise ValueError(msg)
    return Curve(
        cal_bp=tuple(row[0] for row in rows),
        age=tuple(row[1] for row in rows),
        sigma=tuple(row[2] for row in rows),
        delta=tuple(row[3] for row in rows),
        delta_sigma=tuple(row[4] for row in rows),
    )


def radiocarbon_file(
    curves: dict[str, tuple[CurveSource, Curve]], accessed: str
) -> dict[str, Json]:
    """Build the site's file: each curve's citation and its columns."""
    return {
        "schemaVersion": 1,
        "accessed": accessed,
        "curves": {
            key: {
                "cite": source.cite,
                "doi": source.doi,
                "calBP": list(curve.cal_bp),
                "age": list(curve.age),
                "sigma": list(curve.sigma),
                "delta": list(curve.delta),
                "deltaSigma": list(curve.delta_sigma),
            }
            for key, (source, curve) in curves.items()
        },
    }


def _download(url: str) -> bytes:  # pragma: no cover - needs network access
    with urllib.request.urlopen(url, timeout=60) as response:  # noqa: S310  # pyright: ignore[reportAny]
        body: object = response.read()  # pyright: ignore[reportAny]
    if not isinstance(body, bytes):
        msg = f"{url}: expected bytes"
        raise TypeError(msg)
    return body


def fetch_radiocarbon(path: Path) -> int:  # pragma: no cover - needs network access
    """Download each curve, check it against its pinned checksum, and write the site's file."""
    curves = {
        source.key: (
            source,
            parse_curve(verified(_download(source.url), source.sha256, source.key).decode()),
        )
        for source in CURVES
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    made = dt.datetime.now(tz=dt.UTC).date().isoformat()
    _ = path.write_text(json.dumps(radiocarbon_file(curves, made), separators=(",", ":")) + "\n")
    return sum(len(curve.cal_bp) for _, curve in curves.values())
