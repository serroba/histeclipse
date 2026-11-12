/**
 * What the impacts' part decides (#474), as pure functions: whether the craters are drawn, on
 * which map, which strikes to play as deep time runs past them, and a crater's card.
 */

import { approachOf, impactorText } from '../../data/impactScaling';
import {
  impactDetails,
  placeThen,
  strikesPassed,
  type Impact,
  type Impacts,
} from '../../data/impacts';
import { angularDistance } from '../../eclipses/visibility';
import type { DeepScale, GeoPoint, ViewState } from '../../state/viewState';
import type { MarkerCardContent } from '../../ui/markerCard';

/** Degrees from the centre of the globe in view within which a strike is played as time runs. */
export const STRIKE_IN_VIEW = 70;
/** Strikes started in one frame at most, the greatest first, when time runs fast past several. */
export const STRIKES_AT_ONCE = 4;
/** The year “before present” counts back from, as radiocarbon dates do. */
export const BP_ZERO_YEAR = 1950;

/** The span the craters are drawn on: the whole span, past the elevation maps, is the eons'. */
export function impactsScale(state: ViewState, oldest: number): DeepScale {
  const { ma } = state;
  return ma !== null && state.deepScale === 'all' && ma > oldest ? 'eons' : state.deepScale;
}

/** Whether the layer draws: on, on the globe, and in the years or below the eons. */
export function impactsOn(state: ViewState, scale: DeepScale): boolean {
  return (
    state.layers.has('impacts') && state.mode === 'globe' && (state.ma === null || scale !== 'eons')
  );
}

/** In historical time, the millions of years since the year shown: younger craters are not there. */
export function sinceYear(state: ViewState): number {
  return Math.max(0, BP_ZERO_YEAR - state.time.date.year) / 1e6;
}

/** On the ice-age scale the map is today's, so the craters are where they are today. */
export function placeMaFor(scale: DeepScale, ma: number): number {
  return scale === 'ice' ? 0 : ma;
}

export interface Strike {
  readonly impact: Impact;
  readonly place: GeoPoint;
}

/**
 * Of the craters passed between `from` and `ma`, those on the side of the globe in view, the
 * greatest few, in the order they are played: the greatest last, on top.
 */
export function strikesToPlay(
  data: Impacts,
  from: number,
  ma: number,
  placeMa: number,
  facing: GeoPoint,
): Strike[] {
  return strikesPassed(data, from, ma)
    .map((impact) => ({ impact, place: placeThen(data, impact, placeMa) }))
    .filter(
      (each): each is Strike =>
        each.place !== null && angularDistance(each.place, facing) < STRIKE_IN_VIEW,
    )
    .sort((a, b) => (b.impact.diameterKm ?? 0) - (a.impact.diameterKm ?? 0))
    .slice(0, STRIKES_AT_ONCE)
    .reverse();
}

/** The latest few struck, for whoever needs to know one did: they follow fast as time runs. */
export function struckList(before: string | undefined, name: string): string {
  const struck = (before ?? '').split('|').filter(Boolean);
  return [...struck, name].slice(-12).join('|');
}

/** The impact a marker's key names, if it is a crater's and loaded. */
export function pickedImpact(data: Impacts | null, key: string): Impact | undefined {
  const [kind, id] = key.split(':');
  if (kind !== 'impact') return undefined;
  return data?.impacts.find((each) => String(each.id) === id);
}

/** What a play of an impact needs: where it lies, how big, and from where it came. */
export interface ImpactPlay {
  readonly place: GeoPoint;
  readonly craterKm: number;
  readonly fromAzimuth: number;
  readonly angleDegrees: number;
}

/** A play of the impact: the approach is a study's where one exists, else the most likely. */
export function impactPlay(name: string, place: GeoPoint, craterKm: number): ImpactPlay {
  const { fromAzimuth, angleDegrees } = approachOf(name);
  return { place, craterKm, fromAzimuth, angleDegrees };
}

/**
 * A crater's card: its facts, its impactor's where its size is known, and a play of it where it
 * lies at the moment shown (today's place, or where the plates had it).
 */
export function impactCard(
  data: Impacts,
  impact: Impact,
  ma: number,
  play: (play: ImpactPlay) => void,
): MarkerCardContent {
  const details = impactDetails(impact);
  const place = placeThen(data, impact, ma);
  const craterKm = impact.diameterKm;
  if (craterKm === null)
    return { title: details.title, facts: details.facts, links: [details.link] };
  const facts = [...details.facts, ['Impactor', impactorText(impact.name, craterKm)] as const];
  const card = { title: details.title, facts, links: [details.link] };
  if (place === null) return card;
  return {
    ...card,
    action: {
      label: 'Play the impact (an illustration)',
      run: () => {
        play(impactPlay(impact.name, place, craterKm));
      },
    },
  };
}
