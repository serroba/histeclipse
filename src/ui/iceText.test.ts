import { describe, expect, it } from 'vitest';

import { iceText } from './deepTimeBar';

describe('iceText', () => {
  it('credits the ice maps where they reach, and says where they do not', () => {
    expect(iceText({ drawn: true, oldestKa: 80 })).toBe(
      'Ice sheets: PaleoMIST 1.0 (Gowan et al. 2021), every 2,500 years over the last 80,000 years.',
    );
    expect(iceText({ drawn: false, oldestKa: 80 })).toMatch(
      /^Ice sheets: no openly licensed maps reach back beyond 80,000 years;/,
    );
    expect(iceText({ drawn: false, oldestKa: null })).toBe('Ice sheets: loading…');
  });
});
