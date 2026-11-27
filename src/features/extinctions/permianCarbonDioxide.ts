/**
 * Carbon dioxide through the end-Permian extinction (#1229): Wu et al. (2021, Nature
 * Communications, Supplementary Data 3), worked out from the carbon isotopes of fossil plants in
 * southwest China against those of the sea's carbonates, both smoothed (LOESS).
 *
 * Their curve gives the median every 2,000 years from 252.104 to 251.4 Ma; every fifth is kept
 * here, 10,000 years apart, with the last. The ages are theirs: the plants' sections are matched
 * to the sea's carbon-isotope shift and dated by Meishan's ash beds (Burgess et al. 2014).
 *
 * Pure.
 */

import type { ProxyChart } from '../ownTime';

const KYR = 1000 * 365.25 * 86_400;
/** The clock's zero: bed 25 at Meishan, the extinction's start. */
const ZERO = 251.941;

/** Their median CO₂, ppm, at each age, Ma, oldest first. */
const CURVE: readonly (readonly [ma: number, ppm: number])[] = [
  [252.104, 427],
  [252.094, 428],
  [252.084, 429],
  [252.074, 430],
  [252.064, 432],
  [252.054, 432],
  [252.044, 421],
  [252.034, 424],
  [252.024, 450],
  [252.014, 478],
  [252.004, 510],
  [251.994, 507],
  [251.984, 457],
  [251.974, 449],
  [251.964, 496],
  [251.954, 587],
  [251.944, 618],
  [251.934, 688],
  [251.924, 950],
  [251.914, 1536],
  [251.904, 2125],
  [251.894, 2507],
  [251.884, 2374],
  [251.874, 2032],
  [251.864, 1802],
  [251.854, 1680],
  [251.844, 1442],
  [251.834, 1328],
  [251.824, 1314],
  [251.814, 1293],
  [251.804, 1299],
  [251.794, 1328],
  [251.784, 1338],
  [251.774, 1358],
  [251.764, 1396],
  [251.754, 1451],
  [251.744, 1484],
  [251.734, 1549],
  [251.724, 1607],
  [251.714, 1623],
  [251.704, 1682],
  [251.694, 1730],
  [251.684, 1803],
  [251.674, 1845],
  [251.664, 1849],
  [251.654, 1838],
  [251.644, 1872],
  [251.634, 1902],
  [251.624, 1920],
  [251.614, 1948],
  [251.604, 1980],
  [251.594, 1968],
  [251.584, 1945],
  [251.574, 1920],
  [251.564, 1863],
  [251.554, 1782],
  [251.544, 1699],
  [251.534, 1628],
  [251.524, 1551],
  [251.514, 1475],
  [251.504, 1378],
  [251.494, 1297],
  [251.484, 1211],
  [251.474, 1133],
  [251.464, 1059],
  [251.454, 981],
  [251.444, 916],
  [251.434, 845],
  [251.424, 788],
  [251.414, 731],
  [251.404, 684],
  [251.4, 665],
];

export const PERMIAN_CARBON_DIOXIDE: ProxyChart = {
  name: 'Carbon dioxide',
  title: 'Carbon dioxide, ppm, worked out from fossil plants',
  low: 0,
  high: 3000,
  series: ['Median (Wu et al. 2021)'],
  readings: CURVE.map(([ma, ppm]) => ({
    seconds: (ZERO - ma) * 1000 * KYR,
    value: ppm,
    series: 0,
  })),
  says: 'From the carbon isotopes of fossil plants in southwest China, against the sea’s (Wu et al. 2021): some 430 ppm before, about 2,500 at the peak, 47,000 years after the extinction began, then near 2,000 again some 340,000 years on. Each is a median: at the peak, there are two chances in three it lay between about 1,300 and 7,300. An Earth-system model fitted to other records gives far more, some 7,400 ppm (Cui et al. 2021). Dated by matching the plants’ carbon-isotope shift to the sea’s at Meishan.',
};
