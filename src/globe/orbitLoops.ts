/**
 * The planets' orbits, and Earth's (#379): drawn about the Sun in J2000 axes, turned with them.
 */

import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineLoop,
  type Scene,
} from 'three';

import { ORBITING, type Orbiting } from '../astro/planets';
import { sceneFromKm } from './spaceFrame';

const ORBIT_COLOURS: Readonly<Record<Orbiting, string>> = {
  mercury: '#b8b2a8',
  venus: '#e3c98f',
  earth: '#6fa8ff',
  mars: '#d9774b',
  jupiter: '#d8b48a',
  saturn: '#e6d29a',
};

export interface OrbitLoops {
  /** Placed at the Sun and turned to J2000 with the bodies. */
  readonly group: Group;
  /** Draw each orbit, a loop of heliocentric J2000 positions in km; null takes them away. */
  set(paths: Readonly<Record<Orbiting, readonly (readonly number[])[]>> | null): void;
}

/** The orbits, hidden until set, added to `scene`. */
export function createOrbitLoops(scene: Scene): OrbitLoops {
  const group = new Group();
  group.visible = false;
  scene.add(group);
  let loops: LineLoop<BufferGeometry, LineBasicMaterial>[] = [];
  return {
    group,
    set(paths) {
      for (const loop of loops) {
        group.remove(loop);
        loop.geometry.dispose();
        loop.material.dispose();
      }
      loops = [];
      group.visible = paths !== null;
      if (paths === null) return;
      for (const body of ORBITING) {
        const points = paths[body].flatMap(([x = 0, y = 0, z = 0]) => sceneFromKm([x, y, z]));
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
        const loop = new LineLoop(
          geometry,
          new LineBasicMaterial({
            color: ORBIT_COLOURS[body],
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
          }),
        );
        loops.push(loop);
        group.add(loop);
      }
    },
  };
}
