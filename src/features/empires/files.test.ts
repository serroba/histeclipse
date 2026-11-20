import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import { centuryFile, createBorderFiles, createStatesNote } from './files';

/** The site's own files, by URL; counts what was fetched. */
function served() {
  return vi.fn(async (url: string) => new Response(await readFile(`public${url}`, 'utf8')));
}

describe('Cliopatria’s border files', () => {
  it('loads the index and a century’s file once, however often it is asked', async () => {
    const fetchJson = served();
    const files = createBorderFiles('/', fetchJson);
    const first = await files.centuryFor(-500);
    const again = await files.centuryFor(-480);
    expect(first).not.toBeNull();
    expect(again).toBe(first);
    expect(fetchJson).toHaveBeenCalledTimes(2);
    expect(fetchJson).toHaveBeenCalledWith('/data/empires/index.json');
  });

  it('gives a state’s territory in a year, prepared once, and none for a state not there', async () => {
    const files = createBorderFiles('/', served());
    const file = await files.centuryFor(-500);
    const polity = file?.polities.find(({ from, to }) => from <= -500 && -500 <= to);
    if (polity === undefined) throw new Error('no state in 500 BCE');
    const territory = await files.territoryOf(polity.name, -500);
    expect(territory?.name).toBe(polity.name);
    expect(territory?.rings.length).toBeGreaterThan(0);
    expect(await files.territoryOf(polity.name, -500)).toBe(territory);
    expect(await files.territoryOf('No such state', -500)).toBeNull();
  });

  it('carries today’s years back to the last year the borders reach', async () => {
    const files = createBorderFiles('/', served());
    expect(await files.centuryFor(2026)).not.toBeNull();
  });
});

describe('a century’s file', () => {
  it('is kept once loaded, and asked for again after a failure', async () => {
    const cache = new Map<number, Promise<string>>();
    const load = vi.fn(() => Promise.resolve('file'));
    await centuryFile(cache, 100, load);
    await centuryFile(cache, 100, load);
    expect(load).toHaveBeenCalledTimes(1);
    const failing = vi.fn(() => Promise.reject(new Error('offline')));
    await expect(centuryFile(cache, 200, failing)).rejects.toThrow('offline');
    await expect(centuryFile(cache, 200, failing)).rejects.toThrow('offline');
    expect(failing).toHaveBeenCalledTimes(2);
  });
});

describe('what the years’ track says of the states', () => {
  it('says nothing until they change, keeps what it said, and tells the track each time', () => {
    const noted = vi.fn();
    const note = createStatesNote(noted);
    expect(note.said()).toBe('');
    note.states(null);
    expect(note.said()).toBe('');
    note.states('Rome appears.');
    note.states(null);
    expect(note.said()).toBe('Rome appears.');
    expect(noted).toHaveBeenCalledTimes(3);
  });
});
