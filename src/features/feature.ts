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

import type { PlanetEphemeris } from '../astro/planets';
import type { Fetch } from '../data/fetchJson';
import type { Globe } from '../globe/scene';
import type { Layer, ViewState } from '../state/viewState';
import type { MarkerCardContent } from '../ui/markerCard';
import type { ZoomRail } from '../ui/zoomRail';

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
  /** The planets' theory, once loaded; `loadPlanets` asks for it. */
  planets(): PlanetEphemeris | null;
  loadPlanets(): void;
  /** Show the moment again: data the feature waited for has arrived. */
  refresh(): void;
}

/** A feature as mounted. */
export interface FeatureInstance {
  /** The moment shown changed, or the layers did: `jdTT` is the moment in Terrestrial Time. */
  show(state: ViewState, jdTT: number): void;
  /** One of its markers was tapped: what follows `<picks>:` in the marker's pick. */
  pick?(id: string): void;
}

export interface Feature {
  readonly id: Layer;
  /** The kind its markers' picks start with, such as `asteroid` in `asteroid:1`. */
  readonly picks?: string;
  mount(context: FeatureContext): FeatureInstance;
}
