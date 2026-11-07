import { describe, expect, it } from 'vitest';

import { PERIODS } from '../deepTime/periods';
import { PERIOD_EVIDENCE } from './periodEvidence';
import { SOURCES } from './registry';

describe('the evidence for each period', () => {
  it('covers every period of the last 540 million years, by the chart’s names', () => {
    const phanerozoic = PERIODS.filter((period) => period.base <= 540 && period.rank === undefined);
    for (const period of phanerozoic) expect(PERIOD_EVIDENCE).toHaveProperty(period.name);
  });

  it('names only periods the chart has, each resting on registered sources', () => {
    const names = new Set(PERIODS.map((period) => period.name));
    for (const [name, entry] of Object.entries(PERIOD_EVIDENCE)) {
      expect(names).toContain(name);
      expect(entry.sources.length).toBeGreaterThan(0);
      for (const id of entry.sources) expect(SOURCES).toHaveProperty(id);
    }
  });
});
