import { describe, expect, it } from 'vitest';

import real from '../../public/data/humans/species.json';
import { HUMAN_SPECIES } from './humanClaims';
import { loadHumanSpecies, speciesCard, spanWords, type HumanSpeciesData } from './humanSpecies';

const serve = (body: unknown) => (): Promise<Response> => Promise.resolve(Response.json(body));

const fact = (text: string, citation: string, doi: string) => ({
  text,
  source: { citation, doi },
});

const few: HumanSpeciesData = {
  schemaVersion: 1,
  species: [
    {
      id: 'erectus',
      name: 'Homo erectus',
      called: null,
      aka: ['Homo ergaster'],
      summary: 'A long-legged human that left Africa.',
      firstKa: 2000,
      lastKa: 110,
      facts: {
        span: [fact('From Dmanisi on.', 'A 2013, Science', '10.1/a')],
        body: [fact('Brains of 550–1,250 cm³.', 'B 2010, Nature', '10.1/b')],
        tools: [],
        range: [fact('Africa to Java.', 'A 2013, Science', '10.1/a')],
        dna: [],
      },
      debates: [
        {
          question: 'One species or two?',
          views: [fact('One.', 'C 2014, PNAS', '10.1/c'), fact('Two.', 'D 2015, JHE', '10.1/d')],
        },
      ],
      typeFossil: 'Trinil 2, found by Eugène Dubois in 1891',
      wikipedia: 'Homo erectus',
    },
    {
      id: 'neanderthal',
      name: 'Homo neanderthalensis',
      called: 'Neanderthals',
      aka: [],
      summary: 'Our closest relatives in Europe.',
      firstKa: 430,
      lastKa: 40,
      facts: { span: [], body: [], tools: [], range: [], dna: [] },
      debates: [],
      typeFossil: null,
      wikipedia: 'Neanderthal',
    },
  ],
};

describe('the human species', () => {
  it('give each species its card: what, when, body, where and what is argued, with sources', () => {
    const card = speciesCard(few, 'erectus', null);
    expect(card?.title).toBe('Homo erectus');
    expect(card?.facts).toEqual([
      ['What', 'A long-legged human that left Africa.'],
      ['Also named', 'Homo ergaster'],
      ['When', '2 million to 110,000 years ago'],
      ['Dates', 'From Dmanisi on. (A 2013, Science)'],
      ['Body', 'Brains of 550–1,250 cm³. (B 2010, Nature)'],
      ['Where', 'Africa to Java. (A 2013, Science)'],
      ['Named from', 'Trinil 2, found by Eugène Dubois in 1891'],
      ['Argued over', 'One species or two? One. (C 2014, PNAS) Two. (D 2015, JHE)'],
    ]);
    // Each paper once.
    expect(card?.links.map((link) => link.href)).toEqual([
      'https://doi.org/10.1/a',
      'https://doi.org/10.1/b',
      'https://doi.org/10.1/c',
      'https://doi.org/10.1/d',
    ]);
  });

  it('call a species by its plain name where it has one, and leave out what is not known', () => {
    const card = speciesCard(few, 'neanderthal', null);
    expect(card?.title).toBe('Neanderthals (Homo neanderthalensis)');
    expect(card?.facts.map(([label]) => label)).toEqual(['What', 'When']);
    expect(speciesCard(few, 'naledi', null)).toBeNull();
  });

  it('read a span in years, up to today for our own', () => {
    expect(spanWords(315, 0)).toBe('315,000 years ago to today');
    expect(spanWords(2800, 1500)).toBe('2.8 million to 1.5 million years ago');
  });

  it('refuse a species twice, a span backwards, or a debate with one side', async () => {
    const [erectus] = few.species;
    if (erectus === undefined) throw new Error('no species');
    const twice = { ...few, species: [erectus, erectus] };
    await expect(loadHumanSpecies('x', serve(twice))).rejects.toThrow();
    const backwards = { ...few, species: [{ ...erectus, firstKa: 1, lastKa: 2 }] };
    await expect(loadHumanSpecies('x', serve(backwards))).rejects.toThrow();
    const oneSided = {
      ...few,
      species: [
        { ...erectus, debates: [{ question: 'Q?', views: [fact('One.', 'C', '10.1/c')] }] },
      ],
    };
    await expect(loadHumanSpecies('x', serve(oneSided))).rejects.toThrow();
  });

  it('the real file loads, with every species the finds can be of', async () => {
    const data = await loadHumanSpecies('species.json', serve(real));
    expect(data.species.map((species) => species.id).sort()).toEqual([...HUMAN_SPECIES].sort());
  });
});
