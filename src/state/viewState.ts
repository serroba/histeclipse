/**
 * Everything needed to reproduce a view: the URL is a complete, shareable description of it.
 * See `url.ts` for the query-string format.
 */

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

export const LAYERS = ['lunar', 'solar', 'terminator', 'places'] as const;
export type Layer = (typeof LAYERS)[number];

/**
 * How the camera is placed: orbiting Earth freely, or attached to the bodies (standing on Earth
 * looking at the Moon, or on the Moon looking at Earth) and following them through time.
 */
export const VIEWPOINTS = ['free', 'moon-from-earth', 'earth-from-moon'] as const;
export type Viewpoint = (typeof VIEWPOINTS)[number];

/** The bodies the camera can centre on and orbit. */
export const BODIES = ['earth', 'moon', 'sun'] as const;
export type Body = (typeof BODIES)[number];

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
}

// In the focused body's radii. For Earth, ~5 times the Sun's distance (23,455 Earth radii), so
// Earth, Moon and Sun fit in view; the scene caps other bodies at the same reach.
export const CAMERA_DISTANCE_RANGE = { min: 1.1, max: 120_000 } as const;
export const DEFAULT_LAYERS: ReadonlySet<Layer> = new Set<Layer>(['lunar', 'solar', 'terminator']);
export const DEFAULT_CAMERA: GlobeCamera = {
  target: { latitude: 20, longitude: 0 },
  // With a 40° field of view on the narrower side, the whole globe fits with a margin.
  distance: 4.5,
};

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
  };
}
