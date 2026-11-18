import { Mesh, type MeshBasicMaterial, Texture, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { HANFORD, journeyAt, JOURNEY_MS, LIVINGSTON } from './journey';
import { createJourneyScene, toScene } from './journeyScene';

describe('the journey, drawn (#833)', () => {
  it('turns Earth-fixed places as three’s sphere lays a world map', () => {
    expect(toScene([1, 0, 0])).toEqual(new Vector3(1, 0, -0));
    // 90° W, where three's sphere puts a quarter of the way across the map.
    expect(toScene([0, -1, 0])).toEqual(new Vector3(0, 0, 1));
    expect(toScene([0, 0, 1])).toEqual(new Vector3(0, 1, -0));
  });

  it('marks the detectors on the surface, and lights each as the front passes', () => {
    const scene = createJourneyScene();
    const marks = scene.group.children
      .filter((child): child is Mesh => child instanceof Mesh)
      .filter((mesh) => mesh.position.length() > 1);
    expect(marks).toHaveLength(2);
    expect(marks[0]?.position.clone().normalize().distanceTo(toScene(LIVINGSTON))).toBeLessThan(
      1e-9,
    );
    expect(marks[1]?.position.clone().normalize().distanceTo(toScene(HANFORD))).toBeLessThan(1e-9);
    const brightness = (): number[] =>
      marks.map((mark) => (mark.material as MeshBasicMaterial).color.r);
    scene.set(journeyAt(0, 0.41));
    const dark = brightness();
    scene.set(journeyAt(JOURNEY_MS.travel + JOURNEY_MS.arrive, 0.41));
    const lit = brightness();
    expect(lit[0]).toBeGreaterThan(dark[0] ?? 1);
    expect(lit[1]).toBeGreaterThan(dark[1] ?? 1);
    scene.dressEarth(new Texture());
    scene.dispose();
  });

  it('brings the front in along the wave’s heading, across Earth', () => {
    const scene = createJourneyScene();
    const front = scene.group.children.at(-1);
    scene.set(journeyAt(0, 0.41));
    const far = front?.position.clone() ?? new Vector3();
    expect(far.dot(scene.heading)).toBeLessThan(-5);
    scene.set(journeyAt(JOURNEY_MS.travel + JOURNEY_MS.arrive, 0.41));
    expect(front?.position.dot(scene.heading)).toBeGreaterThan(1);
    scene.dispose();
  });
});
