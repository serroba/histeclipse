/**
 * The temperature through the million years after the K-Pg impact (#1229): Hull et al.'s (2020,
 * Science) global compilation, Table S4, each record aligned to a common age model and given as
 * its change from its own latest-Cretaceous temperature. Drawn as three series: the deep sea
 * (benthic foraminifera), the sea's surface (planktonic foraminifera, TEX86), and land and
 * shallow seas (soils, leaves, shells). Bulk carbonate and fish teeth are left out, as Hull et
 * al. leave them out of their global mean; so are readings before the strike, which a clock
 * starting at the impact's approach cannot place.
 *
 * Pure.
 */

import type { ProxyChart } from '../ownTime';
import DATA from './kpgTemperatures.json' with { type: 'json' };

const MYR = 1e6 * 365.25 * 86_400;

/** Each reading: Myr after the K-Pg (Hull et al.'s 66.04 Ma), °C change, series. */
const READINGS: readonly (readonly number[])[] = DATA.readings;

export const KPG_TEMPERATURES: ProxyChart = {
  name: 'Temperature',
  title: 'Temperature change from the latest Cretaceous, °C',
  low: -6,
  high: 6,
  series: ['Deep sea', 'Sea surface', 'Land and shallow seas'],
  readings: READINGS.map(([myr = 0, change = 0, series = 0]) => ({
    seconds: myr * MYR,
    value: change,
    series,
  })),
  says: 'How much warmer or cooler than just before the impact, record by record, in the million years after it: the deep sea from its foraminifera, the surface from planktonic foraminifera and TEX86, land and shallow seas from soils, leaves and shells. Temperatures stayed close to the latest Cretaceous’s at first, then crept more than 1 °C warmer by about 600,000 years on. Compiled and aligned to one age model by Hull et al. (2020), from many studies’ records; each relative to its own last Cretaceous temperature.',
};
