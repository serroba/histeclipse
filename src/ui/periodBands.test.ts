import { describe, expect, it } from 'vitest';

import { bandsFor } from '../deepTime/chart';
import { readingAt } from './periodBands';

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
