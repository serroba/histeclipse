import { describe, expect, it } from 'vitest';

import served from '../../public/data/sun-images.json' with { type: 'json' };
import type { Fetch } from '../util/fetchJson';
import { frameSpan, loadSunImages, SUN_LAYERS } from './sunImages';

const serve =
  (body: unknown): Fetch =>
  () =>
    Promise.resolve(Response.json(body));

describe('sun-images.json', () => {
  it('holds every channel, credited, stitched from frames ending on 8 May 2024', async () => {
    const images = await loadSunImages('/data/sun-images.json', serve(served));
    expect(images.layers.map(({ key }) => key)).toEqual([...SUN_LAYERS]);
    expect(images.credit).toContain('NASA/SDO');
    expect(images.diskRadius).toBe(0.4);
    for (const layer of images.layers) {
      // Four frames about a week apart: three weeks, most of one turn of the Sun.
      expect(layer.frames).toHaveLength(4);
      expect(layer.frames.at(-1)).toMatch(/^2024-05-08T1[12]:/);
      expect(frameSpan(layer)).toEqual(['18 Apr 2024', '08 May 2024']);
    }
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
      layers: [{ ...first, map: { ...first?.map, '512': '../secret.webp' } }],
    };
    await expect(loadSunImages('/x', serve(moved))).rejects.toThrow();
  });

  it('rejects frames out of time order, or none', async () => {
    const [first] = served.layers;
    const shuffled = {
      ...served,
      layers: [{ ...first, frames: [...(first?.frames ?? [])].reverse() }],
    };
    await expect(loadSunImages('/x', serve(shuffled))).rejects.toThrow('frames are in time order');
    const none = { ...served, layers: [{ ...first, frames: [] }] };
    await expect(loadSunImages('/x', serve(none))).rejects.toThrow();
  });
});
