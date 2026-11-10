/**
 * The asteroid belt in the space view (#372): each asteroid a dot where it is, the larger ones
 * larger, all one dusty grey, the largest named, a tap on a name picked as `asteroid:<number>`.
 * A layer on the globe's host (#379): `globe.addLayer(asteroidBelt)`.
 */

import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Points,
  PointsMaterial,
  type Scene,
  Vector3,
} from 'three';
import { createNameLabels, type LayerFactory, type Triple } from './layerHost';

/** The asteroids named, those at least this wide, km: 27 of them, Ceres to Fortuna. */
const NAMED_FROM_KM = 200;

/** An asteroid of the belt as the globe is given it: where it is from Earth, J2000 km. */
export interface SceneAsteroid {
  readonly number: string;
  readonly name: string;
  readonly km: Triple;
  readonly diameterKm: number;
}

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

/** The belt on the globe: null takes it away, as does a globe with no moment yet. */
export const asteroidBelt: LayerFactory<readonly SceneAsteroid[] | null> = (host) => {
  const dots = createAsteroidLayer(host.scene);
  const names = createNameLabels(host, {
    className: 'asteroid-names',
    labelClass: 'asteroid-name',
    testId: 'asteroid-names',
  });
  return {
    update(asteroids) {
      const toScene = host.spaceToScene();
      if (asteroids === null || toScene === null) {
        dots.set(null);
        names.show(null);
        delete host.container.dataset['asteroids'];
        host.requestRender();
        return;
      }
      const placed = asteroids.map((asteroid) => ({ ...asteroid, at: toScene(asteroid.km) }));
      dots.set(placed);
      // Two hundred names would crowd the belt; the dots are there for the rest.
      names.show(
        placed
          .filter(({ diameterKm }) => diameterKm >= NAMED_FROM_KM)
          .map(({ number, name, at }) => ({
            key: number,
            name,
            pick: `asteroid:${number}`,
            scene: new Vector3(...at),
          })),
      );
      host.container.dataset['asteroids'] = String(asteroids.length);
      host.requestRender();
    },
  };
};
