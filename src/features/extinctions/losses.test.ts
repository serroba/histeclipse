import { describe, expect, it } from 'vitest';

import { EXTINCTIONS } from './events';
import { LOSSES } from './losses';

describe('LOSSES', () => {
  it('says what each extinction took, or why it does not', () => {
    for (const extinction of EXTINCTIONS) {
      const loss = LOSSES[extinction.id];
      expect(loss, extinction.id).toBeDefined();
      expect(loss?.says).toMatch(/Stanley/);
      expect(loss?.says).toMatch(/Bond & Grasby/);
    }
  });

  it('gives each estimate as a range lost, its pulses sharing all of it', () => {
    for (const [id, loss] of Object.entries(LOSSES)) {
      const [low, high] = loss.lost;
      expect(low, id).toBeGreaterThan(0);
      expect(high, id).toBeGreaterThanOrEqual(low);
      expect(high, id).toBeLessThan(1);
      const shares = loss.pulses.reduce((sum, pulse) => sum + pulse.share, 0);
      expect(shares, id).toBeCloseTo(1);
      for (const pulse of loss.pulses) expect(pulse.to, id).toBeGreaterThanOrEqual(pulse.from);
    }
  });

  it('says the end-Permian took some 62% of marine genera, as Stanley (2016) estimates', () => {
    expect(LOSSES['end-permian-extinction']?.lost).toEqual([0.618, 0.624]);
  });
});
