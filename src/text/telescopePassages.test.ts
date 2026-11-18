import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { loadTelescopes, type Telescopes } from '../data/telescopes';
import { telescopePassages } from './telescopePassages';
import { indexPassages, searchWords } from './wordSearch';

const raw: unknown = JSON.parse(readFileSync('public/data/telescopes.json', 'utf8'));
const record: Telescopes = await loadTelescopes('t.json', () =>
  Promise.resolve(new Response(JSON.stringify(raw))),
);
const passages = telescopePassages(record);
const named = (id: string) => passages.find((passage) => passage.id === `telescope:${id}`);

describe('each telescope as a passage (#851)', () => {
  it('gives every telescope one, titled with its name and years', () => {
    expect(passages).toHaveLength(record.telescopes.length);
    expect(named('arecibo')?.title).toBe('Arecibo Telescope, 1963–2020');
    expect(named('webb')?.title).toBe('James Webb Space Telescope, since 2021');
    expect(named('elt')?.title).toBe('Extremely Large Telescope, being built since 2014');
    expect(named('arecibo')?.kind).toBe('telescope');
  });

  it('anchors a ground telescope over its site, in its first light’s year, its layer on', () => {
    const [anchor] = named('vlt')?.anchors ?? [];
    expect(anchor?.at?.[0]).toBeCloseTo(-24.63, 1);
    expect(anchor?.view).toMatch(
      /^layers=telescopes&t=1998-06-01T12:00Z&cam=-24\.6276,-70\.4051,2\.40$/,
    );
    expect(anchor?.when).toEqual([1998, expect.any(Number) as number]);
  });

  it('anchors a space telescope a year into its flight, framed for its orbit', () => {
    expect(named('hubble')?.anchors[0]?.view).toBe(
      'layers=telescopes&t=1991-06-01T12:00Z&focus=earth&cam=20.0000,0.0000,8.00',
    );
    // IRAS flew under a year: shown in the year it flew.
    expect(named('iras')?.anchors[0]?.view).toContain('t=1983-06-01');
    expect(named('spitzer')?.anchors[0]?.body).toBe('sun');
    expect(named('webb')?.anchors[0]?.view).toContain('cam=20.0000,0.0000,600.00');
  });

  it('is found by its name and by what it sees', () => {
    const index = indexPassages(passages);
    expect(searchWords(index, 'Keck')[0]?.passage.id).toBe('telescope:keck');
    const radio = searchWords(index, 'radio telescope').map((hit) => hit.passage.id);
    expect(radio.slice(0, 8)).toEqual(
      expect.arrayContaining(['telescope:arecibo', 'telescope:fast']),
    );
    const xrays = searchWords(index, 'X-ray').map((hit) => hit.passage.id);
    expect(xrays).toEqual(expect.arrayContaining(['telescope:chandra', 'telescope:xmm-newton']));
  });
});
