/**
 * The crises of the seas watched in their own time (#1202): the end-Ordovician's ice sheet and
 * the oxygen-poor water of its second pulse, and the Late Devonian's two Kellwasser pulses, on
 * the long crisis clock; the water over as much of the seafloor as the studies estimate (#1230).
 * And the oxygen-poor water a volcanic province's clock draws with its fumes: the end-Permian's.
 */

import { LONG_CRISIS_SCALE } from '../../deepTime/crisisClock';
import type { GeoPoint } from '../../core/geo';
import type { EventPhase, OwnTimeEvent, ProxyChart } from '../ownTime';
import { ANOXIC_EXTENTS, patchesAt, scaleFor, type AnoxicExtent } from './anoxicExtent';
import { END_ORDOVICIAN, LATE_DEVONIAN } from './coldPhases';
import { DEVONIAN_OXYGEN_ISOTOPES } from './devonianOxygenIsotopes';
import { seasLegend } from './legends';
import { seasLayer, type SeasMoment } from './seasLayer';
import { devonianSeas, ordovicianSeas, type Seas } from './seasModel';

/** A crisis of the seas watched in its own time: where its ice and its anoxia were, its timeline. */
export interface ColdCrisis {
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
  /** Its measured curves, where the papers give them (#1229). */
  readonly proxies?: readonly ProxyChart[];
  seas(seconds: number): Seas;
}

/** The crises of the seas, by the extinction each is watched for (#1202). */
export const COLD: readonly ColdCrisis[] = [
  {
    key: 'end-ordovician-extinction',
    name: 'the end-Ordovician',
    phases: END_ORDOVICIAN,
    ice: 'hirnantian-ice',
    anoxia: 'dobs-linn',
    // The first pulse, at the Hirnantian's base (ICS chart); the Silurian begins 1.4 Myr on.
    zero: 445.2,
    drawn:
      'Drawn to illustrate: white, the ice sheet’s reach, its timing following the studies and its size drawn to be seen; murky olive, oxygen-poor water over the sea.',
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
      'Drawn to illustrate: murky olive, oxygen-poor water over the sea, darkest on the shelves; each Kellwasser pulse drawn 150,000 years long, an assumption.',
    proxies: [DEVONIAN_OXYGEN_ISOTOPES],
    seas: devonianSeas,
  },
];

/** The seas at `seconds` of `extent`'s clock: its water round `place`, as much as it says. */
export function seasAt(
  extent: AnoxicExtent,
  place: GeoPoint,
  ice: GeoPoint | null,
  seas: Seas,
  seconds: number,
): SeasMoment {
  const share = extent.share(seconds);
  return { ice, patches: share > 0 ? patchesAt(place, scaleFor(place, share)) : [], seas };
}

/** A crisis of the seas on the long crisis clock: its ice at `ice`, its anoxia round `anoxia`. */
export function coldEvent(
  crisis: ColdCrisis,
  ice: GeoPoint | null,
  anoxia: GeoPoint,
): OwnTimeEvent {
  const extent = ANOXIC_EXTENTS[crisis.key];
  return {
    key: crisis.key,
    title: `${capitalised(crisis.name)}, in its own time`,
    phases: crisis.phases,
    scale: LONG_CRISIS_SCALE,
    offer: `Watch ${crisis.name} in its own time`,
    ma: crisis.zero,
    drawn: extent === undefined ? crisis.drawn : `${crisis.drawn} ${extent.says}`,
    legend: seasLegend(ice !== null),
    ...(crisis.proxies === undefined ? {} : { proxies: crisis.proxies }),
    play(tools) {
      const seas = tools.layer(seasLayer);
      return {
        at(seconds) {
          const now = crisis.seas(seconds);
          seas.update(
            extent === undefined
              ? { ice, patches: [], seas: now }
              : seasAt(extent, anoxia, ice, now, seconds),
          );
        },
        end() {
          seas.update(null);
        },
      };
    },
  };
}

/** `text` with a capital first letter: "the end-Ordovician" as a title. */
function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
