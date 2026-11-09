import { describe, expect, it } from 'vitest';

import data from '../../public/data/planet-keys.json';

import { keyGradient, keyRange, keyTicks, loadColourKeys, type ColourKey } from './planetKeys';

const file = JSON.stringify(data);
const serve = (body: string) => () => Promise.resolve(new Response(body));

function stops(...kms: number[]): ColourKey {
  return {
    datum: 'above',
    credit: 'measured',
    source: 'https://pds',
    stops: kms.map((km) => [km, '#000000']),
  };
}

describe('the height views’ colour keys', () => {
  it('Given the file the pipeline wrote, Then Mars runs from Hellas’s depths to Olympus Mons, the Moon and Venus each over theirs', async () => {
    const { heights: keys } = await loadColourKeys('planet-keys.json', serve(file));
    expect(keyRange(keys.mars)).toEqual([-7.5, 20.5]);
    expect(keyRange(keys.moon)).toEqual([-7.5, 8.5]);
    expect(keyRange(keys.venus)).toEqual([-3, 11]);
    expect(keys.venus.credit).toContain('USGS');
  });

  it('Given the file, Then the enhanced-colour maps are keyed by kinds of rock, each at a named place', async () => {
    const { rocks } = await loadColourKeys('planet-keys.json', serve(file));
    expect(rocks.moon.swatches.map(({ place }) => place)).toContain('Mare Tranquillitatis');
    expect(rocks.mercury.swatches.map(({ kind }) => kind)).toContain('Smooth volcanic plains');
  });

  it('Given heights out of order, Then the file is refused', async () => {
    const bad = JSON.parse(file) as { keys: { mars: { stops: unknown[] } } };
    bad.keys.mars.stops.reverse();
    await expect(loadColourKeys('planet-keys.json', serve(JSON.stringify(bad)))).rejects.toThrow(
      'heights rise',
    );
  });

  it('Given a key, Then its gradient puts each colour at its share of the range', () => {
    expect(
      keyGradient({
        ...stops(-2, 0, 8),
        stops: [
          [-2, '#000000'],
          [0, '#ff0000'],
          [8, '#ffffff'],
        ],
      }),
    ).toBe('linear-gradient(to right, #000000 0%, #ff0000 20%, #ffffff 100%)');
  });

  it('Given ranges small and large, Then the labels are round heights, at most seven', () => {
    expect(keyTicks(stops(-7.5, 20.5)).map(({ km }) => km)).toEqual([-4, 0, 4, 8, 12, 16, 20]);
    expect(keyTicks(stops(-7.5, 8.5)).map(({ km }) => km)).toEqual([-4, 0, 4, 8]);
    expect(keyTicks(stops(-3, 11)).map(({ km }) => km)).toEqual([-2, 0, 2, 4, 6, 8, 10]);
    expect(keyTicks(stops(-1.5, 1.5)).map(({ km }) => km)).toEqual([-1, 0, 1]);
    // Past 70 km even 10 km steps are too many; they are kept all the same.
    expect(keyTicks(stops(0, 100))).toHaveLength(11);
    expect(keyTicks(stops(-7.5, 8.5)).map(({ label }) => label)).toEqual([
      '−4',
      '0',
      '+4',
      '+8 km',
    ]);
    const [first] = keyTicks(stops(-7.5, 20.5));
    expect(first?.at).toBeCloseTo(3.5 / 28);
  });
});
