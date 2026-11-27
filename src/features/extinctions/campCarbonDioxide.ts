/**
 * Carbon dioxide through the end-Triassic's eruptions in the Newark Basin (#1229): soil
 * carbonates below, between and above the province's first three lava flows, Schaller, Wright &
 * Kent (2011, Science, table S1).
 *
 * Each sample is placed by its time from the base of the first lava, the Orange Mountain Basalt,
 * which the table counts in the basin's lake-level cycles. That base is put at 201.52 Ma, as
 * Schaller, Wright & Kent (2015, GSA Bulletin, Table 1) put it from Blackburn et al. (2013); the
 * 2011 table put it at 201.49, an older age, but counted the same thousands of years from it.
 * Samples older than the clock's start, 400,000 years before the extinction, are left out.
 *
 * Pure.
 */

import type { ProxyChart, ProxyReading } from '../ownTime';

const KYR = 1000 * 365.25 * 86_400;
/** The clock's zero: the extinction's start (Blackburn et al. 2013). */
const ZERO = 201.564;
/** The basin's first lava's base, Ma (Blackburn et al. 2013, as Schaller et al. 2015 place it). */
const FIRST_LAVA = 201.52;

/** A sample: thousands of years from the first lava's base, and its CO₂, ppm. */
type Sample = readonly [sample: string, fromLava: number, ppm: number];

/** Table S1's samples, oldest first, from NPC87-377 (the older ones fall before the clock). */
const SAMPLES: readonly Sample[] = [
  ['NPC87-377', -386.7, 2253],
  ['NPMART-1400', -323.6, 2242],
  ['NPMART-1342', -236.1, 1787],
  ['NPEX', -19.1, 1065],
  // The Orange Mountain Basalt, then the Feltville Formation.
  ['NFPT26-245', 0.5, 4434],
  ['NFPT26-169', 36.2, 4228],
  ['NFC93-134', 102.2, 3584],
  ['NFDH9-105', 212.5, 3577],
  ['NFPTI3-156', 233.4, 3453],
  // The Preakness Basalt, then the Towaco Formation.
  ['NTC125-170', 263.7, 4234],
  ['NTC124-73', 263.7, 4070],
  ['NTPT16-340', 274.3, 4050],
  ['NTC100-195', 278.4, 4015],
  ['NTC125-110', 278.4, 3657],
  ['NTPT16-266', 290.1, 3014],
  ['NTC127-192', 327.0, 3460],
  ['NTC101-128', 371.6, 2642],
  ['NTC128-221', 415.7, 3708],
  ['NTC129-223', 465.3, 2356],
  ['NTPT12-239', 575.7, 1949],
  // The Hook Mountain Basalt, then the Boonton Formation.
  ['NBC104-123', 583.8, 4941],
  ['NBPT9-453', 583.8, 5273],
  ['NBC134-192', 1012.2, 3131],
  ['NBPT3-250', 1127.4, 2496],
];

/** Seconds since the clock's zero of a sample `fromLava` thousand years from the first lava. */
export function secondsOf(fromLava: number): number {
  return ((ZERO - FIRST_LAVA) * 1000 + fromLava) * KYR;
}

function readings(): ProxyReading[] {
  return SAMPLES.map(([, fromLava, ppm]) => ({
    seconds: secondsOf(fromLava),
    value: ppm,
    series: fromLava < 0 ? 0 : 1,
  }));
}

export const CAMP_CARBON_DIOXIDE: ProxyChart = {
  name: 'Carbon dioxide',
  title: 'Carbon dioxide in the Newark Basin, ppm, measured',
  low: 0,
  high: 6000,
  series: ['Below the first lava', 'Between and above the lavas'],
  readings: readings(),
  says: 'From soil carbonates in New Jersey (Schaller, Wright & Kent 2011): some 2,000 ppm before the eruptions, about 4,400 just after the basin’s first lava, then falling back over some 300,000 years, a pattern repeated after the next two flows. Each value is uncertain by about a third. Samples are dated by lake-level cycles counted from that lava, which is put at 201.52 million years ago (Blackburn et al. 2013, as Schaller et al. 2015 place it).',
};
