/**
 * The kilonova AT 2017gfo (#992), in three.js: what GW170817 flung out, as a cloud of points
 * about the merged remnant, seen from a little above the orbit's plane. As Kasen et al. (2017)
 * picture it, the fast "blue" ejecta (0.3c) stream out toward the poles and the slower, heavier
 * "red" ejecta (0.1c), where gold and platinum would be, lie about the orbit's plane. Each point
 * is placed by its speed: the cloud expands as its speeds say, keeping its shape, so it is drawn
 * at one size and the clock says how large it truly is. Each part glows as the model in
 * `kilonova.ts` says, against its own peak.
 *
 * Builds and moves objects only: the view draws them.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  SphereGeometry,
} from 'three';

import { seeded } from '../../story/seeded';
import { EJECTA, glowAt, type Ejecta } from './kilonova';

/** How far out, scene units, ejecta at the blue's speed are drawn. */
export const CLOUD = 1.2;
const POINTS: Readonly<Record<Ejecta['name'], number>> = { blue: 1400, red: 2200 };
/** The colours the two glow: hot blue-white, and deep red. */
const COLOURS: Readonly<Record<Ejecta['name'], number>> = { blue: 0x8fc4ff, red: 0xff5a36 };

/**
 * Where each point of a component starts, as its speed: the blue within 45° of either pole, the
 * red within 35° of the orbit's plane (y is the orbit's axis), each at a speed up to its own,
 * more of them slow than fast.
 */
export function ejectaPoints(part: Ejecta, count: number, random: () => number): Float32Array {
  const [fastest] = EJECTA;
  const values = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const around = 2 * Math.PI * random();
    const toward =
      part.name === 'blue'
        ? Math.acos(1 - random() * (1 - Math.cos(Math.PI / 4))) * (random() < 0.5 ? 1 : -1)
        : Math.PI / 2 + (random() * 2 - 1) * ((35 * Math.PI) / 180);
    const reach = (CLOUD * part.speed * Math.sqrt(random())) / fastest.speed;
    const pole = toward < 0 ? Math.PI + toward : toward;
    values[3 * index] = reach * Math.sin(pole) * Math.cos(around);
    values[3 * index + 1] = reach * Math.cos(pole);
    values[3 * index + 2] = reach * Math.sin(pole) * Math.sin(around);
  }
  return values;
}

export interface KilonovaScene {
  readonly group: Group;
  /** Make it glow as it did `days` after the merger. */
  set(days: number): void;
  dispose(): void;
}

export function createKilonovaScene(): KilonovaScene {
  const group = new Group();
  const owned: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(item: T): T => {
    owned.push(item);
    return item;
  };
  const random = seeded(170_817);
  const clouds = EJECTA.map((part) => {
    const geometry = own(new BufferGeometry());
    geometry.setAttribute(
      'position',
      new BufferAttribute(ejectaPoints(part, POINTS[part.name], random), 3),
    );
    const material = own(
      new PointsMaterial({
        color: new Color(COLOURS[part.name]),
        size: part.name === 'blue' ? 0.035 : 0.045,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    const cloud = new Points(geometry, material);
    cloud.name = `${part.name} ejecta`;
    group.add(cloud);
    return { name: part.name, material };
  });
  // What the merger left at the middle: most likely a black hole within a second, drawn small and
  // dark (`events.ts` gives the other reading).
  const middle = new Mesh(
    own(new SphereGeometry(0.03, 16, 12)),
    own(new MeshBasicMaterial({ color: 0x000000 })),
  );
  middle.name = 'remnant';
  group.add(middle);
  return {
    group,
    set(days) {
      const glow = glowAt(days);
      for (const { name, material } of clouds) {
        material.opacity = 0.08 + 0.92 * Math.sqrt(name === 'blue' ? glow.blue : glow.red);
      }
    },
    dispose() {
      for (const item of owned) item.dispose();
    },
  };
}
