import {
  type DataTexture,
  Mesh,
  type MeshBasicMaterial,
  ShaderMaterial,
  Texture,
  Vector3,
} from 'three';
import { describe, expect, it } from 'vitest';

import { HANFORD, journeyAt, JOURNEY_MS, LIVINGSTON } from './journey';
import { createJourneyScene, PATH, sheetSegments, toScene } from './journeyScene';
import { chirp, GW150914_STAND_IN } from './strain';

const wave = chirp(GW150914_STAND_IN);

describe('the journey, drawn (#833, #841)', () => {
  it('turns Earth-fixed places as three’s sphere lays a world map', () => {
    expect(toScene([1, 0, 0])).toEqual(new Vector3(1, 0, -0));
    expect(toScene([0, -1, 0])).toEqual(new Vector3(0, 0, 1));
    expect(toScene([0, 0, 1])).toEqual(new Vector3(0, 1, -0));
  });

  it('lays the sheet of space through Earth’s middle, holding the wave’s path', () => {
    const along = new Vector3(1, 0, 0);
    const across = new Vector3(0, 1, 0);
    const segments = sheetSegments(along, across);
    expect(segments.length % 6).toBe(0);
    for (let index = 2; index < segments.length; index += 3)
      expect(Math.abs(segments[index] ?? 1)).toBe(0);
    expect(Math.max(...segments)).toBeCloseTo(2.8, 6);
  });

  it('gives the shaders the wave along its path, stretched, and moves and lights the detectors', () => {
    const scene = createJourneyScene();
    scene.set(wave, journeyAt(0, 0.41));
    const marks = scene.group.children
      .filter((child): child is Mesh => child instanceof Mesh)
      .filter((mesh) => mesh.position.length() > 0.5);
    expect(marks).toHaveLength(2);
    const brightness = (): number[] =>
      marks.map((mark) => (mark.material as MeshBasicMaterial).color.r);
    const dark = brightness();
    expect(marks[0]?.position.clone().normalize().distanceTo(toScene(LIVINGSTON))).toBeLessThan(
      1e-6,
    );
    // At the merger, Livingston's mark is moved by the wave, and lit.
    scene.set(wave, journeyAt(JOURNEY_MS.travel + 11_000, 0.41));
    expect(marks[0]?.position.length()).not.toBeCloseTo(1.01, 3);
    scene.set(wave, journeyAt(JOURNEY_MS.travel + JOURNEY_MS.arrive, 0.41));
    const lit = brightness();
    expect(lit[0]).toBeGreaterThan(dark[0] ?? 1);
    expect(lit[1]).toBeGreaterThan(dark[1] ?? 1);
    expect(marks[1]?.position.clone().normalize().distanceTo(toScene(HANFORD))).toBeLessThan(0.3);

    const lattice = scene.group.children.find(
      (child) => 'material' in child && child.material instanceof ShaderMaterial,
    ) as { material: ShaderMaterial } | undefined;
    const path = lattice?.material.uniforms['path']?.value as DataTexture;
    expect(path.image.width).toBe(PATH.bins);
    const values = path.image.data as Float32Array;
    expect(Math.max(...values.map(Math.abs))).toBeGreaterThan(0.05);
    scene.dressEarth(new Texture());
    scene.dispose();
  });
});
