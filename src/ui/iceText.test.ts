import { describe, expect, it } from 'vitest';

import { iceText, seaIceText } from './deepTimeBar';

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

describe('seaIceText', () => {
  it('says whose sea ice is drawn, and when it is a blend', () => {
    expect(seaIceText({ model: 'mpi-esm1-2-lr', mix: null })).toBe('Sea ice: loading…');
    expect(seaIceText({ model: 'mpi-esm1-2-lr', mix: 0 })).toMatch(
      /^Sea ice: today’s \(NSIDC, 1981–2010\)\./,
    );
    expect(seaIceText({ model: 'miroc-es2l', mix: 1 })).toContain(
      'the Last Glacial Maximum’s, 21,000 years ago, as the MIROC-ES2L climate model has it',
    );
    expect(seaIceText({ model: 'awi-esm-1-1-lr', mix: 0.5 })).toContain(
      'a stand-in, 50% of the way from today’s (NSIDC) to the Last Glacial Maximum’s (AWI-ESM-1-1-LR model)',
    );
  });
});
