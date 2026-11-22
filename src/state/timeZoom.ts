/**
 * Zooming the time bar (#1074): from the window the bar shows and the moment it is at, the
 * window one zoom step makes, read in the model it falls in. Zooming out of the Holocene's
 * whole track goes on into deep time, on the narrowest span that holds the new window; zooming
 * into deep time's last 11,700 years comes back to the years. The moment stays where it was: a
 * zoom never moves time, only how much of it the bar shows.
 *
 * Pure: windows in, a target out. The years' part and deep time's apply it.
 */

import type { DeepScale } from '../deepTime/scale';
import { roundMa } from '../deepTime/scale';
import {
  type AxisWindow,
  type AxisYear,
  EARTH_FIRST,
  MAPS_REACH_MA,
  maOfYear,
  modelOf,
  momentAt,
  NARROWEST_DEEP,
  NARROWEST_YEARS,
  presetWindow,
  spanFor,
  yearOfMa,
  zoomAxis,
} from './timeAxis';

/** How much one press of + or − zooms: twice as much time, or half. */
export const ZOOM_STEP = 2;

/** Deep time's bar window, Ma: as the `dw` link has it. */
export interface DeepBarWindow {
  readonly oldest: number;
  readonly youngest: number;
}

/** Where a zoom lands: a window of years, or a span of deep time, part of it, and the moment. */
export type ZoomTarget =
  | { readonly model: 'years'; readonly window: AxisWindow }
  | {
      readonly model: 'deep';
      readonly scale: DeepScale;
      /** The part of the span, or null for all of it. */
      readonly window: DeepBarWindow | null;
      readonly ma: number;
    };

/** The axis window of deep time's bar: to today when it reaches 0 Ma. */
export function deepAxisWindow(window: DeepBarWindow, present: number): AxisWindow {
  return {
    first: yearOfMa(window.oldest),
    last: window.youngest <= 0 ? present : yearOfMa(window.youngest),
  };
}

/** A window on the axis as a zoom lands on it, the moment at `around`. */
export function targetOf(
  next: AxisWindow,
  around: AxisYear,
  present: number,
  mapsReach = MAPS_REACH_MA,
): ZoomTarget {
  if (modelOf(next) === 'years') return { model: 'years', window: next };
  const span = spanFor(next, present, mapsReach);
  const scale = span === 'years' ? 'ice' : span;
  const oldest = roundMa(maOfYear(next.first));
  const youngest = next.last >= yearOfMa(0) ? 0 : roundMa(maOfYear(next.last));
  const whole = presetWindow(scale, present, mapsReach).first >= next.first && youngest === 0;
  const moment = momentAt(around, next);
  const ma = moment.model === 'deep' ? moment.ma : 0;
  return { model: 'deep', scale, window: whole ? null : { oldest, youngest }, ma };
}

/** One zoom of the window about the moment: `factor` over 1 shows more time, under 1 less. */
export function zoomTarget(
  window: AxisWindow,
  around: AxisYear,
  factor: number,
  present: number,
  mapsReach = MAPS_REACH_MA,
): ZoomTarget {
  return targetOf(zoomAxis(window, around, factor, present), around, present, mapsReach);
}

/** Whether the window can zoom in further, and out: out to all of Earth's history. */
export function zoomRoom(
  window: AxisWindow,
  present: number,
): { readonly in: boolean; readonly out: boolean } {
  const narrowest = modelOf(window) === 'years' ? NARROWEST_YEARS : NARROWEST_DEEP;
  return {
    in: window.last - window.first > narrowest,
    out: window.first > EARTH_FIRST || window.last < present,
  };
}
