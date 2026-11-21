/**
 * One time axis, from Earth's formation to today (#1073), over the two ways the site keeps time:
 *
 * - the years', calendar dates within the Holocene track (9700 BCE on), where ΔT, the eclipses and
 *   the calendars hold to the day; and
 * - deep time's, millions of years before 1950 kept to a thousand years (`roundMa`).
 *
 * A point on the axis is an astronomical year (year 0 is 1 BCE). Deep time's Ma map onto it as
 * 1950 − ma × 10⁶, 1950 being "present" in years before present (BP), as radiocarbon has it; so
 * 0 Ma is 1950, not today, and the 76 years since sit at the young end of both.
 *
 * A window on the axis is read in one model or the other, never a mix: in the years' when it
 * lies wholly within the Holocene track, else in deep time's. Zooming into the Holocene hands
 * over to the years at the moment the window's start passes 9700 BCE; zooming out hands back. A
 * window held in one model keeps its precision: whole years in the years', a thousand years in
 * deep time's, so no zoom implies a date finer than the record it reads.
 *
 * Pure: windows in and out. The bars, the link (`yw`, `scale`) and playing keep their own parts.
 */

import { EARTH_AGE_MA, roundMa, type DeepScale } from '../deepTime/scale';
import { ICE_AGES_MA } from './viewState';

/** Where years before present count from: 0 Ma is 1950. */
const BP_ZERO = 1950;

/** 9700 BCE, the Holocene track's first year, as far back as ΔT reaches (astronomical year). */
export const YEARS_FIRST = -9699;

/** The 540 million years the elevation maps reach, the 540 Myr span's start unless told. */
export const MAPS_REACH_MA = 540;

/** The narrowest window in the years' model: a decade still reads on the bar (`yearsWindow`). */
export const NARROWEST_YEARS = 10;

/** The narrowest window in deep time's model: ten of its thousand-year steps. */
export const NARROWEST_DEEP = 10_000;

/** A point on the axis: an astronomical year, fractional only in passing. */
export type AxisYear = number;

/** A window on the axis, `first` older than `last`. */
export interface AxisWindow {
  readonly first: AxisYear;
  readonly last: AxisYear;
}

/** The model a window is read in. */
export type TimeModel = 'years' | 'deep';

/** The spans as presets of the window: the years, the ice ages, 540 Myr, all of Earth's history. */
export type Span = 'years' | DeepScale;

/** A moment on the axis, in the model it is read in: a calendar year, or Ma to 1,000 years. */
export type AxisMoment =
  | { readonly model: 'years'; readonly year: number }
  | { readonly model: 'deep'; readonly ma: number };

/** The year `ma` million years before 1950. */
export function yearOfMa(ma: number): AxisYear {
  return BP_ZERO - ma * 1e6;
}

/** Millions of years before 1950 of `year`; negative after 1950. */
export function maOfYear(year: AxisYear): number {
  return (BP_ZERO - year) / 1e6;
}

/** The oldest point on the axis: the oldest solids of the Solar System (`EARTH_AGE_MA`). */
export const EARTH_FIRST: AxisYear = yearOfMa(EARTH_AGE_MA);

/** The model a window is read in: the years' wholly within the Holocene track, else deep time's. */
export function modelOf(window: AxisWindow): TimeModel {
  return window.first >= YEARS_FIRST ? 'years' : 'deep';
}

/** A span's window, from its start to `present` (the last year the bars reach). */
export function presetWindow(span: Span, present: number, mapsReach = MAPS_REACH_MA): AxisWindow {
  const first =
    span === 'years'
      ? YEARS_FIRST
      : yearOfMa(span === 'ice' ? ICE_AGES_MA : span === 'all' ? mapsReach : EARTH_AGE_MA);
  return { first, last: present };
}

const SPANS: readonly Span[] = ['years', 'ice', 'all', 'eons'];

/** The span a window is exactly, if it is one. */
export function presetOf(
  window: AxisWindow,
  present: number,
  mapsReach = MAPS_REACH_MA,
): Span | null {
  return (
    SPANS.find((span) => {
      const preset = presetWindow(span, present, mapsReach);
      return preset.first === window.first && preset.last === window.last;
    }) ?? null
  );
}

