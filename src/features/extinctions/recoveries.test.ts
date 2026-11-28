import { describe, expect, it } from 'vitest';

import SOURCES from '../../sources/sources.json' with { type: 'json' };
import { LOSSES } from './losses';
import { RECOVERIES } from './recoveries';

const NAMES = new Set(Object.values(SOURCES).map((source) => source.name));

describe('how long life took to come back (#1269)', () => {
  it('lists, for four extinctions, three or more studies’ figures; none for the Late Devonian', () => {
    expect(Object.keys(RECOVERIES).sort()).toEqual([
      'end-ordovician-extinction',
      'end-permian-extinction',
      'end-triassic-extinction',
      'k-pg-extinction',
    ]);
    for (const recovery of Object.values(RECOVERIES)) {
      expect(recovery.rows.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('credits each figure to a source in the registry, by its name there', () => {
    for (const recovery of Object.values(RECOVERIES)) {
      for (const { whose } of recovery.rows) {
        expect(NAMES, whose).toContain(whose.replace(/^as (.*) read them$/, '$1'));
      }
    }
  });

  it('shows the end-Permian’s spread, from ammonoids in under 2 Myr to ecosystems in about 50', () => {
    const rows = RECOVERIES['end-permian-extinction']?.rows ?? [];
    expect(rows.map(({ whose }) => whose)).toContain('Brayard et al. 2009');
    expect(rows.at(-1)?.took).toBe('about 50 million years');
  });

  it('rides on each extinction’s gauge', () => {
    expect(LOSSES['k-pg-extinction']?.recovery).toBe(RECOVERIES['k-pg-extinction']);
    expect(LOSSES['late-devonian-extinction']?.recovery).toBeUndefined();
  });
});
