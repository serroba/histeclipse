import { describe, expect, it } from 'vitest';

import real from '../../public/data/humans/aadr-ice-age.json';
import type { Person } from './genomePeople';
import {
  dnaCard,
  dnaPlaces,
  dnaSitesAt,
  loadIceAgeGenomes,
  type IceAgeGenomes,
} from './iceAgeGenomes';

const serve = (body: unknown) => (): Promise<Response> => Promise.resolve(Response.json(body));

const person = (id: string, place: string): Person => [
  id,
  place,
  null,
  null,
  null,
  'male',
  'C1a',
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
];

const entry = (
  id: string,
  place: string,
  bp: number,
  group = 'G',
  doi = 'https://doi.org/10.1/a',
) => ({
  bp,
  latitude: 56.2,
  longitude: 40.5,
  group,
  paper: { name: `Paper ${doi.slice(-1)}`, doi },
  person: person(id, place),
});

const small: IceAgeGenomes = {
  schemaVersion: 1,
  credit: 'AADR',
  source: 'https://doi.org/10.7910/DVN/FFIDCW',
  people: [
    entry('S1', 'Sunghir, Russia', 33210),
    entry('S2', 'Sunghir, Russia', 34630, 'G', 'No electronic version'),
    entry('DV', 'Dolní Věstonice-2, Czechia', 31020),
  ],
};

describe('the ice-age DNA of the Humans layer', () => {
  it('loads and checks, the real file too', async () => {
    await expect(loadIceAgeGenomes('x', serve(small))).resolves.toEqual(small);
    const data = await loadIceAgeGenomes('aadr-ice-age.json', serve(real));
    expect(data.people.length).toBeGreaterThan(80);
    // None the Humans list has already: no Neanderthals, Denisovans or Ranis.
    expect(data.people.some((each) => /Neanderthal|Ranis|IUP/.test(each.group))).toBe(false);
    const bad = { ...small, source: 'http://example.org' };
    await expect(loadIceAgeGenomes('x', serve(bad))).rejects.toThrow();
  });

  it('gathers people by place, oldest first, each place picked by its name', () => {
    const places = dnaPlaces(small);
    expect(places.map((place) => place.id)).toEqual([
      'dna-sunghir-russia',
      'dna-dolni-vestonice-2-czechia',
    ]);
    expect(places[0]?.entries.map((each) => each.person[0])).toEqual(['S2', 'S1']);
    expect(places[0]?.name).toBe('Sunghir');
  });

  it('marks each place from its oldest person’s date on', () => {
    const places = dnaPlaces(small);
    expect(dnaSitesAt(places, 40)).toEqual([]);
    expect(dnaSitesAt(places, 34)).toEqual([
      {
        id: 'dna-sunghir-russia',
        label: 'Sunghir DNA 33.2–34.6 ka',
        species: 'sapiens',
        point: { latitude: 56.2, longitude: 40.5 },
        disputed: false,
        dna: true,
      },
    ]);
    expect(dnaSitesAt(places, 20)).toHaveLength(2);
  });

  it('gives a place’s card: its people, lab labels and papers, linked where they can be', () => {
    const places = dnaPlaces(small);
    const card = dnaCard(small, places, 'sunghir-russia');
    expect(card?.title).toBe('Ancient DNA: Sunghir, Russia');
    expect(card?.facts.slice(0, 2)).toEqual([
      ['Genomes', '2 people'],
      ['Dated', '33.2–34.6 ka'],
    ]);
    expect(card?.facts).toContainEqual(['Y lines (fathers’ fathers)', 'C1a ×2']);
    expect(card?.facts).toContainEqual(['Lab labels', 'G']);
    expect(card?.links).toEqual([
      { label: 'Paper a', href: 'https://doi.org/10.1/a' },
      { label: 'Allen Ancient DNA Resource', href: 'https://doi.org/10.7910/DVN/FFIDCW' },
    ]);
    expect(dnaCard(small, places, 'dna-dolni-vestonice-2-czechia')?.facts[0]).toEqual([
      'Genomes',
      '1 person',
    ]);
    expect(dnaCard(small, places, 'nowhere')).toBeNull();
  });

  it('lists a few lab labels and says how many more', () => {
    const many: IceAgeGenomes = {
      ...small,
      people: Array.from({ length: 8 }, (_, i) =>
        entry(`G${String(i)}`, 'Goyet Cave, Belgium', 30000 + i, `Group${String(i)}`),
      ),
    };
    const card = dnaCard(many, dnaPlaces(many), 'goyet-cave-belgium');
    expect(card?.facts).toContainEqual([
      'Lab labels',
      'Group7, Group6, Group5, Group4, Group3, Group2, and 2 more',
    ]);
  });
});
