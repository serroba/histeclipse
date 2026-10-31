/**
 * The query-string format for shareable links.
 *
 *   ?v=1&mode=globe&t=-0620-04-22T07:20Z&cal=julian&loc=32.5422,44.4209
 *     &cam=20.0000,0.0000,3.00&view=moon-from-earth&layers=lunar,terminator&sel=lunar:-0620-04-22
 *
 * - `t` is Universal Time with ISO-8601 astronomical years (−0620 is 621 BCE).
 * - `cal` is the calendar `t` is written in. When missing, it is the one in use at the
 *   time: Julian before 1582-10-15, Gregorian after. `sel` dates always use that rule.
 * - `cam` is relative to the body in `focus` (absent means Earth): a point on its surface and
 *   a distance in its radii.
 * - `look` is where the observer at `loc` faces in the sky view: azimuth from north through
 *   east, altitude, and field of view, in degrees. It is written whenever `mode=sky`.
 * - `figures` picks the constellation figures the sky view draws: `famous` (absent), `all`
 *   or `none`.
 * - `years` is the calendar the year bar counts in: `western` (absent), `hebrew`, `islamic`,
 *   `egyptian` or `roman`. It changes how years are listed, not the moment in `t`.
 * - `loc` (observer), `sel` (selected eclipse), `view` (an attached viewpoint; absent means
 *   free) and `focus` are optional; everything else is always written out, so a link keeps its meaning
 *   even if defaults change later.
 *
 * Parsing never throws. Bad values fall back to defaults and produce a warning the UI can
 * show, so a mangled link still opens something sensible.
 */

import { calendarDate, calendarDateOf, julianDay, type Calendar } from '../time/julianDay';
import { YEAR_CALENDARS, type YearCalendar } from '../time/calendars';
import { astronomicalYear } from '../time/year';
import { errorMessage } from '../util/errors';
import {
  CAMERA_DISTANCE_RANGE,
  DEFAULT_LOOK,
  FIGURES,
  SKY_FOV_RANGE,
  ECLIPSE_KINDS,
  LAYERS,
  BODIES,
  MODES,
  VIEWPOINTS,
  defaultCalendarFor,
  defaultViewState,
  type Body,
  type EclipseKind,
  type Figures,
  type GeoPoint,
  type GlobeCamera,
  type Layer,
  type Mode,
  type Moment,
  type Selection,
  type SkyLook,
  type Viewpoint,
  type ViewState,
} from './viewState';

export const URL_VERSION = 1;

export interface ParseResult {
  readonly state: ViewState;
  /** Human-readable notes about parameters that were ignored. */
  readonly warnings: readonly string[];
}

// Earliest year with a non-negative Julian Day; the latest the format supports.
const YEAR_RANGE = { min: -4712, max: 9999 } as const;

const DATE_PATTERN = /^([+-]?\d{1,6})-(\d{2})-(\d{2})$/;
const MOMENT_PATTERN = /^([+-]?\d{1,6}-\d{2}-\d{2})(?:T(\d{2}):(\d{2})Z?)?$/;

export function parseViewState(query: string | URLSearchParams, now: Date): ParseResult {
  const params = typeof query === 'string' ? new URLSearchParams(query) : query;
  const defaults = defaultViewState(now);
  const warnings: string[] = [];

  function read<T>(name: string, parse: (raw: string) => T, fallback: T): T {
    const values = params.getAll(name);
    // When a parameter repeats (e.g. someone appended to a link), the last one wins.
    const raw = values.at(-1);
    if (raw === undefined) return fallback;
    if (values.length > 1) {
      warnings.push(`${name} appears ${String(values.length)} times; using the last one`);
    }
    try {
      return parse(raw);
    } catch (error) {
      warnings.push(`Ignored ${name}=${JSON.stringify(raw)}: ${errorMessage(error)}`);
      return fallback;
    }
  }

  const version = params.getAll('v').at(-1) ?? null;
  if (version !== null && version !== String(URL_VERSION)) {
    warnings.push(
      `This link uses format v=${version}; this version of the site reads v=${String(URL_VERSION)}, so some settings may not apply.`,
    );
  }

  const calendar = read<Calendar | null>('cal', parseCalendar, null);
  const state: ViewState = {
    mode: read('mode', parseMode, defaults.mode),
    time: read('t', (raw) => parseMoment(raw, calendar), defaults.time),
    location: read<GeoPoint | null>('loc', parseGeoPoint, defaults.location),
    camera: read('cam', parseCamera, defaults.camera),
    view: read('view', parseViewpoint, defaults.view),
    focus: read('focus', parseFocus, defaults.focus),
    layers: read('layers', parseLayers, defaults.layers),
    selection: read<Selection | null>('sel', parseSelection, defaults.selection),
    look: read('look', parseLook, defaults.look),
    figures: read('figures', parseFigures, defaults.figures),
    years: read('years', parseYears, defaults.years),
  };
  if (calendar !== null && !params.has('t')) {
    warnings.push('Ignored cal: it only applies together with t');
  }
  return { state, warnings };
}

