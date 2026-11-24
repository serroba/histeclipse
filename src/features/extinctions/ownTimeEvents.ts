/**
 * The extinctions that can be watched in their own time (#1191, #1192, #1201): the
 * end-Cretaceous as Chicxulub's strike on its log clock; the end-Permian, end-Triassic and
 * end-Guadalupian as their volcanic provinces fuming on the crisis clock; each where the plates
 * had its place at the moment shown.
 */

import { CRISIS_SCALE } from '../../deepTime/crisisClock';
import { siteThen, type ExtinctionSites } from '../../data/extinctions';
import type { GeoPoint } from '../../core/geo';
import { impactPlay, strikeEvent, strikePhasesOf } from '../impacts';
import type { EventPhase, OwnTimeEvent } from '../ownTime';
import { fumesLayer } from './fumesLayer';
import { campFuming, emeishanFuming, siberianFuming, type Fuming } from './fumesModel';
import { END_GUADALUPIAN } from './guadalupianPhases';
import { END_PERMIAN } from './permianPhases';
import { END_TRIASSIC } from './triassicPhases';

/** Chicxulub's final crater, km, as the Impact Earth Database gives it. */
const CHICXULUB_KM = 180;
/** How far out a province is watched from: its plumes and the haze over the globe. */
const PROVINCE_DISTANCE = 2.3;
/** How far out Chicxulub is watched from: far enough to see its front cross the globe (#1167). */
const STRIKE_DISTANCE = 3.4;

/** `event`, the globe first turned to `place` and drawn back to `distance`. */
function facing(event: OwnTimeEvent, place: GeoPoint, distance: number): OwnTimeEvent {
  return {
    ...event,
    play(tools) {
      tools.strikes.flyTo(place);
      tools.strikes.zoomTo(distance);
      return event.play(tools);
    },
  };
}

/** A volcanic province watched in its own time: where it lay, how far it spread, its timeline. */
interface Province {
  readonly key: string;
  readonly name: string;
  readonly phases: readonly EventPhase[];
  /** Its sites, whose middle it is centred on. */
  readonly sites: readonly string[];
  readonly spread: number;
  /** The first mark under its clock: when its story begins, seconds since the extinction. */
  readonly start: readonly [number, string];
  fuming(seconds: number): Fuming;
}

const KYR = 1000 * 365.25 * 86_400;

/** The provinces, by the extinction each is watched for (#1192, #1201). */
const PROVINCES: readonly Province[] = [
  {
    key: 'end-permian-extinction',
    name: 'the end-Permian',
    phases: END_PERMIAN,
    sites: ['siberian-traps'],
    spread: 9,
    start: [-300 * KYR, 'Lavas'],
    fuming: siberianFuming,
  },
  {
    key: 'end-triassic-extinction',
    name: 'the end-Triassic',
    phases: END_TRIASSIC,
    // Its lavas, now on four continents, lay together in the middle of Pangaea.
    sites: ['camp-palisades', 'camp-morocco'],
    spread: 14,
    start: [-100 * KYR, 'Intrusions'],
    fuming: campFuming,
  },
  {
    key: 'end-guadalupian-extinction',
    name: 'the end-Guadalupian',
    phases: END_GUADALUPIAN,
    sites: ['emeishan-traps'],
    spread: 4,
    start: [-400 * KYR, 'Before'],
    fuming: emeishanFuming,
  },
];

/** A province fuming at `center` on the crisis clock. */
function provinceEvent(province: Province, center: GeoPoint): OwnTimeEvent {
  const title = province.name.charAt(0).toUpperCase() + province.name.slice(1);
  return {
    key: province.key,
    title: `${title}, in its own time`,
    phases: province.phases,
    scale: { ...CRISIS_SCALE, marks: [province.start, ...CRISIS_SCALE.marks.slice(1)] },
    offer: `Watch ${province.name} in its own time`,
    play(tools) {
      const fumes = tools.layer(fumesLayer);
      return {
        at(seconds) {
          fumes.update({ center, spread: province.spread, fuming: province.fuming(seconds) });
        },
        end() {
          fumes.update(null);
        },
      };
    },
  };
}

/** The middle of some places, near enough for places a few thousand kilometres apart. */
function middleOf(points: readonly GeoPoint[]): GeoPoint | null {
  if (points.length === 0) return null;
  const mean = (pick: (point: GeoPoint) => number) =>
    points.reduce((sum, point) => sum + pick(point), 0) / points.length;
  return { latitude: mean((point) => point.latitude), longitude: mean((point) => point.longitude) };
}

/** The place `site` lay at `ma`, if it is in the data and on a plate then. */
function placeOf(data: ExtinctionSites, site: string, ma: number): GeoPoint | null {
  const found = data.sites.find((each) => each.id === site);
  return found === undefined ? null : siteThen(data, found, ma);
}

/** The extinction `id`'s own time at `ma`, if it has one. */
export function ownTimeOf(data: ExtinctionSites, id: string, ma: number): OwnTimeEvent | null {
  const province = PROVINCES.find((each) => each.key === id);
  if (province !== undefined) {
    const places = province.sites.flatMap((site) => placeOf(data, site, ma) ?? []);
    const center = middleOf(places);
    if (center === null) return null;
    // Seen from a little south, at a slant, so the plumes are seen rising.
    const from = { latitude: center.latitude - 4, longitude: center.longitude };
    return facing(provinceEvent(province, center), from, PROVINCE_DISTANCE);
  }
  const phases = strikePhasesOf('Chicxulub');
  if (id !== 'k-pg-extinction' || phases === null) return null;
  const place = placeOf(data, 'chicxulub', ma);
  if (place === null) return null;
  const strike = strikeEvent(impactPlay('Chicxulub', place, CHICXULUB_KM), phases);
  return facing(strike, place, STRIKE_DISTANCE);
}
