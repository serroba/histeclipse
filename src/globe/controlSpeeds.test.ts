import { describe, expect, it } from 'vitest';

import { controlSpeeds } from './controlSpeeds';

/** How far one wheel step moves the camera, as three's OrbitControls scales the distance. */
function step(distance: number, radius: number): number {
  return distance * (1 - 0.95 ** controlSpeeds(distance, radius).zoom);
}

/**
 * How far the ground at the middle of the view moves, in screen heights, for a drag of one
 * screen height: three turns by 2π × speed, and the screen shows height × 2 tan(fov / 2) radii.
 */
function groundPerFinger(distance: number, fov: number): number {
  const turn = 2 * Math.PI * controlSpeeds(distance, 1, fov).rotate;
  return turn / ((distance - 1) * 2 * Math.tan((fov * Math.PI) / 360));
}

describe('the orbit controls’ speeds', () => {
  it('zoom as before: steadily from one and a half radii out, faster far out', () => {
    expect(controlSpeeds(3, 1).zoom).toBe(0.8);
    expect(controlSpeeds(1.5, 1).zoom).toBe(0.8);
    expect(controlSpeeds(100, 1).zoom).toBe(2.5);
    // In the body's own radii: the Sun's is 109 Earth radii.
    expect(controlSpeeds(300, 109).zoom).toBe(0.8);
  });

  it('near the ground, step about an eighth of the height at a time', () => {
    for (const distance of [1.008, 1.02, 1.05, 1.2, 1.5]) {
      const share = step(distance, 1) / (distance - 1);
      expect(share).toBeGreaterThan(0.1);
      expect(share).toBeLessThan(0.13);
    }
  });

  it('close in, a drag moves the ground under the finger as far as the finger moves', () => {
    for (const fov of [35, 50]) {
      for (const distance of [1.008, 1.05, 1.5, 2, 3]) {
        expect(groundPerFinger(distance, fov)).toBeCloseTo(1, 9);
      }
    }
    // At one and a half radii, under a seventh of what it was: no longer half a turn a screen.
    expect(controlSpeeds(1.5, 1).rotate).toBeLessThan(0.5 / 7);
  });

  it('far out, with the whole disc in view, turns half a turn a screen, as it always did', () => {
    expect(controlSpeeds(10, 1).rotate).toBe(0.5);
    expect(controlSpeeds(1000, 1).rotate).toBe(0.5);
    expect(controlSpeeds(6000, 109).rotate).toBe(0.5);
  });

  it('turn slower the lower the camera, never stopping above the ground', () => {
    const turns = [1.008, 1.05, 1.2, 2, 6].map((distance) => controlSpeeds(distance, 1).rotate);
    expect([...turns].sort((a, b) => a - b)).toEqual(turns);
    expect(turns[0]).toBeGreaterThan(0);
    expect(controlSpeeds(0.99, 1)).toEqual({ zoom: 0, rotate: 0 });
  });
});
