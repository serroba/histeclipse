/**
 * What the layers say of themselves where they draw nothing: off their spans, and outside the
 * years their borders cover. The layers themselves, each with the spans it draws on and how far
 * its data reaches, are in `src/layers`; they are passed on from here for the code above.
 */

import type { LayerChoice } from '../layers/layers';
import { astronomicalYear, formatYear } from '../time/year';
import { SPAN_LABELS, type BorderSource, type Layer, type Span } from './viewState';

export { CARBON_LIMIT, LAYER_GROUPS } from '../layers/layers';
export type { Coverage, LayerChoice } from '../layers/layers';

/** The spans' names, joined as a reader would say them. */
function spanList(spans: readonly Span[]): string {
  const names = spans.map((span) => SPAN_LABELS[span]);
  const last = names.pop();
  return names.length === 0 ? (last ?? '') : `${names.join(', ')} and ${last ?? ''}`;
}

/** What a layer says on a span it does not draw on: where it does, and how far it reaches. */
export function elsewhereNote(choice: LayerChoice): string {
  const where =
    choice.spans.length === 1
      ? `the ${spanList(choice.spans)} span`
      : `the ${spanList(choice.spans)} spans`;
  return `Nothing here: drawn on ${where}. ${choice.reach}`;
}

interface BorderSpan {
  readonly name: string;
  /** First and last astronomical years with borders. */
  readonly from: number;
  readonly to: number;
}

/** Cliopatria's latest year. Its borders then stand for the years since, up to the present. */
const CLIOPATRIA_LATEST = 2024;

/** The years each source of borders covers: Cliopatria 3400 BCE–2024, its files' reach. */
const BORDER_SPANS: Readonly<Record<'cliopatria' | 'ohm', BorderSpan>> = {
  cliopatria: { name: 'Cliopatria', from: -3399, to: CLIOPATRIA_LATEST },
  ohm: { name: 'OpenHistoricalMap', from: -4000, to: 2099 },
};

/** The year whose Cliopatria borders show in `year`: its own, or 2024's from then to `present`. */
export function cliopatriaYear(year: number, present: number): number {
  return year > CLIOPATRIA_LATEST && year <= present ? CLIOPATRIA_LATEST : year;
}

function sourcesOf(borders: BorderSource, present: number): readonly BorderSpan[] {
  // Cliopatria's latest borders carry on to the present.
  const cliopatria = {
    ...BORDER_SPANS.cliopatria,
    to: Math.max(BORDER_SPANS.cliopatria.to, present),
  };
  if (borders === 'both') return [cliopatria, BORDER_SPANS.ohm];
  return borders === 'ohm' ? [BORDER_SPANS.ohm] : [cliopatria];
}

/** What a layer says at `year`, a year in `present`, when it has nothing to draw there or draws
 * another year's; null when it draws its own. */
export function layerNote(
  layer: Layer,
  year: number,
  borders: BorderSource,
  present: number,
): string | null {
  if (layer !== 'empires') return null;
  const spans = sourcesOf(borders, present);
  const earliest = spans.reduce((first, span) => (span.from < first.from ? span : first));
  if (year < earliest.from) {
    return `Nothing to draw yet: ${earliest.name} begins in ${formatYear(astronomicalYear(earliest.from))}.`;
  }
  const latest = spans.reduce((last, span) => (span.to > last.to ? span : last));
  if (year > latest.to) {
    const end = latest === BORDER_SPANS.ohm ? latest.to : CLIOPATRIA_LATEST;
    return `Nothing to draw: ${latest.name} ends in ${formatYear(astronomicalYear(end))}.`;
  }
  if (borders !== 'ohm' && cliopatriaYear(year, present) !== year) {
    return `Borders as of ${formatYear(astronomicalYear(CLIOPATRIA_LATEST))}, Cliopatria’s latest year.`;
  }
  return null;
}
