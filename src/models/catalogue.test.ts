import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CATALOGUE } from './catalogue';
import { BUILT } from './catalogueEntry';

interface Recorded {
  readonly id: string;
  readonly kind: string;
  readonly craft?: string | null;
}

const { telescopes } = JSON.parse(readFileSync('public/data/telescopes.json', 'utf8')) as {
  readonly telescopes: readonly Recorded[];
};
const RECORDED = new Map(telescopes.map((telescope) => [telescope.id, telescope]));

describe('the telescopes’ models, one entry each (#873)', () => {
  it('Given each entry, Then it is a telescope of the record, on the ground or in space as there, with its craft', () => {
    expect(new Set(CATALOGUE.map(({ id }) => id)).size).toBe(CATALOGUE.length);
    for (const entry of CATALOGUE) {
      const recorded = RECORDED.get(entry.id);
      expect(recorded, entry.id).toBeDefined();
      expect(recorded?.kind === 'ground', entry.id).toBe(entry.kind === 'ground');
      if (entry.kind === 'space')
        expect(recorded?.craft?.toUpperCase(), entry.id).toBe(entry.craft);
    }
  });

  it('Given each caption, Then it says it is an approximation at true scale, and those built by default say what is by eye', () => {
    for (const entry of CATALOGUE) {
      expect(entry.opening ?? BUILT).toMatch(/^An approximation built here .*at true scale:$/);
      if (entry.opening === undefined) expect(entry.caption, entry.id).toMatch(/by eye/);
    }
  });
});
