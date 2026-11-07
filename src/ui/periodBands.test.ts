import { describe, expect, it } from 'vitest';

import { bandsFor } from '../deepTime/chart';
import { deepShort, deepTicks, lengthText, readingAt, roundStep, yearTicks } from './periodBands';

describe('what a point on a time slider reads', () => {
  const phanerozoic = bandsFor(540);

  it('gives the moment there and the chapter it falls in', () => {
    // Halfway along 540 million years: 270 million years ago, in the Permian.
    expect(readingAt(0.5, 540, 0, phanerozoic)).toBe('270 million years ago · Permian');
    // The span starts just before the Cambrian (538.8 Ma), in the Ediacaran's last sliver.
    expect(readingAt(0, 540, 0, phanerozoic)).toBe('540 million years ago · Ediacaran');
  });

  it('holds to the slider’s ends beyond them', () => {
    expect(readingAt(-0.2, 540, 0, phanerozoic)).toBe(readingAt(0, 540, 0, phanerozoic));
    expect(readingAt(1.3, 540, 0, phanerozoic)).toBe('Today · Quaternary');
  });

  it('changes chapter at a boundary', () => {
    // 251.902 Ma is the Triassic's base, as the chart has it: just after it, the Triassic.
    const triassic = phanerozoic.find(({ unit }) => unit.name === 'Triassic');
    if (triassic === undefined) throw new Error('no Triassic');
    const at = (ma: number): string => readingAt(1 - ma / 540, 540, 0, phanerozoic);
    expect(at(triassic.unit.base + 0.01)).toMatch(/· Permian$/);
    expect(at(triassic.unit.base - 0.01)).toMatch(/· Triassic$/);
  });

  it('says the years in their own words, past 1950 too, in the age that runs to today', () => {
    const holocene = bandsFor(0.0117);
    const year = (ma: number): string => String(Math.round(1950 - ma * 1e6));
    const today = (1950 - 2026) / 1e6;
    expect(readingAt(1, 0.0117, today, holocene, year)).toBe('2026 · Meghalayan');
    expect(readingAt(0, 0.0117, today, holocene, year)).toBe('-9750 · Greenlandian');
  });
});

describe('the round marks between a slider’s ends', () => {
  it('steps by 1, 2 or 5 times a power of ten', () => {
    expect(roundStep(540, 5)).toBe(200);
    expect(roundStep(2.6, 5)).toBe(1);
    expect(roundStep(4568, 5)).toBe(1000);
    expect(roundStep(11_976, 5)).toBe(5000);
  });

  it('marks deep time in Ma, and in ka under a million years, clear of the ends', () => {
    expect(deepTicks(540, 0).map(({ label }) => label)).toEqual(['200 Ma', '400 Ma']);
    expect(deepTicks(4568, 0).map(({ label }) => label)).toEqual([
      '1,000 Ma',
      '2,000 Ma',
      '3,000 Ma',
    ]);
    expect(deepTicks(2.6, 0).map(({ label }) => label)).toEqual(['1 Ma', '2 Ma']);
    expect(deepTicks(0.6, 0).map(({ label }) => label)).toEqual(['200 ka', '400 ka']);
  });

  it('marks the years at round historical years, with no year 0', () => {
    const ma = (year: number): number => (1950 - year) / 1e6;
    const ticks = yearTicks(ma(-9699), ma(2026));
    // Every other millennium, clear of the ends, where 9700 BCE and this year are named.
    expect(ticks.map(({ label }) => label)).toEqual(['6000 BCE', '4000 BCE', '2000 BCE']);
    for (const { label } of ticks) expect(label).not.toMatch(/^0 /);
    // 2000 BCE is astronomical year −1999.
    const twoThousand = ticks.find(({ label }) => label === '2000 BCE');
    expect(twoThousand?.ma).toBeCloseTo((1950 + 1999) / 1e6, 9);
  });
});

describe('how long a chapter lasted', () => {
  it('says millions of years for long ones, years for short ones', () => {
    expect(lengthText(251.902, 201.4)).toBe('50.5 Myr');
    expect(lengthText(4567, 4031)).toBe('536 Myr');
    expect(lengthText(0.0042, 0)).toBe('4,200 years');
    expect(lengthText(0.0117, 0.0082)).toBe('3,500 years');
  });
});

describe('the ends, short enough for a phone', () => {
  it('names deep time in Ma, ka under a million years, and now', () => {
    expect(deepShort(540)).toBe('540 Ma');
    expect(deepShort(4568)).toBe('4,568 Ma');
    expect(deepShort(2.6)).toBe('2.6 Ma');
    expect(deepShort(0.021)).toBe('21 ka');
    expect(deepShort(0)).toBe('now');
  });
});
