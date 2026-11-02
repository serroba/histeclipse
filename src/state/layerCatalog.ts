/**
 * The layers the reader can lay over the globe in historical time, grouped by what they show,
 * and what each says when the moment shown lies outside its data.
 */

import { astronomicalYear, formatYear } from '../time/year';
import type { BorderSource, Layer } from './viewState';

export interface LayerChoice {
  readonly id: Layer;
  readonly label: string;
  readonly about: string;
}

export interface LayerGroup {
  readonly name: string;
  readonly layers: readonly LayerChoice[];
}

export const HISTORY_LAYER_GROUPS: readonly LayerGroup[] = [
  {
    name: 'People',
    layers: [
      {
        id: 'empires',
        label: 'States and empires',
        about: 'Borders from Cliopatria or OpenHistoricalMap, or both to compare.',
      },
    ],
  },
  {
    name: 'Sky and events',
    layers: [
      {
        id: 'solar',
        label: 'Eclipse shadows',
        about: 'The Moon’s shadow and path on Earth, for a solar eclipse.',
      },
      {
        id: 'lunar',
        label: 'Moon in Earth’s shadow',
        about: 'Where on Earth an eclipsed Moon was up, for a lunar eclipse.',
      },
    ],
  },
];

interface Span {
  readonly name: string;
  /** First and last astronomical years with borders. */
  readonly from: number;
  readonly to: number;
}

/** The years each source of borders covers: Cliopatria 3400 BCE–2024, its files' reach. */
const BORDER_SPANS: Readonly<Record<'cliopatria' | 'ohm', Span>> = {
  cliopatria: { name: 'Cliopatria', from: -3399, to: 2024 },
  ohm: { name: 'OpenHistoricalMap', from: -4000, to: 2099 },
};

function sourcesOf(borders: BorderSource): readonly Span[] {
  if (borders === 'both') return [BORDER_SPANS.cliopatria, BORDER_SPANS.ohm];
  return [BORDER_SPANS[borders]];
}

/** What a layer says at `year` when it has nothing to draw there; null when it does. */
export function layerNote(layer: Layer, year: number, borders: BorderSource): string | null {
  if (layer !== 'empires') return null;
  const spans = sourcesOf(borders);
  const earliest = spans.reduce((first, span) => (span.from < first.from ? span : first));
  if (year < earliest.from) {
    return `Nothing to draw yet: ${earliest.name} begins in ${formatYear(astronomicalYear(earliest.from))}.`;
  }
  const latest = spans.reduce((last, span) => (span.to > last.to ? span : last));
  if (year > latest.to) {
    return `Nothing to draw: ${latest.name} ends in ${formatYear(astronomicalYear(latest.to))}.`;
  }
  return null;
}
