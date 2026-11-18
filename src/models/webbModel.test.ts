import { Box3, Mesh, Vector3, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';

import { buildWebb, segmentCentres, WEBB } from './webbModel';

function size(object: Parameters<Box3['setFromObject']>[0]): Vector3 {
  return new Box3().setFromObject(object).getSize(new Vector3());
}

describe('Webb as a 3D model (#797)', () => {
  const webb = buildWebb();

  it('Given NASA’s sizes, Then the sunshield is 21.2 m long and 14.2 m across, in five layers', () => {
    const shield = webb.getObjectByName('sunshield');
    expect(shield).toBeDefined();
    if (shield === undefined) return;
    const { x, z } = size(shield);
    expect(z).toBeCloseTo(WEBB.sunshieldLength, 1);
    expect(x).toBeCloseTo(WEBB.sunshieldWidth, 1);
    const layers = shield.children.filter(({ name }) => name.startsWith('sunshield-layer-'));
    expect(layers).toHaveLength(5);
  });

  it('Given the primary mirror, Then it has 18 segments, 6.6 m tip to tip and about 6.5 m across', () => {
    const mirror = webb.getObjectByName('primary-mirror');
    const segments: Object3D[] = [];
    mirror?.traverse((part) => {
      if (part instanceof Mesh && part.name === 'mirror-segment') segments.push(part);
    });
    expect(segments).toHaveLength(WEBB.segments);
    const box = new Box3();
    for (const segment of segments) box.expandByObject(segment);
    const span = box.getSize(new Vector3());
    expect(span.y).toBeGreaterThan(6.5);
    expect(span.y).toBeLessThan(6.7);
    expect(span.x).toBeGreaterThan(6.0);
    expect(span.x).toBeLessThan(6.6);
  });

  it('Given the segments, Then none overlaps another and the centre is left open', () => {
    const centres = segmentCentres();
    expect(centres).toHaveLength(18);
    for (const [index, [x, y]] of centres.entries()) {
      expect(Math.hypot(x, y)).toBeGreaterThan(WEBB.segmentAcross * 0.99);
      for (const [x2, y2] of centres.slice(index + 1)) {
        expect(Math.hypot(x - x2, y - y2)).toBeGreaterThan(WEBB.segmentAcross * 0.99);
      }
    }
  });

  it('Given the axes, Then the mirror is on the cold side, the bus on the Sun’s, the secondary in front', () => {
    webb.updateMatrixWorld(true);
    const at = (name: string): Vector3 =>
      new Box3().setFromObject(webb.getObjectByName(name) ?? webb).getCenter(new Vector3());
    expect(at('primary-mirror').y).toBeGreaterThan(2);
    expect(at('bus').y).toBeLessThan(0);
    const secondary = webb.getObjectByName('secondary-mirror')?.getWorldPosition(new Vector3());
    // The group's origin is the primary's centre; its box takes in the secondary too.
    const primary = webb.getObjectByName('primary-mirror')?.position.z ?? 0;
    expect((secondary?.z ?? 0) - primary).toBeCloseTo(WEBB.secondaryDistance, 5);
  });

  it('Given the whole telescope, Then it is within its sunshield’s length and about 8 m tall', () => {
    const all = size(webb);
    expect(all.z).toBeCloseTo(WEBB.sunshieldLength, 1);
    expect(all.x).toBeCloseTo(WEBB.sunshieldWidth, 1);
    expect(all.y).toBeGreaterThan(7);
    expect(all.y).toBeLessThan(11);
  });
});
