import { ShaderMaterial } from 'three';
import { describe, expect, it } from 'vitest';

import { WAVE_EVENTS } from './events';
import {
  BINS,
  createSourceSheet,
  placesOf,
  REACH,
  sheetSegments,
  tidalStretch,
} from './sourceSheet';
import { chirp, GW150914_STAND_IN, GW170817_MODEL } from './strain';

const BLACK_HOLES = WAVE_EVENTS.gw150914.bodies;
const NEUTRON_STARS = WAVE_EVENTS.gw170817.bodies;

describe('the source of a gravitational wave, as drawn (#832, #991)', () => {
  it('lays its sheet flat, out to its reach', () => {
    const segments = sheetSegments();
    let farthest = 0;
    for (let index = 0; index < segments.length; index += 3) {
      expect(segments[index + 1]).toBe(0);
      farthest = Math.max(farthest, Math.hypot(segments[index] ?? 0, segments[index + 2] ?? 0));
    }
    expect(farthest).toBeCloseTo(REACH, 5);
  });

  it('keeps the heavier body nearer the centre of mass, the two opposite', () => {
    for (const { masses } of [BLACK_HOLES, NEUTRON_STARS]) {
      const { first, second } = placesOf(masses, 0.3, 1);
      expect(Math.hypot(...first) * masses.first).toBeCloseTo(
        Math.hypot(...second) * masses.second,
        9,
      );
      expect(Math.hypot(first[0] - second[0], first[1] - second[1])).toBeCloseTo(1, 9);
    }
  });

  it('gives the shader the wave as it left, and shows two black holes, then one', () => {
    const sheet = createSourceSheet(BLACK_HOLES);
    const wave = chirp(GW150914_STAND_IN);
    sheet.set(wave, -0.05);
    const shader = sheet.group.children
      .map((child) => ('material' in child ? child.material : null))
      .find((material): material is ShaderMaterial => material instanceof ShaderMaterial);
    const table = shader?.uniforms['table']?.value as Float32Array;
    expect(table).toHaveLength(BINS * 2);
    expect(Math.max(...table.map(Math.abs))).toBeGreaterThan(0.05);
    const holes = sheet.group.children.slice(1);
    expect(holes.map((hole) => hole.name)).toEqual(['black hole', 'black hole', 'black hole']);
    expect(holes.map((hole) => hole.visible)).toEqual([true, true, false]);
    const [first, second] = holes;
    expect(first?.position.length()).toBeGreaterThan(0);
    expect(first?.position.length()).toBeLessThan(second?.position.length() ?? 0);
    sheet.set(wave, 0.01);
    expect(holes.map((hole) => hole.visible)).toEqual([false, false, true]);
    sheet.dispose();
  });

  it('draws GW170817’s as two glowing neutron stars that close in to touching, then one hot body', () => {
    const sheet = createSourceSheet(NEUTRON_STARS);
    const wave = chirp(GW170817_MODEL);
    const stars = sheet.group.children.slice(1);
    expect(stars.map((star) => star.name)).toEqual([
      'neutron star',
      'neutron star',
      'merged remnant',
    ]);
    // Glowing, unlike the black holes: a body and its two halos.
    expect(stars[0]?.children).toHaveLength(3);
    const [first, second, final] = stars;
    if (first === undefined || second === undefined || final === undefined) throw new Error('3');
    const gap = (): number => first.position.distanceTo(second.position);
    sheet.set(wave, wave.start);
    const early = gap();
    const earlySize = first.scale.y;
    sheet.set(wave, -0.0002);
    // Closed in by Kepler's law, to about touching.
    expect(gap()).toBeLessThan(early * 0.4);
    expect(gap()).toBeLessThan(2.4 * earlySize);
    // Pulled out of round toward each other: longer along the line between them.
    expect(first.scale.x).toBeGreaterThan(first.scale.y);
    expect(first.scale.x).toBeGreaterThan(earlySize);
    sheet.set(wave, 0.001);
    expect(stars.map((star) => star.visible)).toEqual([false, false, true]);
    expect(final.scale.x).toBeGreaterThan(earlySize);
    sheet.dispose();
  });

  it('stretches a neutron star more the nearer the other, as the tide, (R/a)³, at most a third more', () => {
    expect(tidalStretch(0.1, 1)).toBeCloseTo(1 + 1.5e-3, 9);
    expect(tidalStretch(0.1, 0.5)).toBeCloseTo(1 + 1.5 * 0.008, 9);
    expect(tidalStretch(0.5, 0.5)).toBe(1.35);
    expect(tidalStretch(0.1, 0)).toBe(1.35);
  });
});
