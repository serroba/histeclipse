/**
 * Everything needed to reproduce a view: the URL is a complete, shareable description of it.
 * See `url.ts` for the query-string format.
 */

import type { GeoPoint } from '../core/geo';
import { DEEP_SCALES, EARTH_AGE_MA, roundMa, type DeepScale, type Span } from '../deepTime/scale';
import { ECLIPSE_KINDS, type EclipseKind, type Selection } from '../data/eclipseKind';
import { defaultCalendarFor, type Moment } from '../time/moment';

// Defined below state, where the domain needs them; re-exported for the layers above (#378).
export type { DeepScale, EclipseKind, GeoPoint, Moment, Selection, Span };
export { DEEP_SCALES, defaultCalendarFor, EARTH_AGE_MA, ECLIPSE_KINDS, roundMa };
import { MOONS } from '../astro/moonOrbits';
import { calendarDateOf, julianDay, julianDayNumber, type JulianDay } from '../time/julianDay';
import { astronomicalYear } from '../time/year';
import { DEEP_DEFAULTS, type DeepState } from './slices/deep';
import { DISPLAY_DEFAULTS, type DisplayState } from './slices/display';
import { HISTORY_DEFAULTS, type HistoryState } from './slices/history';
import { SHEETS_DEFAULTS, type SheetsState } from './slices/sheets';

export {
  craftOn,
  FIGURES,
  PLANET_LIGHTS,
  siteOn,
  type Figures,
  type PlanetLight,
} from './slices/display';
export { BORDER_SOURCES, type BorderSource } from './slices/history';
export {
  BOUNDARY_CHAPTERS,
  CRATERS_SHAPES,
  type BoundaryChapter,
  type CratersShape,
  type CratersView,
  type LineagesView,
  type TreeView,
} from './slices/sheets';

export {
  DISPERSAL_SCENARIOS,
  type DispersalScenario,
  type FossilFinds,
  type LifeStory,
} from './slices/deep';

export const MODES = ['globe', 'sky'] as const;
export type Mode = (typeof MODES)[number];

export const SPAN_LABELS: Readonly<Record<Span, string>> = {
  years: 'Years',
  ice: 'Ice ages',
  all: '540 Myr',
  eons: '4.6 Gyr',
};

// The layers are described one by one below state (#380), and passed on from here.
export { LAYERS, type Layer } from '../layers/layers';
import type { Layer } from '../layers/layers';

/** A dispersal model's scenario shaded with the Humans layer, or none. */

/**
 * How the camera is placed: orbiting Earth freely, or attached to the bodies (standing on Earth
 * looking at the Moon, or on the Moon looking at Earth) and following them through time.
 */
/** Orbit the body in focus; stand on Earth facing the Moon, or the reverse; or, away from Earth,
 * stand on the body in focus and look back at Earth (#245). */
export const VIEWPOINTS = [
  'free',
  'moon-from-earth',
  'earth-from-moon',
  'earth-from-here',
] as const;
export type Viewpoint = (typeof VIEWPOINTS)[number];

/** The bodies the camera can centre on and orbit. */
export const BODIES = [
  'earth',
  'moon',
  'sun',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  // The moons of Mars, Jupiter and Saturn (#335).
  ...MOONS.mars,
  ...MOONS.jupiter,
  ...MOONS.saturn,
] as const;
export type Body = (typeof BODIES)[number];

/**
 * The orbiting camera, relative to the body in focus: the point on its surface under the camera
 * (on the Moon in selenographic coordinates; on the Sun in J2000 right ascension and
 * declination) and the distance from its centre in its own radii.
 */
export interface GlobeCamera {
  readonly target: GeoPoint;
  readonly distance: number;
}

/** Where an observer on the ground looks, in the sky view. */
export interface SkyLook {
  /** Degrees from north through east, 0 to 360 (exclusive). */
  readonly azimuth: number;
  /** Degrees above the horizon, −90 to 90. */
  readonly altitude: number;
  /** Field of view on the narrower side of the screen, in degrees. */
  readonly fov: number;
}

/** The view: what a link names. Each slice's fields live in its file in `slices/` (#381). */
export interface ViewState extends DisplayState, HistoryState, DeepState, SheetsState {
  readonly mode: Mode;
  readonly time: Moment;
  readonly location: GeoPoint | null;
  readonly camera: GlobeCamera;
  readonly view: Viewpoint;
  readonly focus: Body;
  readonly layers: ReadonlySet<Layer>;
  readonly selection: Selection | null;
  readonly look: SkyLook;
}

// In the focused body's radii. For Earth, ~12.8 times the Sun's distance (23,455 Earth radii),
// so Saturn (up to ~11 AU away) fits in view; the scene caps other bodies at the same reach.
// The nearest is Earth's, about 50 km up, where its tiles show the ground at 1.85 km a pixel
// (#568); the other bodies, and Earth on graphics without its tiles, stop at `nearestDistance`.
// A link names any distance in the range; the scene then holds it to what the device allows.
export const CAMERA_DISTANCE_RANGE = { min: 1.008, max: 300_000 } as const;

/**
 * The nearest the camera comes to `body`, in its radii: Earth's tiles let it come closest where
 * the graphics take them on (`tiled`, #578); elsewhere 1.05 radii, where the maps are still sharp.
 */
export function nearestDistance(body: Body, tiled: boolean): number {
  return body === 'earth' && tiled ? CAMERA_DISTANCE_RANGE.min : 1.05;
}
/** None on a first visit (#634): readers turn layers on from the Layers panel. */
export const DEFAULT_LAYERS: ReadonlySet<Layer> = new Set<Layer>();

