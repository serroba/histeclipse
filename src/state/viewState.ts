/**
 * Everything needed to reproduce a view: the URL is a complete, shareable description of it.
 * See `url.ts` for the query-string format.
 */

import type { SkyCulture } from '../data/skyCultures';
import { type CoastSource, DEFAULT_COAST } from '../deepTime/coastline';
import { DEFAULT_SEA_ICE_MODEL, type SeaIceModel } from '../data/seaIce';
import { DEFAULT_TEMPERATURE_MODEL, type TemperatureModel } from '../deepTime/temperatureModels';
import type { SunLayer } from '../data/sunImages';
import type { YearCalendar } from '../time/calendars';
import {
  calendarDateOf,
  julianDay,
  julianDayNumber,
  type Calendar,
  type CalendarDate,
  type JulianDay,
} from '../time/julianDay';
import { astronomicalYear } from '../time/year';

export const MODES = ['globe', 'sky'] as const;
export type Mode = (typeof MODES)[number];

/** Whose borders of past states the empires layer shows. */
export const BORDER_SOURCES = ['cliopatria', 'ohm', 'both'] as const;
/**
 * Deep time's span: the 540 million years the elevation maps cover, the ice ages of the last
 * 2.6 million, or all of Earth's 4.6 billion.
 */
export const DEEP_SCALES = ['all', 'ice', 'eons'] as const;
export type DeepScale = (typeof DEEP_SCALES)[number];
export type BorderSource = (typeof BORDER_SOURCES)[number];

export const LAYERS = [
  'lunar',
  'solar',
  'terminator',
  'places',
  'empires',
  // Deep time only: the surface coloured by temperature, and sea level through time.
  'temperature',
  'sealevel',
  // Deep time: a second reconstruction's continents, outlined.
  'plates',
] as const;
export type Layer = (typeof LAYERS)[number];

/**
 * How the camera is placed: orbiting Earth freely, or attached to the bodies (standing on Earth
 * looking at the Moon, or on the Moon looking at Earth) and following them through time.
 */
export const VIEWPOINTS = ['free', 'moon-from-earth', 'earth-from-moon'] as const;
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
] as const;
export type Body = (typeof BODIES)[number];

/** Which constellation figures the sky view draws: the best-known ones, all 88, or none. */
export const FIGURES = ['famous', 'all', 'none'] as const;
export type Figures = (typeof FIGURES)[number];

export const ECLIPSE_KINDS = ['lunar', 'solar'] as const;
export type EclipseKind = (typeof ECLIPSE_KINDS)[number];

export interface GeoPoint {
  /** Degrees, −90 to 90. */
  readonly latitude: number;
  /** Degrees, −180 (exclusive) to 180. */
  readonly longitude: number;
}

/** A calendar day plus a time of day, in Universal Time, to the minute. */
export interface Moment {
  /** `day` is a whole number here; the time of day lives in `minuteOfDay`. */
  readonly date: CalendarDate;
  /** 0 to 1439. */
  readonly minuteOfDay: number;
}

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

export interface Selection {
  readonly kind: EclipseKind;
  /** Day of greatest eclipse, as a whole calendar day. */
  readonly date: CalendarDate;
}

export interface ViewState {
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
  /** Whose constellations the sky view draws. */
  readonly culture: SkyCulture;
  /** Whose borders the empires layer draws. */
  readonly borders: BorderSource;
  /** A past state (by its name in Cliopatria) whose eclipses the year bar picks out, if any. */
  readonly seenIn: string | null;
  /** Deep time: millions of years ago the globe shows Earth's surface for; null for history. */
  readonly ma: number | null;
  /** Which span the deep-time bar runs over. */
  readonly deepScale: DeepScale;
  /** Whose sea level the ice-age coastlines follow. */
  readonly coast: CoastSource;
  /** Which climate model's ice-age sea ice the globe blends towards. */
  readonly seaIce: SeaIceModel;
  /** Whose temperature maps colour the deep-time globe. */
  readonly temperatureModel: TemperatureModel;
}

// In the focused body's radii. For Earth, ~12.8 times the Sun's distance (23,455 Earth radii),
// so Saturn (up to ~11 AU away) fits in view; the scene caps other bodies at the same reach.
export const CAMERA_DISTANCE_RANGE = { min: 1.1, max: 300_000 } as const;
export const DEFAULT_LAYERS: ReadonlySet<Layer> = new Set<Layer>(['lunar', 'solar', 'terminator']);
export const DEFAULT_CAMERA: GlobeCamera = {
  target: { latitude: 20, longitude: 0 },
  // With a 40° field of view on the narrower side, the whole globe fits with a margin.
  distance: 4.5,
};

/** How far back deep time reaches, millions of years: the oldest elevation map. */
/** Deep time reaches back to the oldest solids of the Solar System (Connelly et al. 2012). */
export const EARTH_AGE_MA = 4568;
export const MA_RANGE = { min: 0, max: EARTH_AGE_MA } as const;

/** The ice-age scale: the Quaternary, 2.58 million years, rounded up to whole hundred thousands. */
export const ICE_AGES_MA = 2.6;
/** Where the ice-age scale opens from further back: the last glacial maximum. */
export const LAST_GLACIAL_MAXIMUM_MA = 0.021;

/** Deep-time moments are kept to a thousand years, fine enough for the ice ages. */
export function roundMa(ma: number): number {
  return Math.round(ma * 1000) / 1000;
}

export const SKY_FOV_RANGE = { min: 5, max: 120 } as const;
/** Facing south, a third of the way up: where the ecliptic runs, seen from the north. */
export const DEFAULT_LOOK: SkyLook = { azimuth: 180, altitude: 30, fov: 90 };

/** The calendar historians use for a date: Julian before 1582-10-15, Gregorian from then on. */
export function defaultCalendarFor(year: number, month: number, day: number): Calendar {
  const isBeforeReform =
    year < 1582 || (year === 1582 && (month < 10 || (month === 10 && day < 15)));
  return isBeforeReform ? 'julian' : 'gregorian';
}

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
    culture: 'modern',
    borders: 'cliopatria',
    seenIn: null,
    ma: null,
    deepScale: 'all',
    coast: DEFAULT_COAST,
    seaIce: DEFAULT_SEA_ICE_MODEL,
    temperatureModel: DEFAULT_TEMPERATURE_MODEL,
  };
}
