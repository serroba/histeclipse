import { describe, expect, it } from 'vitest';

import data from '../../public/data/spacecraft.json';
import { craftCard, writtenDate } from './craftCard';
import { loadSpacecraft } from './spacecraft';

const serve = (body: string) => () => Promise.resolve(new Response(body));
const record = await loadSpacecraft('spacecraft.json', serve(JSON.stringify(data)));
const named = (name: string) => {
  const found = record.craft.find((craft) => craft.name === name);
  if (found === undefined) throw new Error(`no ${name}`);
  return found;
};

describe('a craft’s card', () => {
  it('Given GCAT dates, Then they are written in words, "about" where unsure', () => {
    expect(writtenDate('1977-08-20T13:29')).toBe('20 August 1977');
    expect(writtenDate('1979-05?')).toBe('about May 1979');
    expect(writtenDate('1979')).toBe('1979');
  });

  it('Given Voyager 2, Then its card says when it set out, whose, where it went, and that its path is as flown', () => {
    const card = craftCard(named('Voyager 2'), false);
    expect(card.title).toBe('Voyager 2');
    const facts = Object.fromEntries(card.facts);
    expect(facts['Set out']).toBe('20 August 1977');
    expect(facts['Whose']).toBe('United States (JPL)');
    expect(facts['Went to']).toBe('Jupiter, Saturn, Uranus and Neptune');
    expect(facts['Path']).toBe('As flown, from JPL Horizons');
    expect(card.links[0]?.href).toContain('id=1977-076A');
    expect(card.note).toContain('GCAT, Jonathan McDowell');
  });

  it('Given Apollo 11’s lander, Then its card names the mission, the craft, where it came down, and the path as approximate', () => {
    const eagle = record.craft.find(
      (craft) => craft.name === 'Eagle' && craft.mission === 'Apollo 11',
    );
    if (eagle === undefined) throw new Error('no Eagle');
    const card = craftCard(eagle, true);
    expect(card.title).toBe('Apollo 11');
    const facts = Object.fromEntries(card.facts);
    expect(facts['Craft']).toBe('Eagle');
    expect(facts['Came down']).toContain('on the Moon');
    expect(facts['Crew']).toBe('Crewed');
    expect(facts['Path']).toMatch(/^Approximate/);
  });

  it('Given a Soviet probe, Then whose it was is in words', () => {
    const luna = record.craft.find((craft) => craft.state === 'SU');
    expect(
      luna === undefined ? '' : Object.fromEntries(craftCard(luna, true).facts)['Whose'],
    ).toMatch(/^Soviet Union/);
  });

  it('Given a craft of an unknown country, with no mission or destination, that came down unnamed, Then the card says what it can', () => {
    const card = craftCard(
      {
        id: 'D9',
        name: 'Test craft',
        cospar: '2030-001A',
        nssdc: null,
        launchTag: '2030-001',
        launch: '2030-01-01',
        owner: 'ABC',
        state: 'XX',
        crewed: false,
        part: false,
        parent: null,
        phases: [['Earth', '2030-01-01', null, 'O', '-']],
        landing: { world: 'Mars', lat: null, lon: null, date: null, site: '-' },
      },
      true,
    );
    expect(card.title).toBe('Test craft');
    const facts = Object.fromEntries(card.facts);
    expect(facts['Whose']).toBe('XX (ABC)');
    expect(facts['Went to']).toBeUndefined();
    expect(facts['Came down']).toBe('on Mars');
    // Nor a page at NSSDCA, which has none for it.
    expect(card.links).toEqual([]);
  });

  it('Given craft GCAT designates the old way or not at all, Then each links NSSDCA’s page under its own designation or its carrier’s', () => {
    const page = (name: string) => craftCard(named(name), true).links[0]?.href ?? '';
    // Luna 1, "1959 MU 1" to GCAT; and Pragyan, which Chandrayaan-3 carried.
    expect(page('AMS Luna-1')).toMatch(/id=1959-012A$/);
    expect(
      craftCard(
        record.craft.find((craft) => craft.name === 'Pragyan' && craft.launchTag === '2023-098') ??
          named('none'),
        true,
      ).links[0]?.href,
    ).toMatch(/id=2023-098C$/);
    // Peregrine, under NSSDCA's own name for it.
    expect(page('Peregrine Mission One')).toMatch(/id=PEREGRN-1$/);
  });
});
