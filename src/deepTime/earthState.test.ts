import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  DAY_MEASUREMENTS,
  dayMeasurementsAround,
  fieldAt,
  LAST_REVERSAL_MA,
  SEA_FLOOR_RECORD_MA,
  SUPERCHRONS,
  TILT,
} from './earthState';

describe('fieldAt', () => {
  it('is normal today and since the last reversal', () => {
    expect(fieldAt(0)).toEqual({ polarity: 'normal', interval: null, landRecord: false });
    expect(fieldAt(0.5).polarity).toBe('normal');
    expect(fieldAt(LAST_REVERSAL_MA + 0.1).polarity).toBe('mixed');
  });

  it('holds still through the superchrons', () => {
    expect(fieldAt(100)).toMatchObject({
      polarity: 'normal',
      interval: { name: 'Cretaceous Normal Superchron' },
    });
    expect(fieldAt(290)).toMatchObject({
      polarity: 'reversed',
      interval: { name: 'Kiaman Reverse Superchron' },
    });
    expect(fieldAt(130).polarity).toBe('mixed');
    expect(fieldAt(250).polarity).toBe('mixed');
  });

  it('says where the record comes only from rocks on land', () => {
    expect(fieldAt(SEA_FLOOR_RECORD_MA).landRecord).toBe(false);
    expect(fieldAt(SEA_FLOOR_RECORD_MA + 5).landRecord).toBe(true);
  });

  it('lists superchrons youngest first, without overlaps', () => {
    for (const [index, chron] of SUPERCHRONS.entries()) {
      expect(chron.young).toBeLessThan(chron.old);
      const next = SUPERCHRONS[index + 1];
      if (next !== undefined) expect(chron.old).toBeLessThan(next.young);
    }
  });
});

describe('day length', () => {
  it('agrees with each source’s days per year', () => {
    for (const { hours, daysPerYear } of DAY_MEASUREMENTS) {
      // Sources round their hours, so to a tenth.
      expect(Math.abs(hours - 8766 / daysPerYear)).toBeLessThan(0.1);
    }
  });

  it('finds the measurements on either side', () => {
    expect(dayMeasurementsAround(0)).toMatchObject({ younger: { ma: 0 }, older: { ma: 70 } });
    expect(dayMeasurementsAround(250)).toMatchObject({
      younger: { ma: 70 },
      older: { ma: 390 },
    });
    expect(dayMeasurementsAround(390)).toMatchObject({ younger: { ma: 390 }, older: { ma: 620 } });
    expect(dayMeasurementsAround(700)).toMatchObject({ younger: { ma: 620 }, older: null });
    // Not a deep-time moment, but still answered: today.
    expect(dayMeasurementsAround(-1).younger.ma).toBe(0);
  });

  it('always brackets the moment', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1000, noNaN: true }), (ma) => {
        const { younger, older } = dayMeasurementsAround(ma);
        expect(younger.ma).toBeLessThanOrEqual(ma);
        if (older !== null) expect(older.ma).toBeGreaterThan(ma);
      }),
    );
  });
});

it('keeps today’s tilt inside its cycle', () => {
  expect(TILT.today).toBeGreaterThan(TILT.min);
  expect(TILT.today).toBeLessThan(TILT.max);
});
