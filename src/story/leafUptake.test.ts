import { describe, expect, it } from 'vitest';

import {
  AIR_PARTS,
  airAround,
  CARBON_PER_C14,
  DIOXIDE_FACTS,
  FALL_FACTS,
  HALF_LIFE_YEARS,
  plantFacts,
  remaining,
} from './leafUptake';

describe('the air', () => {
  it('adds up to the dry air, all but a part in 10,000', () => {
    const total = Object.values(AIR_PARTS).reduce((sum, part) => sum + part, 0);
    expect(total).toBe(10_000);
  });

  it('is drawn in its proportions, round a clear middle, the same every time', () => {
    const molecules = airAround(200, 40);
    const count = (kind: string): number => molecules.filter((m) => m.kind === kind).length;
    expect(molecules).toHaveLength(200);
    expect(count('nitrogen')).toBe(156);
    expect(count('oxygen')).toBe(42);
    expect(count('argon')).toBe(2);
    for (const { at } of molecules) {
      expect(Math.hypot(...at)).toBeGreaterThanOrEqual(40 * 0.12);
      for (const value of at) expect(Math.abs(value)).toBeLessThanOrEqual(20);
    }
    expect(airAround(200, 40)).toEqual(molecules);
  });

  it('holds a carbon-14 atom in about a trillion carbon atoms', () => {
    expect(CARBON_PER_C14).toBeCloseTo(8.3e11, -10);
  });
});

describe('remaining', () => {
  it('halves every 5,730 years', () => {
    expect(remaining(0)).toBe(1);
    expect(remaining(HALF_LIFE_YEARS)).toBeCloseTo(0.5, 12);
    expect(remaining(2 * HALF_LIFE_YEARS)).toBeCloseTo(0.25, 12);
  });
});

describe('the facts', () => {
  it('say how carbon dioxide is made, and the air it falls through', () => {
    expect(DIOXIDE_FACTS[0]).toBe('¹⁴C + O → ¹⁴CO: carbon monoxide first');
    expect(FALL_FACTS[0]).toBe(
      'In 10,000 molecules of dry air: 7,808 nitrogen, 2,095 oxygen, 93 argon, about 4 carbon dioxide (today)',
    );
  });

  it('say how the plant takes it in, on land or at sea, and with the Sun’s photon or not', () => {
    expect(plantFacts(false, true)).toEqual([
      '6 CO₂ + 6 H₂O + light → C₆H₁₂O₆ + 6 O₂',
      'In through a stoma, a pore between two guard cells, mostly on the leaf’s underside',
      'Chlorophyll in photosystem II absorbs best at 680 nm (P680): the red photon’s 1.8 eV',
      'When it dies the intake stops: half the carbon-14 is gone every 5,730 years',
    ]);
    expect(plantFacts(true, false)[1]).toContain('alga');
    expect(plantFacts(true, false)[2]).toContain('reflects the green');
  });
});
