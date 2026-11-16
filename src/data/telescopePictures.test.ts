import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import served from '../../public/data/telescope-pictures.json' with { type: 'json' };
import record from '../../public/data/spacecraft.json' with { type: 'json' };
import type { Fetch } from '../util/fetchJson';
import { loadTelescopePictures, picturesOf } from './telescopePictures';

const serve =
  (body: unknown): Fetch =>
  () =>
    Promise.resolve(Response.json(body));

describe('telescope-pictures.json', () => {
  it('gives each telescope, a craft in the record, pictures with a credit, a licence and their files', async () => {
    const all = await loadTelescopePictures('/data/telescope-pictures.json', serve(served));
    const ids = Object.keys(all.telescopes);
    expect(ids).toContain('D01093');
    for (const [id, telescope] of Object.entries(all.telescopes)) {
      expect(record.craft.some((craft) => craft.id === id)).toBe(true);
      expect(telescope.licence).toBe('CC BY 4.0');
      expect(telescope.licenceUrl).toBe('https://creativecommons.org/licenses/by/4.0/');
      expect(telescope.pictures.length).toBeGreaterThanOrEqual(6);
      for (const picture of telescope.pictures) {
        expect(picture.credit.length).toBeGreaterThan(3);
        expect(picture.page).toMatch(/^https:\/\/esa(webb|hubble)\.org\/images\//);
        expect(existsSync(`public/${picture.thumb}`)).toBe(true);
        expect(existsSync(`public/${picture.large}`)).toBe(true);
      }
    }
  });

  it('is refused without a licence, or with a picture from another host', async () => {
    const webb = served.telescopes.D01093;
    const unlicensed = { ...served, telescopes: { D01093: { ...webb, licence: '' } } };
    await expect(loadTelescopePictures('/x', serve(unlicensed))).rejects.toThrow();
    const [first] = webb.pictures;
    const elsewhere = {
      ...served,
      telescopes: {
        D01093: { ...webb, pictures: [{ ...first, thumb: 'https://example.org/a.webp' }] },
      },
    };
    await expect(loadTelescopePictures('/x', serve(elsewhere))).rejects.toThrow();
  });
});

describe('a craft’s pictures', () => {
  it('are its telescope’s, each file from the site’s base, its date as written; none for another craft or before they load', async () => {
    const all = await loadTelescopePictures('/x', serve(served));
    const webb = picturesOf(all, 'D01093', '/histeclipse/');
    expect(webb?.heading).toBe('Pictures it took');
    expect(webb?.source).toBe('ESA/Webb');
    expect(webb?.pictures[0]).toMatchObject({
      title: 'Webb’s First Deep Field',
      released: '12 July 2022',
      thumb: '/histeclipse/pictures/webb/weic2209a-thumb.webp',
      large: '/histeclipse/pictures/webb/weic2209a.webp',
    });
    expect(picturesOf(all, 'D00273', '/')).toBeUndefined();
    expect(picturesOf(null, 'D01093', '/')).toBeUndefined();
  });
});
