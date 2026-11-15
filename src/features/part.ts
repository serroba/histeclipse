/**
 * A part of the page that is not a layer (#443): a sheet, a view, a set of controls. Mounted by
 * the app with what it lends here, it keeps its own state to itself and is shown again only when
 * a field it watches changes. What other parts may ask of it, it returns beside `render`.
 * Layers have their own contract, `Feature` (#380).
 */

import type { Fetch } from '../util/fetchJson';
import type { Place } from '../data/lineages';
import type { WhyId } from '../sources/registry';
import type { Watch } from '../state/redraws';
import type { Store } from '../state/store';
import type { Layer, ViewState } from '../state/viewState';

/** What the app lends a part. */
export interface PartContext {
  /** Where the site's files are served from, ending in `/`. */
  readonly base: string;
  readonly fetchJson: Fetch;
  /** The view: read it, or change it. */
  readonly store: Pick<Store<ViewState>, 'get' | 'set'>;
  /** Tell the reader something went wrong. */
  notify(message: string): void;
  /** A button that opens the "why" sheet at a source. */
  why(id: WhyId | (() => WhyId), label: string): HTMLElement;
  /** Go to deep time at a moment, on the whole span, with a layer on and the globe facing a place. */
  goToDeepTime(ma: number, layer: Layer, where: Place): void;
  /** Where the reader is in time's playing, asked of whichever part keeps it (#606). */
  readonly timeline: Timeline;
}

/** What parts ask of time's playing: answered by the years and deep time once mounted (#606). */
export interface Timeline {
  /** Whether the reader is travelling through the years: today's maps rest then. */
  travelling(): boolean;
  /** Whether deep time is playing. */
  playing(): boolean;
  /** The oldest elevation map, in millions of years. */
  oldest(): number;
}

/** The parts that keep time's playing. */
interface TimeKeepers {
  readonly years: { travelling(): boolean };
  readonly deepTime: { playing(): boolean; oldest(): number };
}

/**
 * The timeline as parts are given it before the years and deep time are mounted: asked before
 * then, nothing is travelling or playing and the maps reach their default oldest.
 */
export function lateTimeline(defaultOldest: number): {
  readonly timeline: Timeline;
  bind(keepers: TimeKeepers): void;
} {
  let keepers: TimeKeepers | null = null;
  return {
    timeline: {
      travelling: () => keepers?.years.travelling() ?? false,
      playing: () => keepers?.deepTime.playing() ?? false,
      oldest: () => keepers?.deepTime.oldest() ?? defaultOldest,
    },
    bind: (bound) => {
      keepers = bound;
    },
  };
}

/** A part as mounted. */
export interface MountedPart {
  /** What it shows depends on: it is shown again when any of these changes. */
  readonly watches: Watch;
  /** What it puts on the page, in order. */
  readonly elements: readonly HTMLElement[];
  render(state: ViewState): void;
}
