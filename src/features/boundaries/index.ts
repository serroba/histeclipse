/**
 * The planetary boundaries' story (#434) as a part of the page: its sheet, whose data and scenes
 * load when it first opens, and the globe beside it (#475). While the Holocene chapter's chart
 * draws, the globe follows it through the ice ages, and is given back on leaving the chapter. On
 * a wide screen the sheet covers the right of the page, so the globe centres in the rest.
 */

import type { Globe } from '../../globe/scene';
import { createBoundariesSheet } from '../../ui/boundariesSheet';
import type { MountedPart, PartContext } from '../part';
import type { BoundaryChapter, GlobeCamera } from '../../state/viewState';
import {
  borrowedOf,
  FACING,
  FACING_DISTANCE,
  givenBack,
  globeAt,
  type Borrowed,
} from './holoceneGlobe';

export interface BoundariesContext extends PartContext {
  readonly globe: Pick<Globe, 'flyTo' | 'zoomTo' | 'setInsets'>;
}

export interface BoundariesPart extends MountedPart {
  /** The button that opens it, for the header's tools. */
  readonly button: HTMLButtonElement;
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

  /** The globe to the chart's year; or, with null, back to the reader. */
  function follow(year: number | null): void {
    if (year === null) {
      if (borrowed === null) return;
      const back = borrowed;
      borrowed = null;
      store.set((state) => givenBack(state, back));
      if (cameraBefore !== null) {
        globe.flyTo(cameraBefore.target);
        globe.zoomTo(cameraBefore.distance);
      }
      besideGlobe();
      return;
    }
    const from = borrowed ?? borrowedOf(store.get());
    store.set((state) => globeAt(state, from, year));
    if (borrowed === null) {
      borrowed = from;
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
    render(state) {
      // Shown on every draw: act only when the chapter changes.
      if (state.boundaries === shown) return;
      shown = state.boundaries;
      sheet.show(shown);
      besideGlobe();
    },
  };
}
