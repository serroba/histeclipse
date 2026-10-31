"""Command-line entry point: ``uv run histeclipse-pipeline --help``."""

import argparse
import sys
from pathlib import Path
from typing import TYPE_CHECKING

from histeclipse_pipeline.catalog import write_lunar_catalog
from histeclipse_pipeline.delta_t import delta_t_table, write_delta_t_table
from histeclipse_pipeline.ephemeris import Ephemeris, fetch_de441
from histeclipse_pipeline.julian_day import Calendar, CalendarDate, julian_day
from histeclipse_pipeline.lunar import find_lunar_eclipses

if TYPE_CHECKING:
    from collections.abc import Sequence

DEFAULT_KERNELS = Path(".cache/de441")
DEFAULT_START_YEAR = -3999
DEFAULT_END_YEAR = 3000

# Extra ephemeris coverage on both sides, so searches near the range ends have data.
EPHEMERIS_PADDING_DAYS = 30.0


def year_start_jd(year: int) -> float:
    """Julian Day of January 1, 0h, in the calendar in use at that time (Julian before 1582)."""
    calendar = Calendar.JULIAN if year < 1583 else Calendar.GREGORIAN  # noqa: PLR2004
    return julian_day(CalendarDate(year, 1, 1.0, calendar))


class Arguments(argparse.Namespace):
    """Parsed arguments, typed for the checkers. Runtime defaults live on each argument."""

    command: str = ""
    kernels: Path = DEFAULT_KERNELS
    start_year: int = DEFAULT_START_YEAR
    end_year: int = DEFAULT_END_YEAR
    out: Path | None = None


def main(argv: Sequence[str] | None = None) -> int:
    """Parse arguments and run the chosen command."""
    parser = argparse.ArgumentParser(prog="histeclipse-pipeline", description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)

    fetch = commands.add_parser("fetch-ephemeris", help="download DE441 excerpts from JPL")
    lunar = commands.add_parser("lunar-catalog", help="compute lunar eclipses and write JSON")
    delta_t = commands.add_parser("delta-t", help="write the ΔT table the web app uses")
    _ = delta_t.add_argument("--out", type=Path, required=True, help="output JSON file")
    _ = lunar.add_argument("--out", type=Path, required=True, help="output directory")
    for command in (fetch, lunar, delta_t):
        # Explicit defaults matter: sub-parsers copy every attribute, None included, onto the
        # namespace, so the class-level defaults on `Arguments` alone would be overwritten.
        _ = command.add_argument("--kernels", type=Path, default=DEFAULT_KERNELS)
        _ = command.add_argument("--start-year", type=int, default=DEFAULT_START_YEAR)
        _ = command.add_argument("--end-year", type=int, default=DEFAULT_END_YEAR)

    args = parser.parse_args(argv, namespace=Arguments())
    kernels = args.kernels
    start_jd = year_start_jd(args.start_year)
    end_jd = year_start_jd(args.end_year + 1)

    if args.command == "delta-t":
        if args.out is None:  # pragma: no cover - argparse already requires --out here
            parser.error("--out is required")
        # One extra year each side: samples sit at epoch years, which do not line up exactly
        # with the calendar years the catalogs cover.
        first, last = args.start_year - 1, args.end_year + 1
        write_delta_t_table(delta_t_table(first, last), args.out)
        print(f"wrote ΔT for {first}..{last} to {args.out}")  # noqa: T201
        return 0

    if args.command == "fetch-ephemeris":  # pragma: no cover - needs network access
        padding = EPHEMERIS_PADDING_DAYS
        for kernel in fetch_de441(kernels, start_jd - padding, end_jd + padding):
            print(f"wrote {kernel.path}")  # noqa: T201
        return 0

    paths = sorted(kernels.glob("*.bsp"))
    if not paths:
        print(f"No kernels in {kernels}; run fetch-ephemeris first", file=sys.stderr)  # noqa: T201
        return 1
    with Ephemeris(paths) as ephemeris:
        try:
            eclipses = find_lunar_eclipses(ephemeris, start_jd, end_jd)
        except ValueError as error:
            print(f"Kernels in {kernels} do not cover the range: {error}", file=sys.stderr)  # noqa: T201
            return 1
    if args.out is None:  # pragma: no cover - argparse already requires --out here
        parser.error("--out is required")
    index = write_lunar_catalog(eclipses, args.out, args.start_year, args.end_year)
    total = sum(chunk["count"] for chunk in index["chunks"])
    print(f"wrote {total} lunar eclipses in {len(index['chunks'])} files to {args.out}")  # noqa: T201
    return 0
