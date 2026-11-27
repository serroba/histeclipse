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
import type { DatedWindow, EventPhase, GuideView, OwnTimeEvent, ProxyChart } from '../ownTime';
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
import { CAMP_CARBON_DIOXIDE } from './campCarbonDioxide';
import { LOSSES } from './losses';
import { MEISHAN_TEMPERATURES } from './meishanTemperatures';
import { PERMIAN_CARBON_DIOXIDE } from './permianCarbonDioxide';
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
/** Far enough out to see a province and its records on one side of the world (#1266). */
const WORLD_DISTANCE = 4.5;
/** How far out Chicxulub is watched from: far enough to see its front cross the globe (#1167). */
const STRIKE_DISTANCE = 3.4;

/** `event`, the globe turned to `place` and drawn back to `distance`, and back when left alone. */
function facing(event: OwnTimeEvent, place: GeoPoint, distance: number): OwnTimeEvent {
  return guided(event, [{ from: -Infinity, place, distance }]);
}

/** `event`, the camera guided through `views` as its clock plays (#1266). */
function guided(event: OwnTimeEvent, views: readonly GuideView[]): OwnTimeEvent {
  return { ...event, views };
}

/** A volcanic province watched in its own time: where it lay, how far it spread, its timeline. */
interface Province {
  readonly key: string;
  readonly name: string;
  readonly phases: readonly EventPhase[];
  /** Its sites, whose middle it is centred on. */
  readonly sites: readonly string[];
  /**
   * Where the camera goes next as its story moves on (#1266): from when, the sites whose middle
   * it looks at, and how far from them, in Earth radii.
   */
  readonly tour?: readonly (readonly [from: number, sites: readonly string[], distance: number])[];
  readonly spread: number;
  /** The first mark under its clock: when its story begins, seconds since the extinction. */
  readonly start: readonly [number, string];
  /** The extinction's dated window, where one is dated closely enough to draw (#1228). */
  readonly dated?: DatedWindow;
  /** What its drawing shows and assumes, said under its clock (#1226). */
  readonly drawn: string;
  /** When the extinction began, Ma: its clock's zero, lent deep time's header (#1222). */
  readonly zero: number;
  /** A measured record through it, drawn above its clock's slider (#1229). */
  readonly proxies?: readonly ProxyChart[];
  fuming(seconds: number): Fuming;
  /** How much of its lava has flowed by `seconds` (#1212). */
  cover(seconds: number): number;
}

const KYR = 1000 * 365.25 * 86_400;

/** What every volcanic province's drawing is, before what it assumes (#1226). */
const SMOKE =
  'Drawn to illustrate, not measured: smoke over vents spread across the province, and the lava, glowing red at its front and dark basalt behind,';

/** The provinces, by the extinction each is watched for (#1192, #1201). */
const PROVINCES: readonly Province[] = [
  {
    key: 'end-permian-extinction',
    name: 'the end-Permian',
    phases: END_PERMIAN,
    sites: ['siberian-traps'],
    spread: 9,
    start: [-300 * KYR, 'Lavas'],
    dated: {
      from: 0,
      to: 61 * KYR,
      plusMinus: [37 * KYR, 31 * KYR],
      says: 'The extinction as dated at Meishan: 251.941 ± 0.037 to 251.880 ± 0.031 million years ago (Burgess, Bowring & Shen 2014).',
    },
    // Its start at Meishan (Burgess, Bowring & Shen 2014), before the boundary at 251.902.
    zero: 251.941,
    proxies: [MEISHAN_TEMPERATURES, PERMIAN_CARBON_DIOXIDE],
    // To Meishan as the sea's life dies, then out to the world as its carbon peaks.
    tour: [
      [2 * KYR, ['meishan'], PROVINCE_DISTANCE],
      [75 * KYR, ['siberian-traps', 'meishan'], WORLD_DISTANCE],
    ],
    drawn: `${SMOKE} as far as the share erupted by then: two thirds before and during the extinction.`,
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
    dated: {
      from: 0,
      to: 100 * KYR,
      // Its start is the clock's zero; the uncertainty is of how long it lasted.
      plusMinus: [0, 40 * KYR],
      says: 'The extinction as Blackburn et al. (2013) date it: 100,000 ± 40,000 years from 201.564 million years ago. On land, cyclostratigraphy gives it 20,000 to 40,000 years (Deenen et al. 2010); in the sea, ash beds date it between 201.51 ± 0.15 and 201.36 ± 0.17 million years ago (as Lindström et al. 2021 review).',
    },
    proxies: [CAMP_CARBON_DIOXIDE],
    // To the sea's record in Europe as its carbon builds, then out to the world as it pulses.
    tour: [
      [30 * KYR, ['kuhjoch', 'st-audries-bay'], PROVINCE_DISTANCE],
      [150 * KYR, ['camp-palisades', 'camp-morocco', 'kuhjoch'], WORLD_DISTANCE],
    ],
    drawn: `${SMOKE} a quarter more with each of its four pulses, spaced evenly over 600,000 years: an assumption.`,
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
    drawn: `${SMOKE} mostly in its first million years; how it spread is drawn, not measured.`,
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
    ...(province.dated === undefined ? {} : { dated: province.dated }),
    ...(province.proxies === undefined ? {} : { proxies: province.proxies }),
    drawn: province.drawn,
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
  /** What its drawing shows and assumes, said under its clock (#1226). */
  readonly drawn: string;
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
    drawn:
      'Drawn to illustrate, not measured: white, the ice sheet’s reach; murky olive, oxygen-poor water round the record’s place, over the sea. Their timing follows the studies; their sizes are drawn to be seen.',
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
    drawn:
      'Drawn to illustrate, not measured: murky olive, oxygen-poor water round the record’s place, over the sea, darkest on the shelves; each Kellwasser pulse drawn 150,000 years long, an assumption.',
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
    drawn: crisis.drawn,
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

/** The extinction `id`'s own time at `ma`, if it has one, with what it took (#1223). */
export function ownTimeOf(data: ExtinctionSites, id: string, ma: number): OwnTimeEvent | null {
  const event = drawnOf(data, id, ma);
  const loss = LOSSES[id];
  return event === null || loss === undefined ? event : { ...event, loss };
}

/** The extinction `id`'s own time at `ma`, as it is drawn, if it has one. */
function drawnOf(data: ExtinctionSites, id: string, ma: number): OwnTimeEvent | null {
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
    const first = { from: -Infinity, place: from, distance: PROVINCE_DISTANCE };
    const tour = (province.tour ?? []).flatMap(([at, sites, distance]) => {
      const place = middleOf(sites.flatMap((site) => placeOf(data, site, ma) ?? []));
      return place === null ? [] : [{ from: at, place, distance }];
    });
    return guided(provinceEvent(province, center), [first, ...tour]);
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
    drawn:
      'The Deccan Traps’ smoke and lava are drawn to illustrate, not measured, and held steady through the million years: whether most erupted before or after the impact is argued.',
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
