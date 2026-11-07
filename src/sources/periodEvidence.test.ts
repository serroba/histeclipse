import { describe, expect, it } from 'vitest';

import { PERIODS } from '../deepTime/periods';
import { PERIOD_EVIDENCE } from './periodEvidence';
import { SOURCES } from './registry';

describe('the evidence for each period', () => {
  it('covers every unit the bar names, from the Hadean to the Quaternary', () => {
    for (const period of PERIODS) expect(PERIOD_EVIDENCE).toHaveProperty(period.name);
  });

  it('says, before the surface maps, that the globe is outlines or a sketch', () => {
    for (const period of PERIODS.filter(({ base }) => base > 635)) {
      expect(PERIOD_EVIDENCE[period.name]?.map).toMatch(/sketch/);
    }
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
