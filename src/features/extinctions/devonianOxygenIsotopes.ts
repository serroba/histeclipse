/**
 * The Late Devonian's tropical sea, measured (#1229): the oxygen isotopes of conodonts, δ¹⁸O of
 * their apatite, from Joachimski et al.'s (2009, EPSL) Appendix A, Table 2: 639 samples through
 * the Devonian, from sections in Europe, North America and Australia, each with its age on the
 * 2004 time scale (Gradstein et al.). The higher the δ¹⁸O, the cooler the water the conodont grew
 * in.
 *
 * The clock's zero is the lower Kellwasser, 600,000 years before the Frasnian–Famennian boundary;
 * on the 2004 scale that boundary is 374.5 Ma, so each sample sits 375.1 − its age million years
 * after the zero. Drawn as the paper measured them, not converted to temperature.
 *
 * Pure.
 */

import type { ProxyChart } from '../ownTime';
import DATA from './devonianOxygenIsotopes.json' with { type: 'json' };

const MYR = 1e6 * 365.25 * 86_400;

/** Each reading: Myr after the lower Kellwasser, and δ¹⁸O ‰ VSMOW. */
type Reading = readonly [myr: number, oxygen: number];
const READINGS = DATA.readings as unknown as readonly Reading[];

export const DEVONIAN_OXYGEN_ISOTOPES: ProxyChart = {
  name: 'Oxygen isotopes',
  title: 'Oxygen isotopes of conodonts, δ¹⁸O, ‰: higher is cooler',
  low: 16,
  high: 20.5,
  series: ['Conodonts'],
  readings: READINGS.map(([myr, oxygen]) => ({ seconds: myr * MYR, value: oxygen, series: 0 })),
  says: 'The heavy oxygen in the teeth of conodonts, small eel-like animals of the open sea, from sections in Germany and France around the crisis: the higher, the cooler the water. Values rise through the two Kellwasser pulses, the cooling Joachimski & Buggisch (2002) read as tropical seas losing 5–7 °C. Taking the Devonian sea’s own water as −1‰, Joachimski et al. (2009) put the late Frasnian and early Famennian tropics at 30–32 °C on average. Measured and compiled by Joachimski et al. (2009), dated on the 2004 time scale; placed on this clock by the Frasnian–Famennian boundary, 600,000 years after its zero.',
};
