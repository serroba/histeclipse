import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { FIRST_COLLISION_KM } from './airCascade';
import {
  AIR_MS,
  CAPTURE_MS,
  captureBeat,
  captureCamera,
  fieldLine,
  firstNamed,
  flashAt,
  kindsNamed,
  nucleusWords,
  rayBeat,
  RAYS_MS,
  raysCamera,
  showerBeat,
  showerCamera,
  starField,
  tremble,
} from './airTimeline';

describe('the scene’s fixed shapes', () => {
  it('spreads the stars over a sphere of the radius asked, the same every time', () => {
    const stars = starField(1400, 80);
    expect(stars).toHaveLength(1400 * 3);
    for (let i = 0; i < stars.length; i += 3) {
      expect(Math.hypot(stars[i] ?? 0, stars[i + 1] ?? 0, stars[i + 2] ?? 0)).toBeCloseTo(80);
    }
    expect(starField(1400, 80)).toEqual(stars);
  });

  it('draws a field line from the surface out to its shell at the equator and back', () => {
    const points = fieldLine(new Vector3(1, 0, 0), 2.6);
    expect(points).toHaveLength(65);
    expect(points[0]?.length()).toBeCloseTo(1);
    expect(points[64]?.length()).toBeCloseTo(1);
    expect(points[32]?.x).toBeCloseTo(2.6);
    expect(points[32]?.y).toBeCloseTo(0);
    // South first, north last: symmetric about the equator.
    expect(points[0]?.y).toBeCloseTo(-(points[64]?.y ?? 0));
  });
});

describe('the rays', () => {
  it('come in over 2.8 s, the second a little after the first', () => {
    expect(rayBeat(0, 0, 48)).toEqual({ progress: 0, index: 0, bursting: 0 });
    expect(rayBeat(1400, 0, 48).progress).toBeCloseTo(0.5);
    expect(rayBeat(1400, 0, 48).index).toBe(24);
    expect(rayBeat(1400, 350, 48).progress).toBeCloseTo(0.375);
    expect(rayBeat(2800, 0, 48)).toMatchObject({ progress: 1, index: 47, bursting: 0 });
  });

  it('flash as they strike, fading over 0.7 s', () => {
    expect(rayBeat(3150, 0, 48).bursting).toBeCloseTo(0.5);
    expect(rayBeat(RAYS_MS, 0, 48).bursting).toBe(1);
  });
});

describe('the shower', () => {
  it('brings the proton in, the front behind its first collision until it gets there', () => {
    expect(showerBeat(0, 13, 40)).toMatchObject({ entering: 0, front: -13, descent: 0 });
    expect(showerBeat(450, 13, 40).front).toBeCloseTo(-6.5);
    expect(showerBeat(900, 13, 40)).toMatchObject({ entering: 1, front: 0 });
  });

  it('sends the front down the cascade, no lower than the ground, then slows the neutron', () => {
    const half = showerBeat(900 + 1700, 13, 40);
    expect(half.front).toBeCloseTo(20);
    expect(half.descent).toBeCloseTo(Math.min(FIRST_COLLISION_KM, 20));
    expect(half.slowing).toBe(0);
    const end = showerBeat(AIR_MS, 13, 40);
    expect(end.front).toBe(40);
    expect(end.descent).toBe(FIRST_COLLISION_KM);
    expect(end.slowing).toBe(1);
  });

  it('names the first collision and the particles for a while, then lets them go', () => {
    expect(firstNamed(-1, 500)).toBe(false);
    expect(firstNamed(0, 1000)).toBe(true);
    expect(firstNamed(10, 900 + 3400 * 0.45)).toBe(false);
    expect(kindsNamed(4500)).toBe(true);
    expect(kindsNamed(AIR_MS)).toBe(false);
  });

  it('flashes each collision as the front passes, growing as it fades', () => {
    expect(flashAt(-0.1).visible).toBe(false);
    expect(flashAt(0)).toEqual({ visible: true, scale: 0.6, opacity: 1 });
    const half = flashAt(1.25);
    expect(half.visible).toBe(true);
    expect(half.scale).toBeCloseTo(1.8);
    expect(half.opacity).toBeCloseTo(0.5);
    expect(flashAt(2.5).visible).toBe(false);
  });
});

describe('the capture', () => {
  it('goes from nitrogen to the compound nucleus to carbon', () => {
    expect(captureBeat(0).stage).toBe('nitrogen');
    expect(captureBeat(2000).stage).toBe('compound');
    expect(captureBeat(CAPTURE_MS).stage).toBe('carbon');
  });

  it('brings the neutron in, bursts as it enters, then sends the proton off', () => {
    expect(captureBeat(0)).toMatchObject({ arriving: 0, flying: 0, flash: 0, carbon: 0 });
    expect(captureBeat(1800)).toMatchObject({ arriving: 1, flying: 0, flash: 0 });
    expect(captureBeat(2100).flash).toBeCloseTo(0.5);
    expect(captureBeat(2500 + 700).flying).toBeCloseTo(1 - 0.5 ** 3);
    expect(captureBeat(CAPTURE_MS)).toMatchObject({ flying: 1, flash: 1, carbon: 1 });
  });

  it('trembles each nucleon, more for an instant once the neutron is in', () => {
    const calm = tremble(500, 3, 'nitrogen').length();
    const shaken = tremble(500, 3, 'compound').length();
    expect(shaken / calm).toBeCloseTo(0.24 / 0.06);
    expect(calm).toBeLessThanOrEqual(0.06 * Math.sqrt(3));
  });

  it('names the nucleus at each stage', () => {
    expect(nucleusWords('nitrogen')).toBe('nitrogen-14: 7 protons, 7 neutrons');
    expect(nucleusWords('compound')).toBe('nitrogen-15, for an instant: 7 protons, 8 neutrons');
    expect(nucleusWords('carbon')).toBe('carbon-14: 6 protons, 8 neutrons');
  });
});

describe('the cameras', () => {
  it('turn and come in on the rays, further out on a narrow screen', () => {
    expect(raysCamera(0, 1)).toEqual({ turn: 0.25, distance: 6.2 });
    expect(raysCamera(RAYS_MS, 1).turn).toBeCloseTo(-0.15);
    expect(raysCamera(RAYS_MS, 1).distance).toBeCloseTo(4.8);
    expect(raysCamera(0, 2).distance).toBeGreaterThan(6.2);
  });

  it('swing down into the shower, and come in on the capture, then after the proton', () => {
    expect(showerCamera(0)).toBe(0);
    expect(showerCamera(2200)).toBe(1);
    expect(captureCamera(0, 1)).toEqual({ inward: 0, after: 0 });
    expect(captureCamera(CAPTURE_MS, 1)).toEqual({ inward: 1, after: 1 });
    // Less after the proton on a narrow screen, where the nucleus would go off its edge.
    expect(captureCamera(CAPTURE_MS, 0.5).after).toBe(0.5);
  });
});
