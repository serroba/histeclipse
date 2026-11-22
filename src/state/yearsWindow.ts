/**
 * The years the Years bar shows (#749): a window of astronomical years within the Holocene's
 * track, null for the whole track. Fitted to a layer's data when it is turned on, picked from
 * presets, or zoomed and panned by hand; kept in links as `yw`.
 */

import { LAYERS, layerEntry, type Layer } from '../layers/layers';

export interface YearsWindow {
  readonly first: number;
  readonly last: number;
}

/** The narrowest window, in years: a decade still reads on the bar. */
export const NARROWEST = 10;

/** The years each layer's data covers, by layer, where its catalogue entry says. */
const SPANS: ReadonlyMap<Layer, YearsWindow> = new Map(
  LAYERS.flatMap((layer) => {
    const entry = layerEntry(layer);
    const years = entry.covers?.years;
    return years === undefined || !entry.spans.includes('years')
      ? []
      : [[layer, { first: years[0], last: years[1] }] as const];
  }),
);

/** The years a layer's data covers, if its catalogue entry says. */
export function layerSpan(layer: Layer): YearsWindow | null {
  return SPANS.get(layer) ?? null;
}

/** A window held to the track (`whole`) and to the narrowest; null where it is the track. */
export function clampWindow(window: YearsWindow, whole: YearsWindow): YearsWindow | null {
  let first = Math.max(whole.first, Math.round(window.first));
  let last = Math.min(whole.last, Math.round(window.last));
  if (last - first < NARROWEST) {
    const middle = Math.round((first + last) / 2);
    first = Math.max(whole.first, middle - NARROWEST / 2);
    last = Math.min(whole.last, first + NARROWEST);
    first = last - NARROWEST;
  }
  return first <= whole.first && last >= whole.last ? null : { first, last };
}

/**
 * The window to fit when layers are turned on: the years all the new ones with a span cover
 * between them; null if none has one.
 */
export function fitFor(added: Iterable<Layer>): YearsWindow | null {
  const spans = [...added].flatMap((layer) => {
    const span = layerSpan(layer);
    return span === null ? [] : [span];
  });
  if (spans.length === 0) return null;
  return {
    first: Math.min(...spans.map(({ first }) => first)),
    last: Math.max(...spans.map(({ last }) => last)),
  };
}

/** The window zoomed by `factor` (under 1 narrows) about the year `around`, held to the track. */
export function zoomed(
  window: YearsWindow,
  around: number,
  factor: number,
  whole: YearsWindow,
): YearsWindow | null {
  const first = around - (around - window.first) * factor;
  const last = around + (window.last - around) * factor;
  return clampWindow({ first, last }, whole);
}

/** The window moved by `years`, its width kept, held to the track. */
export function panned(window: YearsWindow, years: number, whole: YearsWindow): YearsWindow | null {
  const width = window.last - window.first;
  const first = Math.min(whole.last - width, Math.max(whole.first, window.first + years));
  return clampWindow({ first, last: first + width }, whole);
}
