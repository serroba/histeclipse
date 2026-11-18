/**
 * The Holocene chapter borrowing the globe (#475): as the chart draws, the globe goes to the
 * year its line has reached; from 1850 it shows the measured warming (#485), loaded when the
 * story first has the globe; on leaving the chapter, the reader's view and camera come back.
 *
 * One owner of the moment at a time (#845): moving deep time's bar while the story has the
 * globe holds the chart there, paused, and the bar keeps the moment until the chart moves of
 * itself again (`timeOwner.ts`).
 *
 * Moved out of the part so it can be tested: the part lends it the store, the globe and the
 * sheet's chart.
 */

import type { MeasuredWarming } from '../../data/measuredWarming';
import { yearOfMa } from '../../data/iceSheets';
import type { Globe } from '../../globe/globe';
import type { Store } from '../../state/store';
import type { GlobeCamera, ViewState } from '../../state/viewState';
import { errorMessage } from '../../util/errors';
import {
  borrowedOf,
  FACING,
  FACING_DISTANCE,
  givenBack,
  globeAt,
  measuredAt,
  type Borrowed,
} from './holoceneGlobe';
import { createTimeOwner } from './timeOwner';

export interface StoryGlobeContext {
  readonly store: Pick<Store<ViewState>, 'get' | 'set'>;
  readonly globe: Pick<Globe, 'flyTo' | 'zoomTo' | 'setTemperature'>;
  /** Loads the measured warming's index; `fileUrl` names its maps. */
  readonly loadWarming: () => Promise<MeasuredWarming>;
  readonly fileUrl: (file: string) => string;
  readonly notify: (message: string) => void;
  /** The globe beside the sheet, laid out again as the story takes or gives it back. */
  readonly besideGlobe: () => void;
  /** Hold the chart at a year, paused: the year it shows, or null if it is not shown. */
  readonly holdAt: (year: number) => number | null;
}

export interface StoryGlobe {
  /** The globe to the chart's year; or, with null, back to the reader. */
  follow(year: number | null): void;
  /** The view drawn: deep time's bar moved by the reader holds the chart there (#845). */
  viewed(state: ViewState): void;
  /** Whether the story has the globe. */
  borrowing(): boolean;
  /** The chart's year, while the story has the globe and the chart the moment. */
  year(): number | null;
}

/**
 * The measured warming since 1850 (#485), loaded when the story first has the globe, and shown
 * on it from 1850, over the Temperature layer's maps; `yearNow` is the chart's year, if any.
 */
function measuredWarming(
  context: Pick<StoryGlobeContext, 'globe' | 'loadWarming' | 'fileUrl' | 'notify'>,
  yearNow: () => number | null,
): { load(): void; show(year: number): void; clear(): void } {
  let warming: MeasuredWarming | null = null;
  let loading: Promise<MeasuredWarming> | null = null;
  let shown = false;
  const show = (year: number): void => {
    const surface = warming === null ? null : measuredAt(warming, year, context.fileUrl);
    // Before 1850, none: the Temperature layer draws Krapp's maps again as the view changes.
    if (surface !== null) context.globe.setTemperature(surface);
    shown = surface !== null;
  };
  return {
    load() {
      if (warming !== null || loading !== null) return;
      loading = context.loadWarming();
      loading.then(
        (index) => {
          warming = index;
          // A chart held still (less motion) names its year once, before this has loaded (#591).
          const year = yearNow();
          if (year !== null) show(year);
        },
        (error: unknown) => {
          loading = null;
          context.notify(`Could not load the measured warming: ${errorMessage(error)}`);
        },
      );
    },
    show,
    clear() {
      if (shown) context.globe.setTemperature(null);
      shown = false;
    },
  };
}

export function createStoryGlobe(context: StoryGlobeContext): StoryGlobe {
  const { store, globe } = context;
  // What the story took from the reader's view, and where the reader's camera was.
  let borrowed: Borrowed | null = null;
  let cameraBefore: GlobeCamera | null = null;
  let storyYear: number | null = null;
  const owner = createTimeOwner();
  const measured = measuredWarming(context, () => storyYear);

  function giveBack(): void {
    if (borrowed === null) return;
    const back = borrowed;
    borrowed = null;
    storyYear = null;
    owner.gave(null);
    // Cleared first: the reader's view draws its own temperature, if any, as it comes back.
    measured.clear();
    store.set((state) => givenBack(state, back));
    if (cameraBefore !== null) {
      globe.flyTo(cameraBefore.target);
      globe.zoomTo(cameraBefore.distance);
    }
    context.besideGlobe();
  }

  return {
    follow(year) {
      if (year === null) {
        giveBack();
        return;
      }
      if (!owner.follows(year)) return;
      const from = borrowed ?? borrowedOf(store.get());
      // Before the view changes: deep time reads it as it draws.
      storyYear = year;
      store.set((state) => {
        const next = globeAt(state, from, year);
        owner.gave(next.ma); // before the page redraws, not to be taken for the reader's
        return next;
      });
      measured.show(year);
      if (borrowed !== null) return;
      borrowed = from;
      measured.load();
      cameraBefore = store.get().camera;
      globe.flyTo(FACING);
      globe.zoomTo(FACING_DISTANCE);
      context.besideGlobe();
    },
    viewed(state) {
      if (borrowed === null || state.ma === null || !owner.movedByReader(state.ma)) return;
      owner.held(context.holdAt(yearOfMa(state.ma)));
      storyYear = null;
    },
    borrowing: () => borrowed !== null,
    year: () => storyYear,
  };
}
