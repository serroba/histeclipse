import { describe, expect, it } from 'vitest';

import served from '../../public/data/sky.json';
import type { Fetch } from './fetchJson';
import { loadSky, type Sky } from './sky';

const serve =
  (body: unknown): Fetch =>
  () =>
    Promise.resolve(Response.json(body));

const sky = await loadSky('/data/sky.json', serve(served));

function starIndex(hr: number): number {
  return sky.stars.hr.indexOf(hr);
}

describe('sky.json', () => {
  it('holds every naked-eye star of the Bright Star Catalogue', () => {
    expect(sky.stars.hr).toHaveLength(9096);
    expect(Math.max(...sky.stars.vmag)).toBeLessThan(8);
    // Sirius, the brightest star in the night sky.
    expect(Math.min(...sky.stars.vmag)).toBe(sky.stars.vmag[starIndex(2491)]);
  });

  it('names all 88 IAU constellations (Serpens in two parts)', () => {
    expect(sky.constellations).toHaveLength(89);
    const famous = sky.constellations.filter((figure) => figure.rank === 1).map(({ id }) => id);
    expect(famous).toEqual(expect.arrayContaining(['Ori', 'UMa', 'Sco', 'Cas', 'Cyg', 'Leo']));
  });

  it('draws Orion through Betelgeuse, Bellatrix and the belt', () => {
    const orion = sky.constellations.find((figure) => figure.id === 'Ori');
    const hrs = new Set(orion?.lines.flat().map((index) => sky.stars.hr[index]));
    // Betelgeuse, Bellatrix, Rigel, and Alnitak, Alnilam, Mintaka.
    for (const hr of [2061, 1790, 1713, 1948, 1903, 1852]) expect(hrs).toContain(hr);
  });
});

describe('loadSky', () => {
  const tiny: Sky = {
    schemaVersion: 1,
    sources: 'test',
    epoch: 2000,
    stars: {
      hr: [1],
      ra: [10],
      dec: [20],
      pmRa: [0],
      pmDec: [0],
      parallax: [null],
      radialVelocity: [null],
      vmag: [5],
      bv: [null],
    },
    constellations: [{ id: 'Ori', name: 'Orion', rank: 1, label: [84, 13], lines: [[0]] }],
  };

  it('accepts a well-formed file', async () => {
    await expect(loadSky('/sky.json', serve(tiny))).resolves.toEqual(tiny);
  });

  it('rejects columns of different lengths', async () => {
    const broken = { ...tiny, stars: { ...tiny.stars, vmag: [5, 6] } };
    await expect(loadSky('/sky.json', serve(broken))).rejects.toThrow('same length');
  });

  it('rejects figures that point past the catalogue', async () => {
    const broken = { ...tiny, constellations: [{ ...tiny.constellations[0], lines: [[1]] }] };
    await expect(loadSky('/sky.json', serve(broken))).rejects.toThrow('stars in the catalogue');
  });
});
