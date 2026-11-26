import { describe, expect, it } from 'vitest';

import json from '../../../public/data/planetary-boundaries.json';
import { loadPlanetaryBoundaries, type PlanetaryBoundaries } from '../../data/planetaryBoundaries';
import { assessmentIn, radiusOf, ringPiece, wheelOf } from './wheelModel';

const data: PlanetaryBoundaries = await loadPlanetaryBoundaries('/pb.json', () =>
  Promise.resolve(new Response(JSON.stringify(json))),
);

describe('the boundaries’ wheel beside the globe', () => {
  it('reads the latest assessment made by the year shown, and none before the first', () => {
    expect(assessmentIn(2022)).toBeNull();
    expect(assessmentIn(2023)).toBe('richardson2023');
    expect(assessmentIn(2025)).toBe('richardson2023');
    expect(assessmentIn(2026)).toBe('phc2026');
    expect(assessmentIn(2030)).toBe('phc2026');
  });

  it('counts the crossed as each assessment does: seven of nine in 2026, six in 2023', () => {
    expect(wheelOf(data, 'phc2026', null).crossed).toBe(7);
    expect(wheelOf(data, 'richardson2023', null).crossed).toBe(6);
  });

  it('draws all nine, in the report’s order, each with a sector to pick it by', () => {
    const wheel = wheelOf(data, 'phc2026', null);
    expect(wheel.boundaries.map(({ id }) => id)).toEqual(data.boundaries.map(({ id }) => id));
    for (const boundary of wheel.boundaries) {
      expect(boundary.sector, boundary.id).toMatch(/^M.*Z$/);
      expect(boundary.parts.length, boundary.id).toBeGreaterThan(0);
    }
  });

  it('colours a wedge by the zones it reaches: ozone stays green, climate reaches amber', () => {
    const wheel = wheelOf(data, 'phc2026', null);
    const zones = (id: string) =>
      new Set(
        wheel.boundaries
          .find((each) => each.id === id)
          ?.parts.filter((part) => !part.faded)
          .map((part) => part.zone),
      );
    expect(zones('ozone')).toEqual(new Set(['safe']));
    expect(zones('climate')).toContain('increasing');
    // Novel entities are placed by judgement: drawn faded past the sure part.
    expect(
      wheel.boundaries.find((each) => each.id === 'novel')?.parts.some((part) => part.faded),
    ).toBe(true);
  });

  it('draws the other assessment’s bars only when asked to compare', () => {
    expect(wheelOf(data, 'phc2026', null).boundaries.flatMap((each) => each.bars)).toEqual([]);
    const bars = wheelOf(data, 'phc2026', 'richardson2023').boundaries.flatMap((b) => b.bars);
    expect(bars.length).toBeGreaterThan(0);
  });

  it('puts the rings at the reference, the boundary and the high-risk line', () => {
    const { rings } = wheelOf(data, 'phc2026', null);
    expect(rings).toEqual({ reference: radiusOf(0), boundary: radiusOf(1), highRisk: radiusOf(2) });
    expect(radiusOf(1)).toBeGreaterThan(radiusOf(0));
  });

  it('writes a piece of ring as a closed path between two arcs', () => {
    const d = ringPiece(10, 20, 0, Math.PI / 2);
    expect(d.startsWith('M100.00 90.00 L100.00 80.00 A20.00 20.00 0 0 1 120.00 100.00')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
  });
});
