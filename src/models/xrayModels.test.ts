import { Box3, Vector3, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';

import {
  buildChandra,
  buildCompton,
  buildFermi,
  buildNustar,
  buildSpektrRg,
  buildSwift,
  buildXmm,
} from './xrayModels';

const size = (object: Object3D): Vector3 => {
  object.updateMatrixWorld(true);
  return new Box3().setFromObject(object).getSize(new Vector3());
};

describe('the space telescopes for X-rays and gamma rays as 3D models (#862)', () => {
  it('Given Chandra, Then 13.8 m long and 19.5 m across its arrays', () => {
    const { x, y } = size(buildChandra());
    expect(x).toBeCloseTo(19.5, 1);
    expect(y).toBeGreaterThan(13.6);
    expect(y).toBeLessThan(14.4);
  });

  it('Given XMM-Newton, Then 10 m long and 16 m across', () => {
    const { x, y } = size(buildXmm());
    expect(x).toBeCloseTo(16, 1);
    expect(y).toBeCloseTo(10, 1);
  });

  it('Given Fermi and Compton, Then 15 m and 21.3 m across their arrays', () => {
    expect(size(buildFermi()).x).toBeCloseTo(15, 1);
    const compton = size(buildCompton());
    expect(compton.x).toBeCloseTo(21.3, 1);
    expect(compton.y).toBeGreaterThan(3.8);
  });

  it('Given Swift, Then its mask is 1 m above its detectors', () => {
    const swift = buildSwift();
    const [, plane, mask] = swift.children;
    expect((mask?.position.y ?? 0) - (plane?.position.y ?? 0)).toBeCloseTo(1, 9);
    // Everything stands on or above its bus.
    swift.updateMatrixWorld(true);
    expect(new Box3().setFromObject(swift).min.y).toBeGreaterThan(-0.1);
  });

  it('Given NuSTAR, Then some 10.9 m long, its optics 10.14 m from its detectors', () => {
    const { y } = size(buildNustar());
    expect(y).toBeGreaterThan(10.8);
    expect(y).toBeLessThan(11.4);
  });

  it('Given Spektr-RG, Then ART-XC stands 3.5 m tall beside eROSITA', () => {
    const { y } = size(buildSpektrRg());
    expect(y).toBeCloseTo(1.6 + 3.5, 1);
  });
});
