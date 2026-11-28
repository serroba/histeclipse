/**
 * The carbon isotopes of St Audrie's Bay through the end-Triassic extinction (#1229): Hesselbo
 * et al.'s (2002) organic-carbon δ¹³C, GSA Data Repository item 2002021, measured by height in
 * the cliff above the base of the Williton Member (Hesselbo et al. 2004).
 *
 * No one published age model places the whole section in time, and those that place parts of it
 * disagree up to fourfold, so the heights are put in time three ways, each from the published
 * tie points listed below, straight between them; a reader switches between them. Each model
 * places only the heights its sources can: none the Westbury Formation below a gap in the
 * record, where published rates differ more than tenfold. The models are assembled for this
 * site from those sources, not taken whole from any one paper; a research note with their
 * quotes is in issue #1229.
 *
 * Pure.
 */

import type { ProxyChart } from '../ownTime';
import DATA from './stAudriesBayCarbon.json' with { type: 'json' };

const KYR = 1000 * 365.25 * 86_400;

/** Each sample: height in the cliff, m, and δ¹³C of organic carbon, ‰ VPDB. */
type Sample = readonly [height: number, carbon: number];
const SAMPLES = DATA.samples as unknown as readonly Sample[];

/** A model's tie points: height, m, and thousands of years after the clock's zero, 201.564 Ma. */
type Tie = readonly [height: number, kyr: number];
type Ties = readonly [Tie, ...Tie[]];

/**
 * A: the sharp "initial" drop (12.70 m) at the extinction and first lavas (Hesselbo et al. 2002;
 * Deenen et al. 2010; Ruhl et al. 2010); the first Jurassic ammonites (19.26 m) at 201.42 Ma,
 * 144 kyr on, by the Newark astrochronology (Kent et al. 2017); the Planorbis Zone (to 28.0 m)
 * about 250 kyr (Ruhl et al. 2010).
 */
const NEWARK: Ties = [
  [12.7, 0],
  [19.26, 144],
  [28.0, 394],
];

/**
 * B: the first CAMP basalts at the base of the Cotham Member (11.56 m), reverse zone SA5r (about
 * 15.2 m) some 210 kyr later, near the Hettangian's base (Hounslow & Andrews 2024); then the
 * Tilmanni Zone 110 kyr and the Planorbis 220 kyr, as Zhao et al. (2026) re-analyse Somerset.
 */
const HOUNSLOW: Ties = [
  [11.56, 0],
  [15.2, 210],
  [19.26, 320],
  [28.0, 540],
];

/**
 * C: Weedon et al.'s (2018) tuned time from the base of the Blue Lias (14.35 m on this scale),
 * their Table 1, set so their base of the Jurassic (1.50 m above the base, 280 kyr) meets the
 * Hettangian's start at 201.36 Ma, 204 kyr after the clock's zero.
 */
const WEEDON: Ties = [
  [14.35 + 1.5, 204],
  [14.35 + 5.26, 204 + (781 - 280)],
  [14.35 + 5.42, 204 + (808 - 280)],
  [14.35 + 8.18, 204 + (1171 - 280)],
  [14.35 + 13.54, 204 + (1778 - 280)],
  [14.35 + 15.6, 204 + (1851 - 280)],
];

/** Where `height` falls in time by `ties`, kyr, or null outside them. */
export function placed(ties: Ties, height: number): number | null {
  let [low, from] = ties[0];
  for (const [high, to] of ties.slice(1)) {
    if (height >= low && height <= high)
      return from + ((to - from) * (height - low)) / (high - low);
    [low, from] = [high, to];
  }
  return null;
}

/** The samples at or below 28.0 m, the top of the Planorbis Zone, placed by `ties`. */
function readingsBy(ties: Ties) {
  return SAMPLES.flatMap(([height, carbon]) => {
    const kyr = height > 28 ? null : placed(ties, height);
    return kyr === null ? [] : [{ seconds: kyr * KYR, value: carbon, series: 0 }];
  });
}

const SAID =
  'The share of heavy carbon in the organic matter of the cliff at St Audrie’s Bay, Somerset (Hesselbo et al. 2002; heights as logged by Hesselbo et al. 2004): it falls sharply at the extinction, the “initial” excursion, recovers briefly, then stays light through the earliest Jurassic. Its heights are put in time by an age model assembled for this site from published work, not taken from one paper; switch models to see how far the same rocks move. The rocks below a gap in the record are not dated.';

function chartOf(name: string, ties: Ties, how: string): ProxyChart {
  return {
    name,
    title: 'Carbon isotopes of organic matter at St Audrie’s Bay, δ¹³C, ‰',
    low: -31,
    high: -23,
    series: ['St Audrie’s Bay'],
    readings: readingsBy(ties),
    says: `${SAID} ${how}`,
  };
}

export const TRIASSIC_CARBON_ISOTOPES: readonly ProxyChart[] = [
  chartOf(
    'δ¹³C, Newark ages',
    NEWARK,
    'This model: the sharp drop set at the extinction and first lavas, as Hesselbo et al. (2002), Deenen et al. (2010) and Ruhl et al. (2010) correlate it; the first Jurassic ammonites 144,000 years later by the Newark astrochronology (Kent et al. 2017); the Planorbis Zone about 250,000 years (Ruhl et al. 2010).',
  ),
  chartOf(
    'δ¹³C, Hounslow',
    HOUNSLOW,
    'This model: the first lavas set a metre lower, at the base of the Cotham Member, and the reverse zone SA5r 210,000 years later (Hounslow & Andrews 2024); then the Tilmanni and Planorbis Zones 110,000 and 220,000 years (Zhao et al. 2026).',
  ),
  chartOf(
    'δ¹³C, Weedon',
    WEEDON,
    'This model: Weedon et al.’s (2018) tuned time for the Blue Lias, which gives the same rocks up to four times as long, set so their base of the Jurassic meets 201.36 Ma; it cannot place the rocks below. Lindström et al. (2017) go further, tying the extinction to an earlier drop, in the Westbury Formation.',
  ),
];
