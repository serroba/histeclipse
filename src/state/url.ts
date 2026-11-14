/**
 * The query-string format for shareable links.
 *
 *   ?v=1&mode=globe&t=-0620-04-22T07:20Z&cal=julian&loc=32.5422,44.4209
 *     &cam=20.0000,0.0000,3.00&view=moon-from-earth&layers=lunar,solar&sel=lunar:-0620-04-22
 *
 * - `t` is Universal Time with ISO-8601 astronomical years (−0620 is 621 BCE).
 * - `cal` is the calendar `t` is written in. When missing, it is the one in use at the
 *   time: Julian before 1582-10-15, Gregorian after. `sel` dates always use that rule.
 * - `cam` is relative to the body in `focus` (absent means Earth): a point on its surface and
 *   a distance in its radii.
 * - `look` is where the observer at `loc` faces in the sky view: azimuth from north through
 *   east, altitude, and field of view, in degrees. It is written whenever `mode=sky`.
 * - The rest are in the view state's slices, each with its fields (#381): how things are shown
 *   (`slices/display.ts`), the history layers (`slices/history.ts`), deep time
 *   (`slices/deep.ts`) and the sheets a link opens (`slices/sheets.ts`). They are written in
 *   that order, and only when not at their defaults.
 * - `loc` (observer), `sel` (selected eclipse), `view` (an attached viewpoint; absent means
 *   free) and `focus` are optional; everything else is always written out, so a link keeps its meaning
 *   even if defaults change later.
 *
 * Parsing never throws. Bad values fall back to defaults and produce a warning the UI can
 * show, so a mangled link still opens something sensible.
 */

import { calendarDate, calendarDateOf, julianDay, type Calendar } from '../time/julianDay';
import { astronomicalYear } from '../time/year';
import { errorMessage } from '../util/errors';
import { oneOf, readSlice, writeSlice } from './slice';
import { DEEP_PARAMS } from './slices/deep';
import { DISPLAY_PARAMS } from './slices/display';
import { HISTORY_PARAMS } from './slices/history';
import { SHEETS_PARAMS } from './slices/sheets';
import {
  CAMERA_DISTANCE_RANGE,
  DEFAULT_LOOK,
  SKY_FOV_RANGE,
  ECLIPSE_KINDS,
  LAYERS,
  BODIES,
  MODES,
  RETIRED_LAYERS,
  VIEWPOINTS,
  defaultCalendarFor,
  defaultViewState,
  withEclipse,
  type Body,
  type EclipseKind,
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

const URL_VERSION = 1;

export interface ParseResult {
  readonly state: ViewState;
  /** Human-readable notes about parameters that were ignored. */
  readonly warnings: readonly string[];
}

// The Holocene's start, 11,700 years before 2000 (9700 BCE), as far back as ΔT reaches; the latest
// year the format supports.
const YEAR_RANGE = { min: -9699, max: 9999 } as const;

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
    ...readSlice(DISPLAY_PARAMS, defaults, read),
    ...readSlice(HISTORY_PARAMS, defaults, read),
    ...readSlice(DEEP_PARAMS, defaults, read),
    ...readSlice(SHEETS_PARAMS, defaults, read),
  };
  if (calendar !== null && !params.has('t')) {
    warnings.push('Ignored cal: it only applies together with t');
  }
  // A link that picks an eclipse turns the eclipses on (#634).
  if (state.selection !== null && !state.layers.has('eclipses')) {
    return { state: withEclipse(state, state.selection), warnings };
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
  const set = (key: string, value: string): void => {
    params.set(key, value);
  };
  for (const slice of [DISPLAY_PARAMS, HISTORY_PARAMS, DEEP_PARAMS, SHEETS_PARAMS]) {
    writeSlice<object>(slice, state, set);
  }
  // Commas and colons are safe in query values; keeping them literal keeps links readable.
  return params.toString().replaceAll('%2C', ',').replaceAll('%3A', ':');
}

function parseMode(raw: string): Mode {
  return oneOf(raw, MODES, 'mode');
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

/** Layers that became one (#634): the eclipses' shadows and the Moon's, now `eclipses`. */
const MERGED_LAYERS: Readonly<Record<string, Layer>> = { lunar: 'eclipses', solar: 'eclipses' };

function parseLayers(raw: string): ReadonlySet<Layer> {
  if (raw === '') return new Set();
  return new Set(
    raw
      .split(',')
      .filter((name) => !RETIRED_LAYERS.includes(name))
      .map((name) => MERGED_LAYERS[name] ?? oneOf(name, LAYERS, 'layer')),
  );
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
  const lat = fixed(latitude, 4);
  // At a pole every longitude is the same point: write 0, so a link to the pole stays as it
  // was, not some longitude a camera a hair off the pole happens to report (#373).
  return `${lat},${Math.abs(Number(lat)) === 90 ? fixed(0, 4) : fixed(longitude, 4)}`;
}

function formatCamera({ target, distance }: GlobeCamera): string {
  // A third decimal near the ground, where a hundredth of Earth's radius is 64 km (#568).
  return `${formatGeoPoint(target)},${fixed(distance, distance < 1.1 ? 3 : 2)}`;
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
