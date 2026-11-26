/**
 * The sea's surface warming through the end-Permian extinction at Meishan (#1229): conodont
 * oxygen isotopes, Joachimski et al. (2012, GSA Data Repository 2012069, Table DR1), dated by the
 * ash beds of Burgess, Bowring & Shen (2014, Table 1).
 *
 * Temperatures are worked out here from each δ¹⁸O with the paper's equation (Pucéat et al.
 * 2010) and its seawater of −1‰: T = 118.7 − 4.22 (δ¹⁸O + 1). They match the table's to its
 * rounding, but for samples MSC 14 and 15, whose printed temperatures are swapped. Samples the
 * table gives no temperature for (MSC 1a, 4a) are left out, as the paper does.
 *
 * Between dated beds the samples are spaced evenly in their order, an approximation, as their
 * heights are not given; the one sample above bed 28 is drawn across the span to bed 33.
 *
 * Pure.
 */

import type { ProxyChart, ProxyReading } from '../ownTime';

const KYR = 1000 * 365.25 * 86_400;
/** The clock's zero: bed 25, the extinction's start. */
const ZERO = 251.941;

/** Seconds since the clock's zero at `ma`. */
const since = (ma: number) => (ZERO - ma) * 1000 * KYR;

/** Sea-surface temperature, °C, from conodont apatite's δ¹⁸O, ‰ VSMOW. */
export function temperatureOf(d18o: number): number {
  return 118.7 - 4.22 * (d18o + 1);
}

/** A dated ash bed, Ma, between samples in their order. */
interface Dated {
  readonly ma: number;
}
/** A sample, its bed, and its δ¹⁸O: Clarkina, Hindeodus, ramiform elements, where measured. */
interface Sample {
  readonly bed: string;
  readonly d18o: readonly [number | null, number | null, number | null];
  /** Where it is itself at a dated level. */
  readonly ma?: number;
}

/** Meishan's samples bottom to top, with the dated levels among them. */
const SECTION: readonly (Dated | Sample)[] = [
  { ma: 252.104 }, // bed 22's ash
  { bed: '22-14', d18o: [21.6, null, null] },
  { bed: '22-15', d18o: [21.6, null, null] },
  { bed: '22 top', d18o: [21.8, null, null] },
  { ma: 251.999 }, // the base of bed 23, interpolated by Burgess et al.
  { bed: '23-1 base', d18o: [21.3, null, null] },
  { bed: '23-1', d18o: [22.3, null, null] },
  { bed: '23-3', d18o: [21.9, null, null] },
  { bed: '23-4', d18o: [22.0, null, null] },
  { bed: '23-7', d18o: [22.0, null, null] },
  { bed: '24a base', d18o: [21.5, null, null] },
  { bed: '24a', d18o: [21.3, null, null] },
  { bed: '24a', d18o: [21.2, 21.2, 21.0] },
  { bed: '24b', d18o: [20.7, 20.6, null] },
  { bed: '24c', d18o: [20.7, null, null] },
  { bed: '24c-1', d18o: [21.0, null, null] },
  { bed: '24c-2', d18o: [21.2, null, null] },
  { bed: '24c', d18o: [null, 21.2, null] },
  { bed: '24d-1', d18o: [21.0, null, null] },
  { bed: '24d-2', d18o: [21.6, null, null] },
  { bed: '24d-3', d18o: [21.4, null, null] },
  { bed: '24d-4', d18o: [21.4, null, null] },
  { bed: '24d', d18o: [21.1, 21.2, 20.8] },
  { bed: '24e', d18o: [21.0, null, null] },
  { bed: '24e', d18o: [21.6, 21.2, null] },
  { bed: '24e top', d18o: [21.3, null, null] },
  { bed: '24f', d18o: [21.3, null, null] },
  { bed: '24f-1', d18o: [20.9, null, null] },
  { ma: 251.941 }, // bed 25's ash: the extinction begins
  { bed: '26', d18o: [21.0, null, null] },
  { bed: '27a', d18o: [20.0, 19.4, null] },
  { bed: '27b', d18o: [null, 19.5, null] },
  // The boundary, at the first Hindeodus parvus, interpolated by Burgess et al.
  { bed: '27c', d18o: [20.4, 19.4, null], ma: 251.902 },
  { bed: '27d', d18o: [20.4, 19.4, null] },
  { bed: '28', d18o: [null, 19.3, null], ma: 251.88 },
];

/** The sample above bed 28, known only to lie before bed 33's ash, 251.583 Ma. */
const BED_29 = { d18o: 18.8, from: 251.88, to: 251.583 };

/** Each sample's age, Ma: at its dated level, or spaced evenly between the dated levels round it. */
export function sampleAges(section: readonly (Dated | Sample)[]): number[] {
  const levels = section.flatMap((each, index) =>
    each.ma === undefined ? [] : [{ index, ma: each.ma }],
  );
  return section.flatMap((each, index) => {
    if (!('bed' in each)) return [];
    if (each.ma !== undefined) return [each.ma];
    const below = levels.findLast((level) => level.index < index);
    const above = levels.find((level) => level.index > index);
    if (below === undefined || above === undefined) throw new Error(`undated: ${each.bed}`);
    return [
      below.ma + ((above.ma - below.ma) * (index - below.index)) / (above.index - below.index),
    ];
  });
}

function readings(): ProxyReading[] {
  const samples = SECTION.filter((each): each is Sample => 'bed' in each);
  const ages = sampleAges(SECTION);
  const dated = samples.flatMap((sample, index) =>
    sample.d18o.flatMap((d18o, series) =>
      d18o === null
        ? []
        : [{ seconds: since(ages[index] ?? ZERO), value: temperatureOf(d18o), series }],
    ),
  );
  const above: ProxyReading = {
    seconds: since((BED_29.from + BED_29.to) / 2),
    value: temperatureOf(BED_29.d18o),
    series: 1,
    between: [since(BED_29.from), since(BED_29.to)],
  };
  return [...dated, above];
}

export const MEISHAN_TEMPERATURES: ProxyChart = {
  title: 'Sea-surface temperature at Meishan, °C, measured',
  low: 20,
  high: 36,
  series: ['Clarkina', 'Hindeodus', 'Other elements'],
  readings: readings(),
  says: 'Oxygen isotopes of conodonts, tiny teeth, as temperature with seawater at −1‰ (Joachimski et al. 2012): Hindeodus warms by about 8 °C, Clarkina, perhaps living deeper, by 4–5. Dated by the ash beds of Burgess et al. (2014); samples between dated beds are spaced evenly, an approximation, and the last, above bed 28, is drawn across its span.',
};