/**
 * The span a window falls within, the narrowest that holds its start: what a link's `scale`
 * says, and which bar draws it, until one timeline draws them all (#1078).
 */
export function spanFor(window: AxisWindow, present: number, mapsReach = MAPS_REACH_MA): Span {
  return (
    SPANS.find((span) => window.first >= presetWindow(span, present, mapsReach).first) ?? 'eons'
  );
}

/** A deep-time point held to a thousand years, as deep time keeps its moments. */
function toThousand(year: AxisYear): AxisYear {
  return yearOfMa(roundMa(maOfYear(year)));
}

/**
 * A window held to the axis (Earth's formation to `present`), to whole years or thousands as its
 * model keeps time, and to its model's narrowest, widened about its middle.
 */
export function clampAxis(window: AxisWindow, present: number): AxisWindow {
  let first = Math.max(EARTH_FIRST, Math.min(window.first, window.last));
  let last = Math.min(present, Math.max(window.first, window.last));
  // Widened within its own model, so a decade at 9700 BCE stays in the years.
  const years = first >= YEARS_FIRST;
  const width = years ? NARROWEST_YEARS : NARROWEST_DEEP;
  if (last - first < width) {
    const floor = years ? YEARS_FIRST : EARTH_FIRST;
    first = Math.max(floor, Math.min((first + last) / 2 - width / 2, present - width));
    last = first + width;
  }
  // Rounded as the model reads: the years' to whole years, deep time's start to a thousand
  // (which, from before 9700 BCE, rounds to 10,050 BCE or older: it stays in deep time).
  if (years) return { first: Math.round(first), last: Math.round(last) };
  const end = Math.round(last);
  return { first: Math.min(toThousand(first), end - NARROWEST_DEEP), last: end };
}

/** The window zoomed by `factor` (under 1 narrows) about the point `around`, held to the axis. */
export function zoomAxis(
  window: AxisWindow,
  around: AxisYear,
  factor: number,
  present: number,
): AxisWindow {
  const at = Math.min(Math.max(around, window.first), window.last);
  return clampAxis(
    { first: at - (at - window.first) * factor, last: at + (window.last - at) * factor },
    present,
  );
}

/** The window moved by `years` (positive towards today), its width kept, held to the axis. */
export function panAxis(window: AxisWindow, years: number, present: number): AxisWindow {
  const width = window.last - window.first;
  const last = Math.min(present, Math.max(EARTH_FIRST + width, window.last + years));
  return clampAxis({ first: last - width, last }, present);
}

/** How much room a fitted interval is given on each side, as a share of its length. */
const FIT_PADDING = 0.1;

/**
 * The window that fits an interval (#749): its length and a tenth more on each side, so its ends
 * do not sit on the bar's; a single moment gets its model's narrowest window about it.
 */
export function fitAxis(interval: AxisWindow, present: number, padding = FIT_PADDING): AxisWindow {
  const width = interval.last - interval.first;
  return clampAxis(
    { first: interval.first - width * padding, last: interval.last + width * padding },
    present,
  );
}

/** The moment at a point of a window, in the window's model. */
export function momentAt(year: AxisYear, window: AxisWindow): AxisMoment {
  if (modelOf(window) === 'years') return { model: 'years', year: Math.round(year) };
  return { model: 'deep', ma: Math.max(0, roundMa(maOfYear(year))) };
}

/** Where a moment of the view sits on the axis: its year, or its Ma before 1950. */
export function axisOf(moment: { readonly ma: number | null; readonly year: number }): AxisYear {
  return moment.ma === null ? moment.year : yearOfMa(moment.ma);
}

/**
 * The window the view shows today, before the timeline zooms (#1074): the Years bar's window
 * (`yw`), or its whole track; in deep time the span's.
 */
export function windowOfView(
  view: {
    readonly ma: number | null;
    readonly deepScale: DeepScale;
    readonly yearsWindow: AxisWindow | null;
  },
  present: number,
  mapsReach = MAPS_REACH_MA,
): AxisWindow {
  if (view.ma !== null) return presetWindow(view.deepScale, present, mapsReach);
  return view.yearsWindow ?? presetWindow('years', present, mapsReach);
}
