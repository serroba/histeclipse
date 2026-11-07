import { describe, expect, it } from 'vitest';

import { SOURCES } from '../sources/registry';
import { earthFacts } from './earthFacts';
import { POLAR_WANDER, polarWanderAt } from './polarWander';

const poles = (ma: number): string =>
  earthFacts(ma).find(({ label }) => label === 'Poles')?.text ?? '';

describe('true polar wander', () => {
  it('lists its episodes youngest first, apart, each with sources the site knows', () => {
    for (const [index, episode] of POLAR_WANDER.entries()) {
      expect(episode.young).toBeLessThan(episode.old);
      const next = POLAR_WANDER[index + 1];
      if (next !== undefined) expect(episode.old).toBeLessThan(next.young);
      expect(episode.sources.length).toBeGreaterThan(1);
      for (const source of episode.sources) expect(SOURCES[source]).toBeDefined();
      expect(episode.questioned.length).toBeGreaterThan(0);
    }
  });

  it('finds the episode under way, and none between them', () => {
    expect(polarWanderAt(84)?.name).toBe('Late Cretaceous oscillation');
    expect(polarWanderAt(150)?.name).toBe('Jurassic “monster” polar shift');
    expect(polarWanderAt(520)?.name).toBe('Cambrian inertial interchange');
    expect(polarWanderAt(66)).toBeNull();
    expect(polarWanderAt(300)).toBeNull();
  });

  it('is named in the poles’ fact with who found it and who questions it', () => {
    expect(poles(150)).toContain('Jurassic “monster” polar shift');
    expect(poles(150)).toContain('Muttoni & Kent 2019');
    expect(poles(150)).toContain('apparent (or true)');
    expect(poles(520)).toContain('Torsvik, Meert & Smethurst 1998');
    expect(poles(84)).toContain('Mitchell et al. 2021');
    expect(poles(66)).not.toContain('True polar wander then');
  });
});
