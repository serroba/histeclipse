/**
 * The borders of past states as a part of the page (#446): Cliopatria's and OpenHistoricalMap's,
 * a century's file at a time, the first time the layer is on; which states appeared or went
 * since the year drawn before, said on the years' track and named on the map; and a state's
 * territory, for the eclipses seen within it.
 */

import { standingKey } from './paintKey';
import type { Globe } from '../../globe/globe';
import type { PartContext } from '../part';
import { PRESENT_YEAR } from '../../time/present';
import { empiresLayer, type StateChange } from './empireLayer';
import { type BorderSource, type ViewState } from '../../state/viewState';
import { cliopatriaYear } from '../../state/layerCatalog';
import { changesText } from '../../ui/historyTrack';
import {
  centuryFor,
  labelPoint,
  loadEmpireCentury,
  loadEmpireIndex,
  stateChanges,
  stateChangesOnMap,
  type NamedPoint,
  territoriesIn,
  type EmpireCentury,
  type EmpireIndex,
  type Territory,
} from '../../data/empires';
import {
  loadOhmCentury,
  loadOhmIndex,
  ohmIn,
  type OhmCentury,
  type OhmIndex,
} from '../../data/ohmBorders';
import { errorMessage } from '../../util/errors';

/** What the borders ask of the rest of the page. */
export interface EmpiresContext extends PartContext {
  readonly globe: Pick<Globe, 'addLayer'>;
  /** What changed was noted: the years' track says it. */
  noted(): void;
  /** New borders were drawn: "Why here?" may say more. */
  drawn(): void;
}

export interface EmpiresPart {
  /** The borders for the year shown, by the source picked, in historical time. */
  readonly show: (state: ViewState) => void;
  /** What the years' track last said of the states: nothing until they change. */
  readonly said: () => string;
  /** The states last drawn, for "Why here?" to read back. */
  readonly drawn: () => {
    readonly year: number;
    readonly territories: readonly Territory[];
  } | null;
  /** Cliopatria's file for the century of `year`, or null if there is none. */
  readonly centuryFor: (year: number) => Promise<EmpireCentury | null>;
  /** A state's territory in a year, its region prepared once while its borders stay the same. */
  readonly territoryOf: (name: string, shown: number) => Promise<Territory | null>;
}

