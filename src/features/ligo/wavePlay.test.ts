import { describe, expect, it } from 'vitest';

import { chirp, GW150914_STAND_IN } from './strain';
import {
  drawnStrain,
  EXAGGERATION,
  loopMs,
  mergerMs,
  momentText,
  SCALE_NOTE,
  sheets,
  SLOWED,
  strainOfSheets,
  waveTimeAt,
} from './wavePlay';

const wave = chirp(GW150914_STAND_IN);

describe('the wave as played', () => {
  it('plays a fifth of a second over about twenty, with still moments either side', () => {
    expect(loopMs(wave)).toBeGreaterThan(15_000);
    expect(loopMs(wave)).toBeLessThan(30_000);
    expect(waveTimeAt(wave, 0)).toBeLessThan(wave.start);
    expect(waveTimeAt(wave, loopMs(wave) - 1)).toBeGreaterThan(wave.end);
  });

  it('loops, and goes a hundred times slower than the wave', () => {
    expect(waveTimeAt(wave, 5000 + loopMs(wave))).toBeCloseTo(waveTimeAt(wave, 5000), 12);
    expect(waveTimeAt(wave, 6000) - waveTimeAt(wave, 5000)).toBeCloseTo(1 / SLOWED, 12);
  });

  it('knows when the merger is', () => {
    expect(waveTimeAt(wave, mergerMs(wave))).toBeCloseTo(0, 12);
  });

  it('stretches the strain to be seen, and says by how much', () => {
    expect(drawnStrain(wave, 0).plus).toBeCloseTo(wave.at(0).plus * EXAGGERATION, 12);
    expect(Math.hypot(drawnStrain(wave, 0).plus, drawnStrain(wave, 0).cross)).toBeCloseTo(0.4, 6);
    expect(SCALE_NOTE).toContain('4 × 10²⁰');
    expect(SCALE_NOTE).toContain('100 times');
  });
});

describe('the sheets the wave comes through', () => {
  const stack = sheets(5, 4);

  it('starts at the ring and goes back behind it', () => {
    expect(stack.depths).toEqual([-0, -1, -2, -3, -4]);
    expect(stack.speed).toBe(400);
    expect(() => sheets(1, 4)).toThrow('two sheets');
  });

  it('meets the wave earlier the farther back it lies', () => {
    const t = -0.05;
    const strains = strainOfSheets(wave, t, stack);
    expect(strains[0]).toEqual(drawnStrain(wave, t));
    expect(strains[4]).toEqual(drawnStrain(wave, t - 4 / 400));
  });
});

describe('where the wave is, in words', () => {
  it('says how long to the merger, and the pitch', () => {
    expect(momentText(wave, -0.1)).toMatch(/^0\.100 s before the merger · \d+ Hz$/);
    expect(momentText(wave, 0)).toBe('The merger · 150 Hz');
    expect(momentText(wave, 0.01)).toBe('Ringing down, 0.010 s after · 250 Hz');
  });

  it('says when space is at rest', () => {
    expect(momentText(wave, wave.start - 1)).toContain('not arrived');
    expect(momentText(wave, wave.end + 1)).toContain('passed');
  });
});
