/**
 * The craft beyond Earth orbit in the space view (#350): each a dot where it is, and a trail
 * fading back along where it had just been. Cyan for a path as flown (JPL Horizons), amber for
 * an approximate one. Positions come in scene units; `scene.ts` places them.
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
} from 'three';

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
