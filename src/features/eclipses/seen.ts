/**
 * Which eclipses of the year shown could be seen from a past state picked in the bar (#447), and
 * the step to the previous or next one seen from it, this year first, then further.
 */

import type { PartContext } from '../part';
import type { EmpireCentury, Territory } from '../../data/empires';
import { barYear, westernYearsOf } from './years';
import { greatestEclipseUT, yearOf } from '../../data/catalog';
import type { LunarCatalog } from '../../data/lunarCatalog';
import type { SolarCatalog } from '../../data/solarCatalog';
import { momentJulianDay, type ViewState } from '../../state/viewState';
import type { DeltaT } from '../../time/deltaT';
import { astronomicalYear } from '../../time/year';
import { cliopatriaYear } from '../../state/layerCatalog';
import { territoriesIn } from '../../data/empires';
import { createEmpireEclipses, SEARCH_YEARS } from '../../eclipses/empireEclipses';
import { PRESENT_YEAR } from '../../time/present';
import { type Eclipse, type SeenView, type YearEclipses } from '../../ui/timeline';
import { errorMessage } from '../../util/errors';

/** What working out the eclipses seen needs from the rest of the page. */
export interface SeenContext extends Pick<PartContext, 'store' | 'notify'> {
  readonly catalogs: () => { readonly lunar: LunarCatalog; readonly solar: SolarCatalog };
  readonly deltaT: () => DeltaT;
  readonly territoryOf: (name: string, shown: number) => Promise<Territory | null>;
  readonly centuryFor: (year: number) => Promise<EmpireCentury | null>;
  /** The year's eclipses, as listed. */
  readonly listing: () => YearEclipses;
  readonly selected: (state: ViewState) => Eclipse | undefined;
  /** Show the selection again: what was seen has changed. */
  readonly render: (state: ViewState) => void;
  /** Pick an eclipse, turning the globe to it. */
  readonly goTo: (eclipse: Eclipse) => void;
}

export interface Seen {
  /** Whether the bar shows its "seen from" picker. */
  readonly shown: (state: ViewState) => boolean;
  /** Bring the picker and marks up to date with the state and the year. */
  readonly refresh: (state: ViewState) => void;
  readonly step: (direction: 1 | -1) => void;
  readonly view: () => SeenView;
  readonly options: () => readonly string[];
}

export function createSeen(context: SeenContext): Seen {
  const { store } = context;
  // Which of those eclipses could be seen from a past state picked in the bar.
  let seenView: SeenView = { status: 'off' };
  let seenName: string | null = null;
  let seenListing: YearEclipses | null = null;
  let seenOptions: readonly string[] = [];
  let seenOptionsYear: number | null = null;

  const empireEclipses = createEmpireEclipses({
    territory: (name, shown) => context.territoryOf(name, shown),
    async eclipses(year) {
      const each = astronomicalYear(year);
      const { lunar: lunarCatalog, solar: solarCatalog } = context.catalogs();
      if (!lunarCatalog.covers(each) || !solarCatalog.covers(each)) return null;
      const [lunar, solar] = await Promise.all([
        lunarCatalog.eclipsesInYear(each),
        solarCatalog.eclipsesInYear(each),
      ]);
      return [...lunar, ...solar].sort((a, b) => a.jdTT - b.jdTT);
    },
    uncertainty: (eclipse) => context.deltaT().uncertaintySeconds(greatestEclipseUT(eclipse)),
  });

  function seenShown(state: ViewState): boolean {
    return state.layers.has('empires') || state.seenIn !== null;
  }

  /** Bring the bar's "seen from" picker and marks up to date with the state and the year. */
  function refreshSeen(state: ViewState): void {
    const year = state.time.date.year;
    if (seenShown(state) && year !== seenOptionsYear) {
      seenOptionsYear = year;
      context.centuryFor(year).then(
        (file) => {
          if (seenOptionsYear !== year) return;
          const names =
            file === null
              ? []
              : territoriesIn(file, cliopatriaYear(year, PRESENT_YEAR)).map(({ name }) => name);
          seenOptions = [...new Set(names)].sort((a, b) => a.localeCompare(b));
          context.render(store.get());
        },
        (error: unknown) => {
          seenOptionsYear = null;
          context.notify(`Could not load the states of the time: ${errorMessage(error)}`);
        },
      );
    }
    const name = state.seenIn;
    const listing = context.listing();
    if (name === seenName && listing === seenListing) return;
    seenName = name;
    seenListing = listing;
    if (name === null) {
      seenView = { status: 'off' };
      return;
    }
    seenView = { status: 'loading', name };
    if (listing.status !== 'ready') return;
    const current = listing;
    // A year of another calendar can span two western years, each with its own borders.
    const byYear = new Map<number, Eclipse[]>();
    for (const eclipse of current.eclipses) {
      const each = yearOf(greatestEclipseUT(eclipse));
      byYear.set(each, [...(byYear.get(each) ?? []), eclipse]);
    }
    const years = byYear.size === 0 ? new Map([[year, []]]) : byYear;
    Promise.all(
      [...years].map(([each, eclipses]) => empireEclipses.seenInYear(name, each, eclipses)),
    ).then(
      (results) => {
        if (seenName !== name || seenListing !== current) return;
        const marks = results.filter((result) => result !== null);
        seenView =
          marks.length === 0
            ? { status: 'absent', name }
            : { status: 'ready', name, marks: new Map(marks.flatMap((result) => [...result])) };
        context.render(store.get());
      },
      (error: unknown) => {
        if (seenName !== name || seenListing !== current) return;
        seenView = { status: 'off' };
        context.notify(`Could not work out what ${name} saw: ${errorMessage(error)}`);
        context.render(store.get());
      },
    );
  }

  /** The previous or next eclipse seen from the state picked: this year first, then further. */
  function stepSeen(direction: 1 | -1): void {
    const state = store.get();
    const name = state.seenIn;
    if (name === null) return;
    const selected = context.selected(state);
    const pivot =
      selected === undefined ? momentJulianDay(state.time) : greatestEclipseUT(selected);
    const listing = context.listing();
    if (listing.status === 'ready' && seenView.status === 'ready') {
      const { marks } = seenView;
      const later = listing.eclipses.filter((eclipse) => {
        const mark = marks.get(eclipse);
        if (mark === undefined || mark.verdict === 'not') return false;
        const when = greatestEclipseUT(eclipse);
        return direction === 1 ? when > pivot : when < pivot;
      });
      const pick = direction === 1 ? later.at(0) : later.at(-1);
      if (pick !== undefined) {
        context.goTo(pick);
        return;
      }
    }
    const western = westernYearsOf(state, barYear(state)) ?? [state.time.date.year];
    const from = direction === 1 ? western.at(-1) : western.at(0);
    seenView = { status: 'searching', name };
    context.render(state);
    empireEclipses.nearest(name, from ?? state.time.date.year, direction).then(
      (found) => {
        if (store.get().seenIn !== name) return;
        if (found !== null) {
          context.goTo(found.eclipse);
          return;
        }
        const way = direction === 1 ? 'after' : 'before';
        context.notify(
          `No eclipse seen from ${name} in the ${String(SEARCH_YEARS)} years ${way} this one`,
        );
        seenListing = null; // Recompute this year's marks.
        context.render(store.get());
      },
      (error: unknown) => {
        context.notify(`Could not search for eclipses: ${errorMessage(error)}`);
        seenListing = null;
        context.render(store.get());
      },
    );
  }

  return {
    shown: seenShown,
    refresh: refreshSeen,
    step: stepSeen,
    view: () => seenView,
    options: () => seenOptions,
  };
}
