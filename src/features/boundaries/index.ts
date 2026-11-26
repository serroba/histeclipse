/**
 * The planetary boundaries' story (#434) as a part of the page: its sheet, whose data and scenes
 * load when it first opens, and the globe beside it (#475). While the Holocene chapter's chart
 * draws, the globe follows it through the ice ages, and is given back on leaving the chapter. On
 * a wide screen the sheet covers the right of the page, so the globe centres in the rest. From
 * 1850 the globe shows the measured warming, Berkeley Earth's, in place of the ice-age maps (#485).
 */

import { loadMeasuredWarming } from '../../data/measuredWarming';
import type { StoryDate } from '../../deepTime/storyDate';
import type { Globe } from '../../globe/globe';
import { createBoundariesSheet } from './boundariesSheet';
import type { MountedPart, PartContext } from '../part';
import type { BoundaryChapter } from '../../state/viewState';
import { storyDateAt } from './holoceneGlobe';
import { createStoryGlobe } from './storyGlobe';

export { boundariesFeature } from './boundariesLayer';

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
  // The globe the Holocene chapter borrows, and gives back (#475, #845).
  const story = createStoryGlobe({
    store,
    globe,
    loadWarming: () => loadMeasuredWarming(`${base}data/warming/index.json`, context.fetchJson),
    fileUrl: (file) => `${base}data/warming/${file}`,
    notify: (message) => {
      context.notify(message);
    },
    besideGlobe: () => {
      besideGlobe();
    },
    holdAt: (year) => sheet.holdAt(year),
  });

  const sheet = createBoundariesSheet(
    (boundaries) => {
      store.set((state) => ({ ...state, boundaries }));
    },
    (file) => `${base}data/${file}`,
    context.fetchJson,
    `${base}textures/earth-blue-marble-2048.webp`,
    context.why('boundaries', 'Planetary boundaries'),
    // The chart speaks as the sheet is drawn, too: change the view once that is done.
    (year) => {
      queueMicrotask(() => {
        story.follow(year);
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
    page?.classList.toggle('is-beside-story', story.borrowing() && beside);
    page?.style.setProperty('--story-right', `${String(right)}px`);
  }
  new ResizeObserver(besideGlobe).observe(sheet.dialog);
  window.addEventListener('resize', besideGlobe);

  return {
    watches: (state) => [state.boundaries],
    elements: [sheet.dialog],
    button: sheet.button,
    storyDate: () => {
      const year = story.year();
      return year === null ? null : storyDateAt(year);
    },
    render(state) {
      story.viewed(state);
      // Shown on every draw: act only when the chapter changes.
      if (state.boundaries === shown) return;
      shown = state.boundaries;
      sheet.show(shown);
      besideGlobe();
    },
  };
}
