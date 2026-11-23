/**
 * A part of the page that is not a layer (#443): a sheet, a view, a set of controls. Mounted by
 * the app with what it lends here, it keeps its own state to itself and is shown again only when
 * a field it watches changes. What other parts may ask of it, it returns beside `render`.
 * Layers have their own contract, `Feature` (#380).
 */

import type { Fetch } from '../util/fetchJson';
import type { MoonEphemeris } from '../astro/moon';
import type { Vector3 } from '../astro/matrix';
import type { PlanetEphemeris, PlanetName } from '../astro/planets';
import type { SkyPlanet } from '../sky/skyScene';
import type { DeltaT } from '../time/deltaT';
import type { JulianDay } from '../time/julianDay';
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
  /** Tell the reader something went wrong; with `retry`, the notice offers Try again (#1130). */
  notify(message: string, retry?: () => void): void;
  /** A button that opens the "why" sheet at a source. */
  why(id: WhyId | (() => WhyId), label: string): HTMLElement;
  /** Go to deep time at a moment, on the whole span, with a layer on and the globe facing a place. */
  goToDeepTime(ma: number, layer: Layer, where: Place): void;
  /** Where the reader is in time's playing, asked of whichever part keeps it (#606). */
  readonly timeline: Timeline;
  /** The Moon's and the planets' theories, kept by the bodies (#606). */
  readonly ephemerides: Ephemerides;
  /** ΔT, the table that turns the clock's time into the Earth's turning (#606): loaded before
   * anything is drawn, so a part asks for it only once it draws. */
  deltaT(): DeltaT;
}

/** ΔT as the parts are given it before it has loaded: asked for then, it says so. */
export function lateDeltaT(): { readonly deltaT: () => DeltaT; bind(table: DeltaT): void } {
  let table: DeltaT | null = null;
  return {
    deltaT: () => {
      if (table === null) throw new Error('ΔT asked for before it loaded');
      return table;
    },
    bind: (loaded) => {
      table = loaded;
    },
  };
}

/** The Moon's and the planets' theories, as the bodies keep them once mounted (#606). */
export interface Ephemerides {
  /** The Moon's theory, once loaded (it loads with the page). */
  moon(): MoonEphemeris | null;
  /**
   * The Moon for the moment shown, frame after frame (#672, #783): on a grid of exact places,
   * shared by all that draw it at that moment; null until the theory has loaded.
   */
  moonAt(jdTT: JulianDay): Triple | null;
  /** The planets' theory, once loaded; `loadPlanets` asks for it. */
  planets(): PlanetEphemeris | null;
  loadPlanets(): Promise<PlanetEphemeris>;
  /** Each planet's place from Earth's centre, J2000 km, once the theory has loaded. */
  planetPositions(jdTT: JulianDay): Readonly<Record<PlanetName, Triple>> | null;
  /** The planets as an observer sees them. */
  planetsSeen(jdTT: JulianDay, sun: Vector3, observer: Vector3): SkyPlanet[];
}

type Triple = readonly [number, number, number];

/**
 * The ephemerides as parts are given them before the bodies are mounted: asked before then, no
 * theory has loaded; a load asked for waits for the bodies.
 */
export function lateEphemerides(): {
  readonly ephemerides: Ephemerides;
  bind(bodies: Ephemerides): void;
} {
  let bodies: Ephemerides | null = null;
  let mounted: (bound: Ephemerides) => void = () => undefined;
  const ready = new Promise<Ephemerides>((resolve) => {
    mounted = resolve;
  });
  return {
    ephemerides: {
      moon: () => bodies?.moon() ?? null,
      moonAt: (jdTT) => bodies?.moonAt(jdTT) ?? null,
      planets: () => bodies?.planets() ?? null,
      loadPlanets: () => ready.then((bound) => bound.loadPlanets()),
      planetPositions: (jdTT) => bodies?.planetPositions(jdTT) ?? null,
      planetsSeen: (jdTT, sun, observer) => bodies?.planetsSeen(jdTT, sun, observer) ?? [],
    },
    bind: (bound) => {
      bodies = bound;
      mounted(bound);
    },
  };
}

/** What parts ask of time's playing: answered by the years and deep time once mounted (#606). */
export interface Timeline {
  /** Whether the reader is travelling through the years: today's maps rest then. */
  travelling(): boolean;
  /** Whether deep time is playing. */
  playing(): boolean;
  /** The oldest elevation map, in millions of years. */
  oldest(): number;
  /** The moment (UT JD) Earth's face is shown turned to at `jd`: while the launches play fast,
   * a whole day from where they started, so the globe holds still as the planets go on (#770). */
  earthFace(jd: number): number;
}

/** The parts that keep time's playing. */
interface TimeKeepers {
  readonly years: { travelling(): boolean };
  readonly deepTime: { playing(): boolean; oldest(): number };
  readonly launches: { earthFace(jd: number): number };
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
      earthFace: (jd) => keepers?.launches.earthFace(jd) ?? jd,
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
  readonly render: (state: ViewState) => void;
}
