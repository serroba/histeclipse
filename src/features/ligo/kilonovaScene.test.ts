import type { Points, PointsMaterial } from 'three';
import { describe, expect, it } from 'vitest';

import { EJECTA } from './kilonova';
import { CLOUD, createKilonovaScene, ejectaPoints } from './kilonovaScene';
import { seeded } from '../../story/seeded';

const [BLUE, RED] = EJECTA;

describe('the kilonova, as drawn (#992)', () => {
  it('streams the blue toward the poles, out to its speed, and lays the red about the orbit’s plane, slower', () => {
    const random = seeded(1);
    const blue = ejectaPoints(BLUE, 500, random);
    const red = ejectaPoints(RED, 500, random);
    const each = (values: Float32Array, check: (x: number, y: number, z: number) => void): void => {
      for (let index = 0; index < values.length; index += 3) {
        check(values[index] ?? 0, values[index + 1] ?? 0, values[index + 2] ?? 0);
      }
    };
    each(blue, (x, y, z) => {
      const r = Math.hypot(x, y, z);
      expect(r).toBeLessThanOrEqual(CLOUD + 1e-6);
      if (r > 1e-6) expect(Math.abs(y) / r).toBeGreaterThanOrEqual(Math.cos(Math.PI / 4) - 1e-6);
    });
    each(red, (x, y, z) => {
      const r = Math.hypot(x, y, z);
      expect(r).toBeLessThanOrEqual(CLOUD / 3 + 1e-6);
      if (r > 1e-6)
        expect(Math.abs(y) / r).toBeLessThanOrEqual(Math.sin((35 * Math.PI) / 180) + 1e-6);
    });
    // Both poles.
    let north = 0;
    each(blue, (_x, y) => {
      if (y > 0) north += 1;
    });
    expect(north).toBeGreaterThan(150);
    expect(north).toBeLessThan(350);
  });

  it('glows blue early and red late', () => {
    const drawn = createKilonovaScene();
    const opacity = (name: string): number =>
      ((drawn.group.getObjectByName(name) as Points).material as PointsMaterial).opacity;
    drawn.set(1);
    const early = { blue: opacity('blue ejecta'), red: opacity('red ejecta') };
    drawn.set(14);
    expect(early.blue).toBeGreaterThan(early.red);
    expect(opacity('red ejecta')).toBeGreaterThan(opacity('blue ejecta'));
    expect(drawn.group.getObjectByName('remnant')).toBeDefined();
    drawn.dispose();
  });
});
