"""Command-line entry point: ``uv run histeclipse-pipeline --help``."""

import argparse
import sys
from pathlib import Path
from typing import TYPE_CHECKING

from histeclipse_pipeline.aadr import fetch_genomes
from histeclipse_pipeline.amoc import fetch_amoc
from histeclipse_pipeline.ar6_sealevel import fetch_ar6_sealevel
from histeclipse_pipeline.archaeoglobe import fetch_ways
from histeclipse_pipeline.asteroids import fetch_asteroids
from histeclipse_pipeline.atmosphere import fetch_atmosphere
from histeclipse_pipeline.carbon_budget import fetch_carbon_budget
from histeclipse_pipeline.catalog import write_lunar_catalog, write_solar_catalog
from histeclipse_pipeline.cenogrid import fetch_cenogrid
from histeclipse_pipeline.cesm import fetch_cesm
from histeclipse_pipeline.deep_air import fetch_deep_air
from histeclipse_pipeline.delta_t import delta_t_table, write_delta_t_table
from histeclipse_pipeline.dipole import fetch_dipole
from histeclipse_pipeline.dispersal import fetch_dispersal
from histeclipse_pipeline.empires import (
    fetch_cliopatria,
    merge_unchanged,
    parse_polities,
    write_empires,
)
from histeclipse_pipeline.ephemeris import Ephemeris, fetch_de441
from histeclipse_pipeline.eruptions import fetch_eruptions
from histeclipse_pipeline.fossils import fetch_fossils
from histeclipse_pipeline.holocene_temperature import fetch_holocene_temperature
from histeclipse_pipeline.iceoutlines import fetch_outlines
from histeclipse_pipeline.icesheets import fetch_icesheets
from histeclipse_pipeline.ics import fetch_chart
from histeclipse_pipeline.impacts import fetch_impacts
from histeclipse_pipeline.julian_day import Calendar, CalendarDate, julian_day
from histeclipse_pipeline.krapp import fetch_krapp
from histeclipse_pipeline.lunar import find_lunar_eclipses
from histeclipse_pipeline.lunisolar import babylonian_table, chinese_year_table, write_table
from histeclipse_pipeline.macrostrat import fetch_rocks
from histeclipse_pipeline.measured_warming import fetch_measured_warming
from histeclipse_pipeline.moon_orbits import fetch_moon_orbits
from histeclipse_pipeline.natural_forcing import fetch_natural_forcing
from histeclipse_pipeline.ohm import fetch_ohm
from histeclipse_pipeline.p3k14c import fetch_p3k14c
from histeclipse_pipeline.paleo_co2 import fetch_co2_archive
from histeclipse_pipeline.paleodem import fetch_paleodem
from histeclipse_pipeline.paleotemp import fetch_paleotemp
from histeclipse_pipeline.passage_vectors import (
    fetch_model,
    onnx_embedder,
    read_lock,
    write_passage_vectors,
    write_test_vectors,
)
from histeclipse_pipeline.periodo import fetch_periods
from histeclipse_pipeline.phanda import fetch_phanda
from histeclipse_pipeline.pictures import fetch_pictures
from histeclipse_pipeline.planet_keys import fetch_planet_keys
from histeclipse_pipeline.planet_maps import fetch_planet_maps
from histeclipse_pipeline.planet_names import fetch_planet_names
from histeclipse_pipeline.planets import (
    APPARENT,
    PLANET_APPARENT_DESCRIPTION,
    PLANET_APPARENT_SEED,
    PLANET_VECTOR_SEED,
    fetch_planet_vectors,
    write_planet_vectors,
)
from histeclipse_pipeline.polarity import fetch_polarity
from histeclipse_pipeline.radiocarbon import fetch_radiocarbon
from histeclipse_pipeline.saturn_rings import fetch_saturn_rings
from histeclipse_pipeline.seaice import fetch_seaice
from histeclipse_pipeline.sealevel import fetch_sealevel
from histeclipse_pipeline.sealevel_modern import fetch_budget, fetch_modern
from histeclipse_pipeline.shelf import fetch_shelf
from histeclipse_pipeline.sky import (
    constellations,
    fetch_sources,
    parse_bright_star_catalogue,
    sky_file,
    write_sky_file,
)
from histeclipse_pipeline.skycultures import fetch_skycultures
from histeclipse_pipeline.solar import find_solar_eclipses
from histeclipse_pipeline.solar_images import fetch_images
from histeclipse_pipeline.spacecraft import fetch_spacecraft
from histeclipse_pipeline.spacecraft_paths import fetch_spacecraft_paths
from histeclipse_pipeline.temperature_records import fetch_temperature_records
from histeclipse_pipeline.time_tree import fetch_time_trees
from histeclipse_pipeline.timezones import fetch_timezones
from histeclipse_pipeline.tree_of_life import fetch_tree_of_life
from histeclipse_pipeline.vectors import moon_vectors, sample_times, sun_vectors, write_vectors
from histeclipse_pipeline.volcanoes import fetch_volcanoes
from histeclipse_pipeline.warm_past import fetch_warm_past

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

