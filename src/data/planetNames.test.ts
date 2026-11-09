import { describe, expect, it } from 'vitest';

import data from '../../public/data/planet-names.json';

import { NAME_MIN_PIXELS, isNamedBody, largeEnough, loadPlaceNames } from './planetNames';

const file = JSON.stringify(data);
const serve = (body: string) => () => Promise.resolve(new Response(body));

describe('the place names on the rocky bodies', () => {
  it('Given the file the pipeline wrote, Then each body’s names come largest first, Mars’s landmarks among them', async () => {
    const names = await loadPlaceNames('planet-names.json', serve(file));
    for (const body of ['mercury', 'venus', 'moon', 'mars'] as const) {
      const kms = names[body].map(({ km }) => km);
      expect(kms).toEqual([...kms].sort((a, b) => b - a));
    }
    const hellas = names.mars.find(({ name }) => name === 'Hellas Planitia');
    expect(hellas?.kind).toBe('plain');
    expect(hellas?.point.latitude).toBeCloseTo(-42.4, 1);
    expect(names.mars.map(({ name }) => name)).toEqual(
      expect.arrayContaining(['Olympus Mons', 'Valles Marineris', 'Tharsis Montes', 'Gale']),
    );
    expect(names.moon.map(({ name }) => name)).toEqual(
      expect.arrayContaining(['Mare Tranquillitatis', 'Tycho', 'Copernicus']),
    );
    expect(names.venus.map(({ name }) => name)).toContain('Maxwell Montes');
    expect(names.mercury.map(({ name }) => name)).toContain('Caloris Planitia');
  });

  it('Given a latitude past the pole, Then the file is refused', async () => {
    const bad = JSON.parse(file) as { names: { mars: [string, number][] } };
    const first = bad.names.mars[0];
    if (first !== undefined) first[1] = 91;
    await expect(loadPlaceNames('planet-names.json', serve(JSON.stringify(bad)))).rejects.toThrow();
  });

  it('Given a feature, Then it is named once it spans enough of the screen', () => {
    // A 600 km feature on Mars (3,396 km) drawn 200 px across its radius spans about 35 px.
    expect(largeEnough(600, 3396, 200)).toBe(false);
    // Zoomed in to 300 px it spans 53.
    expect(largeEnough(600, 3396, 300)).toBe(true);
    expect(largeEnough(NAME_MIN_PIXELS, 1, 1)).toBe(true);
  });

  it('Given a body, Then only the rocky four have names', () => {
    expect(isNamedBody('mars')).toBe(true);
    expect(isNamedBody('jupiter')).toBe(false);
  });
});
