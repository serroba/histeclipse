import { describe, expect, it } from 'vitest';

import type { Territory } from '../../data/empires';
import { statesFacts, statesHere, type StatesInput } from './here';

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

const base: StatesInput = {
  place: here,
  yearText: '500 BCE',
  states: null,
};

describe('the states at a place', () => {
  it('finds the states drawn over a place', () => {
    expect(statesHere([persia, egypt], here).map(({ name }) => name)).toEqual([
      'Achaemenid Empire',
    ]);
    expect(statesHere([persia, egypt], { latitude: 0, longitude: 0 })).toEqual([]);
  });

  it('names the state Cliopatria draws here, with its Wikipedia page', () => {
    const [fact] = statesFacts({
      ...base,
      states: { source: 'cliopatria', territories: [persia, egypt], asOf: null },
    });
    expect(fact?.text).toBe('Cliopatria draws Achaemenid Empire here in 500 BCE.');
    expect(fact?.why).toBe('empires-cliopatria');
    expect(fact?.link?.href).toBe('https://en.wikipedia.org/wiki/Achaemenid_Empire');
  });

  it('says land with no state drawn was not empty', () => {
    const [fact] = statesFacts({
      ...base,
      place: { latitude: 0, longitude: 0 },
      states: { source: 'cliopatria', territories: [persia], asOf: null },
    });
    expect(fact?.text).toMatch(/no state here in 500 BCE.*not empty/);
    expect(fact?.link).toBeUndefined();
  });

  it('says OpenHistoricalMap’s borders cannot be looked up by point, and with both, says each', () => {
    const facts = statesFacts({
      ...base,
      states: { source: 'both', territories: [persia], asOf: '2024 CE' },
    });
    expect(facts.map(({ why }) => why)).toEqual(['empires-cliopatria', 'empires-ohm']);
    expect(facts[0]?.text).toContain('in 2024 CE');
    expect(facts[1]?.text).toContain('lines and names, not areas');
  });

  it('says when the borders are still loading', () => {
    const [fact] = statesFacts({
      ...base,
      states: { source: 'cliopatria', territories: null, asOf: null },
    });
    expect(fact?.text).toBe('Cliopatria’s borders are loading.');
  });

  it('says nothing for layers that are off', () => {
    expect(statesFacts(base)).toEqual([]);
  });
});
