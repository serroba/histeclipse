/**
 * The extinctions that can be watched in their own time (#1191, #1192, #1201): the
 * end-Cretaceous as Chicxulub's strike on its log clock; the end-Permian, end-Triassic and
 * end-Guadalupian as their volcanic provinces fuming on the crisis clock; the end-Ordovician
 * and the Late Devonian as their ice and oxygen-poor seas on the long one (#1202); each where
 * the plates had its place at the moment shown.
 */

import { CRISIS_SCALE, LONG_CRISIS_SCALE } from '../../deepTime/crisisClock';
import { siteThen, type ExtinctionSites } from '../../data/extinctions';
import type { GeoPoint } from '../../core/geo';
import { impactPlay, strikeEvent, strikePhasesOf } from '../impacts';
import type { EventPhase, OwnTimeEvent } from '../ownTime';
import { fumesLayer } from './fumesLayer';
import {
  campCover,
  campFuming,
  deccanCover,
  deccanFuming,
  emeishanCover,
  emeishanFuming,
  siberianCover,
  siberianFuming,
  type Fuming,
} from './fumesModel';
import { END_ORDOVICIAN, LATE_DEVONIAN } from './coldPhases';
import { END_GUADALUPIAN } from './guadalupianPhases';
import { END_PERMIAN } from './permianPhases';
import { seasLayer } from './seasLayer';
import { devonianSeas, ordovicianSeas, type Seas } from './seasModel';
import { END_TRIASSIC } from './triassicPhases';

/** Chicxulub's final crater, km, as the Impact Earth Database gives it. */
const CHICXULUB_KM = 180;
/** How far out the crises of the seas are watched from: the ice sheet or the seas whole. */
const COLD_DISTANCE = 3;
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
  /** When the extinction began, Ma: its clock's zero, lent deep time's header (#1222). */
  readonly zero: number;
  fuming(seconds: number): Fuming;
  /** How much of its lava has flowed by `seconds` (#1212). */
  cover(seconds: number): number;
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
    // Its start at Meishan (Burgess, Bowring & Shen 2014), before the boundary at 251.902.
    zero: 251.941,
    fuming: siberianFuming,
    cover: siberianCover,
  },
  {
    key: 'end-triassic-extinction',
    name: 'the end-Triassic',
    phases: END_TRIASSIC,
    // Its lavas, now on four continents, lay together in the middle of Pangaea.
    sites: ['camp-palisades', 'camp-morocco'],
    spread: 14,
    // Not the intrusions, 100,000 years before: their mark would sit on the extinction's.
    start: [-400 * KYR, 'Rifting'],
    // Its start with the earliest lavas (Blackburn et al. 2013).
    zero: 201.564,
    fuming: campFuming,
    cover: campCover,
  },
  {
    key: 'end-guadalupian-extinction',
    name: 'the end-Guadalupian',
    phases: END_GUADALUPIAN,
    sites: ['emeishan-traps'],
    spread: 4,
    start: [-400 * KYR, 'Before'],
    zero: 259.8,
    fuming: emeishanFuming,
    cover: emeishanCover,
  },
];

/** A province fuming at `center` on the crisis clock. */
function provinceEvent(province: Province, center: GeoPoint): OwnTimeEvent {
  return {
    key: province.key,
    title: `${capitalised(province.name)}, in its own time`,
    phases: province.phases,
    scale: { ...CRISIS_SCALE, marks: [province.start, ...CRISIS_SCALE.marks.slice(1)] },
    offer: `Watch ${province.name} in its own time`,
    ma: province.zero,
    play(tools) {
      const fumes = tools.layer(fumesLayer);
      return {
        at(seconds) {
          fumes.update({
            center,
            spread: province.spread,
            fuming: province.fuming(seconds),
            cover: province.cover(seconds),
          });
        },
        end() {
          fumes.update(null);
        },
      };
    },
  };
}

