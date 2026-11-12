import { describe, expect, it } from 'vitest';

import type { Territory } from '../../data/empires';
import type { RockUnit } from '../../data/rocks';
import type { WaysAt } from '../../data/waysOfLife';
import { hereFacts, placeText, statesHere, type HereInput } from './here';

/** A square of `size` degrees round a point. */
function square(longitude: number, latitude: number, size = 2): [number, number][] {
  return [
    [longitude - size, latitude - size],
    [longitude + size, latitude - size],
    [longitude + size, latitude + size],
    [longitude - size, latitude + size],
  ];
}

const persia: Territory = {
  name: 'Achaemenid Empire',
  wikipedia: 'Achaemenid Empire',
  rings: [square(52, 32)],
};
const egypt: Territory = { name: 'Egypt', wikipedia: '', rings: [square(31, 27)] };
const here = { latitude: 32.5, longitude: 51.7 };

const base: HereInput = {
  place: here,
  yearText: '500 BCE',
  states: null,
  ways: null,
  rock: undefined,
};

describe('why here', () => {
  it('says a place in degrees', () => {
    expect(placeText({ latitude: 36.36, longitude: -43.15 })).toBe('36.4°N 43.1°W');
    expect(placeText({ latitude: -12, longitude: 130 })).toBe('12.0°S 130.0°E');
  });

  it('finds the states drawn over a place', () => {
    expect(statesHere([persia, egypt], here).map(({ name }) => name)).toEqual([
      'Achaemenid Empire',
    ]);
    expect(statesHere([persia, egypt], { latitude: 0, longitude: 0 })).toEqual([]);
  });

  it('names the state Cliopatria draws here, with its Wikipedia page', () => {
    const [fact] = hereFacts({
      ...base,
      states: { source: 'cliopatria', territories: [persia, egypt], asOf: null },
    });
    expect(fact?.text).toBe('Cliopatria draws Achaemenid Empire here in 500 BCE.');
    expect(fact?.why).toBe('empires-cliopatria');
    expect(fact?.link?.href).toBe('https://en.wikipedia.org/wiki/Achaemenid_Empire');
  });

  it('says land with no state drawn was not empty', () => {
    const [fact] = hereFacts({
      ...base,
      place: { latitude: 0, longitude: 0 },
      states: { source: 'cliopatria', territories: [persia], asOf: null },
    });
    expect(fact?.text).toMatch(/no state here in 500 BCE.*not empty/);
    expect(fact?.link).toBeUndefined();
  });

  it('says OpenHistoricalMap’s borders cannot be looked up by point, and with both, says each', () => {
    const facts = hereFacts({
      ...base,
      states: { source: 'both', territories: [persia], asOf: '2024 CE' },
    });
    expect(facts.map(({ why }) => why)).toEqual(['empires-cliopatria', 'empires-ohm']);
    expect(facts[0]?.text).toContain('in 2024 CE');
    expect(facts[1]?.text).toContain('lines and names, not areas');
  });

  it('gives the ways of life rated here, and the rock beneath', () => {
    const at: WaysAt = {
      year: -550,
      counts: { foraging: 0, pastoralism: 0, extensive: 1, intensive: 0, urban: 0, mixed: 0 },
      regions: [
        {
          name: 'Iranian Plateau',
          rings: [square(52, 32)],
          way: 'extensive',
          ways: ['extensive'],
          level: 3,
        },
      ],
    };
    const rock: RockUnit = {
      name: 'Cenozoic sediments',
      lith: 'sedimentary rocks',
      topMa: 0,
      bottomMa: 66,
      colour: '#fff',
      rings: [],
    };
    const facts = hereFacts({ ...base, ways: { at, momentText: '550 BCE' }, rock });
    expect(facts.map(({ title }) => title)).toEqual(['Ways of life', 'Rocks']);
    expect(facts[0]?.text).toBe(
      'Iranian Plateau: farming, widespread, as archaeologists rated it for 550 BCE.',
    );
    expect(facts[1]?.text).toBe(
      'Cenozoic sediments: sedimentary rocks, from 66 to 0 million years ago.',
    );
  });

  it('says when nothing is rated or mapped here', () => {
    const at: WaysAt = {
      year: -550,
      counts: { foraging: 0, pastoralism: 0, extensive: 0, intensive: 0, urban: 0, mixed: 0 },
      regions: [],
    };
    const facts = hereFacts({ ...base, ways: { at, momentText: '550 BCE' }, rock: null });
    expect(facts[0]?.text).toContain('rates no region here');
    expect(facts[1]?.text).toContain('No map unit');
  });

  it('says when the borders are still loading', () => {
    const [fact] = hereFacts({
      ...base,
      states: { source: 'cliopatria', territories: null, asOf: null },
    });
    expect(fact?.text).toBe('Cliopatria’s borders are loading.');
  });

  it('says nothing for layers that are off', () => {
    expect(hereFacts(base)).toEqual([]);
  });
});
