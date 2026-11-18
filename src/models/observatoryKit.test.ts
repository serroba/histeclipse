import { Box3, Group, Mesh, Vector3, type BufferGeometry, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';

import { materials } from './kit';
import {
  altAz,
  cutawayDome,
  hexRings,
  monolith,
  poleward,
  segmented,
  trussTube,
} from './observatoryKit';

const box = (object: Object3D): Box3 => {
  object.updateMatrixWorld(true);
  return new Box3().setFromObject(object);
};

describe('the optical telescopes’ parts (#860)', () => {
  const kit = materials();

  it('Given a dome 42 m across and 41 m tall, Then it is so, cut away on the side first seen', () => {
    const dome = cutawayDome(42, 41, kit);
    const { min, max } = box(dome);
    expect(max.y).toBeCloseTo(41, 5);
    expect(max.x - min.x).toBeGreaterThan(30);
    // Cut away toward the camera's first place (+X, +Z): no part of it lies within 60° of there.
    const toward = Math.atan2(0.6, 1);
    dome.traverse((part) => {
      if (!(part instanceof Mesh)) return;
      const at = (part.geometry as BufferGeometry).getAttribute('position');
      for (let index = 0; index < at.count; index += 1) {
        const x = at.getX(index);
        const z = at.getZ(index);
        if (Math.hypot(x, z) < 1) continue;
        const off = Math.abs(
          Math.atan2(Math.sin(Math.atan2(x, z) - toward), Math.cos(Math.atan2(x, z) - toward)),
        );
        expect(off).toBeGreaterThan(Math.PI / 3);
      }
    });
    const flat = cutawayDome(40, 43, kit, false);
    expect(flat.children).toHaveLength(1);
    expect(box(flat).max.y).toBeCloseTo(43, 5);
  });

  it('Given rings 1 to 3 of hexagons, Then 36, as Keck’s mirror; rings 3 to 16, 798, as the ELT’s', () => {
    expect(hexRings(1, 3, 1.8)).toHaveLength(36);
    expect(hexRings(3, 16, 1.45)).toHaveLength(798);
    expect(hexRings(0, 0, 1)).toHaveLength(1);
  });

  it('Given Keck’s segments, Then the mirror is about 11 m across, curved up to its focus', () => {
    const mirror = segmented({ from: 1, to: 3 }, 1.8, 17.5, kit);
    expect(mirror.count).toBe(36);
    const { min, max } = box(mirror);
    expect(max.x - min.x).toBeGreaterThan(10);
    expect(max.x - min.x).toBeLessThan(11.5);
    expect(max.y).toBeGreaterThan(0.3);
  });

  it('Given a truss tube, Then it reaches its length, its mirror at its foot', () => {
    const tube = trussTube(monolith(5.1, 16.76, kit), 6.4, 17, kit);
    const { min, max } = box(tube);
    expect(min.y).toBeLessThan(0.1);
    expect(max.y).toBeGreaterThan(17);
    expect(max.y).toBeLessThan(17.5);
  });

  it('Given an alt-az fork at the zenith, Then the tube stands straight up from its axis', () => {
    const tube = new Mesh();
    const mount = altAz(
      new Group().add(tube),
      { axis: 10, span: 8, pivot: 2, elevationDeg: 90 },
      kit,
    );
    mount.updateMatrixWorld(true);
    expect(tube.getWorldPosition(new Vector3()).y).toBeCloseTo(8, 9);
    const low = altAz(new Group(), { axis: 10, span: 8, pivot: 2, elevationDeg: 30 }, kit);
    expect(low.children.at(-1)?.rotation.x).toBeCloseTo((-60 * Math.PI) / 180, 9);
  });

  it('Given a latitude, Then the pole is that high above the north', () => {
    const pole = poleward(33.4);
    expect(pole.length()).toBeCloseTo(1, 9);
    expect((Math.asin(pole.y) * 180) / Math.PI).toBeCloseTo(33.4, 9);
    expect(pole.z).toBeLessThan(0);
  });
});