/** A crisis of the seas watched in its own time: where its ice and its anoxia were, its timeline. */
interface ColdCrisis {
  readonly key: string;
  readonly name: string;
  readonly phases: readonly EventPhase[];
  /** The site its ice sheet is centred on, if it had one. */
  readonly ice: string | null;
  /** The site its oxygen-poor water spreads round. */
  readonly anoxia: string;
  /** Its first pulse, Ma: its clock's zero, lent deep time's header (#1222). */
  readonly zero: number;
  seas(seconds: number): Seas;
}

/** The crises of the seas, by the extinction each is watched for (#1202). */
const COLD: readonly ColdCrisis[] = [
  {
    key: 'end-ordovician-extinction',
    name: 'the end-Ordovician',
    phases: END_ORDOVICIAN,
    ice: 'hirnantian-ice',
    anoxia: 'dobs-linn',
    // The first pulse, at the Hirnantian's base (ICS chart); the Silurian begins 1.4 Myr on.
    zero: 445.2,
    seas: ordovicianSeas,
  },
  {
    key: 'late-devonian-extinction',
    name: 'the Late Devonian',
    phases: LATE_DEVONIAN,
    ice: null,
    anoxia: 'coumiac',
    // The lower Kellwasser, 600,000 years before the upper at the Frasnian–Famennian, 372.2.
    zero: 372.8,
    seas: devonianSeas,
  },
];

/** Degrees round its record the oxygen-poor water's patches spread over. */
const ANOXIA_SPREAD = 22;

/** A crisis of the seas on the long crisis clock: its ice at `ice`, its anoxia round `anoxia`. */
function coldEvent(crisis: ColdCrisis, ice: GeoPoint | null, anoxia: GeoPoint): OwnTimeEvent {
  return {
    key: crisis.key,
    title: `${capitalised(crisis.name)}, in its own time`,
    phases: crisis.phases,
    scale: LONG_CRISIS_SCALE,
    offer: `Watch ${crisis.name} in its own time`,
    ma: crisis.zero,
    play(tools) {
      const seas = tools.layer(seasLayer);
      return {
        at(seconds) {
          seas.update({ ice, anoxia, spread: ANOXIA_SPREAD, seas: crisis.seas(seconds) });
        },
        end() {
          seas.update(null);
        },
      };
    },
  };
}

/** `text` with a capital first letter: "the end-Permian" as a title. */
function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
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
  const cold = COLD.find((each) => each.key === id);
  if (cold !== undefined) {
    const anoxia = placeOf(data, cold.anoxia, ma);
    if (anoxia === null) return null;
    const ice = cold.ice === null ? null : placeOf(data, cold.ice, ma);
    return facing(coldEvent(cold, ice, anoxia), ice ?? anoxia, COLD_DISTANCE);
  }
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
  const deccan = placeOf(data, 'deccan-traps', ma);
  return facing(deccan === null ? strike : withDeccan(strike, deccan), place, STRIKE_DISTANCE);
}

/** How far the Deccan Traps' vents spread, degrees: drawn to cover the province, not measured. */
const DECCAN_SPREAD = 7;

/**
 * Chicxulub's strike with the Deccan Traps fuming beside it (#1206), the end-Cretaceous's two
 * causes on one clock: it outranks the strike alone, so it takes the clock over when Impacts and
 * Extinctions reach it at once.
 */
function withDeccan(strike: OwnTimeEvent, deccan: GeoPoint): OwnTimeEvent {
  return {
    ...strike,
    rank: 1,
    play(tools) {
      const struck = strike.play(tools);
      const fumes = tools.layer(fumesLayer);
      return {
        at(seconds) {
          struck.at(seconds);
          fumes.update({
            center: deccan,
            spread: DECCAN_SPREAD,
            fuming: deccanFuming(seconds),
            cover: deccanCover(),
          });
        },
        end() {
          struck.end();
          fumes.update(null);
        },
      };
    },
  };
}
