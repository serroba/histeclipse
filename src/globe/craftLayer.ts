/**
 * The craft beyond Earth orbit in the space view (#350): each a dot where it is, and a trail
 * fading back along where it had just been. Cyan for a path as flown (JPL Horizons), amber for
 * an approximate one, each named, a tap on a name picked as `craft:<id>`. A layer on the globe's
 * host (#379): `globe.addLayer(craftInFlight)`.
 */

import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Points,
  PointsMaterial,
  type Scene,
  Vector3,
} from 'three';
import { createNameLabels, type LayerFactory, type Triple } from './layerHost';

/** A craft beyond Earth orbit as the globe is given it: from Earth's centre (J2000 km), its trail. */
export interface SceneCraft {
  readonly id: string;
  readonly name: string;
  readonly km: Triple;
  readonly trail: readonly Triple[];
  readonly approximate: boolean;
  /** At a world, rather than on its way: named after those on their way. */
  readonly at: string | null;
}

/** A craft as the layer draws it: scene positions, now and back along its trail. */
export interface CraftDrawn {
  readonly at: readonly [number, number, number];
  readonly trail: readonly (readonly [number, number, number])[];
  readonly approximate: boolean;
}

const MOST_CRAFT = 512;
const MOST_TRAIL = 32;
const FLOWN = [0.5, 0.85, 1] as const;
const APPROXIMATE = [1, 0.7, 0.28] as const;

export interface CraftLayer {
  /** Draw these craft; null hides them all. */
  set(craft: readonly CraftDrawn[] | null): void;
}

export function createCraftLayer(scene: Scene): CraftLayer {
  const group = new Group();
  group.visible = false;
  scene.add(group);

  const dotPositions = new Float32BufferAttribute(new Float32Array(MOST_CRAFT * 3), 3);
  const dotColours = new Float32BufferAttribute(new Float32Array(MOST_CRAFT * 3), 3);
  const dots = new BufferGeometry();
  dots.setAttribute('position', dotPositions);
  dots.setAttribute('color', dotColours);
  group.add(
    new Points(
      dots,
      new PointsMaterial({
        size: 5,
        sizeAttenuation: false,
        vertexColors: true,
        depthWrite: false,
      }),
    ),
  );

  const segments = MOST_CRAFT * MOST_TRAIL;
  const trailPositions = new Float32BufferAttribute(new Float32Array(segments * 2 * 3), 3);
  const trailColours = new Float32BufferAttribute(new Float32Array(segments * 2 * 4), 4);
  const trails = new BufferGeometry();
  trails.setAttribute('position', trailPositions);
  trails.setAttribute('color', trailColours);
  group.add(
    new LineSegments(
      trails,
      new LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }),
    ),
  );

  return {
    set(craft) {
      group.visible = craft !== null;
      if (craft === null) return;
      const shown = craft.slice(0, MOST_CRAFT);
      let vertex = 0;
      shown.forEach(({ at, trail, approximate }, index) => {
        const [r, g, b] = approximate ? APPROXIMATE : FLOWN;
        dotPositions.setXYZ(index, at[0], at[1], at[2]);
        dotColours.setXYZ(index, r, g, b);
        // From the craft back along its trail, each segment fainter than the last.
        const points = [at, ...trail.slice(0, MOST_TRAIL)];
        for (let k = 0; k + 1 < points.length; k += 1) {
          const from = points[k] ?? at;
          const to = points[k + 1] ?? at;
          const near = 0.8 * (1 - k / points.length);
          const far = 0.8 * (1 - (k + 1) / points.length);
          trailPositions.setXYZ(vertex, from[0], from[1], from[2]);
          trailColours.setXYZW(vertex, r, g, b, near);
          trailPositions.setXYZ(vertex + 1, to[0], to[1], to[2]);
          trailColours.setXYZW(vertex + 1, r, g, b, far);
          vertex += 2;
        }
      });
      dots.setDrawRange(0, shown.length);
      trails.setDrawRange(0, vertex);
      for (const attribute of [dotPositions, dotColours, trailPositions, trailColours]) {
        attribute.needsUpdate = true;
      }
      dots.computeBoundingSphere();
      trails.computeBoundingSphere();
    },
  };
}

/** The craft on the globe: null takes them away, as does a globe with no moment yet. */
export const craftInFlight: LayerFactory<readonly SceneCraft[] | null> = (host) => {
  const drawn = createCraftLayer(host.scene);
  const names = createNameLabels(host, {
    className: 'craft-names',
    labelClass: 'craft-name',
    testId: 'craft-names',
  });
  return {
    update(craft) {
      const toScene = host.spaceToScene();
      if (craft === null || toScene === null) {
        drawn.set(null);
        names.show(null);
        delete host.container.dataset['craft'];
        host.requestRender();
        return;
      }
      drawn.set(
        craft.map(({ km, trail, approximate }) => ({
          at: toScene(km),
          trail: trail.map(toScene),
          approximate,
        })),
      );
      // Those on their way get room first; those at a world are named after them.
      const order = [...craft].sort((a, b) => Number(a.at !== null) - Number(b.at !== null));
      names.show(
        order.map(({ id, name, km }) => ({
          key: id,
          name,
          pick: `craft:${id}`,
          scene: new Vector3(...toScene(km)),
        })),
      );
      host.container.dataset['craft'] = String(craft.length);
      host.requestRender();
    },
  };
};
