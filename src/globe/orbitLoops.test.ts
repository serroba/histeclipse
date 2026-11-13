import { Scene, type LineLoop } from 'three';
import { describe, expect, it } from 'vitest';

import { ORBITING, type Orbiting } from '../astro/planets';
import { createOrbitLoops } from './orbitLoops';

const square = [
  [1, 0, 0],
  [0, 1, 0],
  [-1, 0, 0],
  [0, -1, 0],
];

describe("the planets' orbits", () => {
  it('starts hidden, draws a loop for each, and takes them away', () => {
    const scene = new Scene();
    const orbits = createOrbitLoops(scene);
    expect(scene.children).toContain(orbits.group);
    expect(orbits.group.visible).toBe(false);
    const paths = Object.fromEntries(ORBITING.map((body) => [body, square])) as Record<
      Orbiting,
      number[][]
    >;
    orbits.set(paths);
    expect(orbits.group.visible).toBe(true);
    expect(orbits.group.children).toHaveLength(ORBITING.length);
    const first = orbits.group.children[0] as LineLoop;
    expect(first.geometry.getAttribute('position').count).toBe(4);
    orbits.set(paths);
    expect(orbits.group.children).toHaveLength(ORBITING.length);
    orbits.set(null);
    expect(orbits.group.visible).toBe(false);
    expect(orbits.group.children).toHaveLength(0);
  });
});
