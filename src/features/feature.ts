/**
 * A feature (#380): one thing the reader can turn on, in one folder, mounted by the app through
 * this contract. It gets what it needs from the app here, and the app reaches it only through
 * `Feature` and `FeatureInstance`: adding one means a folder and a line in `features/index.ts`,
 * not edits across the app.
 *
 * What the layer is, as the reader is offered it, is described below the view's state, where the
 * link, the chips and the search read it (#904): its id, name, spans, icon and why in
 * `src/layers/<id>.ts`, listed in `src/layers/layers.ts`. Its why's text is
 * `src/sources/whys/<id>.json` (#906), its sources entries in `sources/sources.json` (and their references in `sources/citations.json`), and its
 * styles a `.css` file in its folder (#382).
 */

import type { PlayAxis } from '../deepTime/playAxis';
import type { StoryDate } from '../deepTime/storyDate';
import type { Pace } from '../deepTime/playSpeed';
import type { Fetch } from '../util/fetchJson';
import type { Globe } from '../globe/globe';
import type { Brief, LayerLoad } from '../state/activeLayers';
import type { DeepScale, GeoPoint, Layer, ViewState } from '../state/viewState';
import type { EmpireCentury, Territory } from '../data/empires';
import type { LineageGroup } from '../data/lineages';
import type { Co2Archive } from '../data/co2Archive';
import type { PlateMaskIndex } from '../data/plateMasks';
import type { DeepTimeView } from '../ui/deepTimeBar';
import type { TreeOfLife } from '../data/treeOfLife';
import type { DeepChip, DeepChipView } from '../ui/deepChips';
import type { MarkerCardContent } from '../ui/markerCard';
import type { Ephemerides, Timeline } from './part';
import type { Anchor } from '../text/passages';
import type { HereFact } from '../sources/registry';
import type { DatingCard } from '../ui/datingCard';
import type { Radiocarbon } from '../data/radiocarbon';
import type { WaysLegend } from '../ui/waysLegend';
import type { ZoomRail } from '../ui/zoomRail';
import type { OwnTime } from './ownTime';

/** While the years play, a layer drawn from the year redraws at most this often, in ms. */
export const TRAVEL_REDRAW_MS = 500;

/**
 * Whether a layer drawn from the year should draw now: whenever time stands, and while the years
 * play at most every TRAVEL_REDRAW_MS, so it stays on the globe without redrawing every frame. A
 * draw skipped asks `late` once, when it is due, so the year the years stop at is drawn too.
 */
export function travelPace(
  late: () => void,
  now: () => number = () => performance.now(),
  after: (run: () => void, ms: number) => void = (run, ms) => {
    setTimeout(run, ms);
  },
): { due(travelling: boolean): boolean } {
  let last = -Infinity;
  let waiting = false;
  return {
    due(travelling) {
      if (!travelling) return true;
      const at = now();
      if (at - last >= TRAVEL_REDRAW_MS) {
        last = at;
        return true;
      }
      if (!waiting) {
        waiting = true;
        after(
          () => {
            waiting = false;
            late();
          },
          TRAVEL_REDRAW_MS - (at - last),
        );
      }
      return false;
    },
  };
}

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
  /** Deep time: go to a moment there, on the span that shows it. */
  readonly deepTime: {
    enter(ma: number, scale: DeepScale): void;
    /** On the whole span, with a layer on and the globe facing a place. */
    goTo(ma: number, layer: Layer, where: GeoPoint): void;
    /** Play from `ma` on a span, at one of its speeds, towards today (#177). */
    play(ma: number, scale: DeepScale, maPerSecond: number): void;
    /** Show deep time again, or what is drawn on leaving it: a map it draws from has arrived. */
    again(): void;
    /** Pause play for a while (#1174): whether it was playing, to resume it after. */
    hold(): boolean;
    /** Play on from where it was held. */
    resume(): void;
    /** The pace deep time plays at. */
    pace(): Pace;
  };
  /**
   * The ice ages' Earth on the globe: the shelf the sea left bare, the ice sheets, the sea ice,
   * and close up today's heights in tiles where the device takes tiles on (#1016).
   */
  readonly iceAgeEarth: Pick<
    Globe,
    'setShelf' | 'setIce' | 'setSeaIce' | 'setEarthTiles' | 'tileLimits'
  >;
  /** What the years' track says of the Holocene's Earth: kept, and the track told it was drawn. */
  readonly holoceneNote: { keep(said: string | null): void; shown(): void };
  /** Cliopatria's border files, loaded a century at a time and shared with the eclipses. */
  readonly stateBorders: {
    centuryFor(year: number): Promise<EmpireCentury | null>;
    territoryOf(name: string, shown: number): Promise<Territory | null>;
  };
  /** The years' track: what it says of the states that came or went, or null to say it again. */
  readonly yearsTrack: { states(said: string | null): void };
  /** "Why here?": what a layer has at the place changed, so the panel is written again if open. */
  readonly whyHere: { again(): void };
  /** A second reconstruction's continents, outlined on the globe in deep time. */
  readonly plateOutlines: Pick<Globe, 'setPlates' | 'prefetch'>;
  /** The index of those continents' outlines, loaded once and shared with deep time. */
  readonly plateMasks: {
    ask(): Promise<PlateMaskIndex>;
    loaded(): PlateMaskIndex | null;
  };
  /** The Paleo-CO2 Data Archive, once the reader has asked deep time's bar for it. */
  readonly co2Archive: { loaded(): Co2Archive | null };
  /** The globe coloured by temperature in deep time, and the maps ahead fetched as it plays. */
  readonly temperatureMaps: Pick<Globe, 'setTemperature' | 'prefetch'>;
  /** A crater's strike: played on the globe turned to it, and written on `on` as it happens. */
  readonly strikes: Pick<Globe, 'playImpact' | 'flyTo' | 'zoomTo' | 'setInsets'> & {
    readonly on: HTMLElement;
  };
  /** Radiocarbon's calibration curves, loaded once. */
  readonly radiocarbon: { curves(): Promise<Radiocarbon> };
  /** The card that carries a radiocarbon date across a curve. */
  readonly datingCard: Pick<DatingCard, 'open'>;
  /** The glow over Earth where cosmic rays make carbon-14, by latitude. */
  readonly carbonGlow: Pick<Globe, 'setC14Glow'>;
  /** The air shower: play it under a field's dipole, from the Sun's core if `fromSun`. */
  readonly shower: { watch(dipole: number, fromSun: boolean): void };
  /**
   * Events watched in their own time (#1191): one clock over the page at a time, deep time held
   * while it is open. Made from the others in `mountFeatures`, not by the app.
   */
  readonly ownTime: OwnTime;
  /** What lies over the whole page: a feature's own dialog is added there. */
  readonly overPage: { add(element: HTMLElement): void };
  /** The key to the ways of life's shading, under the years. */
  readonly waysKey: Pick<WaysLegend, 'render'>;
}

