/**
 * What the "why" sheet says of the view (#451): what each layer on the map has at the place
 * picked ("Why here?"), what that depends on, and what a why says of the moment shown. Pure:
 * the layers' data comes in as it has loaded.
 */

import type { Territory } from '../../data/empires';
import { periodAt } from '../../deepTime/periods';
import { hereFacts, placeText } from './here';
import { PERIOD_EVIDENCE } from '../../sources/periodEvidence';
import type { HereFact, WhyId } from '../../sources/registry';
import { cliopatriaYear } from '../../state/layerCatalog';
import { LAYERS, type Layer, type ViewState } from '../../state/viewState';
import { PRESENT_YEAR } from '../../time/present';
import { astronomicalYear, formatYear } from '../../time/year';
import type { HereView, WhyMoment } from '../../ui/whySheet';

/** What the layers have loaded, for "Why here?" to read. */
export interface HereData {
  /** The states last drawn, and the year they were drawn for. */
  readonly drawn: { readonly year: number; readonly territories: readonly Territory[] } | null;
  /** What the features on the contract have at the place (#893), each with its layer. */
  readonly features: readonly (readonly [Layer, HereFact])[];
}

/** What each layer on the map has at the place picked: "Why here?". */
export function hereView(state: ViewState, data: HereData): HereView | null {
  if (state.location === null || state.ma !== null) return null;
  const year = state.time.date.year;
  const words = (y: number): string => formatYear(astronomicalYear(y));
  const shownYear = cliopatriaYear(year, PRESENT_YEAR);
  const { drawn } = data;
  const states = hereFacts({
    place: state.location,
    yearText: words(year),
    states: state.layers.has('empires')
      ? {
          source: state.borders,
          territories: drawn?.year === year ? drawn.territories : null,
          asOf: shownYear === year ? null : words(shownYear),
        }
      : null,
  });
  // In the layers' own order (#909), as the Sources list is: the states' facts are the empires'.
  const byLayer: readonly (readonly [Layer, HereFact])[] = [
    ...states.map((fact) => ['empires', fact] as const),
    ...data.features,
  ];
  const place = (layer: Layer): number => LAYERS.indexOf(layer);
  const facts = byLayer
    .map(([layer, fact], index) => ({ fact, at: place(layer), index }))
    .sort((a, b) => a.at - b.at || a.index - b.index)
    .map(({ fact }) => fact);
  return { place: placeText(state.location), facts };
}

/** What "Here" depends on, so it is written again only when that changes. */
export function hereVersion(state: ViewState, data: HereData): string {
  return [
    state.location === null ? '' : placeText(state.location),
    state.time.date.year,
    [...state.layers].join(','),
    state.borders,
    data.drawn?.year ?? '',
    data.features.map(([, { text }]) => text).join('/'),
  ].join('|');
}

/**
 * What the open why depends on, so the sheet is written again only when that changes: "Here"'s
 * place and layers, or deep time's period for its evidence.
 */
export function whyVersion(state: ViewState, here: () => HereData): string {
  if (state.why === 'here') return hereVersion(state, here());
  if (state.why === 'deep-evidence' && state.ma !== null) return periodAt(state.ma)?.name ?? '';
  return '';
}

/** What a why says of the moment shown: deep time's map, the period's own evidence. */
export function whyMoment(id: WhyId, state: ViewState): WhyMoment | null {
  if (id !== 'deep-evidence' || state.ma === null) return null;
  const period = periodAt(state.ma);
  const evidence = period === null ? undefined : PERIOD_EVIDENCE[period.name];
  if (period === null || evidence === undefined) return null;
  return {
    title: `Then: the ${period.name}`,
    lines: [evidence.map, evidence.evidence],
    sources: evidence.sources,
  };
}
