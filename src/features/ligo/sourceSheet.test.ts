import { ShaderMaterial } from 'three';
import { describe, expect, it } from 'vitest';

import { BINS, createSourceSheet, MASSES, placesOf, REACH, sheetSegments } from './sourceSheet';
import { chirp, GW150914_STAND_IN } from './strain';

describe('the source of GW150914, as drawn (#832)', () => {
  it('lays its sheet flat, out to its reach', () => {
    const segments = sheetSegments();
    let farthest = 0;
    for (let index = 0; index < segments.length; index += 3) {
      expect(segments[index + 1]).toBe(0);
      farthest = Math.max(farthest, Math.hypot(segments[index] ?? 0, segments[index + 2] ?? 0));
    }
    expect(farthest).toBeCloseTo(REACH, 5);
  });

  it('keeps the heavier black hole nearer the centre of mass, the two opposite', () => {
    const { first, second } = placesOf(0.3, 1);
    expect(Math.hypot(...first) * MASSES.first).toBeCloseTo(
      Math.hypot(...second) * MASSES.second,
      9,
    );
    expect(Math.hypot(first[0] - second[0], first[1] - second[1])).toBeCloseTo(1, 9);
  });

  it('gives the shader the wave as it left, and shows two black holes, then one', () => {
    const sheet = createSourceSheet();
    const wave = chirp(GW150914_STAND_IN);
    sheet.set(wave, -0.05);
    const shader = sheet.group.children
      .map((child) => ('material' in child ? child.material : null))
      .find((material): material is ShaderMaterial => material instanceof ShaderMaterial);
    const table = shader?.uniforms['table']?.value as Float32Array;
    expect(table).toHaveLength(BINS * 2);
    expect(Math.max(...table.map(Math.abs))).toBeGreaterThan(0.05);
    const holes = sheet.group.children.slice(1);
    expect(holes.map((hole) => hole.visible)).toEqual([true, true, false]);
    const [first, second] = holes;
    expect(first?.position.length()).toBeGreaterThan(0);
    expect(first?.position.length()).toBeLessThan(second?.position.length() ?? 0);
    sheet.set(wave, 0.01);
    expect(holes.map((hole) => hole.visible)).toEqual([false, false, true]);
    sheet.dispose();
  });
});
