import { describe, expect, it } from 'vitest';

import type { DatesHere } from '../../data/radiocarbonDates';
import { carried } from './carried';

const sample = {
  latitude: 51,
  longitude: -2,
  age: 3600,
  error: 40,
  lab: 'OxA-1234',
  site: 'Stonehenge',
  country: 'United Kingdom',
  material: 'antler',
  period: 'Bronze Age',
} as unknown as DatesHere['samples'][number];

describe('a date carried across a curve', () => {
  it('takes the northern curve, and says the lab, site, country and what was dated', () => {
    expect(carried(sample, false)).toEqual({
      curve: 'intcal20',
      name: 'IntCal20',
      note: 'OxA-1234 from Stonehenge, United Kingdom (antler, Bronze Age): 3600 ± 40 radiocarbon years, from p3k14c.',
    });
  });

  it('takes the southern curve south of the equator', () => {
    expect(carried(sample, true)).toMatchObject({ curve: 'shcal20', name: 'SHCal20' });
  });

  it('says so plainly where the record names no lab, site, country or material', () => {
    const bare = { ...sample, lab: '', site: '', country: '', material: '', period: '' };
    expect(carried(bare, false).note).toBe(
      'A sample from an unnamed site: 3600 ± 40 radiocarbon years, from p3k14c.',
    );
  });
});
