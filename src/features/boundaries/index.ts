/**
 * The planetary boundaries' story (#434) as a part of the page: its sheet, whose data and scenes
 * load when it first opens, and the globe beside it (#475). While the Holocene chapter's chart
 * draws, the globe follows it through the ice ages, and is given back on leaving the chapter. On
 * a wide screen the sheet covers the right of the page, so the globe centres in the rest. From
 * 1850 the globe shows the measured warming, Berkeley Earth's, in place of the ice-age maps (#485).
 */

import { loadMeasuredWarming, type MeasuredWarming } from '../../data/measuredWarming';
import type { StoryDate } from '../../deepTime/storyDate';
import type { Globe } from '../../globe/scene';
import { errorMessage } from '../../util/errors';
import { createBoundariesSheet } from './boundariesSheet';
import type { MountedPart, PartContext } from '../part';
import type { BoundaryChapter, GlobeCamera } from '../../state/viewState';
import {
  borrowedOf,
  FACING,
  FACING_DISTANCE,
  givenBack,
  globeAt,
  measuredAt,
  storyDateAt,
  type Borrowed,
} from './holoceneGlobe';

export interface BoundariesContext extends PartContext {
  readonly globe: Pick<Globe, 'flyTo' | 'zoomTo' | 'setInsets' | 'setTemperature'>;
}

export interface BoundariesPart extends MountedPart {
  /** The button that opens it, for the header's tools. */
  readonly button: HTMLButtonElement;
  /** While the story has the globe, the date it lends deep time's header and bar (#492). */
  readonly storyDate: () => StoryDate | null;
}

/** A sheet starting further right than this share of the page sits beside the globe. */
const BESIDE = 0.35;

export function mountBoundaries(context: BoundariesContext): BoundariesPart {
  const { base, store, globe } = context;
  let shown: BoundaryChapter | null | undefined;
  // What the story took from the reader's view, while it has the globe.
  let borrowed: Borrowed | null = null;
  // And where the reader's camera was, to turn it back there.
  let cameraBefore: GlobeCamera | null = null;
  // The measured warming since 1850 (#485), loaded when the story first has the globe.
  let warming: MeasuredWarming | null = null;
  let warmingLoading: Promise<MeasuredWarming> | null = null;
  let measuredShown = false;
  // The chart's year, while the story has the globe.
  let storyYear: number | null = null;

  function loadWarming(): void {
    if (warming !== null || warmingLoading !== null) return;
    warmingLoading = loadMeasuredWarming(`${base}data/warming/index.json`, context.fetchJson);
    warmingLoading.then(
      (index) => {
        warming = index;
      },
      (error: unknown) => {
        warmingLoading = null;
        context.notify(`Could not load the measured warming: ${errorMessage(error)}`);
      },
    );
  }

  /** From 1850, the measured warming on the globe, over the Temperature layer's maps. */
  function showMeasured(year: number): void {
    const surface =
      warming === null ? null : measuredAt(warming, year, (file) => `${base}data/warming/${file}`);
    if (surface !== null) {
      globe.setTemperature(surface);
      measuredShown = true;
    } else if (measuredShown) {
      // Back before 1850: the Temperature layer draws Krapp's maps again as the view changes.
      measuredShown = false;
    }
  }

  /** The globe to the chart's year; or, with null, back to the reader. */
  function follow(year: number | null): void {
    if (year === null) {
      if (borrowed === null) return;
      const back = borrowed;
      borrowed = null;
      storyYear = null;
      if (measuredShown) {
        // Cleared first: the reader's view draws its own temperature, if any, as it comes back.
        globe.setTemperature(null);
        measuredShown = false;
      }
      store.set((state) => givenBack(state, back));
      if (cameraBefore !== null) {
        globe.flyTo(cameraBefore.target);
        globe.zoomTo(cameraBefore.distance);
      }
      besideGlobe();
      return;
    }
    const from = borrowed ?? borrowedOf(store.get());
    // Before the view changes: deep time reads it as it draws.
    storyYear = year;
    store.set((state) => globeAt(state, from, year));
    showMeasured(year);
    if (borrowed === null) {
      borrowed = from;
      loadWarming();
      cameraBefore = store.get().camera;
      globe.flyTo(FACING);
      globe.zoomTo(FACING_DISTANCE);
      besideGlobe();
    }
  }

  const sheet = createBoundariesSheet(
    (boundaries) => {
      store.set((state) => ({ ...state, boundaries }));
    },
    (file) => `${base}data/${file}`,
    context.fetchJson,
    `${base}textures/earth-blue-marble-2048.jpg`,
    context.why('boundaries', 'Planetary boundaries'),
    // The chart speaks as the sheet is drawn, too: change the view once that is done.
    (year) => {
      queueMicrotask(() => {
        follow(year);
      });
    },
  );

  /**
   * How much of the page's right the sheet covers, where it sits beside the globe. While the
   * story has the globe, deep time's bar keeps to the space left of the sheet, folded.
   */
  function besideGlobe(): void {
    const { dialog } = sheet;
    const box = dialog.getBoundingClientRect();
    const beside = dialog.open && box.width > 0 && box.left > window.innerWidth * BESIDE;
    const right = beside ? window.innerWidth - box.left : 0;
    globe.setInsets({ right });
    const page = dialog.parentElement;
    page?.classList.toggle('is-beside-story', borrowed !== null && beside);
    page?.style.setProperty('--story-right', `${String(right)}px`);
  }
  new ResizeObserver(besideGlobe).observe(sheet.dialog);
  window.addEventListener('resize', besideGlobe);

  return {
    watches: (state) => [state.boundaries],
    elements: [sheet.dialog],
    button: sheet.button,
    storyDate: () => (storyYear === null ? null : storyDateAt(storyYear)),
    render(state) {
      // Shown on every draw: act only when the chapter changes.
      if (state.boundaries === shown) return;
      shown = state.boundaries;
      sheet.show(shown);
      besideGlobe();
    },
  };
}