export function mountEmpires(context: EmpiresContext): EmpiresPart {
  const { base, fetchJson } = context;
  const statesOnGlobe = context.globe.addLayer(empiresLayer);
  // What the track last said of the states (nothing until they change), and what was drawn
  // then, to tell what changed.
  let statesSaid = '';
  let statesBefore: {
    readonly source: BorderSource;
    readonly year: number;
    readonly places: readonly NamedPoint[];
  } | null = null;
  /**
   * Note which states appeared or went since the year drawn before, if it was near; and give
   * those to name on the map, if it was nearer still.
   */
  function noteStates(
    source: BorderSource,
    year: number,
    places: readonly NamedPoint[],
  ): readonly StateChange[] {
    const before = statesBefore;
    statesBefore = { source, year, places };
    // Far apart, or by another source, a list of what differs says little about what happened.
    if (before?.source !== source || Math.abs(year - before.year) > 500) {
      return [];
    }
    const { appeared, gone } = stateChanges(
      before.places.map(({ name }) => name),
      places.map(({ name }) => name),
    );
    const said = changesText(year, appeared, gone);
    if (said !== null) statesSaid = said;
    context.noted();
    // On the map, only a step's worth (a year, or up to the fastest trip's 80): after a jump
    // of centuries every name would light up.
    const step = Math.abs(year - before.year);
    return step === 0 || step > 100 ? [] : stateChangesOnMap(before.places, places);
  }

  // Borders of past states load a century at a time, the first time the layer is on.
  let empireIndex: Promise<EmpireIndex> | null = null;
  const empireCenturies = new Map<number, Promise<EmpireCentury>>();
  let empiresShown: string | null = null;
  const ohmCenturies = new Map<number, Promise<OhmCentury>>();
  let ohmIndex: Promise<OhmIndex> | null = null;

  /** One century file, loaded once and kept; a failed load is retried next time. */
  function centuryFile<T>(
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

  /** Cliopatria's file for the century of `year`, or null if there is none. */
  function empireCenturyFor(year: number): Promise<EmpireCentury | null> {
    empireIndex ??= loadEmpireIndex(`${base}data/empires/index.json`, fetchJson);
    return empireIndex.then((index) => {
      const century = centuryFor(index, cliopatriaYear(year, PRESENT_YEAR));
      if (century === null) return null;
      return centuryFile(empireCenturies, century, () =>
        loadEmpireCentury(`${base}data/empires/${String(century)}.json`, fetchJson),
      );
    });
  }

  // A state's territory, kept while its borders stay the same so its region is prepared once.
  const territories = new WeakMap<object, Territory>();
  async function territoryOf(name: string, shown: number): Promise<Territory | null> {
    const year = cliopatriaYear(shown, PRESENT_YEAR);
    const file = await empireCenturyFor(year);
    if (file === null) return null;
    const polities = file.polities.filter(
      (polity) => polity.name === name && polity.from <= year && year <= polity.to,
    );
    const first = polities[0];
    if (first === undefined) return null;
    let territory = territories.get(first);
    if (territory === undefined) {
      const parts = territoriesIn({ ...file, polities }, year);
      territory = { name, wikipedia: first.wikipedia, rings: parts.flatMap(({ rings }) => rings) };
      territories.set(first, territory);
    }
    return territory;
  }

  // The states last drawn, for "Why here?" to read back.
  let statesDrawn: { readonly year: number; readonly territories: readonly Territory[] } | null =
    null;

  /** The borders of past states for the year shown, by the source picked, in historical time. */
  function show(state: ViewState): void {
    // Past states belong to historical time, not deep time.
    const on = state.layers.has('empires') && state.ma === null;
    const source = state.borders;
    const year = state.time.date.year;
    const key = on ? `${source}:${String(year)}` : null;
    if (key === empiresShown) return;
    empiresShown = key;
    if (!on) {
      statesOnGlobe.update(null);
      return;
    }
    ohmIndex ??= loadOhmIndex(`${base}data/ohm/index.json`, fetchJson);
    // What the map will show, from each source's file: the layer repaints only when it changes.
    const paints = { cliopatria: '', ohm: '' };
    const territories =
      source === 'ohm'
        ? Promise.resolve([])
        : empireCenturyFor(year).then((file) => {
            const at = cliopatriaYear(year, PRESENT_YEAR);
            paints.cliopatria = standingKey(file, file?.polities ?? [], at);
            return file === null ? [] : territoriesIn(file, at);
          });
    const ohm =
      source === 'cliopatria'
        ? Promise.resolve(null)
        : ohmIndex.then(async (index) => {
            const century = Math.floor(year / 100) * 100;
            if (!index.centuries.includes(century)) return { borders: [], labels: [] };
            const file = await centuryFile(ohmCenturies, century, () =>
              loadOhmCentury(`${base}data/ohm/${String(century)}.json`, fetchJson),
            );
            paints.ohm = standingKey(file, file.borders, year);
            return ohmIn(file, year);
          });
    Promise.all([territories, ohm]).then(
      ([drawn, lines]) => {
        // The year or source may have moved on while the files loaded.
        if (empiresShown !== key) return;
        statesDrawn = { year, territories: drawn };
        context.drawn();
        const changes = noteStates(source, year, [
          ...drawn.map((territory) => ({ ...labelPoint(territory), name: territory.name })),
          ...(lines?.labels ?? []),
        ]);
        const paintKey = `${source}:${paints.cliopatria}|${paints.ohm}`;
        statesOnGlobe.update({ territories: drawn, ohm: lines, changes, paintKey });
      },
      (error: unknown) => {
        empiresShown = null;
        context.notify(`Could not load the borders of past states: ${errorMessage(error)}`);
      },
    );
  }

  return {
    show,
    said: () => statesSaid,
    drawn: () => statesDrawn,
    centuryFor: empireCenturyFor,
    territoryOf,
  };
}
