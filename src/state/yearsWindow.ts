/**
 * The years the Years bar shows (#749): a window of astronomical years within the Holocene's
 * track, null for the whole track. Fitted to a layer's data when it is turned on, picked from
 * presets, or zoomed and panned by hand; kept in links as `yw`.
 */

import { LAYERS, layerEntry, type Layer } from '../layers/layers';
import { astronomicalYear, formatYear } from '../time/year';

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

/** A window in words: `1854–2026`, `9700 BCE–2026`. */
export function windowText(window: YearsWindow): string {
  const words = (year: number): string => formatYear(astronomicalYear(year)).replace(/ CE$/, '');
  return `${words(window.first)}–${words(window.last)}`;
}

export interface WindowChoice {
  /** As a select's value: `first,last`, or `all` for the whole track. */
  readonly value: string;
  readonly label: string;
}

/** A window as a choice's value. */
export function windowValue(window: YearsWindow | null): string {
  return window === null ? 'all' : `${String(window.first)},${String(window.last)}`;
}

/** A choice's value back to a window; null for the whole track or anything else. */
export function windowOf(value: string): YearsWindow | null {
  const [first, last] = value.split(',').map(Number);
  if (first === undefined || last === undefined || !Number.isInteger(first)) return null;
  if (!Number.isInteger(last) || last <= first) return null;
  return { first, last };
}

/**
 * The windows offered: the whole Holocene, the instrumental years, the last century, each
 * layer on with a span, and the window shown if it is none of these; no two alike.
 */
export function windowChoices(
  layers: Iterable<Layer>,
  shown: YearsWindow | null,
  whole: YearsWindow,
  labelOf: (layer: Layer) => string,
): WindowChoice[] {
  const found: { readonly window: YearsWindow | null; readonly label: string }[] = [
    { window: null, label: `The Holocene, ${windowText(whole)}` },
    { window: { first: 1850, last: whole.last }, label: `Since 1850` },
    { window: { first: whole.last - 100, last: whole.last }, label: `The last 100 years` },
  ];
  for (const layer of layers) {
    const span = layerSpan(layer);
    if (span !== null) {
      const held = clampWindow(span, whole);
      found.push({ window: held, label: `${labelOf(layer)}, ${windowText(held ?? whole)}` });
    }
  }
  if (shown !== null) found.push({ window: shown, label: `These years, ${windowText(shown)}` });
  const seen = new Set<string>();
  return found.flatMap(({ window, label }) => {
    const value = windowValue(window);
    if (seen.has(value)) return [];
    seen.add(value);
    return [{ value, label }];
  });
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
