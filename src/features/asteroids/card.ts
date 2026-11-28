/**
 * A small body's card (#372, #1329): what it is, its size and whose measure that is, its orbit,
 * and how well its place is known: within the years its orbit is fitted to JPL's, as closely as
 * the fit came; outside them, only roughly.
 */

import type { Asteroid, BodyGroup } from './orbits';
import { SOURCES, type Source } from '../../sources/registry';
import type { MarkerCardContent } from '../../ui/markerCard';

const KM_PER_AU = 149_597_870.7;
const DAYS_PER_YEAR = 365.25;
const J2000 = 2451545;

/** What each group is, as a card says it. */
const GROUP_SAID: Readonly<Record<BodyGroup, string>> = {
  'near-earth': 'Near-Earth asteroid: its orbit brings it within 1.3 AU of the Sun',
  'main-belt': 'Main-belt asteroid, between Mars and Jupiter',
  trojan: 'Jupiter Trojan: it shares Jupiter’s orbit, some 60° ahead of the planet or behind',
  centaur: 'Centaur, among the giant planets',
  'kuiper-belt': 'Kuiper belt, beyond Neptune',
  'scattered-disc': 'Scattered disc: beyond Neptune, on a long and tilted orbit',
  detached: 'Detached: even at its nearest to the Sun, far beyond Neptune',
};

/** A width as a card says it: metres under a kilometre, a decimal under ten. */
function across(km: number): string {
  if (km < 1) return `${String(Math.round(km * 1000))} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString('en-GB')} km`;
}

/** A distance from the Sun, AU: two decimals near, whole numbers far out. */
function au(km: number): string {
  const value = km / KM_PER_AU;
  return value < 10 ? value.toFixed(2) : value < 100 ? value.toFixed(1) : value.toFixed(0);
}

/** How long once round takes: a decimal under a century, whole years beyond. */
function years(count: number): string {
  return count < 100 ? count.toFixed(1) : Math.round(count).toLocaleString('en-GB');
}

/** The year a Julian Day falls in, near enough for naming a span of centuries. */
function yearOf(jdTT: number): number {
  return Math.round(2000 + (jdTT - J2000) / DAYS_PER_YEAR);
}

/** The source a body's size is from, if the registry knows it. */
function sizedBy(id: string): Source | null {
  return id in SOURCES ? SOURCES[id as keyof typeof SOURCES] : null;
}

export function asteroidCard(asteroid: Asteroid, jdTT: number): MarkerCardContent {
  const round = 360 / asteroid.longitude[1] / DAYS_PER_YEAR;
  const [from, to] = asteroid.fittedJdTT;
  const within = jdTT >= from && jdTT <= to;
  const nearest = asteroid.axisKm * (1 - asteroid.eccentricity);
  const farthest = asteroid.axisKm * (1 + asteroid.eccentricity);
  const size = sizedBy(asteroid.sized);
  const jpl = `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${asteroid.number}`;
  return {
    title: asteroid.name,
    facts: [
      [
        'What',
        asteroid.dwarfPlanet === true
          ? `Dwarf planet, one of the five the IAU names · ${GROUP_SAID[asteroid.group]}`
          : GROUP_SAID[asteroid.group],
      ],
      ['Across', across(asteroid.diameterKm)],
      [
        'Orbit',
        `${au(asteroid.axisKm)} AU from the Sun on average (${au(nearest)} to ${au(farthest)}), once round every ${years(round)} years`,
      ],
      ['Minor planet', `number ${asteroid.number}`],
      [
        'Where',
        within
          ? `Within ${asteroid.offDegrees.toFixed(1)}° of JPL’s place along its orbit, seen from the Sun`
          : `Roughly: its orbit is fitted to JPL’s from ${String(yearOf(from))} to ${String(yearOf(to))} and carried on; this far from those years, where it is along its orbit is not well known`,
      ],
    ],
    links: [
      { label: 'JPL Small-Body Database', href: jpl },
      ...(size === null || asteroid.sized === 'jplSbdb'
        ? []
        : [{ label: `Its size: ${size.name}`, href: size.url }]),
    ],
    note:
      asteroid.sized === 'jplSbdb'
        ? 'Size: JPL’s Small-Body Database; where it is: a mean orbit fitted to JPL Horizons.'
        : `Size: ${size?.name ?? 'its own source'}; where it is: a mean orbit fitted to JPL Horizons.`,
  };
}
