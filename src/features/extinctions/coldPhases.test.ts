import { describe, expect, it } from 'vitest';

import { LONG_CRISIS_SCALE } from '../../deepTime/crisisClock';
import { phaseAt } from '../ownTime';
import { END_ORDOVICIAN, LATE_DEVONIAN } from './coldPhases';

const KYR = 1000 * 365.25 * 86_400;

describe('the end-Ordovician’s and the Late Devonian’s phases (#1202)', () => {
  for (const [name, phases] of [
    ['end-Ordovician', END_ORDOVICIAN],
    ['Late Devonian', LATE_DEVONIAN],
  ] as const) {
    it(`run in order on the long clock, the ${name}’s each with its sources`, () => {
      const starts = phases.map((each) => each.from);
      expect(starts).toEqual([...starts].sort((a, b) => a - b));
      expect(LONG_CRISIS_SCALE.secondsAt(0)).toBeLessThanOrEqual(starts[0] ?? 0);
      for (const each of phases) {
        expect(each.sources.length).toBeGreaterThan(0);
        for (const source of each.sources) expect(source.url).toMatch(/^https:\/\/doi\.org\/10\./);
      }
    });
  }

  it('say where the causes are argued, and the two pulses of each', () => {
    expect(phaseAt(END_ORDOVICIAN, 0)?.title).toMatch(/argued/);
    expect(phaseAt(END_ORDOVICIAN, 1000 * KYR)?.id).toBe('second');
    expect(phaseAt(LATE_DEVONIAN, -200 * KYR)?.title).toMatch(/argued/);
    expect(phaseAt(LATE_DEVONIAN, 600 * KYR)?.id).toBe('upper');
  });
});
