/**
 * The journey, drawn (#833): Earth, a unit across its radius, turned as it is Earth-fixed (the
 * map's 0° longitude toward +x, the north pole up), with Livingston and Hanford marked; and the
 * wave's front, a plane of rings across its path, coming in and sweeping over it. Each detector
 * lights as the front passes it.
 *
 * Builds and moves objects only: the view draws them.
 */

import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  RingGeometry,
  SphereGeometry,
  type Texture,
  Vector3,
} from 'three';

import { arrivalDirection, HANFORD, type JourneyMoment, LIVINGSTON, reached } from './journey';
import type { Triple } from './strain';

/** Earth-fixed (z to the pole) into the scene's axes (y up), as three's sphere maps a world map:
 * 0° longitude to +x, 90° W to +z. */
export function toScene([x, y, z]: Triple): Vector3 {
  return new Vector3(x, z, -y);
}

/** The colours the plot gives the two: Livingston blue, Hanford red. */
const MARKS = { L1: 0x5ab0ff, H1: 0xff6b5a } as const;
const RINGS = 6;

export interface JourneyScene {
  readonly group: Group;
  /** The way the wave goes, in the scene's axes. */
  readonly heading: Vector3;
  /** Midway between the two detectors, in the scene's axes. */
  readonly detectors: Vector3;
  set(moment: JourneyMoment): void;
  /** Dress Earth in its map, once it has loaded. */
  dressEarth(map: Texture): void;
  dispose(): void;
}

export function createJourneyScene(): JourneyScene {
  const owned: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(item: T): T => {
    owned.push(item);
    return item;
  };
  const group = new Group();
  const k = arrivalDirection();
  const heading = toScene(k).normalize();
  const earthMaterial = own(new MeshStandardMaterial({ color: 0x2c5a8a, roughness: 0.9 }));
  const earth = new Mesh(own(new SphereGeometry(1, 64, 40)), earthMaterial);
  group.add(earth);

  const marks = (['L1', 'H1'] as const).map((detector) => {
    const material = own(
      new MeshBasicMaterial({ color: new Color(MARKS[detector]).multiplyScalar(0.35) }),
    );
    const mark = new Mesh(own(new SphereGeometry(0.035, 16, 10)), material);
    mark.position.copy(toScene(detector === 'L1' ? LIVINGSTON : HANFORD).multiplyScalar(1.01));
    group.add(mark);
    return { detector, material, place: detector === 'L1' ? LIVINGSTON : HANFORD };
  });

  // The front: rings in a plane across the wave's path, faint, brighter toward the middle.
  const front = new Group();
  for (let ring = 0; ring < RINGS; ring += 1) {
    const inner = 0.4 + ring * 0.55;
    const material = own(
      new MeshBasicMaterial({
        color: 0xffc861,
        transparent: true,
        opacity: 0.32 - ring * 0.045,
        side: DoubleSide,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    front.add(new Mesh(own(new RingGeometry(inner, inner + 0.08, 96)), material));
  }
  // The rings lie in the plane across `heading`: their own z turned onto it.
  front.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), heading));
  group.add(front);

  return {
    group,
    heading,
    detectors: toScene(LIVINGSTON).add(toScene(HANFORD)).normalize(),
    set(moment) {
      front.position.copy(heading).multiplyScalar(moment.front);
      for (const { detector, material, place } of marks) {
        const lit = reached(moment, place, k);
        material.color.set(MARKS[detector]).multiplyScalar(lit ? 1.6 : 0.35);
      }
    },
    dressEarth(map) {
      earthMaterial.map = map;
      earthMaterial.color.set(0xffffff);
      earthMaterial.needsUpdate = true;
      owned.push(map);
    },
    dispose() {
      for (const item of owned) item.dispose();
    },
  };
}
