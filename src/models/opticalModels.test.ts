import { Box3, InstancedMesh, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';

import {
  buildHale,
  buildHerschel,
  buildHooker,
  buildLeviathan,
  buildYerkes,
} from './historicalModels';
import { buildElt, buildGtc, buildKeck, buildRubin, buildSubaru, buildVlt } from './opticalModels';

const box = (object: Object3D): Box3 => {
  object.updateMatrixWorld(true);
  return new Box3().setFromObject(object);
};

/** The segments' instanced meshes in a model. */
const segments = (model: Object3D): number[] => {
  const found: number[] = [];
  model.traverse((part) => {
    if (part instanceof InstancedMesh) found.push(part.count);
  });
  return found;
};

describe('the optical telescopes as 3D models (#860)', () => {
  it('Given Keck, Then two mirrors of 36 segments, 85 m apart', () => {
    const keck = buildKeck();
    expect(segments(keck)).toEqual([36, 36]);
    const twins = keck.getObjectByName('array')?.children ?? [];
    expect(twins[0]?.position.distanceTo(twins[1]?.position ?? twins[0].position)).toBeCloseTo(
      85,
      5,
    );
  });

  it('Given the ELT, Then 798 segments, in a dome 80 m tall, its secondary some 60 m up', () => {
    const elt = buildElt();
    expect(segments(elt)).toEqual([798]);
    expect(box(elt).max.y).toBeCloseTo(80, 5);
  });

  it('Given the GTC, Then 36 segments, and its dome tops its 41 m building', () => {
    const gtc = buildGtc();
    expect(segments(gtc)).toEqual([36]);
    expect(box(gtc).max.y).toBeCloseTo(41, 5);
  });

  it('Given Subaru, Then its enclosure is 43 m tall; the VLT has four Unit Telescopes and four Auxiliaries', () => {
    expect(box(buildSubaru()).max.y).toBeCloseTo(43, 5);
    const vlt = buildVlt();
    const groups: number[] = [];
    vlt.traverse((part) => {
      if (part.name === 'array') groups.push(part.children.length);
    });
    expect(groups).toEqual([4, 4]);
    expect(box(vlt).max.y).toBeCloseTo(28.5, 5);
  });

  it('Given Rubin, Then its dome, 30 m across, stands on its 15 m pier', () => {
    const { min, max } = box(buildRubin());
    expect(max.y).toBeCloseTo(15 + 26, 5);
    expect(min.y).toBeLessThan(0);
  });
});

describe('the historical telescopes as 3D models (#860)', () => {
  it('Given the Hale and the Hooker, Then their domes are 41 m and 30.5 m across', () => {
    expect(box(buildHale()).max.y).toBeCloseTo(41, 5);
    const hooker = box(buildHooker());
    expect(hooker.max.y).toBeCloseTo(10.06 + 24, 5);
  });

  it('Given Yerkes, Then its tube is 18.3 m long, in its dome 27.4 m across', () => {
    const yerkes = buildYerkes();
    expect(box(yerkes).max.y).toBeCloseTo(27.4, 5);
  });

  it('Given Herschel’s 40-foot and the Leviathan, Then their tubes are 12.2 m and 16 m long', () => {
    const length = (model: Object3D): number => {
      const tube = model.getObjectByName('tube');
      const geometry = (tube as unknown as { geometry: { parameters: { height: number } } })
        .geometry;
      return geometry.parameters.height;
    };
    expect(length(buildHerschel())).toBeCloseTo(12.19, 5);
    expect(length(buildLeviathan())).toBeCloseTo(16, 5);
    expect(box(buildLeviathan()).max.y).toBeCloseTo(15.2, 5);
  });
});
