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
      {
        id: 'ways',
        label: 'Ways of life',
        about:
          'How people lived by region, as archaeologists rated it (ArchaeoGLOBE): foraging, herding, farming, towns.',
      },
      {
        id: 'genomes',
        label: 'Ancient genomes',
        about:
          'Dated ancient DNA from the Allen Ancient DNA Resource (Reich lab), counted by region within 250 years.',
      },
    ],
  },
  {
    name: 'Earth',
    layers: [
      {
        id: 'rocks',
        label: 'Rocks at the surface',
        about:
          'How old the rocks at the surface are, from Macrostrat; pick a place to see its rock, then the Earth when it formed.',
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

/** Cliopatria's latest year. Its borders then stand for the years since, up to the present. */
export const CLIOPATRIA_LATEST = 2024;

/** The years each source of borders covers: Cliopatria 3400 BCE–2024, its files' reach. */
const BORDER_SPANS: Readonly<Record<'cliopatria' | 'ohm', Span>> = {
  cliopatria: { name: 'Cliopatria', from: -3399, to: CLIOPATRIA_LATEST },
  ohm: { name: 'OpenHistoricalMap', from: -4000, to: 2099 },
};

/** The year whose Cliopatria borders show in `year`: its own, or 2024's from then to `present`. */
export function cliopatriaYear(year: number, present: number): number {
  return year > CLIOPATRIA_LATEST && year <= present ? CLIOPATRIA_LATEST : year;
}

function sourcesOf(borders: BorderSource, present: number): readonly Span[] {
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
