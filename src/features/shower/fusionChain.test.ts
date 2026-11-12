import { describe, expect, it } from 'vitest';

import { CHAIN, CHAIN_MS, SETTLED_T, stageAt, stageProgress } from './fusionChain';

describe('the proton–proton chain', () => {
  it('runs its stages in order, then starts again', () => {
    expect(stageAt(0).stage).toBe('pp');
    expect(stageAt(2600).stage).toBe('dp');
    expect(stageAt(5000).stage).toBe('hehe');
    expect(stageAt(8000).stage).toBe('done');
    expect(stageAt(CHAIN_MS + 100).stage).toBe('pp');
  });

  it('says how far through its stage a moment is', () => {
    expect(stageProgress(0)).toBe(0);
    expect(stageProgress(1300)).toBeCloseTo(0.5);
    expect(stageProgress(2599)).toBeLessThan(1);
    // The last stage runs to the chain's end.
    expect(stageProgress(8200)).toBeCloseTo(0.5);
  });

  it('settles on the chain complete', () => {
    expect(stageAt(SETTLED_T).stage).toBe('done');
  });

  it('adds up: four protons in, one helium-4 out, 26.7 MeV', () => {
    expect(CHAIN.map(({ equation }) => equation)).toEqual([
      '¹H + ¹H → ²H + e⁺ + ν',
      '²H + ¹H → ³He + γ',
      '³He + ³He → ⁴He + 2 ¹H',
      '4 ¹H → ⁴He + energy',
    ]);
    expect(CHAIN.at(-1)?.gives).toContain('26.7 MeV');
  });
});
