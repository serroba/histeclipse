import { describe, expect, it } from 'vitest';
import { iceOutlineText } from './iceOutlineText';
import type { IceOutlines } from '../data/iceOutlines';

const outlines: IceOutlines = {
  name: 'MIS 6',
  fromKa: 132,
  toKa: 190,
  min: [
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
  ],
  best: [],
  max: [],
};

describe('ice outline explanation', () => {
  it('has no explanation between time slices', () => {
    expect(iceOutlineText(null)).toBeNull();
  });
  it('names the reconstruction, age span, range styles and disagreement', () => {
    const text = iceOutlineText(outlines);
    expect(text).toContain('Batchelor et al. (2019), MIS 6 (132,000–190,000 years ago)');
    expect(text).toContain('solid gold');
    expect(text).toContain('dotted blue');
    expect(text).toContain('dashed red');
    expect(text).toContain('the reconstructions disagree');
  });
  it('formats a named point, a million-year span and a best-only glacial maximum', () => {
    expect(iceOutlineText({ ...outlines, name: '30 ka' })).toContain('about 30,000 years ago');
    expect(iceOutlineText({ ...outlines, fromKa: 1000, toKa: 1500 })).toContain(
      '1–1.5 million years ago',
    );
    expect(iceOutlineText({ ...outlines, min: [] })).toContain('about 26,500 years ago');
    expect(iceOutlineText({ ...outlines, min: [], max: outlines.min })).toContain('MIS 6');
  });
});
