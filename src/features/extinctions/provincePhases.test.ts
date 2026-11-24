import { describe, expect, it } from 'vitest';

import { CRISIS_SCALE } from '../../deepTime/crisisClock';
import { phaseAt } from '../ownTime';
import { END_GUADALUPIAN } from './guadalupianPhases';
import { END_TRIASSIC } from './triassicPhases';

describe('the end-Triassic’s and the end-Guadalupian’s phases (#1201)', () => {
  for (const [name, phases] of [
    ['end-Triassic', END_TRIASSIC],
    ['end-Guadalupian', END_GUADALUPIAN],
  ] as const) {
    it(`run in order on the crisis clock, the ${name}’s each with its sources`, () => {
      const starts = phases.map((each) => each.from);
      expect(starts).toEqual([...starts].sort((a, b) => a - b));
      expect(CRISIS_SCALE.secondsAt(0)).toBeLessThanOrEqual(starts[0] ?? 0);
      for (const each of phases) {
        expect(each.sources.length).toBeGreaterThan(0);
        for (const source of each.sources) expect(source.url).toMatch(/^https:\/\/doi\.org\/10\./);
      }
      expect(phaseAt(phases, 0)?.id).toBe('eruptions');
    });
  }

  it('say the end-Guadalupian is argued, and the end-Triassic began underground', () => {
    expect(END_GUADALUPIAN[0]?.title).toMatch(/argued/);
    expect(phaseAt(END_TRIASSIC, -50 * 365.25 * 86_400 * 1000)?.id).toBe('intrusions');
  });
});
