/**
 * The cold and the suffocating seas (#1202), as an illustration, not a model: the end-Ordovician's
 * ice sheet over Gondwana at the South Pole, and the oxygen-poor water spreading in the
 * Ordovician's second pulse and the Late Devonian's two. How far and how strongly follows each
 * extinction's studies on the long crisis clock, seconds since its first pulse; the ice's reach
 * and the patches' places are drawn to be seen, not measured.
 *
 * Pure.
 */

import { clamp01 } from '../../util/timing';

const KYR = 1000 * 365.25 * 86_400;

/** What the seas show at a moment: the ice's reach, degrees from its centre, and the anoxia. */
export interface Seas {
  readonly ice: number;
  /** How strongly oxygen-poor water spreads, 0 to 1. */
  readonly anoxia: number;
}

/** Rising from 0 at `from` to 1 at `to`, seconds; falling if `to` is before `from`. */
function ramp(seconds: number, from: number, to: number): number {
  return clamp01((seconds - from) / (to - from));
}

/** A pulse of oxygen-poor water at `at`: spreading over 30,000 years, lasting `length`, ebbing. */
function pulse(seconds: number, at: number, length: number): number {
  return ramp(seconds, at - 30 * KYR, at) * ramp(seconds, at + length + 100 * KYR, at + length);
}

/** The ice's reach before the glacial maximum, at it, and once it has melted, degrees. */
const ICE = { before: 14, most: 30, after: 6 } as const;

/**
 * The end-Ordovician (#1202): ice over Gondwana through much of the time, growing to a glacial
 * maximum at least as large as the last ice age's with the first pulse, the tropics cooling by
 * about 5 °C (Finnegan et al. 2011); melting by the second pulse a million years later, which
 * came with warming and oxygen-poor water (Harper et al. 2014; Bond & Grasby 2020).
 */
export function ordovicianSeas(seconds: number): Seas {
  const growing = ramp(seconds, -200 * KYR, 0);
  const melting = ramp(seconds, 500 * KYR, 1000 * KYR);
  const ice = ICE.before + (ICE.most - ICE.before) * growing - (ICE.most - ICE.after) * melting;
  return { ice, anoxia: pulse(seconds, 1000 * KYR, 300 * KYR) };
}

/**
 * The Late Devonian (#1202): the lower and upper Kellwasser pulses of oxygen-poor water, 600,000
 * years apart (De Vleeschouwer et al. 2017; Bond & Wignall 2008). How long each lasted is drawn
 * at 150,000 years: an assumption.
 */
export function devonianSeas(seconds: number): Seas {
  return {
    ice: 0,
    anoxia: Math.max(pulse(seconds, 0, 150 * KYR), pulse(seconds, 600 * KYR, 150 * KYR)),
  };
}
