/**
 * A feature (#380): one thing the reader can turn on, in one folder, mounted by the app through
 * this contract. It gets what it needs from the app here, and the app reaches it only through
 * `Feature` and `FeatureInstance`: adding one means a folder and a line in `features/index.ts`,
 * not edits across the app.
 *
 * Still central for now: the layer's id (`state/viewState`), its entry in the Layers panel
 * (`state/layerCatalog`), its sources (`sources/registry`) and its styles; they move with the
 * state and URL by feature (#381) and the CSS by component (#382).
 */

import type { MoonEphemeris } from '../astro/moon';
import type { PlanetEphemeris } from '../astro/planets';
import type { Fetch } from '../data/fetchJson';
import type { Globe } from '../globe/scene';
import type { DeepScale, Layer, ViewState } from '../state/viewState';
import type { LineageGroup } from '../data/lineages';
import type { DeepChip, DeepChipView } from '../ui/deepChips';
import type { MarkerCardContent } from '../ui/markerCard';
import type { ZoomRail } from '../ui/zoomRail';

/** Said in the Layers panel of a layer whose markers rest while the years play. */
export const RESTING = 'Resting while you travel through the years; back when the track closes.';

/** What the app lends a feature. */
export interface FeatureContext {
  /** Where the site's files are served from, ending in `/`. */
  readonly base: string;
  readonly fetchJson: Fetch;
  readonly globe: Pick<Globe, 'addLayer'>;
  readonly zoomRail: ZoomRail;
  /** Tell the reader something went wrong. */
  notify(message: string): void;
  /** Open the card for a marker. */
  showCard(card: MarkerCardContent): void;
  /** Whether a marker's card is open. */
  cardOpen(): boolean;
  /** The planets' theory, once loaded; `loadPlanets` asks for it. */
  planets(): PlanetEphemeris | null;
  loadPlanets(): void;
  /** The Moon's ephemeris, once loaded (it loads with the app). */
  moon(): MoonEphemeris | null;
  /** Open the tree of life through time at a genus (#358). */
  openLineages(group: LineageGroup, genus: string): void;
  /** Whether the reader is travelling through the years: markers of single events rest then. */
  travelling(): boolean;
  /** Show the moment and the Layers panel again: data the feature waited for has arrived. */
  refresh(): void;
}

/** A moment of deep time, and the span the bar shows it on. */
export interface DeepMoment {
  readonly ma: number;
  readonly scale: DeepScale;
}

/** A feature as mounted. */
export interface FeatureInstance {
  /** The moment shown changed, or the layers did: `jdTT` is the moment in Terrestrial Time. */
  show?(state: ViewState, jdTT: number): void;
  /**
   * Deep time shown (#380): the moment in millions of years and the span of the bar, or null on
   * leaving it. A feature with a chip in the bar says how it stands.
   */
  deep?(state: ViewState, moment: DeepMoment | null): DeepChipView | null;
  /** One of its markers was tapped: all that follows `<picks>:` in the marker's pick. */
  pick?(id: string): void;
  /** Another marker was tapped: a card of this feature's still loading should not open. */
  unpick?(): void;
  /** What the Layers panel says under its layer, if anything. */
  said?(): string | null;
}

export interface Feature {
  readonly id: Layer;
  /**
   * What the feature shows depends on, besides the moment (#381): when any of these changes, it
   * is shown again. Each moment shown shows every feature anyway.
   */
  watches(state: ViewState): readonly unknown[];
  /** The kind its markers' picks start with, such as `asteroid` in `asteroid:1`. */
  readonly picks?: string;
  /** Its chip in the deep-time bar, if it has one. */
  readonly deepChip?: Omit<DeepChip, 'layer'>;
  mount(context: FeatureContext): FeatureInstance;
}
