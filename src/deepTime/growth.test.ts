import { describe, expect, it } from 'vitest';

import { earthMass, earthRadius, GROWTH_CHOICES, GROWTH_MODELS, PROTO_EARTH } from './growth';

describe('how fast Earth grew (#1219)', () => {
  it('grows from nothing towards the proto-Earth, never past it', () => {
    for (const model of GROWTH_MODELS) {
      expect(earthMass(model, 0)).toBe(0);
      expect(earthMass(model, 200)).toBeLessThanOrEqual(PROTO_EARTH);
      expect(earthMass(model, 200)).toBeGreaterThan(0.88);
      let last = 0;
      for (const myr of [0.5, 1, 3, 4, 5, 10, 30, 57]) {
        expect(earthMass(model, myr)).toBeGreaterThan(last);
        last = earthMass(model, myr);
      }
    }
  });

  it('has most of the mass while the gas lasted if fast, a third of it slowly', () => {
    expect(earthMass('fast', 4)).toBeCloseTo(0.8 * PROTO_EARTH);
    expect(earthMass('slow', 4)).toBeLessThan(0.3);
    // The slow model's share still to come falls by e every 11 Myr.
    expect(earthMass('slow', 11)).toBeCloseTo(PROTO_EARTH * (1 - Math.exp(-1)));
    expect(earthMass('fast', 1)).toBeLessThan(earthMass('slow', 1));
  });

  it('draws the radius as the cube root of the mass, an embryo at the least', () => {
    expect(earthRadius('slow', 0)).toBe(0.08);
    expect(earthRadius('fast', 4)).toBeCloseTo(Math.cbrt(0.8 * PROTO_EARTH));
    expect(earthRadius('slow', 300)).toBeCloseTo(Math.cbrt(PROTO_EARTH), 3);
  });

  it('names each model’s source', () => {
    expect(GROWTH_CHOICES.slow.source).toContain('Kleine');
    expect(GROWTH_CHOICES.fast.url).toMatch(/^https:\/\/doi\.org\//);
  });
});
