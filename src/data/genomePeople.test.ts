import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { lineOf, loadPeople, peopleAt, peopleFacts, personLine, type Person } from './genomePeople';

const serve = (body: unknown) => (): Promise<Response> => Promise.resolve(Response.json(body));

const sunghir: Person = [
  'Sunghir1',
  'Sunghir, Russia',
  'multiple elements (molar; long bone)',
  '32326-30080 calBCE (28890±430 BP, OxA-X-2464-12)',
  'radiocarbon on the remains',
  'male',
  'C1a',
  'U8c',
  'shotgun',
  1.5,
  831679,
  'brothers I2',
  20.8,
  'PRJEB22592',
  'adult',
];

const bare = (id: string, sex: Person[5] = null): Person => [
  id,
  'Somewhere',
  null,
  null,
  null,
  sex,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
];

describe('the people of the ancient genomes', () => {
  it('load and check, the real files too', async () => {
    const file = { schemaVersion: 1, first: 0, people: [sunghir] };
    await expect(loadPeople('x', serve(file))).resolves.toEqual(file);
    const real: unknown = JSON.parse(
      readFileSync(new URL('../../public/data/genomes/people/0.json', import.meta.url), 'utf8'),
    );
    const loaded = await loadPeople('0.json', serve(real));
    expect(loaded.people).toHaveLength(1000);
    const bad = { ...file, people: [[...sunghir.slice(0, 13), 'not-an-accession', null]] };
    await expect(loadPeople('x', serve(bad))).rejects.toThrow();
  });

  it('are found by their row in the genomes file, across files', () => {
    const at = peopleAt([
      { schemaVersion: 1, first: 0, people: [bare('A')] },
      { schemaVersion: 1, first: 1000, people: [bare('B')] },
    ]);
    expect(at(0)?.[0]).toBe('A');
    expect(at(1000)?.[0]).toBe('B');
    expect(at(5)).toBeUndefined();
  });

  it('count close haplogroups as one line', () => {
    expect(lineOf('R1b1a1b1a1a')).toBe('R1b');
    expect(lineOf('U5a1c')).toBe('U5a');
    expect(lineOf('HV0+195')).toBe('HV0');
    expect(lineOf('?')).toBe('?');
  });

  it('say all that is known of a person in a line', () => {
    expect(personLine(sunghir)).toBe(
      'male · adult · Y C1a · mt U8c · multiple elements (molar; long bone) · 32326-30080 calBCE (28890±430 BP, OxA-X-2464-12) (radiocarbon on the remains) · Sunghir, Russia · shotgun, 1.5× coverage, 831,679 SNPs · 20.8 cM in long runs of homozygosity · relatives: brothers I2',
    );
    const thin = bare('X');
    thin[3] = '800-400 BCE';
    thin[8] = '1240k capture';
    expect(personLine(thin)).toBe('800-400 BCE · Somewhere · 1240k capture');
    expect(personLine(bare('Y'))).toBe('Somewhere');
  });

  it('tally sex, lines and relatives, then list a dozen people and say how many more', () => {
    const people = [
      sunghir,
      ...Array.from({ length: 13 }, (_, i) => bare(`I${String(i)}`, i % 2 ? 'female' : null)),
    ];
    const { facts, links } = peopleFacts(people);
    expect(facts.slice(0, 4)).toEqual([
      ['Genetic sex', '6 female, 1 male, 7 not told'],
      ['Y lines (fathers’ fathers)', 'C1a ×1'],
      ['mtDNA lines (mothers’ mothers)', 'U8c ×1'],
      ['With relatives found', '1 of 14'],
    ]);
    expect(facts).toHaveLength(4 + 12 + 1);
    expect(facts.at(-1)).toEqual(['More', '2 more people, not listed']);
    expect(links).toEqual([
      { label: 'Reads: PRJEB22592', href: 'https://www.ebi.ac.uk/ena/browser/view/PRJEB22592' },
    ]);
    const lines = peopleFacts(
      ['H1', 'H2', 'J1', 'K1', 'T2', 'U5', 'V1', 'W1'].map((mt) => {
        const person = bare(mt);
        person[7] = mt;
        return person;
      }),
    );
    expect(lines.facts[1]).toEqual([
      'mtDNA lines (mothers’ mothers)',
      'H1 ×1, H2 ×1, J1 ×1, K1 ×1, T2 ×1, U5 ×1, and 2 more',
    ]);
  });
});
