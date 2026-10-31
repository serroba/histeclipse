import { describe, expect, it } from 'vitest';

import served from '../../public/data/sun-images.json';
import type { Fetch } from './fetchJson';
import { loadSunImages, SUN_LAYERS } from './sunImages';

const serve =
  (body: unknown): Fetch =>
  () =>
    Promise.resolve(Response.json(body));

describe('sun-images.json', () => {
  it('holds every channel, credited, from 8 May 2024', async () => {
    const images = await loadSunImages('/data/sun-images.json', serve(served));
    expect(images.layers.map(({ key }) => key)).toEqual([...SUN_LAYERS]);
    expect(images.credit).toContain('NASA/SDO');
    expect(images.diskRadius).toBe(0.4);
    for (const layer of images.layers) expect(layer.observed).toMatch(/^2024-05-08T1[12]:/);
  });
});

describe('loadSunImages', () => {
  it('rejects a channel listed twice', async () => {
    const doubled = { ...served, layers: [served.layers[0], served.layers[0]] };
    await expect(loadSunImages('/x', serve(doubled))).rejects.toThrow('each channel appears once');
  });

  it('rejects files outside the Sun textures', async () => {
    const [first] = served.layers;
    const moved = {
      ...served,
      layers: [{ ...first, files: { ...first?.files, '512': '../secret.webp' } }],
    };
    await expect(loadSunImages('/x', serve(moved))).rejects.toThrow();
  });
});
