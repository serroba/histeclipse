import { describe, expect, it } from 'vitest';

import type { LunarEclipse } from '../data/lunarCatalog';
import { julianDayNumber } from '../time/julianDay';
import { moonInShadow } from './moonInShadow';

function eclipse(gamma: number, umbralMagnitude: number): LunarEclipse {
  return {
    jdTT: julianDayNumber(2_460_748.79161),
    kind: umbralMagnitude >= 1 ? 'total' : umbralMagnitude > 0 ? 'partial' : 'penumbral',
    umbralMagnitude,
    penumbralMagnitude: umbralMagnitude + 1,
    gamma,
    deltaT: 69,
    sublunar: [0, 0],
  };
}

describe('moonInShadow', () => {
  it.each([
    ['2025 Mar 14 (total)', 0.3484, 1.1784],
    ['621 BCE Apr 22 (partial)', 0.9127, 0.1492],
    ['1970 Feb 21 (partial)', 0.9619, 0.0463],
    ['1969 Aug 27 (penumbral)', -1.5407, -0.9516],
  ])(
    'reproduces the catalog umbral magnitude for %s at greatest eclipse',
    (_name, gamma, magnitude) => {
      expect(moonInShadow(eclipse(gamma, magnitude), 0).umbralDepth).toBeCloseTo(magnitude, 1);
    },
  );

  it('puts the Moon north of the axis for positive gamma, and moves it east over time', () => {
    const subject = eclipse(0.3484, 1.1784);
    const before = moonInShadow(subject, -60);
    const after = moonInShadow(subject, 60);
    expect(before.y).toBeCloseTo(0.3484, 9);
    expect(before.x).toBeGreaterThan(0);
    expect(after.x).toBeLessThan(0);
    expect(before.x).toBeCloseTo(-after.x, 9);
  });

  it('reports the phase alongside the geometry', () => {
    const subject = eclipse(0.3484, 1.1784);
    expect(moonInShadow(subject, 0).phase).toBe('total');
    expect(moonInShadow(subject, 300).phase).toBe('none');
    expect(moonInShadow(subject, 300).umbralDepth).toBeLessThan(0);
  });
});
