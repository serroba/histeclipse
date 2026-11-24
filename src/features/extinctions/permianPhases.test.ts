import { describe, expect, it } from 'vitest';

import { CRISIS_SCALE } from '../../deepTime/crisisClock';
import { phaseAt } from '../ownTime';
import { END_PERMIAN } from './permianPhases';

describe('the end-Permian’s phases (#1192)', () => {
  it('run in order across the crisis clock, each with its sources', () => {
    const starts = END_PERMIAN.map((phase) => phase.from);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    expect(CRISIS_SCALE.secondsAt(0)).toBeLessThanOrEqual(starts[0] ?? 0);
    for (const phase of END_PERMIAN) {
      expect(phase.sources.length).toBeGreaterThan(0);
      for (const source of phase.sources) expect(source.url).toMatch(/^https:\/\/doi\.org\/10\./);
    }
  });

  it('say the sills and the dying as the extinction begins, the recovery millions of years on', () => {
    expect(phaseAt(END_PERMIAN, 0)?.id).toBe('sills');
    expect(phaseAt(END_PERMIAN, CRISIS_SCALE.secondsAt(4.1))?.title).toBe('The Great Dying');
    expect(phaseAt(END_PERMIAN, CRISIS_SCALE.secondsAt(CRISIS_SCALE.end))?.id).toBe('recovery');
  });

  it('say where it is argued that land died first', () => {
    expect(END_PERMIAN[0]?.title).toMatch(/argued/);
  });
});
