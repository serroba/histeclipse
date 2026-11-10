/**
 * The asteroid belt in the space view (#372): each asteroid a dot where it is, the larger ones
 * larger, all one dusty grey. Positions come in scene units; `scene.ts` places them.
 */

import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Points,
  PointsMaterial,
  type Scene,
} from 'three';

/** Dot sizes, pixels, for asteroids at least as wide as each diameter (km): Ceres the largest. */
const SIZES: readonly (readonly [number, number])[] = [
  [800, 7],
  [400, 5],
  [200, 3.5],
  [0, 2.5],
];
const MOST = 1024;
const COLOUR = 0xb8ac98;

/** An asteroid as the layer draws it: where it is, in scene units, and how wide it is, km. */
export interface AsteroidDrawn {
  readonly at: readonly [number, number, number];
  readonly diameterKm: number;
}

export interface AsteroidLayer {
  /** Draw these asteroids; null hides them all. */
  set(asteroids: readonly AsteroidDrawn[] | null): void;
}

/** The size class an asteroid's dot is drawn in: its index in SIZES. */
function sizeClass(diameterKm: number): number {
  const index = SIZES.findIndex(([least]) => diameterKm >= least);
  return index === -1 ? SIZES.length - 1 : index;
}

export function createAsteroidLayer(scene: Scene): AsteroidLayer {
  const group = new Group();
  group.visible = false;
  scene.add(group);
  const classes = SIZES.map(([, size]) => {
    const positions = new Float32BufferAttribute(new Float32Array(MOST * 3), 3);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', positions);
    group.add(
      new Points(
        geometry,
        new PointsMaterial({ size, sizeAttenuation: false, color: COLOUR, depthWrite: false }),
      ),
    );
    return { positions, geometry };
  });

  return {
    set(asteroids) {
      group.visible = asteroids !== null;
      if (asteroids === null) return;
      const counts = classes.map(() => 0);
      for (const { at, diameterKm } of asteroids.slice(0, MOST)) {
        const index = sizeClass(diameterKm);
        const drawn = classes[index];
        const count = counts[index];
        if (drawn === undefined || count === undefined) continue;
        drawn.positions.setXYZ(count, at[0], at[1], at[2]);
        counts[index] = count + 1;
      }
      classes.forEach(({ positions, geometry }, index) => {
        geometry.setDrawRange(0, counts[index] ?? 0);
        positions.needsUpdate = true;
        geometry.computeBoundingSphere();
      });
    },
  };
}
