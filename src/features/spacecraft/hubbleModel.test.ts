import { Box3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { buildHubble, HUBBLE } from './hubbleModel';

const size = (object: Parameters<Box3['setFromObject']>[0]): Vector3 =>
  new Box3().setFromObject(object).getSize(new Vector3());

describe('Hubble as a 3D model (#797)', () => {
  const hubble = buildHubble();
  hubble.updateMatrixWorld(true);

  it('Given ESA/Hubble’s sizes, Then its body is 13.2 m long and 4.2 m across', () => {
    // Its own copy: the door is taken off to measure the body alone.
    const body = buildHubble().getObjectByName('body');
    const door = body?.getObjectByName('aperture-door');
    door?.removeFromParent();
    const { x, y, z } = size(body ?? hubble);
    expect(z).toBeCloseTo(HUBBLE.length, 1);
    expect(x).toBeCloseTo(HUBBLE.diameter, 1);
    expect(y).toBeCloseTo(HUBBLE.diameter, 1);
  });

  it('Given its arrays, Then there are two, each 2.45 m by 7.56 m, long side along the tube, square to the Sun', () => {
    const wings =
      hubble
        .getObjectByName('solar-arrays')
        ?.children.filter(({ name }) => name === 'solar-array') ?? [];
    expect(wings).toHaveLength(2);
    for (const wing of wings) {
      const { x, y, z } = size(wing);
      expect(x).toBeCloseTo(HUBBLE.arrayWidth, 2);
      expect(z).toBeCloseTo(HUBBLE.arrayLength, 2);
      // Thin along Y, which faces the Sun.
      expect(y).toBeLessThan(0.1);
    }
    // One out each side, clear of the tube.
    const sides = wings.map(({ position }) => Math.sign(position.x));
    expect(sides.sort()).toEqual([-1, 1]);
    expect(Math.abs(wings[0]?.position.x ?? 0) - HUBBLE.arrayWidth / 2).toBeGreaterThan(
      HUBBLE.tube / 2,
    );
  });

  it('Given its door open, Then it stands out in front of the aperture, and the mirror is inside the tube', () => {
    const door = new Box3().setFromObject(hubble.getObjectByName('aperture-door') ?? hubble);
    expect(door.min.z).toBeGreaterThan(HUBBLE.length / 2 - 0.2);
    expect(door.max.z).toBeGreaterThan(HUBBLE.length / 2 + HUBBLE.tube * 0.9);
    const mirror = hubble.getObjectByName('primary-mirror');
    const across = size(mirror ?? hubble);
    expect(across.x).toBeCloseTo(HUBBLE.mirror, 2);
  });

  it('Given its antennas, Then there are two, above and below the tube', () => {
    const dishes =
      hubble.getObjectByName('antennas')?.children.filter((part) => part.type === 'Mesh') ?? [];
    expect(dishes.length).toBe(4);
    const ys = new Box3().setFromObject(hubble.getObjectByName('antennas') ?? hubble);
    expect(ys.max.y).toBeGreaterThan(3);
    expect(ys.min.y).toBeLessThan(-3);
  });
});
