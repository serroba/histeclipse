import { describe, expect, it } from 'vitest';

import { iceText } from './deepTimeBar';

describe('iceText', () => {
  it('credits the ice maps where they reach, and says where they do not', () => {
    expect(iceText({ drawn: true, oldestKa: 80, standIn: null })).toBe(
      'Ice sheets: PaleoMIST 1.0 (Gowan et al. 2021), every 2,500 years over the last 80,000 years.',
    );
    expect(iceText({ drawn: false, oldestKa: 80, standIn: null })).toMatch(
      /^Ice sheets: no openly licensed maps reach back beyond 80,000 years;/,
    );
    expect(iceText({ drawn: false, oldestKa: null, standIn: null })).toBe('Ice sheets: loading…');
  });

  it('says plainly when a later map stands in, and why', () => {
    const standIn = { ka: 60, file: '60000.png', frameLevel: -58.4, level: -60.2 };
    expect(iceText({ drawn: true, oldestKa: 80, standIn })).toBe(
      'Ice sheets: a stand-in. No openly licensed maps reach back beyond 80,000 years, so this is the ice of 60,000 years ago, when sea level was similar (−58 m, against −60 m at the moment shown). Sea level tracks how much ice there was, not where: the ice sheets’ shapes may have differed.',
    );
    expect(
      iceText({
        drawn: true,
        oldestKa: 80,
        standIn: { ...standIn, ka: 0, frameLevel: 0, level: 4 },
      }),
    ).toContain(
      'so this is today’s ice, when sea level was similar (0 m, against +4 m at the moment shown)',
    );
  });
});
