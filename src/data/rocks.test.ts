import { describe, expect, it } from 'vitest';

import data from '../../public/data/rocks.json';
import { loadRocks, rockAt, rockText, rockUnits, type Rocks } from './rocks';

const serve = (body: unknown) => (): Promise<Response> => Promise.resolve(Response.json(body));

const small: Rocks = {
  schemaVersion: 1,
  credit: 'Macrostrat',
  source: 'https://macrostrat.org',
  accessed: '2026-11-03',
  scale: 100,
  units: [
    {
      name: 'Ordovician sedimentary',
      lith: 'sedimentary',
      topMa: 470,
      bottomMa: 485.4,
      colour: '#1A9D6F',
      // A square from 10° to 20°, with a hole from 14° to 16°.
      rings: [
        [1000, 1000, 2000, 1000, 2000, 2000, 1000, 2000],
        [1400, 1400, 1600, 1400, 1600, 1600, 1400, 1600],
      ],
    },
    {
      name: 'Across the date line',
      lith: 'volcanic',
      topMa: 1,
      bottomMa: 2,
      colour: '#FFFF00',
      rings: [[17_000, 0, 19_000, 0, 19_000, 500, 17_000, 500]],
    },
  ],
};

describe('rocks', () => {
  it('load and check, the real file too', async () => {
    const loaded = await loadRocks('rocks.json', serve(data));
    expect(loaded.units.length).toBeGreaterThan(1000);
    await expect(loadRocks('x', serve({ ...small, scale: 0 }))).rejects.toThrow();
  });

  it('find the unit at a place, minding holes and the date line', () => {
    const units = rockUnits(small);
    expect(rockAt(units, { latitude: 12, longitude: 12 })?.name).toBe('Ordovician sedimentary');
    expect(rockAt(units, { latitude: 15, longitude: 15 })).toBeNull();
    expect(rockAt(units, { latitude: 2, longitude: -175 })?.name).toBe('Across the date line');
    expect(rockAt(units, { latitude: -50, longitude: 0 })).toBeNull();
  });

  it('say what the rock is and when it formed', () => {
    const units = rockUnits(small);
    expect(rockText(rockAt(units, { latitude: 12, longitude: 12 }))).toBe(
      'At the place picked: Ordovician sedimentary, formed 485.4–470 million years ago.',
    );
    expect(rockText(rockAt(units, { latitude: 2, longitude: 179 }))).toBe(
      'At the place picked: Across the date line (volcanic), formed 2–1 million years ago.',
    );
    expect(rockText(null)).toContain('this map has none there');
  });

  it('find old shield rock in northern Canada in the real map', async () => {
    const units = rockUnits(await loadRocks('rocks.json', serve(data)));
    const shield = rockAt(units, { latitude: 60, longitude: -100 });
    expect(shield?.bottomMa).toBeGreaterThan(1000);
  });
});
