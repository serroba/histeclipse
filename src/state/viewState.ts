/**
 * Everything needed to reproduce a view: the URL is a complete, shareable description of it.
 * See `url.ts` for the query-string format.
 */

import type { GeoPoint } from '../core/geo';
import { DEEP_SCALES, EARTH_AGE_MA, roundMa, type DeepScale } from '../deepTime/scale';
import { ECLIPSE_KINDS, type EclipseKind, type Selection } from '../eclipses/kind';
import { defaultCalendarFor, type Moment } from '../time/moment';

// Defined below state, where the domain needs them; re-exported for the layers above (#378).
export type { DeepScale, EclipseKind, GeoPoint, Moment, Selection };
export { DEEP_SCALES, defaultCalendarFor, EARTH_AGE_MA, ECLIPSE_KINDS, roundMa };
import { MOONS } from '../astro/moonOrbits';
import type { SkyCulture } from '../data/skyCultures';
import type { LineageGroup } from '../data/lineages';
import type { WhyView } from '../sources/registry';
import type { SunLayer } from '../data/sunImages';
import type { YearCalendar } from '../time/calendars';
import { calendarDateOf, julianDay, julianDayNumber, type JulianDay } from '../time/julianDay';
import { astronomicalYear } from '../time/year';
import { DEEP_DEFAULTS, type DeepState } from './slices/deep';

export { DISPERSAL_SCENARIOS, type DispersalScenario } from './slices/deep';

export const MODES = ['globe', 'sky'] as const;
export type Mode = (typeof MODES)[number];

/** Whose borders of past states the empires layer shows. */
export const BORDER_SOURCES = ['cliopatria', 'ohm', 'both'] as const;

/** How far the time bar reaches: the Holocene's years, or one of deep time's scales. */
export type Span = 'years' | DeepScale;
export const SPAN_LABELS: Readonly<Record<Span, string>> = {
  years: 'Years',
  ice: 'Ice ages',
  all: '540 Myr',
  eons: '4.6 Gyr',
};
export type BorderSource = (typeof BORDER_SOURCES)[number];

export const LAYERS = [
  'lunar',
  'solar',
  // The orbits of Earth and the planets, seen from far out or from the Sun or a planet.
  'orbits',
  // Every craft sent beyond Earth orbit, flying as the time plays (#350).
  'spacecraft',
  // The main belt's asteroids at least 100 km across, going round the Sun (#372).
  'asteroids',
  'empires',
  // Dated ancient genomes (AADR), counted by region around the year shown.
  'genomes',
  // How people lived by region (ArchaeoGLOBE): foraging, herding, farming, towns.
  'ways',
  // The rocks at the surface today and how old they are (Macrostrat).
  'rocks',
  // Named periods for the place picked (PeriodO), each by its source.
  'periods',
  // Archaeological radiocarbon dates (p3k14c), calibrated, by cell and 250 years.
  'dates',
  // Impact craters and deposits (Impact Earth), in either time: where they lay then.
  'impacts',
  // Volcanoes erupting near the year shown (Smithsonian GVP).
  'volcanoes',
  // Deep time only: the surface coloured by temperature, and sea level through time.
  'temperature',
  'sealevel',
  // Deep time: a second reconstruction's continents, outlined.
  'plates',
  // Deep time: dated finds of our species and its relatives.
  'humans',
  // Deep time: carbon dioxide and methane from the ice cores.
  'air',
  // The years: carbon-14 in the air (IntCal20, SHCal20), why a radiocarbon date is a range.
  'radiocarbon',
  // Where cosmic rays make carbon-14, by latitude, for a field and a Sun (Kovaltsov et al. 2012).
  'carbonMade',
  // Deep time: fossils of four groups of animals, where they lay then.
  'fossils',
] as const;
/** How a planet is shown close up: as it looks, or another way where a mission gives one:
 * Venus's ground by radar, Mercury's minerals in enhanced colour, Jupiter recently. */
export const PLANET_LIGHTS = ['look', 'radar', 'minerals', 'recent', 'height', 'haze'] as const;
export type PlanetLight = (typeof PLANET_LIGHTS)[number];

