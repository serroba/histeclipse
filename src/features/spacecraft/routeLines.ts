/**
 * The whole route of a mission followed (#712): a faint line along each craft's path, from
 * leaving Earth to its last moment, broken where its path does not place it. Cyan where the
 * path is as flown (JPL Horizons), amber where it is approximate, as the craft's dots are. A
 * layer on the globe's host (#379): `globe.addLayer(missionRoutes)`.
 */

import { BufferGeometry, Float32BufferAttribute, LineBasicMaterial, LineSegments } from 'three';

import type { LayerFactory, Triple } from '../../globe/layerHost';

type Point = readonly [number, number, number];

/** A route as the scene has it: its points, in scene units, oldest first. */
interface SceneRoute {
  readonly points: readonly (Point | null)[];
  readonly approximate: boolean;
}

/** Most segments drawn: a few craft, each a few hundred points. */
const MOST_SEGMENTS = 4096;
const FLOWN = [0.5, 0.85, 1] as const;
const APPROXIMATE = [1, 0.7, 0.28] as const;
const FAINT = 0.6;

export interface RouteLines {
  readonly object: LineSegments;
  /** How many segments are drawn. */
  readonly segments: () => number;
  /** Draw these routes; null or none hides them. */
  set(routes: readonly SceneRoute[] | null): void;
}

export function createRouteLines(): RouteLines {
  const positions = new Float32BufferAttribute(new Float32Array(MOST_SEGMENTS * 2 * 3), 3);
  const colours = new Float32BufferAttribute(new Float32Array(MOST_SEGMENTS * 2 * 4), 4);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', positions);
  geometry.setAttribute('color', colours);
  const object = new LineSegments(
    geometry,
    new LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }),
  );
  object.visible = false;
  let drawn = 0;

  return {
    object,
    segments: () => drawn,
    set(routes) {
      drawn = 0;
      for (const { points, approximate } of routes ?? []) {
        const [r, g, b] = approximate ? APPROXIMATE : FLOWN;
        for (let k = 0; k + 1 < points.length && drawn < MOST_SEGMENTS; k += 1) {
          const from = points[k];
          const to = points[k + 1];
          if (from === null || from === undefined || to === null || to === undefined) continue;
          positions.setXYZ(2 * drawn, from[0], from[1], from[2]);
          positions.setXYZ(2 * drawn + 1, to[0], to[1], to[2]);
          colours.setXYZW(2 * drawn, r, g, b, FAINT);
          colours.setXYZW(2 * drawn + 1, r, g, b, FAINT);
          drawn += 1;
        }
      }
      object.visible = drawn > 0;
      geometry.setDrawRange(0, drawn * 2);
      positions.needsUpdate = true;
      colours.needsUpdate = true;
      if (drawn > 0) geometry.computeBoundingSphere();
    },
  };
}

/** A route as it is given: from Earth's centre, J2000 km. */
export interface RouteInSpace {
  readonly points: readonly (Triple | null)[];
  readonly approximate: boolean;
}

/** The routes of a mission followed; null takes them away, as does a globe with no moment yet. */
export const missionRoutes: LayerFactory<readonly RouteInSpace[] | null> = (host) => {
  const lines = createRouteLines();
  host.scene.add(lines.object);
  return {
    update(routes) {
      const toScene = host.spaceToScene();
      lines.set(
        routes === null || toScene === null
          ? null
          : routes.map(({ points, approximate }) => ({
              approximate,
              points: points.map((point) => (point === null ? null : toScene(point))),
            })),
      );
      host.container.dataset['routes'] = String(lines.segments());
      host.requestRender();
    },
  };
};
