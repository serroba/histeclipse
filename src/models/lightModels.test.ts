import { Box3, Vector3, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';

import {
  buildCobe,
  buildEuclid,
  buildGaia,
  buildHerschelSpace,
  buildHipparcos,
  buildIras,
  buildKepler,
  buildPlanck,
  buildSpitzer,
  buildTess,
  buildWmap,
} from './lightModels';

const size = (object: Object3D): Vector3 => {
  object.updateMatrixWorld(true);
  return new Box3().setFromObject(object).getSize(new Vector3());
};

describe('the space telescopes for light, infrared and microwaves as 3D models (#861)', () => {
  it('Given Planck, Then 4.2 m tall and 4.2 m across', () => {
    const { x, y } = size(buildPlanck());
    expect(y).toBeCloseTo(4.2, 1);
    expect(x).toBeLessThanOrEqual(4.21);
    expect(x).toBeGreaterThan(3.8);
  });

  it('Given WMAP, Then about 3.8 m tall on its 5.0 m shield', () => {
    const { x, y, z } = size(buildWmap());
    expect(Math.max(x, z)).toBeCloseTo(5.0, 1);
    expect(y).toBeGreaterThan(3.3);
    expect(y).toBeLessThan(3.9);
  });

  it('Given Gaia, Then its sunshield is 10.2 m across', () => {
    expect(size(buildGaia()).x).toBeCloseTo(10.2, 1);
  });

  it('Given Kepler, Spitzer and Herschel, Then 4.7 m, 4.5 m and 7.5 m tall', () => {
    expect(size(buildKepler()).y).toBeCloseTo(4.7, 1);
    expect(size(buildSpitzer()).y).toBeCloseTo(4.5, 1);
    const herschel = size(buildHerschelSpace());
    expect(herschel.y).toBeGreaterThan(7.2);
    expect(herschel.y).toBeLessThan(7.6);
  });

  it('Given COBE, Then 8.53 m across its solar panels', () => {
    const { x, z } = size(buildCobe());
    expect(Math.max(x, z)).toBeGreaterThan(7.5);
    expect(Math.max(x, z)).toBeLessThan(8.6);
  });

  it('Given IRAS, Then 3.6 m tall and 3.24 m wide', () => {
    const { x, y } = size(buildIras());
    expect(y).toBeGreaterThan(3.4);
    expect(y).toBeLessThan(3.7);
    expect(x).toBeCloseTo(3.24, 1);
  });

  it('Given Hipparcos, Euclid and TESS, Then built: three panels; 4.5 m tall; four cameras', () => {
    expect(buildHipparcos().children.at(-1)?.children).toHaveLength(3);
    expect(size(buildEuclid()).y).toBeCloseTo(4.5, 1);
    expect(buildTess().children.filter((part) => part.type === 'Group')).toHaveLength(4);
  });
});
