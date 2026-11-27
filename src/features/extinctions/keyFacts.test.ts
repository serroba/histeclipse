import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { factsAt, KEY_FACTS } from './keyFacts';

const SITES = new Set(
  (
    JSON.parse(readFileSync('public/data/extinctions.json', 'utf8')) as {
      sites: readonly { id: string; extinction: string }[];
    }
  ).sites.map((site) => `${site.extinction} ${site.id}`),
);

describe('the key facts pinned as an extinction plays (#1268)', () => {
  it('pins each fact at one of its own extinction’s places, with a source', () => {
    for (const [extinction, facts] of Object.entries(KEY_FACTS)) {
      for (const fact of facts) {
        expect(SITES.has(`${extinction} ${fact.site}`), `${extinction} ${fact.site}`).toBe(true);
        expect(fact.sources.length).toBeGreaterThan(0);
        expect(fact.to).toBeGreaterThan(fact.from);
      }
    }
  });

  it('shows one fact at a place at a time', () => {
    for (const facts of Object.values(KEY_FACTS)) {
      for (const [index, fact] of facts.entries()) {
        const overlapping = facts.filter(
          (other, at) =>
            at !== index &&
            other.site === fact.site &&
            other.from < fact.to &&
            fact.from < other.to,
        );
        expect(overlapping).toEqual([]);
      }
    }
  });

  it('says whose each fact is, by the registry’s names', () => {
    const shown = factsAt(
      KEY_FACTS['end-triassic-extinction'] ?? [],
      200_000 * 365.25 * 86_400,
    ).find((each) => each.site === 'camp-palisades');
    expect(shown?.whose).toBe('Marzoli et al. 1999; Lindström et al. 2021');
  });
});
