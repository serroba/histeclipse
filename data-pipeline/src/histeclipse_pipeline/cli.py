"""Command-line entry point: ``uv run histeclipse-pipeline --help``."""

import argparse
import sys
from pathlib import Path
from typing import TYPE_CHECKING

from histeclipse_pipeline.catalog import write_lunar_catalog, write_solar_catalog
from histeclipse_pipeline.delta_t import delta_t_table, write_delta_t_table
from histeclipse_pipeline.ephemeris import Ephemeris, fetch_de441
from histeclipse_pipeline.julian_day import Calendar, CalendarDate, julian_day
from histeclipse_pipeline.lunar import find_lunar_eclipses
from histeclipse_pipeline.solar import find_solar_eclipses
from histeclipse_pipeline.vectors import sample_times, sun_vectors, write_vectors

if TYPE_CHECKING:
    from collections.abc import Callable, Sequence

DEFAULT_KERNELS = Path(".cache/de441")
DEFAULT_START_YEAR = -3999
DEFAULT_END_YEAR = 3000

SUN_VECTOR_COUNT = 200
SUN_VECTOR_SEED = 2026
SUN_VECTOR_DESCRIPTION = (
    "Apparent geocentric Sun from JPL DE441 via Skyfield (histeclipse-pipeline sun-vectors): "
    "subsolar point in degrees and sidereal time in hours at UT1 Julian Days, with TT from "
    "Skyfield's Delta T model. Reference values for the web app's analytic formulas."
)

# Extra ephemeris coverage on both sides, so searches near the range ends have data.
EPHEMERIS_PADDING_DAYS = 30.0


class Arguments(argparse.Namespace):
    """Parsed arguments, typed for the checkers. Runtime defaults live on each argument."""

    command: str = ""
    kernels: Path = DEFAULT_KERNELS
    start_year: int = DEFAULT_START_YEAR
    end_year: int = DEFAULT_END_YEAR
    # argparse requires --out for every command that reads it.
    out: Path = Path()
    count: int = SUN_VECTOR_COUNT


def year_start_jd(year: int) -> float:
    """Julian Day of January 1, 0h, in the calendar in use at that time (Julian before 1582)."""
    calendar = Calendar.JULIAN if year < 1583 else Calendar.GREGORIAN  # noqa: PLR2004
    return julian_day(CalendarDate(year, 1, 1.0, calendar))


def lunar_catalog(args: Arguments) -> int:
    """Compute lunar eclipses for the year range and write the JSON catalog."""
    paths = sorted(args.kernels.glob("*.bsp"))
    if not paths:
        return _fail(f"No kernels in {args.kernels}; run fetch-ephemeris first")
    start_jd, end_jd = year_start_jd(args.start_year), year_start_jd(args.end_year + 1)
    with Ephemeris(paths) as ephemeris:
        try:
            eclipses = find_lunar_eclipses(ephemeris, start_jd, end_jd)
        except ValueError as error:
            return _fail(f"Kernels in {args.kernels} do not cover the range: {error}")
    index = write_lunar_catalog(eclipses, args.out, args.start_year, args.end_year)
    total = sum(chunk["count"] for chunk in index["chunks"])
    return _say(f"wrote {total} lunar eclipses in {len(index['chunks'])} files to {args.out}")


def solar_catalog(args: Arguments) -> int:
    """Compute solar eclipses and their Besselian elements, and write the JSON catalog."""
    paths = sorted(args.kernels.glob("*.bsp"))
    if not paths:
        return _fail(f"No kernels in {args.kernels}; run fetch-ephemeris first")
    start_jd, end_jd = year_start_jd(args.start_year), year_start_jd(args.end_year + 1)
    with Ephemeris(paths) as ephemeris:
        try:
            eclipses = find_solar_eclipses(ephemeris, paths, start_jd, end_jd)
        except ValueError as error:
            return _fail(f"Kernels in {args.kernels} do not cover the range: {error}")
    index = write_solar_catalog(eclipses, args.out, args.start_year, args.end_year)
    total = sum(chunk["count"] for chunk in index["chunks"])
    return _say(f"wrote {total} solar eclipses in {len(index['chunks'])} files to {args.out}")


def delta_t(args: Arguments) -> int:
    """Write the ΔT table, one year wider than the range on each side.

    Samples sit at Julian epoch years, which do not line up exactly with the calendar
    years the catalogs cover.
    """
    first, last = args.start_year - 1, args.end_year + 1
    write_delta_t_table(delta_t_table(first, last), args.out)
    return _say(f"wrote ΔT for {first}..{last} to {args.out}")


def sun(args: Arguments) -> int:
    """Write Sun reference vectors for the web app's tests."""
    times = sample_times(args.start_year, args.end_year, args.count, SUN_VECTOR_SEED)
    try:
        vectors = sun_vectors(sorted(args.kernels.glob("*.bsp")), times)
    except ValueError as error:
        return _fail(f"Kernels in {args.kernels} do not cover the range: {error}")
    write_vectors(vectors, args.out, SUN_VECTOR_DESCRIPTION)
    return _say(f"wrote {len(vectors)} Sun vectors to {args.out}")


def fetch_ephemeris(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Download the DE441 excerpts the other commands read."""
    padding = EPHEMERIS_PADDING_DAYS
    start_jd, end_jd = year_start_jd(args.start_year), year_start_jd(args.end_year + 1)
    for kernel in fetch_de441(args.kernels, start_jd - padding, end_jd + padding):
        _ = _say(f"wrote {kernel.path}")
    return 0


COMMANDS: dict[str, tuple[Callable[[Arguments], int], str, str | None]] = {
    # name: (handler, help, --out help or None when the command takes no --out)
    "fetch-ephemeris": (fetch_ephemeris, "download DE441 excerpts from JPL", None),
    "lunar-catalog": (lunar_catalog, "compute lunar eclipses and write JSON", "output directory"),
    "solar-catalog": (
        solar_catalog,
        "compute solar eclipses with Besselian elements and write JSON",
        "output directory",
    ),
    "delta-t": (delta_t, "write the ΔT table the web app uses", "output JSON file"),
    "sun-vectors": (sun, "write Sun reference values for web tests", "output JSON file"),
}


def main(argv: Sequence[str] | None = None) -> int:
    """Parse arguments and run the chosen command."""
    parser = argparse.ArgumentParser(prog="histeclipse-pipeline", description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    for name, (_, help_text, out_help) in COMMANDS.items():
        command = commands.add_parser(name, help=help_text)
        if out_help is not None:
            _ = command.add_argument("--out", type=Path, required=True, help=out_help)
        # Explicit defaults matter: sub-parsers copy every attribute, None included, onto the
        # namespace, so the class-level defaults on `Arguments` alone would be overwritten.
        _ = command.add_argument("--kernels", type=Path, default=DEFAULT_KERNELS)
        _ = command.add_argument("--start-year", type=int, default=DEFAULT_START_YEAR)
        _ = command.add_argument("--end-year", type=int, default=DEFAULT_END_YEAR)
        if name == "sun-vectors":
            _ = command.add_argument("--count", type=int, default=SUN_VECTOR_COUNT)

    args = parser.parse_args(argv, namespace=Arguments())
    handler = COMMANDS[args.command][0]
    return handler(args)


def _say(message: str) -> int:
    print(message)  # noqa: T201
    return 0


def _fail(message: str) -> int:
    print(message, file=sys.stderr)  # noqa: T201
    return 1