export function serializeViewState(state: ViewState): string {
  const params = new URLSearchParams();
  params.set('v', String(URL_VERSION));
  params.set('mode', state.mode);
  params.set('t', formatMoment(state.time));
  params.set('cal', state.time.date.calendar);
  if (state.location !== null) params.set('loc', formatGeoPoint(state.location));
  params.set('cam', formatCamera(state.camera));
  // The default free view is left out, so links from before viewpoints existed read the same.
  if (state.view !== 'free') params.set('view', state.view);
  if (state.focus !== 'earth') params.set('focus', state.focus);
  params.set('layers', LAYERS.filter((layer) => state.layers.has(layer)).join(','));
  if (state.selection !== null) params.set('sel', formatSelection(state.selection));
  if (state.mode === 'sky' || !sameLook(state.look, DEFAULT_LOOK)) {
    params.set('look', formatLook(state.look));
  }
  if (state.figures !== 'famous') params.set('figures', state.figures);
  if (state.years !== 'western') params.set('years', state.years);
  // Commas and colons are safe in query values; keeping them literal keeps links readable.
  return params.toString().replaceAll('%2C', ',').replaceAll('%3A', ':');
}

function parseMode(raw: string): Mode {
  return oneOf(raw, MODES, 'mode');
}

function parseFigures(raw: string): Figures {
  return oneOf(raw, FIGURES, 'figures');
}

function parseYears(raw: string): YearCalendar {
  return oneOf(raw, YEAR_CALENDARS, 'years');
}

function parseLook(raw: string): SkyLook {
  const [azimuth, altitude, fov] = numbers(raw, 3);
  if (altitude < -90 || altitude > 90) throw new Error('altitude must be between -90 and 90');
  const { min, max } = SKY_FOV_RANGE;
  if (fov < min || fov > max) {
    throw new Error(`field of view must be between ${String(min)} and ${String(max)} degrees`);
  }
  return {
    azimuth: azimuth >= 0 && azimuth < 360 ? azimuth : ((azimuth % 360) + 360) % 360,
    altitude,
    fov,
  };
}

function sameLook(a: SkyLook, b: SkyLook): boolean {
  return a.azimuth === b.azimuth && a.altitude === b.altitude && a.fov === b.fov;
}

function formatLook({ azimuth, altitude, fov }: SkyLook): string {
  return `${fixed(azimuth, 1)},${fixed(altitude, 1)},${fixed(fov, 1)}`;
}

function parseViewpoint(raw: string): Viewpoint {
  return oneOf(raw, VIEWPOINTS, 'view');
}

function parseFocus(raw: string): Body {
  return oneOf(raw, BODIES, 'focus');
}

function parseCalendar(raw: string): Calendar {
  return oneOf(raw, ['julian', 'gregorian'] as const, 'calendar');
}

function parseDateParts(raw: string): [number, number, number] {
  const match = DATE_PATTERN.exec(raw);
  if (match === null) throw new Error('expected a date like -0620-04-22');
  const [, year = '', month = '', day = ''] = match;
  const parts: [number, number, number] = [Number(year), Number(month), Number(day)];
  if (parts[0] < YEAR_RANGE.min || parts[0] > YEAR_RANGE.max) {
    throw new Error(`year must be between ${String(YEAR_RANGE.min)} and ${String(YEAR_RANGE.max)}`);
  }
  return parts;
}

