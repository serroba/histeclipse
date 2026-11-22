/**
 * The borders of past states as a feature (#380, #446, #909): Cliopatria's and
 * OpenHistoricalMap's, a century's file at a time, the first time the layer is on; which states
 * appeared or went since the year drawn before, said on the years' track and named on the map;
 * and what the states have at the place picked.
 */

import { standingKey } from './paintKey';
import { PRESENT_YEAR } from '../../time/present';
import { astronomicalYear, formatYear } from '../../time/year';
import { empiresLayer, type StateChange } from './empireLayer';
import { type BorderSource, type ViewState } from '../../state/viewState';
import { cliopatriaYear } from '../../state/layerCatalog';
import { changesText } from '../../ui/historyTrack';
import {
  labelPoint,
  stateChanges,
  stateChangesOnMap,
  type NamedPoint,
  territoriesIn,
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
import { feature, type FeatureContext, type FeatureInstance } from '../feature';
import { centuryFile } from './files';
import { statesFacts } from './here';

export { createBorderFiles, createStatesNote } from './files';

const NEEDS = ['stateBorders', 'yearsTrack', 'whyHere'] as const;
type EmpiresContext = FeatureContext<(typeof NEEDS)[number]>;

const words = (year: number): string => formatYear(astronomicalYear(year));

function mountEmpires(context: EmpiresContext): FeatureInstance {
  const { base, fetchJson } = context;
  const statesOnGlobe = context.globe.addLayer(empiresLayer);
  // What was drawn before, to tell what changed.
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
    context.yearsTrack.states(changesText(year, appeared, gone));
    // On the map, only a step's worth (a year, or up to the fastest trip's 80): after a jump
    // of centuries every name would light up.
    const step = Math.abs(year - before.year);
    return step === 0 || step > 100 ? [] : stateChangesOnMap(before.places, places);
  }

  // OpenHistoricalMap's borders load a century at a time, the first time the layer is on.
  let empiresShown: string | null = null;
  // Whether the borders are on, a load is on its way, or one failed and waits for Try again (#762).
  let bordersOn = false;
  let pending: string | null = null;
  let failed = false;
  const ohmCenturies = new Map<number, Promise<OhmCentury>>();
  let ohmIndex: Promise<OhmIndex> | null = null;
  const empireCenturyFor = (
    year: number,
  ): ReturnType<EmpiresContext['stateBorders']['centuryFor']> =>
    context.stateBorders.centuryFor(year);

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
    bordersOn = on;
    if (key === empiresShown || (on && failed)) return;
    empiresShown = key;
    if (!on) {
      statesOnGlobe.update(null);
      return;
    }
    if (ohmIndex === null) {
      const asked = loadOhmIndex(`${base}data/ohm/index.json`, fetchJson);
      asked.catch(() => {
        if (ohmIndex === asked) ohmIndex = null;
      });
      ohmIndex = asked;
    }
    pending = key;
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
        if (pending === key) pending = null;
        // The year or source may have moved on while the files loaded.
        if (empiresShown !== key) return;
        // The chip said "loading" only until the first states were drawn: say they are.
        const first = statesDrawn === null;
        statesDrawn = { year, territories: drawn };
        if (first) context.refresh();
        context.whyHere.again();
        const changes = noteStates(source, year, [
          ...drawn.map((territory) => ({ ...labelPoint(territory), name: territory.name })),
          ...(lines?.labels ?? []),
        ]);
        const paintKey = `${source}:${paints.cliopatria}|${paints.ohm}`;
        statesOnGlobe.update({ territories: drawn, ohm: lines, changes, paintKey });
      },
      (error: unknown) => {
        if (pending === key) pending = null;
        failed = true;
        context.notify(`Could not load the borders of past states: ${errorMessage(error)}`);
        context.refresh();
      },
    );
  }

  /** Try the borders again, as the reader asks from the chip. */
  function retry(): void {
    if (!failed) return;
    failed = false;
    empiresShown = null;
    context.refresh();
  }

  return {
    show,
    load() {
      if (!bordersOn) return null;
      if (failed) return { state: 'failed', retry };
      // Loading until the first states are drawn; later years' files need no word on the chip.
      return pending === null || statesDrawn !== null ? null : { state: 'loading' };
    },
    here(state) {
      if (state.location === null || state.ma !== null || !state.layers.has('empires')) return null;
      const year = state.time.date.year;
      const shownYear = cliopatriaYear(year, PRESENT_YEAR);
      return statesFacts({
        place: state.location,
        yearText: words(year),
        states: {
          source: state.borders,
          territories: statesDrawn?.year === year ? statesDrawn.territories : null,
          asOf: shownYear === year ? null : words(shownYear),
        },
      });
    },
  };
}

export const empiresFeature = feature({
  id: 'empires',
  needs: NEEDS,
  watches: (state) => [state.layers, state.ma, state.borders],
  mount: mountEmpires,
});
