import { describe, expect, it } from 'vitest';

import file from '../../public/data/enso-composites/index.json';
import {
  compositeColours,
  compositeFor,
  compositeOf,
  compositeText,
  loadEnsoComposites,
  pickOptions,
  scaleEnds,
  type EnsoComposites,
} from './ensoComposites';

const data = file as unknown as EnsoComposites;
const upper = (id: string): string => id.toUpperCase();

describe('El Niño and La Niña composites', () => {
  it('Given the published file, Then it reads: rain and temperature, by both indices', async () => {
    const read = await loadEnsoComposites('/c.json', () =>
      Promise.resolve(new Response(JSON.stringify(file))),
    );
    expect(read.variables.map(({ id }) => id)).toEqual(['rain', 'temperature']);
    expect(read.maps).toHaveLength(16);
    expect(new Set(read.maps.map(({ index }) => index))).toEqual(new Set(['roni', 'oni']));
  });

  it('Given a pick, Then its map by an index, named in words; every pick listed', () => {
    const pick = { variable: 'rain', phase: 'elNino', season: 'djf' } as const;
    expect(compositeFor(data, pick, 'roni')?.file).toBe('rain-roni-elNino-djf.png');
    expect(compositeFor(data, pick, 'nope')).toBeNull();
    const listed = pickOptions(data);
    expect(listed[0]).toEqual({ pick, label: 'Rain, El Niño, December–February' });
    expect(listed).toHaveLength(8);
    expect(listed[7]?.pick).toEqual({ variable: 'temperature', phase: 'laNina', season: 'jja' });
  });

  it('Given a map, Then how many seasons, which, how much is significant, and how the other index differs', () => {
    const map = compositeFor(
      data,
      { variable: 'temperature', phase: 'elNino', season: 'djf' },
      'roni',
    );
    expect(map).not.toBeNull();
    if (map === null) return;
    const said = compositeText(data, map, upper);
    expect(said).toMatch(
      /^Temperature in El Niño’s December–February, by RONI: the mean of \d+ seasons \(\d{4}, .*\), each place against its own trend\. \d+% of it is significant at 10%; the rest is faded\. ONI names \d+, /,
    );
  });

  it('Given few or no seasons, or the same ones, Then it says so', () => {
    const base = data.maps[0];
    if (base === undefined) return;
    const one: EnsoComposites = {
      ...data,
      variables: [],
      maps: [
        { ...base, index: 'a', seasons: 1, years: [1990], significantShare: null },
        { ...base, index: 'b', seasons: 1, years: [1990] },
      ],
    };
    const [first, second] = one.maps;
    if (first === undefined || second === undefined) return;
    expect(compositeText(one, first, upper)).toBe(
      'rain in El Niño’s December–February, by A: the mean of 1 season (1990), each place against its own trend. B names 1, the same ones.',
    );
    expect(compositeText(one, { ...first, seasons: 0, years: [] }, upper)).toBe(
      'rain in El Niño’s December–February, by A: no such season in the years used.',
    );
    expect(compositeText(one, { ...first, seasons: 4, years: [1, 2, 3, 4] }, upper)).toContain(
      '(1, 2, 3, 4)',
    );
  });

  it('Given packed pixels, Then coloured by sign on the variable’s own scale, faded where not significant, none without data', () => {
    expect(compositeOf(0, 2)).toBe(-2);
    expect(compositeOf(255, 2)).toBe(2);
    const packed = new Uint8ClampedArray([0, 128, 255, 255, 255, 128, 0, 255, 128, 128, 255, 0]);
    const rain = compositeColours(packed, 2, 'rain');
    expect([...rain.slice(0, 3)]).toEqual([...scaleEnds('rain')[0]]);
    expect(rain[3]).toBeGreaterThan(228);
    expect([...rain.slice(4, 7)]).toEqual([...scaleEnds('rain')[1]]);
    expect(rain[7]).toBe(80);
    expect([...rain.slice(8)]).toEqual([0, 0, 0, 0]);
    const warm = compositeColours(packed, 2, 'temperature');
    expect([...warm.slice(4, 7)]).toEqual([...scaleEnds('temperature')[1]]);
  });
});
