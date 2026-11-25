/**
 * What the extinctions' part decides (#1190), as pure functions: whether they are drawn, which
 * places are marked at a moment and where the plates had them, and a place's card.
 */

import {
  siteOnOther,
  siteThen,
  type ExtinctionSite,
  type ExtinctionSites,
} from '../../data/extinctions';
import { angularDistance } from '../../eclipses/visibility';
import type { GeoPoint, ViewState } from '../../state/viewState';
import type { MarkerCardContent } from '../../ui/markerCard';
import {
  ABOUT_THE_LIST,
  claimLinks,
  estimatesOf,
  EXTINCTIONS,
  SITE_NOTES,
  type Extinction,
} from './events';

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

/** The extinctions deep time passed playing from `from` towards today to `to`, oldest first. */
export function extinctionsPassed(from: number, to: number): Extinction[] {
  return EXTINCTIONS.filter((each) => from > each.ma && each.ma >= to);
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

/**
 * A place's card: the extinction, what it took and what caused it, and what this place is; and
 * `watch`, where the extinction can be watched in its own time (#1191).
 */
/** Kilometres in a degree of a great circle on the mean Earth. */
const KM_PER_DEGREE = (6371 * Math.PI) / 180;

/** A place in words: "64.1°N 36.4°E". */
function placeWords({ latitude, longitude }: GeoPoint): string {
  const ns = latitude < 0 ? 'S' : 'N';
  const ew = longitude < 0 ? 'W' : 'E';
  return `${Math.abs(latitude).toFixed(1)}°${ns} ${Math.abs(longitude).toFixed(1)}°${ew}`;
}

/**
 * Where the plate models put a place at its extinction, and how far they disagree (#1231): the
 * deep-time maps' PALEOMAP, and the second model. Null where either has no plate there.
 */
export function platesFact(
  data: ExtinctionSites,
  site: ExtinctionSite,
  extinction: Extinction,
): string | null {
  const here = siteThen(data, site, extinction.ma);
  const other = siteOnOther(data, site);
  if (here === null || other === null) return null;
  const km = Math.round((angularDistance(here, other) * KM_PER_DEGREE) / 10) * 10;
  const latitude = Math.abs(here.latitude - other.latitude).toFixed(1);
  return `PALEOMAP (Scotese), the deep-time maps’ model, puts it at ${placeWords(here)}; ${data.compared.name} at ${placeWords(other)}, ${km.toLocaleString('en')} km away and ${latitude}° apart in latitude. The rocks’ magnetism fixes ancient latitudes, not longitudes, so the models differ most in those.`;
}

/** The plate models' sources, for a card that compares them (#1231). */
const PLATES_SOURCES = ['paleodem', 'merdith2021', 'gplates'] as const;

export function extinctionCard(
  mark: ExtinctionMark,
  watch: (() => void) | null = null,
  plates: string | null = null,
): MarkerCardContent {
  const { site, extinction } = mark;
  const when = estimatesOf(extinction);
  const note = SITE_NOTES[site.id];
  return {
    ...(watch === null ? {} : { action: { label: 'Watch it in its own time', run: watch } }),
    title: extinction.title,
    facts: [
      ['Here', `${site.name}: ${ROLE[site.role].toLowerCase()}`],
      ...(note === undefined ? [] : [['Shows', note.text] as const]),
      [
        'When',
        when.length > 0 ? when.join('; ') : `About ${String(extinction.ma)} million years ago`,
      ],
      ['Lost', extinction.lost.text],
      ['Causes', extinction.causes.text],
      ...(plates === null ? [] : [['Plates', plates] as const]),
    ],
    links: claimLinks([
      ...(note === undefined ? [] : [note]),
      extinction.lost,
      extinction.causes,
      ABOUT_THE_LIST,
      ...(plates === null ? [] : [{ text: plates, sources: PLATES_SOURCES }]),
    ]),
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
