"""Static JSON catalog files served by the web app.

Layout of ``<out>/``:

- ``index.json``: metadata and one entry per chunk file.
- ``<century>.json``: eclipses whose greatest eclipse falls in that century, e.g.
  ``-600.json`` holds astronomical years -600..-501.

The chunk key is the century's first astronomical year, using floor division
(-586 belongs to the -600 chunk).
"""

import json
from collections import defaultdict
from typing import TYPE_CHECKING, TypedDict

from histeclipse_pipeline.julian_day import GREGORIAN_REFORM_JD, Calendar, calendar_date
from histeclipse_pipeline.lunar import DELTA_T_MODEL, LunarEclipse

if TYPE_CHECKING:
    from collections.abc import Iterable, Sequence
    from pathlib import Path

SCHEMA_VERSION = 1
EPHEMERIS = "JPL DE441"
YEARS_PER_CHUNK = 100


class LunarEclipseRecord(TypedDict):
    """One eclipse as written to JSON. Mirrors the web app's runtime schema."""

    jdTT: float
    kind: str
    umbralMagnitude: float
    penumbralMagnitude: float
    gamma: float
    deltaT: float
    sublunar: tuple[float, float]


class ChunkEntry(TypedDict):
    """An entry in ``index.json``."""

    startYear: int
    file: str
    count: int


class CatalogIndex(TypedDict):
    """Contents of ``index.json``."""

    schemaVersion: int
    kind: str
    ephemeris: str
    deltaTModel: str
    startYear: int
    endYear: int
    yearsPerChunk: int
    chunks: list[ChunkEntry]


def astronomical_year(jd_tt: float) -> int:
    """Year of a Julian Day, in the calendar historians use for that date.

    That means the Julian calendar before the 1582 reform and the Gregorian calendar after it.
    """
    calendar = Calendar.JULIAN if jd_tt < GREGORIAN_REFORM_JD else Calendar.GREGORIAN
    return calendar_date(jd_tt, calendar).year


def to_record(eclipse: LunarEclipse) -> LunarEclipseRecord:
    """Round values to what the precision of the data justifies and use JSON key names."""
    return {
        "jdTT": round(eclipse.greatest_jd_tt, 6),
        "kind": eclipse.kind.value,
        "umbralMagnitude": round(eclipse.umbral_magnitude, 4),
        "penumbralMagnitude": round(eclipse.penumbral_magnitude, 4),
        "gamma": round(eclipse.gamma, 4),
        "deltaT": round(eclipse.delta_t_seconds),
        "sublunar": (
            round(eclipse.sublunar_latitude, 2),
            round(eclipse.sublunar_longitude, 2),
        ),
    }


def write_lunar_catalog(
    eclipses: Iterable[LunarEclipse], out: Path, start_year: int, end_year: int
) -> CatalogIndex:
    """Write chunked JSON for eclipses in astronomical years ``start_year..end_year``.

    Every century the range touches gets a chunk file, even if it has no eclipses, so the
    web app can tell "no eclipses" apart from "not covered".
    """
    if start_year > end_year:
        msg = f"Empty year range {start_year}..{end_year}"
        raise ValueError(msg)
    chunks: defaultdict[int, list[LunarEclipseRecord]] = defaultdict(list)
    for eclipse in sorted(eclipses, key=lambda e: e.greatest_jd_tt):
        year = astronomical_year(eclipse.greatest_jd_tt)
        if not start_year <= year <= end_year:
            msg = f"Eclipse at JD {eclipse.greatest_jd_tt} (year {year}) is outside the range"
            raise ValueError(msg)
        chunks[year // YEARS_PER_CHUNK * YEARS_PER_CHUNK].append(to_record(eclipse))

    out.mkdir(parents=True, exist_ok=True)
    entries: list[ChunkEntry] = []
    first_chunk = start_year // YEARS_PER_CHUNK * YEARS_PER_CHUNK
    for chunk_start in range(first_chunk, end_year + 1, YEARS_PER_CHUNK):
        records = chunks.get(chunk_start, [])
        name = f"{chunk_start}.json"
        _write_json(out / name, records)
        entries.append({"startYear": chunk_start, "file": name, "count": len(records)})

    index: CatalogIndex = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": "lunar",
        "ephemeris": EPHEMERIS,
        "deltaTModel": DELTA_T_MODEL,
        "startYear": start_year,
        "endYear": end_year,
        "yearsPerChunk": YEARS_PER_CHUNK,
        "chunks": entries,
    }
    _write_json(out / "index.json", index)
    return index


def _write_json(path: Path, value: CatalogIndex | Sequence[LunarEclipseRecord]) -> None:
    # Compact separators keep files small. One record per line keeps regeneration diffs readable.
    def dump(item: object) -> str:
        return json.dumps(item, separators=(",", ":"), allow_nan=False)

    if isinstance(value, dict):
        text = dump(value)
    else:
        text = "[\n" + ",\n".join(dump(record) for record in value) + "\n]" if value else "[]"
    _ = path.write_text(text + "\n")
