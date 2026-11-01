/**
 * Eclipses seen from a past state's territory: for the eclipses of one year, and the nearest
 * year before or after with one, so the year bar can step through "the Babylonian eclipses".
 *
 * The territory is the state's in the year of each eclipse, so it grows and shrinks with it.
 */

import type { Territory } from '../data/empires';
import type { LunarEclipse } from '../data/lunarCatalog';
import type { SolarEclipse } from '../data/solarCatalog';
import { isSolar } from './describe';
import { lunarSeenIn, regionOf, solarSeenIn, type Region, type SeenIn } from './seenIn';

type Eclipse = LunarEclipse | SolarEclipse;

/** How far the search for the next eclipse seen from a state goes, in years. */
export const SEARCH_YEARS = 200;

export interface EmpireEclipseSources {
  /** The state's territory in an astronomical year, or null if it is not on the map then. */
  territory(name: string, year: number): Promise<Territory | null>;
  /** The eclipses of an astronomical year, or null outside the catalogs. */
  eclipses(year: number): Promise<readonly Eclipse[] | null>;
  /** ΔT's one-sigma uncertainty for an eclipse, seconds. */
  uncertainty(eclipse: Eclipse): number;
}

export interface Found {
  readonly year: number;
  readonly eclipse: Eclipse;
  readonly seen: SeenIn;
}

export interface EmpireEclipses {
  /** How each eclipse was seen from the state in `year`; null if the state is not on the map. */
  seenInYear(
    name: string,
    year: number,
    eclipses: readonly Eclipse[],
  ): Promise<ReadonlyMap<Eclipse, SeenIn> | null>;
  /**
   * The first eclipse seen (or maybe seen) from the state, in the years after (`+1`) or before
   * (`−1`) `year`, looking up to `SEARCH_YEARS` away. Null if there is none in that span.
   */
  nearest(name: string, year: number, direction: 1 | -1): Promise<Found | null>;
}

export function createEmpireEclipses(sources: EmpireEclipseSources): EmpireEclipses {
  // Regions take a few milliseconds to prepare; a state's territory is the same for years.
  const regions = new Map<Territory, Region>();
  let lastName: string | null = null;

  async function regionIn(name: string, year: number): Promise<Region | null> {
    if (name !== lastName) {
      regions.clear();
      lastName = name;
    }
    const territory = await sources.territory(name, year);
    if (territory === null) return null;
    let region = regions.get(territory);
    if (region === undefined) {
      region = regionOf(territory);
      regions.set(territory, region);
    }
    return region;
  }

  function seen(eclipse: Eclipse, region: Region): SeenIn {
    const uncertainty = sources.uncertainty(eclipse);
    return isSolar(eclipse)
      ? solarSeenIn(eclipse, region, uncertainty)
      : lunarSeenIn(eclipse, region, uncertainty);
  }

  return {
    async seenInYear(name, year, eclipses) {
      const region = await regionIn(name, year);
      if (region === null) return null;
      return new Map(eclipses.map((eclipse) => [eclipse, seen(eclipse, region)]));
    },

    async nearest(name, year, direction) {
      for (let step = 1; step <= SEARCH_YEARS; step += 1) {
        const each = year + direction * step;
        const eclipses = await sources.eclipses(each);
        if (eclipses === null) return null;
        const region = await regionIn(name, each);
        if (region === null || eclipses.length === 0) continue;
        const ordered = direction === 1 ? eclipses : [...eclipses].reverse();
        for (const eclipse of ordered) {
          const result = seen(eclipse, region);
          if (result.verdict !== 'not') return { year: each, eclipse, seen: result };
        }
      }
      return null;
    },
  };
}
