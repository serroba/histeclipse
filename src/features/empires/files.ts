/**
 * Cliopatria's border files (#446): a century's file at a time, loaded once and kept, and a
 * state's territory in a year. Made once for the page: the layer draws from it, and the eclipses
 * read a state's territory from it.
 */

import {
  centuryFor,
  loadEmpireCentury,
  loadEmpireIndex,
  territoriesIn,
  type EmpireCentury,
  type EmpireIndex,
  type Territory,
} from '../../data/empires';
import { cliopatriaYear } from '../../state/layerCatalog';
import { PRESENT_YEAR } from '../../time/present';
import type { Fetch } from '../../util/fetchJson';

export interface BorderFiles {
  /** Cliopatria's file for the century of `year`, or null if there is none. */
  centuryFor(year: number): Promise<EmpireCentury | null>;
  /** A state's territory in a year, its region prepared once while its borders stay the same. */
  territoryOf(name: string, shown: number): Promise<Territory | null>;
}

/** One century file, loaded once and kept; a failed load is retried next time. */
export function centuryFile<T>(
  cache: Map<number, Promise<T>>,
  century: number,
  load: () => Promise<T>,
): Promise<T> {
  let file = cache.get(century);
  if (file === undefined) {
    file = load();
    file.catch(() => cache.delete(century));
    cache.set(century, file);
  }
  return file;
}

export function createBorderFiles(base: string, fetchJson: Fetch): BorderFiles {
  let index: Promise<EmpireIndex> | null = null;
  const centuries = new Map<number, Promise<EmpireCentury>>();

  function fileFor(year: number): Promise<EmpireCentury | null> {
    if (index === null) {
      const asked = loadEmpireIndex(`${base}data/empires/index.json`, fetchJson);
      // A failed index is asked for again next time, not kept (#762).
      asked.catch(() => {
        if (index === asked) index = null;
      });
      index = asked;
    }
    return index.then((loaded) => {
      const century = centuryFor(loaded, cliopatriaYear(year, PRESENT_YEAR));
      if (century === null) return null;
      return centuryFile(centuries, century, () =>
        loadEmpireCentury(`${base}data/empires/${String(century)}.json`, fetchJson),
      );
    });
  }

  // A state's territory, kept while its borders stay the same so its region is prepared once.
  const territories = new WeakMap<object, Territory>();
  return {
    centuryFor: fileFor,
    async territoryOf(name, shown) {
      const year = cliopatriaYear(shown, PRESENT_YEAR);
      const file = await fileFor(year);
      if (file === null) return null;
      const polities = file.polities.filter(
        (polity) => polity.name === name && polity.from <= year && year <= polity.to,
      );
      const first = polities[0];
      if (first === undefined) return null;
      let territory = territories.get(first);
      if (territory === undefined) {
        const parts = territoriesIn({ ...file, polities }, year);
        territory = {
          name,
          wikipedia: first.wikipedia,
          rings: parts.flatMap(({ rings }) => rings),
        };
        territories.set(first, territory);
      }
      return territory;
    },
  };
}

/** What the years' track says of the states that came or went: kept until they change again. */
export interface StatesNote {
  /** What was last said: nothing until the states change. */
  said(): string;
  /** The states were drawn again: what to say of the change, or null to keep what was said. */
  states(said: string | null): void;
}

/** The note, telling `noted` each time the states are drawn so the track says it. */
export function createStatesNote(noted: () => void): StatesNote {
  let last = '';
  return {
    said: () => last,
    states(said) {
      if (said !== null) last = said;
      noted();
    },
  };
}
