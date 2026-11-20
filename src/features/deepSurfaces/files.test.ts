import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import { createCo2ArchiveFile } from './co2Archive';
import { createPlateMasks } from './plateMasks';

const served = () =>
  vi.fn(async (url: string) => new Response(await readFile(`public${url}`, 'utf8')));
const offline = () => vi.fn(() => Promise.reject(new Error('offline')));

describe('the index of the continents’ outlines', () => {
  it('is loaded once, and then says how far back the plates reach', async () => {
    const fetchJson = served();
    const masks = createPlateMasks('/', fetchJson);
    expect(masks.loaded()).toBeNull();
    expect(masks.reach()).toBeUndefined();
    const index = await masks.ask();
    await masks.ask();
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(fetchJson).toHaveBeenCalledWith('/data/plates/index.json');
    expect(masks.loaded()).toBe(index);
    expect(masks.reach()).toBe(index.frames.at(-1)?.ma);
  });

  it('is asked for again after a failed load', async () => {
    const fetchJson = offline();
    const masks = createPlateMasks('/', fetchJson);
    await expect(masks.ask()).rejects.toThrow('offline');
    await expect(masks.ask()).rejects.toThrow('offline');
    expect(fetchJson).toHaveBeenCalledTimes(2);
    expect(masks.loaded()).toBeNull();
  });
});

describe('the Paleo-CO2 Data Archive', () => {
  it('is loaded once when asked for, and says it has arrived', async () => {
    const fetchJson = served();
    const arrived = vi.fn();
    const file = createCo2ArchiveFile('/', fetchJson, { arrived, notify: vi.fn() });
    expect(file.loaded()).toBeNull();
    file.load();
    file.load();
    await vi.waitFor(() => {
      expect(arrived).toHaveBeenCalledTimes(1);
    });
    file.load();
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(fetchJson).toHaveBeenCalledWith('/data/air-co2-archive.json');
    expect(file.loaded()).not.toBeNull();
  });

  it('tells the reader when it does not load, and is asked for again the next time', async () => {
    const fetchJson = offline();
    const notify = vi.fn();
    const file = createCo2ArchiveFile('/', fetchJson, { arrived: vi.fn(), notify });
    file.load();
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith('Could not load the Paleo-CO₂ Data Archive: offline');
    });
    file.load();
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });
});
