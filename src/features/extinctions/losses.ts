/**
 * What each extinction took, for the gauge on its clock (#1223): the share of marine genera lost,
 * as Stanley (2016, Fig. 4) estimates it with the extinction already under way before each crisis
 * counted apart, beside the other counts of the fossil record that Bond & Grasby (2017, Table 2)
 * set side by side, Sepkoski's (1996), Bambach et al.'s (2004) and McGhee et al.'s (2013). Where
 * Stanley gives none, the end-Triassic, the gauge spans the others. How the losses fall over each
 * clock is drawn from its phases, and each gauge's words say so.
 *
 * Pure.
 */

import type { LossGauge } from '../ownTime';

const DAY = 86_400;
const YEAR = 365.25 * DAY;
const KYR = 1000 * YEAR;

const WHAT = 'Marine genera';

/** Whose estimate the gauge draws, and how it is counted. */
const STANLEY =
  'as Stanley (2016) estimates it, the extinction already under way before the crisis counted apart';

/** The other counts of genera lost, Sepkoski's, Bambach et al.'s and McGhee et al.'s, percent. */
function others(sepkoski: number, bambach: number, mcghee: number): string {
  return `other counts give ${String(sepkoski)}% (Sepkoski), ${String(bambach)}% (Bambach et al.) and ${String(mcghee)}% (McGhee et al.), as Bond & Grasby set them side by side`;
}

export const LOSSES: Readonly<Record<string, LossGauge>> = {
  'end-ordovician-extinction': {
    what: WHAT,
    // Stanley's Fig. 4 favours 45–46%; his text gives 42–43%, or 43–44% with fewer late
    // Ashgillian background losses. Both are shown.
    lost: [0.42, 0.46],
    pulses: [
      { from: 0, to: 200 * KYR, share: 0.7 },
      { from: 1000 * KYR, to: 1200 * KYR, share: 0.3 },
    ],
    says: `Lost over both pulses, more than two thirds in the first: 42–46% ${STANLEY}; ${others(49, 43, 52)}. Drawn falling over 200,000 years at each pulse: the timing is drawn, the total estimated.`,
  },
  'late-devonian-extinction': {
    what: WHAT,
    lost: [0.16, 0.2],
    pulses: [
      { from: 0, to: 150 * KYR, share: 0.5 },
      { from: 600 * KYR, to: 750 * KYR, share: 0.5 },
    ],
    says: `Lost in the Frasnian crisis: 16–20% ${STANLEY}; ${others(35, 22, 40)}. Few genera, but the reefs never recovered. Split evenly between the two Kellwasser pulses, an assumption; the total is estimated.`,
  },
  'end-guadalupian-extinction': {
    what: WHAT,
    lost: [0.33, 0.35],
    pulses: [{ from: 0, to: 100 * KYR, share: 1 }],
    says: `Lost: 33–35% ${STANLEY}, about half the end-Permian’s; ${others(47, 36, 25)}. Drawn falling over its first 100,000 years, an assumption; the total is estimated.`,
  },
  'end-permian-extinction': {
    what: WHAT,
    // 61.8–62.4% for E/O of 1.0 and 0.95; about 64% were it as low as 0.8.
    lost: [0.618, 0.624],
    pulses: [{ from: 0, to: 61 * KYR, share: 1 }],
    says: `Lost: about 62% ${STANLEY}; of species, about 81%, not the 90–96% often quoted. ${capitalised(others(58, 57, 83))}. Drawn falling evenly across the dated window; the total is estimated.`,
  },
  'end-triassic-extinction': {
    what: WHAT,
    lost: [0.33, 0.73],
    pulses: [{ from: 0, to: 20 * KYR, share: 1 }],
    says: `Lost: 33% (Bambach et al.), 40% (Sepkoski) or 73% (McGhee et al.), as Bond & Grasby set them side by side, the counts far apart; Stanley (2016) left it out, its timing and marine victims too controversial. Drawn falling over the first 20,000 years, with the burst of carbon: the timing is drawn.`,
  },
  'k-pg-extinction': {
    what: WHAT,
    lost: [0.38, 0.4],
    pulses: [{ from: 14 * DAY, to: 100 * YEAR, share: 1 }],
    says: `Lost: 38–40% ${STANLEY}; ${others(39, 34, 40)}. Drawn falling from the darkness to a century on: the timing is drawn, the total estimated.`,
  },
};

/** `text` with a capital first letter. */
function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
