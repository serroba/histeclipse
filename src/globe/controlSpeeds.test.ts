import { describe, expect, it } from 'vitest';

import { controlSpeeds } from './controlSpeeds';

/** How far one wheel step moves the camera, as three's OrbitControls scales the distance. */
function step(distance: number, radius: number): number {
  return distance * (1 - 0.95 ** controlSpeeds(distance, radius).zoom);
}

describe('the orbit controls’ speeds', () => {
  it('are as before from one and a half radii out, faster far out', () => {
    expect(controlSpeeds(3, 1)).toEqual({ zoom: 0.8, rotate: 0.5 });
    expect(controlSpeeds(1.5, 1)).toEqual({ zoom: 0.8, rotate: 0.5 });
    expect(controlSpeeds(100, 1)).toEqual({ zoom: 2.5, rotate: 0.5 });
    // In the body's own radii: the Sun's is 109 Earth radii.
    expect(controlSpeeds(300, 109)).toEqual({ zoom: 0.8, rotate: 0.5 });
  });

  it('near the ground, step about an eighth of the height at a time', () => {
    for (const distance of [1.008, 1.02, 1.05, 1.2, 1.5]) {
      const share = step(distance, 1) / (distance - 1);
      expect(share).toBeGreaterThan(0.1);
      expect(share).toBeLessThan(0.13);
    }
  });

  it('turn slower the lower the camera, never stopping above the ground', () => {
    const turns = [1.008, 1.05, 1.2, 2].map((distance) => controlSpeeds(distance, 1).rotate);
    expect([...turns].sort((a, b) => a - b)).toEqual(turns);
    expect(turns[0]).toBeGreaterThan(0);
    expect(controlSpeeds(0.99, 1)).toEqual({ zoom: 0, rotate: 0 });
  });
});