export type Capability = keyof Capabilities;

/** What the app lends: the capabilities but those made from the others in `mountFeatures`. */
export type AppCapabilities = Omit<Capabilities, 'ownTime'>;

/** What a feature asking for `Needs` is mounted with: the core, and those capabilities. */
export type FeatureContext<Needs extends Capability = never> = FeatureCore &
  Pick<Capabilities, Needs>;

/** A moment of deep time, and the span the bar shows it on. */
export interface DeepMoment {
  readonly ma: number;
  readonly scale: DeepScale;
  /** Whether the moment is before the elevation maps reach; not said, it is not. */
  readonly uncharted?: boolean;
  /** How fast deep time plays, millions of years a second; null or not said while it stands. */
  readonly maPerSecond?: number | null;
}

/**
 * What a feature may say in deep time's bar besides its chip (#909): the fields of the bar's
 * view that are a layer's own. The bar draws each; a feature that has none leaves it out.
 */
export type DeepBarFields = Partial<
  Pick<
    DeepTimeView,
    | 'air'
    | 'plateMotion'
    | 'coastline'
    | 'ice'
    | 'iceOutlines'
    | 'seaIce'
    | 'seaLevel'
    | 'temperature'
  >
> & {
  /** Whether the globe is coloured by temperature at the moment: deep time's glance says so. */
  readonly temperatureDrawn?: boolean;
};

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
  /** Deep time shown (#909): its own fields of the bar's view, if it has any. */
  deepBar?(state: ViewState, moment: DeepMoment): DeepBarFields;
  /** Deep time (#1077): the moments, Ma, of the finds its layer shows, that play eases near. */
  finds?(state: ViewState): readonly number[];
  /**
   * Deep time (#1276): its own timeline that play follows while it shows, such as the
   * temperature chart's pace over the ice ages; null while it does not.
   */
  playAxis?(state: ViewState): PlayAxis | null;
  /**
   * Deep time (#1285): a date it lends the header and bar, finer than the moment the view keeps,
   * such as the temperature chart's year through the last thousand years; null while it has none.
   */
  storyDate?(): StoryDate | null;
  /** One of its markers was tapped: all that follows `<picks>:` in the marker's pick. */
  pick?(id: string): void;
  /** Another marker was tapped: a card of this feature's still loading should not open. */
  unpick?(): void;
  /** What the Layers panel says under its layer, if anything. */
  said?(): string | null;
  /** What its chip says beside its name while it draws (#1159), if anything. */
  brief?(): Brief | null;
  /** The step it offers from its row in the Layers panel (#909), if it has one now. */
  action?(): LayerAction | null;
  /** What it has at the place picked, for "Why here?" (#893), if anything. */
  here?(state: ViewState): HereFact | readonly HereFact[] | null;
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
  /** Where its chip goes among the features': higher is later, and 0 if not said. */
  readonly deepChipOrder?: number;
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
