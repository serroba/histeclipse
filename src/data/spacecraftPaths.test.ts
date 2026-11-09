import { beforeAll, describe, expect, it } from 'vitest';

import paths from '../../public/data/spacecraft-paths.json';
import record from '../../public/data/spacecraft.json';

import { craftAt, loadSpacecraftPaths, type PathPiece } from './spacecraftPaths';

const serve = (body: string) => () => Promise.resolve(new Response(body));
const JD_BASE = 2_400_000;

/** A path: about the Sun from day 100 to 110 (since JD 2400000), then at Saturn. */
const PIECES: readonly PathPiece[] = [
  {
    centre: 'Sun',
    points: [
      [100, 0, 0, 0],
      [104, 400, 0, 0],
      [110, 400, 600, 0],
    ],
  },
  // Midnight of 1858-12-02 is JD 2400015.5 (MJD 15), of 1859-01-01 JD 2400045.5.
  { at: 'Saturn', from: '1858-12-02', to: '1859-01-01' },
];

describe('where a craft is, along the path Horizons gives', () => {
  it('Given a moment between two kept points, Then the craft is that share of the way along', () => {
    expect(craftAt(PIECES, JD_BASE + 102)).toEqual({ centre: 'Sun', km: [200, 0, 0] });
    expect(craftAt(PIECES, JD_BASE + 107)).toEqual({ centre: 'Sun', km: [400, 300, 0] });
  });

  it('Given a moment on a kept point, Then it is there', () => {
    expect(craftAt(PIECES, JD_BASE + 110)).toEqual({ centre: 'Sun', km: [400, 600, 0] });
  });

  it('Given a moment of a long stay, Then the craft is at that world', () => {
    expect(craftAt(PIECES, JD_BASE + 30)).toEqual({ at: 'Saturn' });
    expect(craftAt(PIECES, JD_BASE + 15)).toBeNull();
  });

  it('Given a moment outside its path, Then it is nowhere the path says', () => {
    expect(craftAt(PIECES, JD_BASE + 50)).toBeNull();
    expect(craftAt(PIECES, JD_BASE + 120)).toBeNull();
  });

  it('Given a file of paths, Then it is read; a malformed one refused', async () => {
    const good = {
      schemaVersion: 1,
      source: 'https://ssd.jpl.nasa.gov/horizons/',
      paths: { D1: PIECES },
    };
    expect(await loadSpacecraftPaths('p.json', serve(JSON.stringify(good)))).toEqual({
      D1: PIECES,
    });
    const bad = { ...good, paths: { D1: [{ centre: 'Moon', points: [[1, 2, 3, 4]] }] } };
    await expect(loadSpacecraftPaths('p.json', serve(JSON.stringify(bad)))).rejects.toThrow();
  });
});

describe('the paths Horizons gives, as the pipeline kept them', () => {
  let all: Readonly<Record<string, readonly PathPiece[]>> = {};
  beforeAll(async () => {
    all = await loadSpacecraftPaths('spacecraft-paths.json', serve(JSON.stringify(paths)));
  });
  const idOf = (name: string) => record.craft.find((craft) => craft.name === name)?.id ?? '';
  const AU = 149_597_870.7;

  it('Given Voyager 1 on 14 February 1990, the day it took the Pale Blue Dot, Then it is some 40 AU from the Sun', () => {
    const where = craftAt(all[idOf('Voyager 1')] ?? [], 2_447_936.5);
    expect(where !== null && 'km' in where ? where.centre : null).toBe('Sun');
    const distance = where !== null && 'km' in where ? Math.hypot(...where.km) / AU : 0;
    expect(distance).toBeGreaterThan(39);
    expect(distance).toBeLessThan(42);
  });

  it('Given Cassini in 2010, Then it is in orbit at Saturn', () => {
    expect(craftAt(all[idOf('Cassini')] ?? [], 2_455_197.5)).toEqual({ at: 'Saturn' });
  });

  it('Given Artemis I on its way, Then it is about Earth, beyond the Moon’s distance at its farthest', () => {
    const pieces = all[idOf('Artemis I')] ?? [];
    expect(pieces.length).toBeGreaterThan(0);
    const farthest = Math.max(
      ...pieces.flatMap((piece) =>
        'points' in piece ? piece.points.map(([, x, y, z]) => Math.hypot(x, y, z)) : [],
      ),
    );
    expect(farthest).toBeGreaterThan(400_000);
  });
});
