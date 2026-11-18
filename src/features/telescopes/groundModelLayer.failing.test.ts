import { Group, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';

import type { CraftFrame } from '../../globe/focus';
import type { LayerHost } from '../../globe/layerHost';

vi.mock('../../models/telescopeModels', () => ({
  telescopeModel: () => ({ load: () => Promise.reject(new Error('offline')) }),
}));

const { groundModel } = await import('./groundModelLayer');

describe('the ground model layer, its model not loaded (#864)', () => {
  it('Given its parts could not be fetched, Then the site is still held, nothing drawn', async () => {
    const held: (CraftFrame | null)[] = [];
    const requestRender = vi.fn();
    const host = {
      camera: new PerspectiveCamera(),
      container: { dataset: {} },
      onEarth: { add: (...objects: Group[]) => new Group().add(...objects) },
      sunPosition: () => new Vector3(0, 0, -1),
      holdCraft: (craft: CraftFrame | null) => held.push(craft),
      afterRender: () => undefined,
      drawOver: vi.fn(),
      requestRender,
    } as unknown as LayerHost;
    const site = { id: 'lovell', latitude: 53.2369, longitude: -2.3075 };
    groundModel(host).update({ held: site, near: [site] });
    await vi.waitFor(() => {
      expect(requestRender).toHaveBeenCalledTimes(2);
    });
    expect(held.at(-1)?.id).toBe('lovell');
  });
});
