/**
 * A radiocarbon date as the dating card carries it across a curve: which curve, by hemisphere,
 * and what is said of the sample. Pure.
 */

import type { DatesHere } from '../../data/radiocarbonDates';

type Sample = DatesHere['samples'][number];

export interface Carried {
  readonly curve: 'intcal20' | 'shcal20';
  readonly name: 'IntCal20' | 'SHCal20';
  readonly note: string;
}

/** The curve for the hemisphere, and the sample in words: its lab, site, country and material. */
export function carried(sample: Sample, south: boolean): Carried {
  const what = [sample.material, sample.period].filter((word) => word !== '');
  const where = `${sample.site || 'an unnamed site'}${sample.country === '' ? '' : `, ${sample.country}`}`;
  const of = what.length === 0 ? '' : ` (${what.join(', ')})`;
  return {
    curve: south ? 'shcal20' : 'intcal20',
    name: south ? 'SHCal20' : 'IntCal20',
    note: `${sample.lab || 'A sample'} from ${where}${of}: ${String(sample.age)} ± ${String(sample.error)} radiocarbon years, from p3k14c.`,
  };
}
