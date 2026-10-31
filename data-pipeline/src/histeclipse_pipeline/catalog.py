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

from histeclipse_pipeline.delta_t import DELTA_T_MODEL
from histeclipse_pipeline.julian_day import GREGORIAN_REFORM_JD, Calendar, calendar_date

if TYPE_CHECKING:
    from collections.abc import Iterable, Sequence
    from pathlib import Path

    from histeclipse_pipeline.lunar import LunarEclipse
    from histeclipse_pipeline.solar import SolarEclipse

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


class BesselianRecord(TypedDict):
    """Besselian elements as written to JSON: cubics in hours from ``t0`` (JD, TT)."""

    t0: float
    x: list[float]
    y: list[float]
    d: list[float]
    mu: list[float]
    l1: list[float]
    l2: list[float]
    tanF1: float
    tanF2: float


class SolarEclipseRecord(TypedDict):
    """One solar eclipse as written to JSON. Mirrors the web app's runtime schema."""

    jdTT: float
    kind: str
    gamma: float
    magnitude: float
    deltaT: float
    greatest: tuple[float, float]
    elements: BesselianRecord


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
    """Write chunked JSON for lunar eclipses in astronomical years ``start_year..end_year``."""
    items = ((eclipse.greatest_jd_tt, to_record(eclipse)) for eclipse in eclipses)
    return _write_chunked(items, out, start_year, end_year, "lunar")


def to_solar_record(eclipse: SolarEclipse) -> SolarEclipseRecord:
    """Round values to what the precision of the data justifies and use JSON key names.

    Coefficients keep 8 decimals of an Earth radius (6 cm) and 7 of a degree, far below
    anything ΔT or the ephemeris can resolve, so rounding never shows on the map.
    """
    elements = eclipse.elements

    def coefficients(values: tuple[float, ...], digits: int) -> list[float]:
        return [round(value, digits) for value in values]

    return {
        "jdTT": round(eclipse.greatest_jd_tt, 6),
        "kind": eclipse.kind.value,
        "gamma": round(eclipse.gamma, 4),
        "magnitude": round(eclipse.magnitude, 4),
        "deltaT": round(eclipse.delta_t_seconds),
        "greatest": (round(eclipse.greatest_latitude, 2), round(eclipse.greatest_longitude, 2)),
        "elements": {
            "t0": round(elements.t0_jd_tt, 7),
            "x": coefficients(elements.x, 8),
            "y": coefficients(elements.y, 8),
            "d": coefficients(elements.d, 7),
            "mu": coefficients(elements.mu, 6),
            "l1": coefficients(elements.l1, 8),
            "l2": coefficients(elements.l2, 8),
            "tanF1": round(elements.tan_f1, 9),
            "tanF2": round(elements.tan_f2, 9),
        },
    }


def write_solar_catalog(
    eclipses: Iterable[SolarEclipse], out: Path, start_year: int, end_year: int
) -> CatalogIndex:
    """Write chunked JSON for solar eclipses in astronomical years ``start_year..end_year``."""
    items = ((eclipse.greatest_jd_tt, to_solar_record(eclipse)) for eclipse in eclipses)
    return _write_chunked(items, out, start_year, end_year, "solar")


def _write_chunked[Record](
    items: Iterable[tuple[float, Record]], out: Path, start_year: int, end_year: int, kind: str
) -> CatalogIndex:
    """Write records to century files plus ``index.json``.

    Every century the range touches gets a chunk file, even if it has no eclipses, so the
    web app can tell "no eclipses" apart from "not covered".
    """
    if start_year > end_year:
        msg = f"Empty year range {start_year}..{end_year}"
        raise ValueError(msg)
    chunks: defaultdict[int, list[Record]] = defaultdict(list)
    for jd_tt, record in sorted(items, key=lambda item: item[0]):
        year = astronomical_year(jd_tt)
        if not start_year <= year <= end_year:
            msg = f"Eclipse at JD {jd_tt} (year {year}) is outside the range"
            raise ValueError(msg)
        chunks[year // YEARS_PER_CHUNK * YEARS_PER_CHUNK].append(record)

    out.mkdir(parents=True, exist_ok=True)
    entries: list[ChunkEntry] = []
    first_chunk = start_year // YEARS_PER_CHUNK * YEARS_PER_CHUNK
    for chunk_start in range(first_chunk, end_year + 1, YEARS_PER_CHUNK):
        records = chunks.get(chunk_start, [])
        name = f"{chunk_start}.json"
        _write_records(out / name, records)
        entries.append({"startYear": chunk_start, "file": name, "count": len(records)})

    index: CatalogIndex = {
        "schemaVersion": SCHEMA_VERSION,
        "kind": kind,
        "ephemeris": EPHEMERIS,
        "deltaTModel": DELTA_T_MODEL,
        "startYear": start_year,
        "endYear": end_year,
        "yearsPerChunk": YEARS_PER_CHUNK,
        "chunks": entries,
    }
    _ = (out / "index.json").write_text(_dump(index) + "\n")
    return index


def _dump(item: object) -> str:
    # Compact separators keep files small.
    return json.dumps(item, separators=(",", ":"), allow_nan=False)


def _write_records(path: Path, records: Sequence[object]) -> None:
    # One record per line keeps regeneration diffs readable.
    text = "[\n" + ",\n".join(_dump(record) for record in records) + "\n]" if records else "[]"
    _ = path.write_text(text + "\n")
