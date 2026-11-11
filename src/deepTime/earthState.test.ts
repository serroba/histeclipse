import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import polarity from '../../public/data/polarity.json';
import type { PolarityScale } from '../data/polarity';

import {
  DAY_MEASUREMENTS,
  dayMeasurementsAround,
  fieldAt,
  LAST_REVERSAL_MA,
  magneticNorthAt,
  POLARITY_RECORD_MA,
  polaritySpans,
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

describe('fieldAt with the polarity time scale', () => {
  const scale = polarity as PolarityScale;

  it('knows each reversal of the last 83 Ma: Chicxulub struck in a reversed chron', () => {
    expect(fieldAt(66.04, scale).polarity).toBe('reversed');
    expect(fieldAt(1, scale).polarity).toBe('normal');
    expect(fieldAt(LAST_REVERSAL_MA + 0.1, scale).polarity).toBe('reversed');
  });

  it('runs the scale’s last chron on to the superchron, with no gap', () => {
    expect(fieldAt(82.95, scale).polarity).toBe('reversed');
    expect(fieldAt(83.5, scale).polarity).toBe('normal');
  });

  it('falls back to the superchrons and reversing often beyond the scale', () => {
    expect(fieldAt(100, scale).interval?.name).toBe('Cretaceous Normal Superchron');
    expect(fieldAt(150, scale).polarity).toBe('mixed');
  });
});

describe('polaritySpans', () => {
  const scale = polarity as PolarityScale;

  it('cover the span end to end, youngest first, without gaps', () => {
    const spans = polaritySpans(scale, 540);
    expect(spans[0]?.young).toBe(0);
    expect(spans.at(-1)?.old).toBe(540);
    for (const [index, span] of spans.entries()) {
      expect(span.young).toBeLessThan(span.old);
      const next = spans[index + 1];
      if (next !== undefined) {
        expect(next.young).toBe(span.old);
        expect(next.polarity).not.toBe(span.polarity);
      }
    }
  });

  it('show every reversal of the scale, then the superchrons and reversing often', () => {
    const spans = polaritySpans(scale, 540);
    expect(spans.filter(({ young }) => young < 82.875)).toHaveLength(scale.boundaries.length - 1);
    expect(spans.find(({ young }) => young === 83)).toMatchObject({ polarity: 'normal', old: 121 });
    expect(spans.find(({ young }) => young === 267)).toMatchObject({
      polarity: 'reversed',
      old: 318,
    });
  });

  it('say the record is unknown before it reaches', () => {
    const spans = polaritySpans(scale, 1000);
    expect(spans.at(-1)).toEqual({ young: POLARITY_RECORD_MA, old: 1000, polarity: 'unknown' });
  });

  it('keep to a window of the span, and work without the scale', () => {
    const window = polaritySpans(scale, 70, 60);
    expect(window[0]?.young).toBe(60);
    expect(window.at(-1)?.old).toBe(70);
    expect(polaritySpans(null, 2).map(({ polarity: p }) => p)).toEqual(['normal', 'mixed']);
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

describe('magneticNorthAt', () => {
  const scale = polarity as PolarityScale;

  it('Given today, Then a compass points to the north pole', () => {
    expect(magneticNorthAt(0, scale)).toBe('north');
  });

  it('Given the Kiaman superchron, Then it points to the south pole', () => {
    expect(magneticNorthAt(290, null)).toBe('south');
  });

  it('Given a time of frequent reversals, Then either pole', () => {
    expect(magneticNorthAt(400, null)).toBe('either');
  });

  it('Given a time before the record, Then nothing is marked', () => {
    expect(magneticNorthAt(POLARITY_RECORD_MA + 1, scale)).toBeNull();
  });
});
