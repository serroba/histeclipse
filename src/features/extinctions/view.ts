/**
 * What the extinctions' part decides (#1190), as pure functions: whether they are drawn, which
 * places are marked at a moment and where the plates had them, and a place's card.
 */

import { siteThen, type ExtinctionSite, type ExtinctionSites } from '../../data/extinctions';
import type { GeoPoint, ViewState } from '../../state/viewState';
import type { MarkerCardContent } from '../../ui/markerCard';
import { ABOUT_THE_LIST, claimLinks, estimatesOf, EXTINCTIONS, type Extinction } from './events';

/** How far either side of its extinction a place is marked, Ma. */
const AROUND_MA = 5;

/** Whether the layer draws: on, on the globe, in deep time on the plates' span. */
export function extinctionsOn(state: ViewState): boolean {
  return (
    state.layers.has('extinctions') &&
    state.mode === 'globe' &&
    state.ma !== null &&
    state.deepScale === 'all'
  );
}

export interface ExtinctionMark {
  readonly site: ExtinctionSite;
  readonly extinction: Extinction;
  readonly point: GeoPoint;
}

/** The places marked at `ma`, oldest extinction first: those near it, where the plates had them. */
export function extinctionMarks(data: ExtinctionSites, ma: number): ExtinctionMark[] {
  return EXTINCTIONS.filter((extinction) => Math.abs(extinction.ma - ma) <= AROUND_MA).flatMap(
    (extinction) =>
      data.sites.flatMap((site) => {
        const point = site.extinction === extinction.id ? siteThen(data, site, ma) : null;
        return point === null ? [] : [{ site, extinction, point }];
      }),
  );
}

/** When the extinctions were, Ma: play eases near each (#1077). */
export function extinctionMoments(): number[] {
  return EXTINCTIONS.map((each) => each.ma);
}

/** What the layer says at `ma`: the extinction near, if any. */
export function extinctionsText(marks: readonly ExtinctionMark[]): string {
  const near = [...new Set(marks.map((mark) => mark.extinction.title))];
  return near.length === 0 ? 'No great extinction near this moment.' : near.join(' · ');
}

const ROLE: Readonly<Record<ExtinctionSite['role'], string>> = {
  cause: 'Its cause, or one held or argued',
  record: 'Where it is dated',
};

/** A place's card: the extinction, what it took and what caused it, and what this place is. */
export function extinctionCard(mark: ExtinctionMark): MarkerCardContent {
  const { site, extinction } = mark;
  const when = estimatesOf(extinction);
  return {
    title: extinction.title,
    facts: [
      ['Here', `${site.name}: ${ROLE[site.role].toLowerCase()}`],
      [
        'When',
        when.length > 0 ? when.join('; ') : `About ${String(extinction.ma)} million years ago`,
      ],
      ['Lost', extinction.lost.text],
      ['Causes', extinction.causes.text],
    ],
    links: claimLinks([extinction.lost, extinction.causes, ABOUT_THE_LIST]),
    note:
      extinction.counted === 'argued'
        ? `Not one of the usual five. ${ABOUT_THE_LIST.text}`
        : ABOUT_THE_LIST.text,
  };
}

/** The mark a marker's key names, if it is an extinction's and shown. */
export function pickedMark(
  marks: readonly ExtinctionMark[],
  key: string,
): ExtinctionMark | undefined {
  return marks.find((mark) => mark.site.id === key);
}