MOON_VECTOR_SEED = 2027
MOON_VECTOR_DESCRIPTION = (
    "Geometric geocentric Moon from JPL DE441 (histeclipse-pipeline moon-vectors): ICRF "
    "(J2000 equator) position in km at TT Julian Days. Reference values for the web app's "
    "lunar ephemeris."
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
    seed: int | None = None
    # The data file whose "wikipedia" titles the pictures command looks up (or whose genera the
    # tree-of-life command places), and a word their pages' descriptions must have, if any.
    source: Path = Path()
    must_mention: str | None = None
    # The one map the planet-maps command makes, by its stem, if not all.
    only: str | None = None


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


def moon(args: Arguments) -> int:
    """Write Moon reference vectors for the web app's tests."""
    paths = sorted(args.kernels.glob("*.bsp"))
    if not paths:
        return _fail(f"No kernels in {args.kernels}; run fetch-ephemeris first")
    seed = MOON_VECTOR_SEED if args.seed is None else args.seed
    times = sample_times(args.start_year, args.end_year, args.count, seed)
    with Ephemeris(paths) as ephemeris:
        try:
            vectors = moon_vectors(ephemeris, times)
        except ValueError as error:
            return _fail(f"Kernels in {args.kernels} do not cover the range: {error}")
    write_vectors(vectors, args.out, MOON_VECTOR_DESCRIPTION)
    return _say(f"wrote {len(vectors)} Moon vectors to {args.out}")


def fetch_ephemeris(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Download the DE441 excerpts the other commands read."""
    padding = EPHEMERIS_PADDING_DAYS
    start_jd, end_jd = year_start_jd(args.start_year), year_start_jd(args.end_year + 1)
    for kernel in fetch_de441(args.kernels, start_jd - padding, end_jd + padding):
        _ = _say(f"wrote {kernel.path}")
    return 0


def sky(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Download the star catalogue and constellation figures and write ``sky.json``."""
    lines, names, figures = fetch_sources()
    stars = parse_bright_star_catalogue(lines)
    write_sky_file(sky_file(stars, constellations(names, figures, stars)), args.out)
    return _say(f"wrote {len(stars)} stars to {args.out}")


def empires(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Download Cliopatria and write simplified borders, one file per century."""
    polities = merge_unchanged(parse_polities(fetch_cliopatria()))
    count = write_empires(polities, args.out)
    return _say(f"wrote {len(polities)} polity rows in {count} century files to {args.out}")


def planet_vectors(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write Horizons (DE441) positions of the planets for the web app's tests."""
    seed = PLANET_VECTOR_SEED if args.seed is None else args.seed
    times = sample_times(args.start_year, args.end_year, args.count, seed)
    vectors = fetch_planet_vectors(times)
    write_planet_vectors(vectors, args.out)
    return _say(f"wrote {len(times)} positions of {len(vectors)} planets to {args.out}")


def planet_apparent_vectors(args: Arguments) -> int:  # pragma: no cover - needs network
    """Write DE441 planet directions with light time and aberration, for web tests."""
    seed = PLANET_APPARENT_SEED if args.seed is None else args.seed
    times = sample_times(args.start_year, args.end_year, args.count, seed)
    vectors = fetch_planet_vectors(times, corrections=APPARENT)
    write_planet_vectors(vectors, args.out, PLANET_APPARENT_DESCRIPTION)
    return _say(f"wrote {len(times)} apparent positions of {len(vectors)} planets")


def skycultures(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Copy Stellarium's sky cultures unchanged, and write the Hipparcos stars they use."""
    cultures, stars = fetch_skycultures(args.out)
    return _say(f"copied {cultures} sky cultures and wrote {stars} stars under {args.out}")


def ohm_borders(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Read OpenHistoricalMap's country borders and labels, one file per century."""
    borders, labels, files = fetch_ohm(args.out)
    return _say(f"wrote {borders} borders and {labels} labels in {files} century files")


def paleodem(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write Earth's elevation every 5 million years since 540 Ma as small images."""
    count = fetch_paleodem(args.out)
    return _say(f"wrote {count} elevation images to {args.out}")


def cesm(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write a second model's surface temperature every 10 Myr since 250 Ma (CESM)."""
    count = fetch_cesm(args.out)
    return _say(f"wrote {count} CESM temperature images to {args.out}")


def ics(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write the International Chronostratigraphic Chart's units (ICS, CC BY 4.0)."""
    count = fetch_chart(args.out)
    return _say(f"wrote {count} chart units to {args.out}")


def periods(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write named periods by country (PeriodO, CC0; Natural Earth)."""
    count = fetch_periods(args.out)
    return _say(f"wrote {count} named periods to {args.out}")


def rocks(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write the rocks at the surface and their ages (Macrostrat, CC BY 4.0)."""
    count = fetch_rocks(args.out)
    return _say(f"wrote {count} map units to {args.out}")


def fossils(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write fossil occurrences of four groups at their age's places (PBDB, CC BY 4.0)."""
    count = fetch_fossils(args.out)
    return _say(f"wrote {count} fossil occurrences to {args.out}")


def impacts(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write impact craters and deposits, and their places when they struck (Impact Earth)."""
    count = fetch_impacts(args.out)
    return _say(f"wrote {count} impact craters and deposits to {args.out}")


def volcanoes(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write Holocene volcanoes and their eruptions (Smithsonian GVP), and their summaries."""
    count = fetch_volcanoes(args.out)
    return _say(f"wrote {count} eruptions to {args.out}")


def timezones(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write each time zone's place (the tz database), for the globe's first view."""
    count = fetch_timezones(args.out)
    return _say(f"wrote {count} time zones to {args.out}")


def planet_maps(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write the bodies' maps from their missions, for the close-up view (public/textures)."""
    count = fetch_planet_maps(args.out, Path(".cache/planet-maps"), args.only)
    return _say(f"wrote {count} maps to {args.out}")


def moon_orbits(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Fit the moons' orbits to JPL Horizons (public/data), with reference positions."""
    report = fetch_moon_orbits(
        args.out, Path("../test-vectors/moons.json"), Path(".cache/moon-orbits")
    )
    return _say("\n".join([*report, f"wrote {len(report)} orbits to {args.out}"]))


def asteroids(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Fit the large asteroids' orbits to JPL Horizons (public/data), with reference positions."""
    report = fetch_asteroids(
        args.out, Path("../test-vectors/asteroids.json"), Path(".cache/asteroids")
    )
    return _say("\n".join([*report, f"wrote {len(report)} orbits to {args.out}"]))


def passage_vectors(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Embed the passages for search by meaning (public/data), with test vectors for the site.

    Then run Prettier on test-vectors/embedding.json, as on every file the repository keeps.
    """
    lock = read_lock(Path("../models.lock.json"))
    folder = fetch_model(lock, Path(".cache/models") / lock["name"])
    count = write_passage_vectors(
        Path("../public/data/passages.json"), args.out, onnx_embedder(folder), lock
    )
    write_test_vectors(folder, lock, Path("../test-vectors/embedding.json"))
    return _say(f"embedded {count} passages into {args.out}")


def spacecraft(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write every craft sent beyond Earth orbit, and those that never left (public/data)."""
    left, never = fetch_spacecraft(args.out, Path(".cache/spacecraft"))
    return _say(f"wrote {left} craft beyond Earth orbit and {never} that never left to {args.out}")


def spacecraft_paths(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write the paths JPL Horizons has for the craft beyond Earth orbit (public/data)."""
    count = fetch_spacecraft_paths(
        Path("../public/data/spacecraft.json"), args.out, Path(".cache/spacecraft-paths")
    )
    return _say(f"wrote the paths of {count} craft to {args.out}")


def saturn_rings(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write Saturn's rings' texture: Voyager's opacity, Cassini's colour (public/textures)."""
    width = fetch_saturn_rings(args.out, Path(".cache/saturn-rings"))
    return _say(f"wrote the rings, {width} pixels across, to {args.out}")


def planet_keys(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write the height views' colour keys, measured against altimetry (public/data)."""
    count = fetch_planet_keys(args.out, Path("../public/textures"), Path(".cache/planet-keys"))
    return _say(f"wrote {count} colour keys to {args.out}")


def planet_names(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write the IAU's names for the largest features of the rocky bodies (public/data)."""
    count = fetch_planet_names(args.out, Path(".cache/planet-names"))
    return _say(f"wrote {count} place names to {args.out}")


def polarity(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write every reversal of the last 83 Ma (GTS 2020, as PmagPy carries it)."""
    count = fetch_polarity(args.out)
    return _say(f"wrote {count} polarity chrons to {args.out}")


def radiocarbon(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write the radiocarbon calibration curves (IntCal20, SHCal20)."""
    count = fetch_radiocarbon(args.out)
    return _say(f"wrote {count} curve rows to {args.out}")


def p3k14c(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write archaeological radiocarbon dates, calibrated and counted by cell (p3k14c)."""
    count = fetch_p3k14c(args.source, args.out)
    return _say(f"calibrated {count} dates into {args.out}")


def natural_forcing(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write the Sun's irradiance (CMIP6, Steinhilber 2012) and volcanic sulfur (eVolv2k)."""
    counts = fetch_natural_forcing(args.out)
    written = ", ".join(f"{count} {name}" for name, count in counts.items())
    return _say(f"wrote {written} to {args.out}")


def eruptions(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write the Holocene's eruptions as the ice cores record them (HolVol)."""
    count = fetch_eruptions(args.out)
    return _say(f"wrote {count} eruptions to {args.out}")


def dipole(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write the dipole moment of the last 55,000 years (GGF100k)."""
    count = fetch_dipole(args.out)
    return _say(f"wrote {count} dipole moments to {args.out}")


def tree_of_life(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write the tree of life trimmed to what the site shows (Open Tree of Life, CC0)."""
    count = fetch_tree_of_life(args.source, args.out, Path(".cache/tree-of-life"))
    return _say(f"wrote {count} nodes of the tree of life to {args.out}")


def time_tree(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write each fossil group's genera through time and place (PBDB, CC BY 4.0)."""
    count = fetch_time_trees(args.out)
    return _say(f"wrote {count} genera's tracks to {args.out}")


def pictures(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write the lead picture, author and licence of each Wikipedia page a data file names."""
    count = fetch_pictures(args.source, args.out, args.must_mention)
    return _say(f"wrote {count} pictures to {args.out}")


def deep_air(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write CO2 and O2 over the last 540 million years (Foster 2017; Mills 2023)."""
    count = fetch_deep_air(args.out)
    return _say(f"wrote {count} CO2 estimates, the CO2 fit and the O2 estimate to {args.out}")


def carbon_budget(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write the Global Carbon Budget and each country's emissions and warming (CC BY 4.0)."""
    years, countries = fetch_carbon_budget(args.out)
    return _say(f"wrote {years} years of the budget and {countries} countries to {args.out}")


def co2_archive(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write CO2 estimates by method from the Paleo-CO2 Data Archive (CC BY 4.0)."""
    count, empty = fetch_co2_archive(args.out)
    skipped = f"; no estimates in {', '.join(empty)}" if empty else ""
    return _say(f"wrote {count} CO2 estimates to {args.out}{skipped}")


def cenogrid(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write the Cenozoic benthic δ18O and δ13C record (CENOGRID, CC BY 4.0), thinned."""
    count = fetch_cenogrid(args.out)
    return _say(f"wrote {count} CENOGRID points to {args.out}")


def phanda(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write Phanerozoic GMST by stage with its percentiles (PhanDA, Judd et al. 2024)."""
    count = fetch_phanda(args.out)
    return _say(f"wrote {count} PhanDA stages to {args.out}")


def icesheets(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write ice-sheet thickness every 2,500 years over the last 80,000 (PaleoMIST 1.0)."""
    count = fetch_icesheets(args.out)
    return _say(f"wrote {count} ice-sheet images to {args.out}")


def atmosphere(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write CO2 and methane over 800,000 years from Antarctic ice cores (NOAA)."""
    count = fetch_atmosphere(args.out)
    return _say(f"wrote {count} ice-core gas measurements to {args.out}")


def ways(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write how people lived by region over 10,000 years (ArchaeoGLOBE, CC0)."""
    count = fetch_ways(args.out)
    return _say(f"wrote the ways of life of {count} regions to {args.out}")


def genomes(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write dated ancient genomes by 2° cell (Allen Ancient DNA Resource)."""
    count = fetch_genomes(args.out)
    return _say(f"wrote {count} ancient genomes to {args.out}")


def dispersal(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write a dispersal model's arrival times (Timmermann & Friedrich 2016, CC BY-NC)."""
    count = fetch_dispersal(args.out)
    return _say(f"wrote {count} arrival-time maps to {args.out}")


def iceoutlines(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write ice-sheet outlines for 18 Quaternary time slices (Batchelor et al. 2019)."""
    count = fetch_outlines(args.out)
    return _say(f"wrote outlines from {count} shapefiles to {args.out}")


def shelf(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write today's coasts and shelves, for coastlines at past sea levels."""
    size = fetch_shelf(args.out)
    return _say(f"wrote a {size}-byte shelf image to {args.out}")


def seaice(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write sea ice today (NSIDC) and at the Last Glacial Maximum (three PMIP4 models)."""
    count = fetch_seaice(args.out)
    return _say(f"wrote sea ice from {count} sources to {args.out}")


def sealevel(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write four reconstructions of global sea level, side by side."""
    points = fetch_sealevel(args.out)
    return _say(f"wrote {points} sea-level points to {args.out}")


def sealevel_modern(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write measured sea level since 1900 and the altimetry trend map (AR6, NOAA)."""
    points = fetch_modern(args.out)
    return _say(f"wrote {points} measured sea-level points and the trend map to {args.out}")


def sealevel_budget(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write Frederikse et al.'s sea-level budget, for checking only: not for public/."""
    years = fetch_budget(args.out)
    return _say(f"wrote {years} years of the sea-level budget to {args.out}")


def holocene_temperature(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write temperature from 800,000 years ago to today, from four records side by side."""
    points = fetch_holocene_temperature(args.out)
    return _say(f"wrote {points} temperature points to {args.out}")


def paleotemp(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write surface temperature maps for 100 steps since 540 Ma as small images."""
    count = fetch_paleotemp(args.out)
    return _say(f"wrote {count} temperature images to {args.out}")


def krapp(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write land temperature maps for the last 800,000 years as small images."""
    count = fetch_krapp(args.out)
    return _say(f"wrote {count} ice-age temperature images to {args.out}")


def temperature_records(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write global mean temperature since 1850 from five records side by side."""
    points = fetch_temperature_records(args.out)
    return _say(f"wrote {points} temperature-record points to {args.out}")


def amoc(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write the AMOC as measured (RAPID) and as reconstructed, each source apart."""
    points = fetch_amoc(args.out)
    return _say(f"wrote {points} AMOC points to {args.out}")


def measured_warming(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write measured land warming since 1850 (Berkeley Earth) as small images."""
    count = fetch_measured_warming(args.out)
    return _say(f"wrote {count} measured-warming images to {args.out}")


def ar6_sealevel(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write sea level projected to 2150 by IPCC AR6, global curves and 1° maps."""
    count = fetch_ar6_sealevel(args.out)
    return _say(f"wrote AR6 sea-level curves and {count} maps to {args.out}")


def warm_past(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Write temperature change maps of the Last Interglacial and mid-Pliocene."""
    count = fetch_warm_past(args.out)
    return _say(f"wrote {count} warm-past temperature-change images to {args.out}")


#: Babylonian months from Nabonassar (747 BCE) to 100 CE; Chinese years from 720 BCE to 2100 CE,
#: with a margin each side for the months that straddle the ends.
BABYLON_YEARS = (-749, 101)
CHINESE_YEARS = (-720, 2100)


def calendars(args: Arguments) -> int:  # pragma: no cover - needs the full DE441 excerpts
    """Write the Babylonian and Chinese month tables computed from DE441."""
    paths = sorted(args.kernels.glob("*.bsp"))
    if not paths:
        return _fail(f"No kernels in {args.kernels}; run fetch-ephemeris first")
    with Ephemeris(paths) as ephemeris:
        babylon = babylonian_table(
            ephemeris, year_start_jd(BABYLON_YEARS[0]), year_start_jd(BABYLON_YEARS[1])
        )
        first, last = CHINESE_YEARS
        # From the November before the first year to the March after the last.
        chinese = chinese_year_table(
            ephemeris, year_start_jd(first) - 61, year_start_jd(last + 1) + 59, first
        )
    write_table(babylon, args.out / "babylon.json")
    write_table(chinese, args.out / "chinese.json")
    months, years = len(babylon["lengths"]) + 1, len(chinese["years"])
    return _say(f"wrote {months} Babylonian months and {years} Chinese years to {args.out}")


def sun_images(args: Arguments) -> int:  # pragma: no cover - needs network access
    """Render the SDO layers into ``public/textures/sun`` and write their manifest."""
    result = fetch_images(args.out, args.kernels.parent / "sdo")
    return _say(f"wrote {len(result['layers'])} layers of the Sun to {args.out}")


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
    "moon-vectors": (moon, "write Moon reference values for web tests", "output JSON file"),
    "sky": (sky, "write stars and constellation figures for the sky view", "output JSON file"),
    "empires": (
        empires,
        "write simplified borders of past states, one file per century",
        "output directory",
    ),
    "planet-vectors": (
        planet_vectors,
        "write DE441 planet positions from JPL Horizons for web tests",
        "output JSON file",
    ),
    "planet-apparent-vectors": (
        planet_apparent_vectors,
        "write DE441 planet directions with light time and aberration for web tests",
        "output JSON file",
    ),
    "skycultures": (
        skycultures,
        "copy other cultures' constellations and the stars they use",
        "the web app's public directory",
    ),
    "ohm-borders": (
        ohm_borders,
        "write OpenHistoricalMap's country borders, one file per century",
        "output directory",
    ),
    "paleodem": (
        paleodem,
        "write Earth's elevation for each 5 Myr step since 540 Ma (PALEOMAP PaleoDEMs)",
        "output directory",
    ),
    "cesm": (
        cesm,
        "write a second model's surface temperature every 10 Myr since 250 Ma (CESM)",
        "output directory",
    ),
    "ics": (
        ics,
        "write the International Chronostratigraphic Chart's units (ICS, CC BY 4.0)",
        "output JSON file",
    ),
    "periods": (
        periods,
        "write named periods by country (PeriodO, CC0; Natural Earth)",
        "output JSON file",
    ),
    "rocks": (
        rocks,
        "write the rocks at the surface and their ages (Macrostrat, CC BY 4.0)",
        "output JSON file",
    ),
    "fossils": (
        fossils,
        "write fossil occurrences of four groups at their age's places (PBDB, CC BY 4.0)",
        "output JSON file",
    ),
    "impacts": (
        impacts,
        "write impact craters and deposits, and their places when they struck (Impact Earth)",
        "output JSON file",
    ),
    "timezones": (
        timezones,
        "write each time zone's place, to open the globe over the reader's region",
        "output file",
    ),
    "volcanoes": (
        volcanoes,
        "write Holocene volcanoes and their eruptions (Smithsonian GVP), and their summaries",
        "output JSON file",
    ),
    "planet-maps": (
        planet_maps,
        "write the bodies' maps from their missions (MESSENGER, Viking, Cassini, BMNG, LRO)",
        "output folder (public/textures)",
    ),
    "moon-orbits": (
        moon_orbits,
        "fit the orbits of the moons of Mars, Jupiter and Saturn to JPL Horizons",
        "output JSON file (public/data/moon-orbits.json)",
    ),
    "asteroids": (
        asteroids,
        "fit the orbits of the main belt's asteroids 100 km across or more to JPL Horizons",
        "output JSON file (public/data/asteroids.json)",
    ),
    "passage-vectors": (
        passage_vectors,
        "embed the site's passages for search by meaning (bge-small-en-v1.5)",
        "output binary file (public/data/passage-vectors.bin)",
    ),
    "spacecraft": (
        spacecraft,
        "write every craft sent beyond Earth orbit (GCAT, NSSDCA's chronology)",
        "output JSON file (public/data/spacecraft.json)",
    ),
    "spacecraft-paths": (
        spacecraft_paths,
        "write the paths JPL Horizons has for the craft beyond Earth orbit",
        "output JSON file (public/data/spacecraft-paths.json)",
    ),
    "saturn-rings": (
        saturn_rings,
        "write Saturn's rings' texture: Voyager's optical depth, Cassini's colour",
        "output PNG file (public/textures/planets/saturn-rings.png)",
    ),
    "planet-keys": (
        planet_keys,
        "write the height views' colour keys, measured against MOLA and LOLA heights",
        "output JSON file (public/data/planet-keys.json)",
    ),
    "planet-names": (
        planet_names,
        "write the IAU's names for the largest features of Mercury, Venus, the Moon and Mars",
        "output JSON file (public/data/planet-names.json)",
    ),
    "polarity": (
        polarity,
        "write the geomagnetic polarity time scale (GTS 2020, via PmagPy)",
        "output JSON file",
    ),
    "radiocarbon": (
        radiocarbon,
        "write the radiocarbon calibration curves (IntCal20, SHCal20)",
        "output JSON file",
    ),
    "p3k14c": (
        p3k14c,
        "write archaeological radiocarbon dates, calibrated and counted by cell (p3k14c)",
        "output folder (public/data/radiocarbon-dates)",
    ),
    "natural-forcing": (
        natural_forcing,
        "write solar irradiance (CMIP6, Steinhilber 2012) and volcanic sulfur (eVolv2k v4)",
        "output folder (public/data/natural-forcing)",
    ),
    "eruptions": (
        eruptions,
        "write the Holocene's eruptions as the ice cores record them (HolVol)",
        "output JSON file",
    ),
    "dipole": (
        dipole,
        "write the dipole moment of the last 55,000 years (GGF100k)",
        "output JSON file",
    ),
    "tree-of-life": (
        tree_of_life,
        "write the tree of life trimmed to what the site shows (Open Tree of Life)",
        "output JSON file",
    ),
    "time-tree": (
        time_tree,
        "write each fossil group's genera through time and place (PBDB, CC BY 4.0)",
        "output directory",
    ),
    "pictures": (
        pictures,
        "write the lead picture, author and licence of each Wikipedia page a data file names",
        "output JSON file",
    ),
    "deep-air": (
        deep_air,
        "write CO2 and O2 over the last 540 million years (Foster 2017; Mills 2023)",
        "output JSON file",
    ),
    "carbon-budget": (
        carbon_budget,
        "write the Global Carbon Budget and each country's emissions and warming (CC BY 4.0)",
        "output directory",
    ),
    "co2-archive": (
        co2_archive,
        "write CO2 estimates by method from the Paleo-CO2 Data Archive (CC BY 4.0)",
        "output JSON file",
    ),
    "cenogrid": (
        cenogrid,
        "write the Cenozoic benthic isotope record, thinned (CENOGRID, CC BY 4.0)",
        "output JSON file (public/data/cenogrid/index.json)",
    ),
    "phanda": (
        phanda,
        "write Phanerozoic GMST by stage with its percentiles (PhanDA, Judd et al. 2024)",
        "output JSON file (public/data/phanda/index.json)",
    ),
    "icesheets": (
        icesheets,
        "write ice-sheet thickness every 2,500 years since 80 ka (PaleoMIST 1.0)",
        "output directory",
    ),
    "atmosphere": (
        atmosphere,
        "write CO2 and methane over 800,000 years from Antarctic ice cores (NOAA)",
        "output JSON file",
    ),
    "ways": (
        ways,
        "write how people lived by region over 10,000 years (ArchaeoGLOBE, CC0)",
        "output JSON file",
    ),
    "genomes": (
        genomes,
        "write dated ancient genomes by 2° cell (Allen Ancient DNA Resource)",
        "output JSON file",
    ),
    "dispersal": (
        dispersal,
        "write a dispersal model's arrival times (Timmermann & Friedrich 2016, CC BY-NC)",
        "output directory",
    ),
    "iceoutlines": (
        iceoutlines,
        "write ice-sheet outlines for 18 Quaternary time slices (Batchelor et al. 2019)",
        "output JSON file",
    ),
    "shelf": (
        shelf,
        "write today's coasts and shelves (ETOPO1) for coastlines at past sea levels",
        "output directory",
    ),
    "seaice": (
        seaice,
        "write sea ice today (NSIDC) and at the Last Glacial Maximum (PMIP4 models)",
        "output directory",
    ),
    "sealevel": (
        sealevel,
        "write global sea level through time from four reconstructions",
        "output directory",
    ),
    "sealevel-modern": (
        sealevel_modern,
        "write measured sea level since 1900 and its trend map (IPCC AR6, NOAA LSA)",
        "output directory",
    ),
    "sealevel-budget": (
        sealevel_budget,
        "write Frederikse et al. 2020's budget (all rights reserved: keep it out of public/)",
        "output JSON file",
    ),
    "holocene-temperature": (
        holocene_temperature,
        "write temperature from 800 ka to today (EPICA, LGMR, PAGES 2k, HadCRUT5)",
        "output JSON file",
    ),
    "paleotemp": (
        paleotemp,
        "write surface temperature maps for 100 steps since 540 Ma (Scotese 2022)",
        "output directory",
    ),
    "krapp": (
        krapp,
        "write land temperature maps for the last 800,000 years (Krapp et al. 2021)",
        "output directory",
    ),
    "temperature-records": (
        temperature_records,
        "write global temperature since 1850 (GISTEMP, NOAAGlobalTemp, ERA5, HadCRUT5, Berkeley)",
        "output directory",
    ),
    "amoc": (
        amoc,
        "write the AMOC measured at 26.5°N (RAPID) beside reconstructions that disagree",
        "output directory",
    ),
    "measured-warming": (
        measured_warming,
        "write measured land warming since 1850 against 1850-1900 (Berkeley Earth)",
        "output directory",
    ),
    "ar6-sealevel": (
        ar6_sealevel,
        "write sea level projected to 2150 by SSP (IPCC AR6, Garner et al. 2021)",
        "output directory",
    ),
    "warm-past": (
        warm_past,
        "write temperature change at the Last Interglacial and mid-Pliocene (PMIP4, PlioMIP2)",
        "output directory (public/data/warmpast)",
    ),
    "calendars": (
        calendars,
        "write Babylonian first-crescent months and Chinese months computed from DE441",
        "output directory",
    ),
    "sun-images": (
        sun_images,
        "download SDO images of the Sun for the space view",
        "the web app's public directory",
    ),
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
        if name == "planet-maps":
            _ = command.add_argument(
                "--only",
                default=None,
                help="make only the map with this stem (planets/mars-height)",
            )
        if name == "p3k14c":
            _ = command.add_argument(
                "--source", type=Path, required=True, help="the site's radiocarbon curves file"
            )
        if name == "tree-of-life":
            _ = command.add_argument(
                "--source", type=Path, required=True, help="the fossils file naming genera"
            )
        if name == "pictures":
            _ = command.add_argument(
                "--source", type=Path, required=True, help="data file naming Wikipedia titles"
            )
            _ = command.add_argument(
                "--must-mention",
                default=None,
                help="a word each page's description must have; pages without it are skipped",
            )
        if name in {"sun-vectors", "moon-vectors", "planet-vectors", "planet-apparent-vectors"}:
            _ = command.add_argument("--count", type=int, default=SUN_VECTOR_COUNT)
            _ = command.add_argument(
                "--seed", type=int, default=None, help="sampling seed (an independent check set)"
            )

    args = parser.parse_args(argv, namespace=Arguments())
    handler = COMMANDS[args.command][0]
    return handler(args)


def _say(message: str) -> int:
    print(message)  # noqa: T201
    return 0


def _fail(message: str) -> int:
    print(message, file=sys.stderr)  # noqa: T201
    return 1
