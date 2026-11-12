/**
 * What the "why" sheet says of the view (#451): what each layer on the map has at the place
 * picked ("Why here?"), what that depends on, and what a why says of the moment shown. Pure:
 * the layers' data comes in as it has loaded.
 */

import type { Territory } from '../../data/empires';
import { rockAt, type RockUnit } from '../../data/rocks';
import { waysAt, type WaysOfLife } from '../../data/waysOfLife';
import { periodAt } from '../../deepTime/periods';
import { hereFacts, placeText } from '../../sources/here';
import { PERIOD_EVIDENCE } from '../../sources/periodEvidence';
import type { WhyId } from '../../sources/registry';
import { cliopatriaYear } from '../../state/layerCatalog';
import type { ViewState } from '../../state/viewState';
import { PRESENT_YEAR } from '../../time/present';
import { astronomicalYear, formatYear } from '../../time/year';
import type { HereView, WhyMoment } from '../../ui/whySheet';

/** What the layers have loaded, for "Why here?" to read. */
export interface HereData {
  /** The states last drawn, and the year they were drawn for. */
  readonly drawn: { readonly year: number; readonly territories: readonly Territory[] } | null;
  readonly waysOfLife: WaysOfLife | null;
  readonly rocks: readonly RockUnit[] | null;
}

/** What each layer on the map has at the place picked: "Why here?". */
export function hereView(state: ViewState, data: HereData): HereView | null {
  if (state.location === null || state.ma !== null) return null;
  const year = state.time.date.year;
  const words = (y: number): string => formatYear(astronomicalYear(y));
  const shownYear = cliopatriaYear(year, PRESENT_YEAR);
  const { drawn, waysOfLife, rocks } = data;
  const waysThen =
    state.layers.has('ways') && waysOfLife !== null ? waysAt(waysOfLife, year) : null;
  return {
    place: placeText(state.location),
    facts: hereFacts({
      place: state.location,
      yearText: words(year),
      states: state.layers.has('empires')
        ? {
            source: state.borders,
            territories: drawn?.year === year ? drawn.territories : null,
            asOf: shownYear === year ? null : words(shownYear),
          }
        : null,
      ways: waysThen === null ? null : { at: waysThen, momentText: words(waysThen.year) },
      rock: state.layers.has('rocks') && rocks !== null ? rockAt(rocks, state.location) : undefined,
    }),
  };
}

/** What "Here" depends on, so it is written again only when that changes. */
export function hereVersion(state: ViewState, data: HereData): string {
  return [
    state.location === null ? '' : placeText(state.location),
    state.time.date.year,
    [...state.layers].join(','),
    state.borders,
    data.drawn?.year ?? '',
    data.waysOfLife === null ? 0 : 1,
    data.rocks === null ? 0 : 1,
  ].join('|');
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