export type Layer = (typeof LAYERS)[number];

/** The planetary boundaries' story's chapters (#434), in order; the Holocene's first (#453). */
export const BOUNDARY_CHAPTERS = ['holocene', 'safe', 'pressure', 'compare'] as const;
export type BoundaryChapter = (typeof BOUNDARY_CHAPTERS)[number];

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

/** Which constellation figures the sky view draws: the best-known ones, all 88, or none. */
export const FIGURES = ['famous', 'all', 'none'] as const;
export type Figures = (typeof FIGURES)[number];

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
export interface ViewState extends DeepState {
  readonly mode: Mode;
  readonly time: Moment;
  readonly location: GeoPoint | null;
  readonly camera: GlobeCamera;
  readonly view: Viewpoint;
  readonly focus: Body;
  readonly layers: ReadonlySet<Layer>;
  readonly selection: Selection | null;
  readonly look: SkyLook;
  readonly figures: Figures;
  /** The calendar the year bar counts in. */
  readonly years: YearCalendar;
  /** The channel of light the Sun is shown in, close up. */
  readonly sunLayer: SunLayer;
  /** How a planet is shown close up (#239): as it looks, or by another light where it has one. */
  readonly planetLight: PlanetLight;
  /** Whose constellations the sky view draws. */
  readonly culture: SkyCulture;
  /** Whose borders the empires layer draws. */
  readonly borders: BorderSource;
  /** A past state (by its name in Cliopatria) whose eclipses the year bar picks out, if any. */
  readonly seenIn: string | null;
  /** The why panel open: what it explains, or every source; null when closed. */
  readonly why: WhyView | null;
  /**
   * The tree of life open (#300): the whole tree, or the node an Open Tree of Life id names, its
   * line back to the root lit; null when closed.
   */
  readonly tree: TreeView | null;
  /**
   * The impacts' paths through time open (#304): all of them, or one crater's (its Impact Earth
   * Database id) picked out; null when closed.
   */
  readonly craters: CratersView | null;
  /** How the impacts' paths are drawn (#322): on a flat map, or in a 3D box with time as depth. */
  readonly cratersIn: CratersShape;
  /**
   * A fossil group's genera through time and place open (#358): the group, and the genus or
   * group within it picked out (its PBDB number); null when closed.
   */
  readonly lineages: LineagesView | null;
  /** The planetary boundaries' story open (#434), at a chapter; null when closed. */
  readonly boundaries: BoundaryChapter | null;
}

/** What the lineages through time show: a fossil group, and one of its names picked out. */
export interface LineagesView {
  readonly group: LineageGroup;
  readonly pick: number | null;
}

export const CRATERS_SHAPES = ['map', 'box'] as const;
export type CratersShape = (typeof CRATERS_SHAPES)[number];

/** What the impacts' paths show: all of them, or one crater's picked out. */
export type CratersView = 'all' | { readonly id: number };

/** What the tree of life shows: all of it, or one taxon's place in it (its Open Tree id). */
export type TreeView = 'all' | { readonly ott: number };

// In the focused body's radii. For Earth, ~12.8 times the Sun's distance (23,455 Earth radii),
// so Saturn (up to ~11 AU away) fits in view; the scene caps other bodies at the same reach.
export const CAMERA_DISTANCE_RANGE = { min: 1.05, max: 300_000 } as const;
export const DEFAULT_LAYERS: ReadonlySet<Layer> = new Set<Layer>(['lunar', 'solar']);

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
    figures: 'famous',
    years: 'western',
    sunLayer: 'visible',
    planetLight: 'look',
    culture: 'modern',
    borders: 'cliopatria',
    seenIn: null,
    ...DEEP_DEFAULTS,
    why: null,
    tree: null,
    craters: null,
    cratersIn: 'map',
    lineages: null,
    boundaries: null,
  };
}

/** Orbiting another body in the years: the bars and panels speak of it, not of Earth. */
export function awayFromEarth(state: ViewState): boolean {
  return state.mode === 'globe' && state.focus !== 'earth' && state.ma === null;
}
