import { describe, expect, it } from 'vitest';

import file from '../../../public/data/planet-keys.json';
import { keyGradient } from '../../data/planetKeys';
import { seenPlanet, viewKey, type LoadedKeys } from './seen';

const AU = 149_597_870.7;
const keys = { heights: file.keys, rocks: file.swatches } as unknown as LoadedKeys;

describe('seenPlanet', () => {
  it('names the planet, points from the observer to it, and dims it with its phase', () => {
    // Jupiter at opposition: the Sun behind Earth, the planet 4.2 au away, fully lit.
    const full = seenPlanet('jupiter', [4.2 * AU, 0, 0], [-AU, 0, 0], [6378, 0, 0]);
    expect(full.name).toBe('Jupiter');
    expect(full.direction).toEqual([4.2 * AU - 6378, 0, 0]);
    // Nearer quadrature, seen partly lit and farther: fainter (a larger magnitude).
    const later = seenPlanet('jupiter', [4.2 * AU, 4 * AU, 0], [-AU, 0, 0], [0, 0, 0]);
    expect(later.magnitude).toBeGreaterThan(full.magnitude);
    expect(full.magnitude).toBeLessThan(-2);
  });

  it("tilts Saturn's rings into its brightness, as no other planet has", () => {
    const at: readonly [number, number, number] = [9 * AU, 0, 0];
    const saturn = seenPlanet('saturn', at, [-AU, 0, 0], [0, 0, 0]);
    expect(saturn.name).toBe('Saturn');
    expect(Number.isFinite(saturn.magnitude)).toBe(true);
  });
});

describe('viewKey', () => {
  it('gives a rocks view its swatches and their credit, as a sentence', () => {
    const { key } = viewKey(keys, { rockKey: 'mercury' });
    expect(key).toEqual({
      swatches: file.swatches.mercury.swatches,
      note: expect.stringMatching(/^[A-Z].*\.$/) as unknown,
    });
  });

  it('gives a heights view its gradient, ticks, datum and credit', () => {
    const { key } = viewKey(keys, { colourKey: 'mars' });
    expect(key).toEqual({
      gradient: keyGradient(keys.heights.mars),
      ticks: expect.any(Array) as unknown,
      note: `Height ${file.keys.mars.datum}; key ${file.keys.mars.credit}.`,
    });
  });

  it('gives a view with neither no key', () => {
    expect(viewKey(keys, {})).toEqual({});
  });
});
