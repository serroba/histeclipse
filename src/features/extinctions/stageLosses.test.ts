import { describe, expect, it } from 'vitest';

import { EXTINCTIONS } from './events';
import { LOSSES } from './losses';
import { EXTINCTION_STAGES, historyOf, stageSays, typicalLoss, withHistory } from './stageLosses';

describe('each extinction against every stage’s losses (#1269)', () => {
  it('names stages the record counts for every extinction', () => {
    for (const extinction of EXTINCTIONS) {
      const names = EXTINCTION_STAGES[extinction.id];
      expect(names, extinction.id).toBeDefined();
      const history = historyOf(names ?? []);
      for (const name of names ?? []) {
        const stage = history.stages.find((each) => each.name === name);
        expect(stage?.lost, name).toBeGreaterThan(0);
      }
    }
  });

  it('finds every mass extinction well above an ordinary stage’s losses', () => {
    const typical = typicalLoss();
    expect(typical).toBeGreaterThan(0.1);
    expect(typical).toBeLessThan(0.3);
    const history = historyOf(['Changhsingian']);
    const permian = history.stages.find((each) => each.name === 'Changhsingian');
    expect(permian?.lost).toBeGreaterThan(2 * typical);
  });

  it('spans the Phanerozoic, oldest first, and says so at its ends', () => {
    const { stages, ends } = historyOf(['Maastrichtian']);
    expect(stages[0]?.name).toBe('Fortunian');
    expect(ends).toEqual(['539 Ma', '3 Ma']);
    // Each after the last, without overlap; the Pridoli, a series with no stages, is a gap.
    for (let index = 1; index < stages.length; index += 1) {
      expect(stages[index]?.base).toBeLessThanOrEqual((stages[index - 1]?.top ?? 0) + 0.01);
    }
  });

  it('says each count of a stage, and how long it was', () => {
    expect(stageSays('Changhsingian')).toMatch(
      /^the Changhsingian, 2 million years long, lost \d+% \(gap-filler rate, Alroy 2014\), \d+% \(three-timer, Alroy 2008\), \d+% last found$/,
    );
    expect(stageSays('Nowhere')).toBe('');
  });

  it('adds the record’s counts to each gauge, keeping the studies’ estimate', () => {
    const permian = LOSSES['end-permian-extinction'];
    expect(permian?.lost).toEqual([0.618, 0.624]);
    expect(permian?.history?.marked).toEqual(['Changhsingian']);
    expect(permian?.says).toMatch(
      /Stanley.*Paleobiology Database’s finds.*an ordinary stage loses \d+%\.$/,
    );
    expect(LOSSES['end-ordovician-extinction']?.history?.title).toMatch(/here \d+% and \d+%/);
  });

  it('leaves a gauge with no stages as it is', () => {
    const gauge = { what: 'Genera', lost: [0.1, 0.2] as const, pulses: [], says: 'Said.' };
    expect(withHistory('unknown', gauge)).toBe(gauge);
  });
});
