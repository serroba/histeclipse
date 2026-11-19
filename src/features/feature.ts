/**
 * A feature (#380): one thing the reader can turn on, in one folder, mounted by the app through
 * this contract. It gets what it needs from the app here, and the app reaches it only through
 * `Feature` and `FeatureInstance`: adding one means a folder and a line in `features/index.ts`,
 * not edits across the app.
 *
 * What the layer is, as the reader is offered it, is described below the view's state, where the
 * link, the chips and the search read it (#904): its id, name, spans, icon and why in
 * `src/layers/<id>.ts`, listed in `src/layers/layers.ts`. Its why's text is
 * `src/sources/whys/<id>.json` (#906), its sources entries in `sources/sources.json`, and its
 * styles a `.css` file in its folder (#382).
 */

import type { Fetch } from '../util/fetchJson';
import type { Globe } from '../globe/globe';
import type { LayerLoad } from '../state/activeLayers';
import type { DeepScale, Layer, ViewState } from '../state/viewState';
import type { LineageGroup } from '../data/lineages';
import type { TreeOfLife } from '../data/treeOfLife';
import type { DeepChip, DeepChipView } from '../ui/deepChips';
import type { MarkerCardContent } from '../ui/markerCard';
import type { Ephemerides, Timeline } from './part';
import type { Anchor } from '../text/passages';
import type { HereFact } from '../sources/registry';
import type { WaysLegend } from '../ui/waysLegend';
import type { ZoomRail } from '../ui/zoomRail';

/** Said in the Layers panel of a layer whose markers rest while the years play. */
export const RESTING = 'Resting while you travel through the years; back when the track closes.';

/** What the app lends every feature. It does not grow with the layers: see `Capabilities`. */
export interface FeatureCore {
  /** Where the site's files are served from, ending in `/`. */
  readonly base: string;
  readonly fetchJson: Fetch;
  /** Its layers on the globe. */
  readonly globe: Pick<Globe, 'addLayer'>;
  /** Tell the reader something went wrong. */
  notify(message: string): void;
  /** Change what the reader is looking at, as one of the feature's own choices does. */
  change(update: (state: ViewState) => ViewState): void;
  /** Show the moment and the Layers panel again: data the feature waited for has arrived. */
  refresh(): void;
}

/**
 * What a feature may ask for by name (#909), in its `needs`: it is lent those and no others, so
 * what each feature touches is written down with it. Something one more layer needs of the page
 * is a capability here, not a field of `FeatureCore`.
 */
export interface Capabilities {
  /** A marker's card: open one, and whether one is open. */
  readonly cards: {
    show(card: MarkerCardContent): void;
    open(): boolean;
  };
  /** A view laid over the reader's, as a step Back undoes: a related discovery (#731). */
  readonly anchors: { open(anchor: Anchor): void };
  /** The Moon's and the planets' theories (#606). */
  readonly ephemerides: Ephemerides;
  /** Where the reader is in time's playing (#606): markers of single events rest while travelling. */
  readonly timeline: Timeline;
  /** The rail's own buttons for what is far from Earth. */
  readonly zoomRail: ZoomRail;
  /** The tree of life: open it through time at a genus (#358), or at the node `pick` finds. */
  readonly tree: {
    openLineages(group: LineageGroup, genus: string): void;
    openTree(pick: (tree: TreeOfLife) => number | undefined): void;
  };
  /** A dispersal model's settled land, shaded on Earth. */
  readonly settledLand: Pick<Globe, 'setSettled'>;
  /** Earth lit evenly, with no night side, while a layer needs every part seen. */
  readonly evenLight: Pick<Globe, 'setEvenLight'>;
  /** The key to the ways of life's shading, under the years. */
  readonly waysKey: Pick<WaysLegend, 'render'>;
}

export type Capability = keyof Capabilities;

/** What a feature asking for `Needs` is mounted with: the core, and those capabilities. */
export type FeatureContext<Needs extends Capability = never> = FeatureCore &
  Pick<Capabilities, Needs>;

/** A moment of deep time, and the span the bar shows it on. */
export interface DeepMoment {
  readonly ma: number;
  readonly scale: DeepScale;
}

/** A step a layer offers from what it shows, on its row in the Layers panel. */
export interface LayerAction {
  readonly label: string;
  readonly run: () => void;
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
  /** The step it offers from its row in the Layers panel (#909), if it has one now. */
  action?(): LayerAction | null;
  /** What it has at the place picked, for "Why here?" (#893), if anything. */
  here?(state: ViewState): HereFact | null;
  /**
   * How its layer's load stands (#751), while loading or failed, else null; a failed load offers
   * to try again. It asks `refresh` when this changes, so the chips say it.
   */
  load?(): LayerLoad | null;
}

/** A feature as it is written: what it asks for, and how it is mounted with it. */
export interface FeatureDefinition<Needs extends Capability> {
  readonly id: Layer;
  /** The capabilities it asks for, by name: `mount` is lent these with the core. */
  readonly needs: readonly Needs[];
  /**
   * What the feature shows depends on, besides the moment (#381): when any of these changes, it
   * is shown again. Each moment shown shows every feature anyway.
   */
  watches(state: ViewState): readonly unknown[];
  /** The kind its markers' picks start with, such as `asteroid` in `asteroid:1`. */
  readonly picks?: string;
  /** Its chip in the deep-time bar, if it has one. */
  readonly deepChip?: Omit<DeepChip, 'layer'>;
  mount(context: FeatureContext<Needs>): FeatureInstance;
}

/** A feature as the app mounts it: it takes from all the capabilities only those it asked for. */
export interface Feature extends Omit<FeatureDefinition<Capability>, 'mount'> {
  mount(core: FeatureCore, capabilities: Capabilities): FeatureInstance;
}

/** A feature from its definition, lent on mounting the core and the capabilities it names. */
export function feature<const Needs extends Capability>(
  definition: FeatureDefinition<Needs>,
): Feature {
  return {
    ...definition,
    mount(core, capabilities) {
      const lent: Partial<Capabilities> = {};
      for (const need of definition.needs) Object.assign(lent, { [need]: capabilities[need] });
      return definition.mount({ ...core, ...(lent as Pick<Capabilities, Needs>) });
    },
  };
}
