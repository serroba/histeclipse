import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  endYear,
  loadTelescopes,
  stateIn,
  yearOf,
  type Telescope,
  type Telescopes,
} from './telescopes';

const raw: unknown = JSON.parse(readFileSync('public/data/telescopes.json', 'utf8'));
const serve = (body: unknown) => () => Promise.resolve(new Response(JSON.stringify(body)));
const loaded: Telescopes = await loadTelescopes('telescopes.json', serve(raw));
const telescopes: readonly Telescope[] = loaded.telescopes;
const named = (id: string): Telescope => {
  const found = telescopes.find((telescope) => telescope.id === id);
  if (found === undefined) throw new Error(`no ${id}`);
  return found;
};

describe('the telescopes (#847)', () => {
  it('holds about forty, some in space and some on the ground', () => {
    expect(telescopes.length).toBeGreaterThanOrEqual(35);
    expect(telescopes.length).toBeLessThanOrEqual(45);
    expect(telescopes.filter((t) => t.kind === 'space').length).toBeGreaterThanOrEqual(15);
    expect(telescopes.filter((t) => t.kind === 'ground').length).toBeGreaterThanOrEqual(15);
  });

  it('gives each its sources and a link to its operator', () => {
    for (const telescope of telescopes) {
      expect(telescope.sources.length).toBeGreaterThan(0);
      expect(telescope.links.length).toBeGreaterThan(0);
    }
  });

  it('places each ground telescope at its site, and each space one on its kind of orbit', () => {
    const vlt = named('vlt');
    const webb = named('webb');
    const hubble = named('hubble');
    expect(vlt.kind === 'ground' ? vlt.site.latitude : null).toBeCloseTo(-24.63, 1);
    expect(webb.kind === 'space' ? webb.orbit : null).toBe('L2');
    expect(hubble.kind === 'space' ? hubble.craft : null).toBe('s20580');
  });

  it('begins each before it ends', () => {
    for (const telescope of telescopes) {
      expect(endYear(telescope) ?? Infinity).toBeGreaterThanOrEqual(yearOf(telescope.from));
    }
    expect(endYear(named('arecibo'))).toBe(2020);
    expect(endYear(named('webb'))).toBeNull();
  });
});

describe('a telescope in a given year', () => {
  it('is working from first light to its end, inclusive', () => {
    const arecibo = named('arecibo');
    expect(stateIn(arecibo, 1962)).toBeNull();
    expect(stateIn(arecibo, 1963)).toBe('working');
    expect(stateIn(arecibo, 2020)).toBe('working');
    expect(stateIn(arecibo, 2021)).toBeNull();
    expect(stateIn(named('webb'), 2030)).toBe('working');
  });

  it('is being built, once its building began, until it works', () => {
    const elt = named('elt');
    expect(stateIn(elt, 2010)).toBeNull();
    expect(stateIn(elt, 2026)).toBe('building');
  });
});

describe('the file, checked as it is read', () => {
  const good = raw as { schemaVersion: 1; telescopes: Record<string, unknown>[] };
  const refused = (file: unknown): Promise<unknown> => loadTelescopes('t.json', serve(file));

  it('refuses two telescopes with one id, or one that ends before it began', async () => {
    const [first] = good.telescopes;
    await expect(refused({ ...good, telescopes: [first, first] })).rejects.toThrow('unique');
    await expect(
      refused({ ...good, telescopes: [{ ...first, from: '2000', until: '1990' }] }),
    ).rejects.toThrow('end after');
  });

  it('refuses a ground telescope without a place, or a link that is not https', async () => {
    const ground = good.telescopes.find((t) => t['kind'] === 'ground');
    await expect(
      refused({ ...good, telescopes: [{ ...ground, site: undefined }] }),
    ).rejects.toThrow();
    await expect(
      refused({ ...good, telescopes: [{ ...ground, links: [{ label: 'x', href: 'http://x' }] }] }),
    ).rejects.toThrow();
  });
});
