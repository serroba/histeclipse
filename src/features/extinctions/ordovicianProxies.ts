/**
 * The end-Ordovician's tropical sea, measured (#1229): Finnegan et al.'s (2011, Science) clumped
 * isotopes of brachiopods, trilobites and rugose corals from Anticosti Island and the Cincinnati
 * Arch, Table S1, the samples they find unaltered: the temperature each grew in, and its carbon
 * isotopes.
 *
 * Their ages are estimated from each sample's stage, to about half a million years, on a time
 * scale they do not name; they place the Hirnantian's start at the base of the Laframboise
 * Member, between their 445.7 and 445.5 Ma samples. The readings are shifted 0.4 million years
 * so that start meets the clock's first pulse, 445.2 Ma.
 *
 * Pure.
 */

import type { ProxyChart } from '../ownTime';
import DATA from './ordovicianProxies.json' with { type: 'json' };

const MYR = 1e6 * 365.25 * 86_400;
const SERIES = ['Brachiopods and trilobites', 'Rugose corals'];
const DATED =
  'Each sample is dated by its stage, to about half a million years, so it sits only roughly on this clock: shifted so the Hirnantian’s start, as Finnegan et al. place it, meets the clock’s.';

/** Each reading: Myr after the Hirnantian's start, °C, δ¹³C ‰, series. */
type Reading = readonly [myr: number, temperature: number, carbon: number, series: number];
const READINGS = DATA.readings as unknown as readonly Reading[];

function chartOf(pick: (reading: Reading) => number) {
  return READINGS.map((reading) => ({
    seconds: reading[0] * MYR,
    value: pick(reading),
    series: reading[3],
  }));
}

export const ORDOVICIAN_TEMPERATURES: ProxyChart = {
  name: 'Temperature',
  title: 'Tropical sea temperature at Anticosti and the Cincinnati Arch, °C',
  low: 25,
  high: 50,
  series: SERIES,
  readings: chartOf((reading) => reading[1]),
  says: `The temperature each shell or coral grew in, from its clumped isotopes (Finnegan et al. 2011), in the shallow tropical seas of Laurentia: 32–37 °C through most of the time, falling to 28–31 °C only in the Hirnantian’s Laframboise Member, as ice spread over Gondwana. The authors read these as the warmest the sea may have been: some samples hold a little recrystallised calcite, so trends follow the coolest. ${DATED}`,
};

export const ORDOVICIAN_CARBON_ISOTOPES: ProxyChart = {
  name: 'Carbon isotopes',
  title: 'Carbon isotopes of the same shells and corals, δ¹³C, ‰',
  low: -1,
  high: 6,
  series: SERIES,
  readings: chartOf((reading) => reading[2]),
  says: `The share of heavy carbon in the same samples (Finnegan et al. 2011): about 0 to +2.5‰ before and after, rising to +3 to +5‰ in the Hirnantian with the fall in sea level: an excursion found worldwide. ${DATED}`,
};
