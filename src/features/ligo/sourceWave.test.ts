import { describe, expect, it } from 'vitest';

import { orbitOf, radialTable, sourceStrain } from './sourceWave';
import { chirp, GW150914_STAND_IN, type Waveform } from './strain';

/** A steady tone at `hertz`, face on: h₊ = cos 2πft, h× = sin 2πft. */
function tone(hertz: number): Waveform {
  return {
    start: -10,
    end: 10,
    peak: 1,
    at: (t) => ({
      plus: Math.cos(2 * Math.PI * hertz * t),
      cross: Math.sin(2 * Math.PI * hertz * t),
    }),
    frequency: () => hertz,
  };
}

/** Where, going out along one azimuth, h₊ crosses zero. */
function crossings(wave: Waveform, speed: number): number[] {
  const found: number[] = [];
  let last = sourceStrain(wave, { r: 1, phi: 0, iota: Math.PI / 2 }, 0, speed, 1).plus;
  for (let r = 1.001; r < 20; r += 0.001) {
    const now = sourceStrain(wave, { r, phi: 0, iota: Math.PI / 2 }, 0, speed, 1).plus;
    if (Math.sign(now) !== Math.sign(last)) found.push(r);
    last = now;
  }
  return found;
}

describe('the wave leaving its source (#832)', () => {
  it('has a wavelength that halves as the frequency doubles', () => {
    const wavelength = (hertz: number): number => {
      const zeros = crossings(tone(hertz), 100);
      return (2 * ((zeros.at(-1) ?? 0) - (zeros[0] ?? 0))) / (zeros.length - 1);
    };
    expect(wavelength(10)).toBeCloseTo(10, 1);
    expect(wavelength(20)).toBeCloseTo(5, 1);
  });

  it('falls as 1/r', () => {
    const wave = tone(10);
    // Places a whole wavelength apart meet the same phase.
    const near = sourceStrain(wave, { r: 2, phi: 0.3, iota: Math.PI / 2 }, 0, 100, 1).plus;
    const far = sourceStrain(wave, { r: 12, phi: 0.3, iota: Math.PI / 2 }, 0, 100, 1).plus;
    expect(far / near).toBeCloseTo(2 / 12, 9);
  });

  it('is two-armed: turning half way round the source finds the same wave', () => {
    const wave = tone(10);
    const at = (phi: number): number =>
      sourceStrain(wave, { r: 3, phi, iota: Math.PI / 2 }, 0, 100, 1).plus;
    expect(at(0.4 + Math.PI)).toBeCloseTo(at(0.4), 9);
    expect(at(0.4 + Math.PI / 2)).toBeCloseTo(-at(0.4), 9);
  });

  it('is circular face on, plus only and halved in the orbit’s plane', () => {
    const wave = tone(10);
    const above = sourceStrain(wave, { r: 1, phi: 0, iota: 0 }, 0.01, 1e9, 1);
    expect(Math.hypot(above.plus, above.cross)).toBeCloseTo(1, 6);
    const edge = sourceStrain(wave, { r: 1, phi: 0, iota: Math.PI / 2 }, 0, 1e9, 1);
    expect(edge.cross).toBeCloseTo(0, 12);
    expect(edge.plus).toBeCloseTo(0.5, 6);
  });

  it('tabulates the wave as it left, nearest first, for the shader', () => {
    const wave = tone(10);
    const table = radialTable(wave, 0, 100, 5, 6);
    expect(table).toHaveLength(12);
    expect(table[0]).toBeCloseTo(1, 6);
    // 5 units out it left 0.05 s earlier: half a cycle at 10 Hz.
    expect(table[10]).toBeCloseTo(-1, 6);
  });
});

describe('the two black holes’ orbit', () => {
  const wave = chirp(GW150914_STAND_IN);
  const orbit = orbitOf(wave);

  it('goes round at half the wave’s frequency, always the same way', () => {
    const turned = orbit.angle(-0.05) - orbit.angle(-0.1);
    // About four wave cycles from 0.1 to 0.05 s before the merger: two orbits.
    expect(turned).toBeGreaterThan(0);
    const late = (orbit.angle(-0.001) - orbit.angle(-0.002)) / 0.001 / (2 * Math.PI);
    expect(late).toBeCloseTo(wave.frequency(-0.0015) / 2, -1);
  });

  it('closes in as the pitch rises, by Kepler’s third law, and is one after the merger', () => {
    expect(orbit.separation(wave.start)).toBeCloseTo(1, 2);
    expect(orbit.separation(0)).toBeCloseTo((150 / 35) ** (-2 / 3), 2);
    expect(orbit.two(-0.01)).toBe(true);
    expect(orbit.two(0.01)).toBe(false);
    expect(orbit.angle(5)).toBe(orbit.angle(0));
  });
});

describe('an orbit the wave cannot give', () => {
  const silent: Waveform = {
    start: -0.1,
    end: 0.02,
    peak: 0,
    at: () => ({ plus: 0, cross: 0 }),
    frequency: () => 0,
  };

  it('stays where it began, and is gone after the merger', () => {
    const orbit = orbitOf(silent);
    expect(orbit.angle(-0.05)).toBe(0);
    expect(orbit.separation(-0.05)).toBe(1);
    expect(orbit.separation(0.01)).toBe(0);
  });

  it('turns the other way for a wave turning the other way', () => {
    const backwards: Waveform = {
      ...tone(50),
      at: (t) => ({ plus: Math.cos(2 * Math.PI * 50 * t), cross: -Math.sin(2 * Math.PI * 50 * t) }),
      start: -0.1,
      end: 0.01,
    };
    const orbit = orbitOf(backwards);
    expect(orbit.angle(-0.02) - orbit.angle(-0.06)).toBeCloseTo(-2 * Math.PI * 25 * 0.04, 1);
  });
});
