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

export interface GlobeCamera {
  /** The point on Earth the camera looks at. */
  readonly target: GeoPoint;
  /** Distance from Earth's center, in Earth radii. */
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
  readonly layers: ReadonlySet<Layer>;
  readonly selection: Selection | null;
}

export const CAMERA_DISTANCE_RANGE = { min: 1.1, max: 50 } as const;
export const DEFAULT_LAYERS: ReadonlySet<Layer> = new Set<Layer>(['lunar', 'terminator']);
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
    layers: DEFAULT_LAYERS,
    selection: null,
  };
}