/**
 * Layers that once were and no longer are: old links naming them still open, without them.
 * Day and night are always drawn; places were never drawn.
 */
export const RETIRED_LAYERS: readonly string[] = ['terminator', 'places'];

/**
 * The layers that colour the ground itself: one at a time, as two together cannot be read.
 * Radiocarbon dates shade squares in oranges and pinks that read as ways of life or as states'
 * fills (#163).
 */
const GROUND_FILLS: readonly Layer[] = ['rocks', 'ways', 'dates'];

/** The layers with one turned on or off; turning a ground fill on turns the other off. */
export function withLayer(layers: ReadonlySet<Layer>, layer: Layer, on: boolean): Set<Layer> {
  const next = new Set(layers);
  if (!on) {
    next.delete(layer);
    return next;
  }
  if (GROUND_FILLS.includes(layer)) {
    for (const other of GROUND_FILLS) next.delete(other);
  }
  next.add(layer);
  return next;
}
/** The place to pin on the globe: none in deep time, whose maps today's place means nothing on (#948). */
export function pinnedPlace(state: ViewState): GeoPoint | null {
  return state.ma === null ? state.location : null;
}

/**
 * The view with `layer` turned on or off, wherever that is done (the Layers panel, an icon on
 * the zoom rail). Eclipses off let go of the one picked (#634).
 */
export function layerTurned(state: ViewState, layer: Layer, on: boolean): ViewState {
  const selection = layer === 'eclipses' && !on ? null : state.selection;
  // The spacecraft off take away the craft the camera was on (#796); the telescopes off, the
  // telescope on the ground it was at (#864).
  const gone =
    !on &&
    ((layer === 'spacecraft' && state.on?.kind === 'craft') ||
      (layer === 'telescopes' && state.on?.kind === 'site'));
  return {
    ...state,
    selection,
    on: gone ? null : state.on,
    layers: withLayer(state.layers, layer, on),
  };
}

/** The view with `layer` turned the other way: off if it was on, on if it was off. */
export function toggledLayer(state: ViewState, layer: Layer): ViewState {
  return layerTurned(state, layer, !state.layers.has(layer));
}

/** The view with an eclipse picked, and so the eclipses on (#634). */
export function withEclipse(state: ViewState, selection: Selection): ViewState {
  return { ...state, selection, layers: withLayer(state.layers, 'eclipses', true) };
}

export const DEFAULT_CAMERA: GlobeCamera = {
  target: { latitude: 20, longitude: 0 },
  // With a 40° field of view on the narrower side, the whole globe fits with a margin.
  distance: 4.5,
};

/** The ice-age scale: the Quaternary, 2.58 million years, rounded up to whole hundred thousands. */
export const ICE_AGES_MA = 2.6;
/** Where the ice-age scale opens from further back: the last glacial maximum. */
export const LAST_GLACIAL_MAXIMUM_MA = 0.021;

// Down to 1°: the Sun's or the Moon's disc then fills half the view.
export const SKY_FOV_RANGE = { min: 1, max: 120 } as const;
/** Facing south, a third of the way up: where the ecliptic runs, seen from the north. */
export const DEFAULT_LOOK: SkyLook = { azimuth: 180, altitude: 30, fov: 90 };

/** The moment `date` falls in, to the minute, in the Gregorian calendar. */
export function momentFromDate(date: Date): Moment {
  return {
    date: calendarDateOf(
      astronomicalYear(date.getUTCFullYear()),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
      'gregorian',
    ),
    minuteOfDay: date.getUTCHours() * 60 + date.getUTCMinutes(),
  };
}

export function momentJulianDay(moment: Moment): JulianDay {
  return julianDayNumber(julianDay(moment.date) + moment.minuteOfDay / 1440);
}

export function defaultViewState(now: Date): ViewState {
  return {
    mode: 'globe',
    time: momentFromDate(now),
    location: null,
    camera: DEFAULT_CAMERA,
    view: 'free',
    focus: 'earth',
    layers: DEFAULT_LAYERS,
    selection: null,
    look: DEFAULT_LOOK,
    ...DISPLAY_DEFAULTS,
    ...HISTORY_DEFAULTS,
    ...DEEP_DEFAULTS,
    ...SHEETS_DEFAULTS,
  };
}

/** Orbiting another body in the years: the bars and panels speak of it, not of Earth. */
/**
 * Whether the bar's time is the launches' (#702): the spacecraft on, in the years' globe, no
 * eclipse open. It runs the time instead of the years or a body's cycle.
 */
export function spacecraftPlays(state: ViewState): boolean {
  return (
    state.mode === 'globe' &&
    state.ma === null &&
    state.selection === null &&
    state.layers.has('spacecraft')
  );
}

/**
 * Whether the bar's time is ozone's own (#805): the ozone layer on, on Earth's globe in the
 * years, no eclipse open, and the spacecraft, which run the time first, off. The bar then
 * reaches only the years ozone has data for.
 */
export function ozonePlays(state: ViewState): boolean {
  return (
    state.mode === 'globe' &&
    state.ma === null &&
    state.selection === null &&
    state.focus === 'earth' &&
    state.layers.has('ozone') &&
    !state.layers.has('spacecraft')
  );
}

export function awayFromEarth(state: ViewState): boolean {
  return state.mode === 'globe' && state.focus !== 'earth' && state.ma === null;
}

/**
 * Whether a tap on the globe clears the panels, or brings them back, rather than picking a
 * place (#811): in deep time, which has no place to stand, and in the ozone section, which is
 * about the whole layer.
 */
export function tapClears(state: ViewState): boolean {
  return state.ma !== null || ozonePlays(state);
}