function parseMoment(raw: string, calendar: Calendar | null): Moment {
  const match = MOMENT_PATTERN.exec(raw);
  if (match === null) throw new Error('expected a time like -0620-04-22T07:20Z');
  const [, datePart = '', hours = '0', minutes = '0'] = match;
  const [year, month, day] = parseDateParts(datePart);
  const hour = Number(hours);
  const minute = Number(minutes);
  if (hour > 23 || minute > 59) throw new Error('time of day must be 00:00 to 23:59');
  const date = calendarDateOf(
    astronomicalYear(year),
    month,
    day,
    calendar ?? defaultCalendarFor(year, month, day),
  );
  return { date, minuteOfDay: hour * 60 + minute };
}

function parseGeoPoint(raw: string): GeoPoint {
  const [latitude, longitude] = numbers(raw, 2);
  if (latitude < -90 || latitude > 90) throw new Error('latitude must be between -90 and 90');
  return { latitude, longitude: normalizeLongitude(longitude) };
}

function parseCamera(raw: string): GlobeCamera {
  const [latitude, longitude, distance] = numbers(raw, 3);
  const target = parseGeoPoint(`${String(latitude)},${String(longitude)}`);
  const { min, max } = CAMERA_DISTANCE_RANGE;
  if (distance < min || distance > max) {
    throw new Error(`distance must be between ${String(min)} and ${String(max)} Earth radii`);
  }
  return { target, distance };
}

function parseLayers(raw: string): ReadonlySet<Layer> {
  if (raw === '') return new Set();
  return new Set(raw.split(',').map((name) => oneOf(name, LAYERS, 'layer')));
}

function parseSelection(raw: string): Selection {
  const separator = raw.indexOf(':');
  if (separator < 0) throw new Error('expected kind:date, like lunar:-0620-04-22');
  const kind: EclipseKind = oneOf(raw.slice(0, separator), ECLIPSE_KINDS, 'eclipse kind');
  const [year, month, day] = parseDateParts(raw.slice(separator + 1));
  const date = calendarDateOf(
    astronomicalYear(year),
    month,
    day,
    defaultCalendarFor(year, month, day),
  );
  return { kind, date };
}

function formatYear(year: number): string {
  const digits = String(Math.abs(year)).padStart(4, '0');
  return year < 0 ? `-${digits}` : digits;
}

function formatDate(year: number, month: number, day: number): string {
  return `${formatYear(year)}-${pad2(month)}-${pad2(day)}`;
}

function formatMoment({ date, minuteOfDay }: Moment): string {
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  return `${formatDate(date.year, date.month, date.day)}T${pad2(hours)}:${pad2(minutes)}Z`;
}

function formatGeoPoint({ latitude, longitude }: GeoPoint): string {
  return `${fixed(latitude, 4)},${fixed(longitude, 4)}`;
}

function formatCamera({ target, distance }: GlobeCamera): string {
  return `${formatGeoPoint(target)},${fixed(distance, 2)}`;
}

function formatSelection({ kind, date }: Selection): string {
  // Selection dates are always written in the calendar in use at the time.
  const year = date.year;
  const calendar = defaultCalendarFor(year, date.month, date.day);
  const shown = calendar === date.calendar ? date : calendarDate(julianDay(date), calendar);
  return `${kind}:${formatDate(shown.year, shown.month, Math.floor(shown.day))}`;
}

function numbers(raw: string, count: 2): [number, number];
function numbers(raw: string, count: 3): [number, number, number];
function numbers(raw: string, count: number): number[] {
  const parts = raw.split(',');
  if (parts.length !== count) {
    throw new Error(`expected ${String(count)} comma-separated numbers`);
  }
  return parts.map((part) => {
    const value = part.trim() === '' ? Number.NaN : Number(part);
    if (!Number.isFinite(value)) throw new Error(`${JSON.stringify(part)} is not a number`);
    return value;
  });
}

function oneOf<const T extends string>(raw: string, options: readonly T[], what: string): T {
  const match = options.find((option) => option === raw);
  if (match === undefined) {
    throw new Error(`unknown ${what}; expected one of ${options.join(', ')}`);
  }
  return match;
}

/** Wrap into (−180, 180]. Values already in range are returned untouched, to avoid float noise. */
function normalizeLongitude(longitude: number): number {
  if (longitude > -180 && longitude <= 180) return longitude;
  const wrapped = ((((longitude + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
}

/** Fixed decimals without a stray minus sign on values that round to zero. */
function fixed(value: number, digits: number): string {
  const text = value.toFixed(digits);
  return Number(text) === 0 ? (0).toFixed(digits) : text;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}
