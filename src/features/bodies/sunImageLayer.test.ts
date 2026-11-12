import { RepeatWrapping, Texture } from 'three';
import { describe, expect, it } from 'vitest';

import type { LayerHost } from '../../globe/layerHost';
import type { SunImageTextures } from '../../globe/surfaces';
import { sunImageLayerWith, type SunImageRequest } from './sunImageLayer';

function request(key: string): SunImageRequest {
  return {
    key,
    map: { small: `${key}-map-512`, large: `${key}-map-4096` },
    disc: { small: `${key}-disc-512`, large: `${key}-disc-2048` },
    tint: [1, 0.93, 0.8],
    diskRadius: 0.4,
    limbDarkening: 0.6,
  };
}

/** A loader whose loads finish when the test says, and a host that keeps what it shows. */
function setUp() {
  const pending = new Map<string, { resolve: (texture: Texture) => void; reject: () => void }>();
  const loads: string[] = [];
  const load = (url: string) =>
    new Promise<Texture>((resolve, reject) => {
      loads.push(url);
      pending.set(url, {
        resolve,
        reject: () => {
          reject(new Error(url));
        },
      });
    });
  const finish = async (...urls: string[]) => {
    for (const url of urls) {
      const texture = new Texture();
      texture.name = url;
      pending.get(url)?.resolve(texture);
    }
    // Let the loads' callbacks run.
    for (let turn = 0; turn < 5; turn++) await Promise.resolve();
  };
  const fail = async (url: string) => {
    pending.get(url)?.reject();
    for (let turn = 0; turn < 5; turn++) await Promise.resolve();
  };
  const shown: (SunImageTextures | null)[] = [];
  const dataset: Record<string, string> = {};
  const host = {
    container: { dataset },
    maxAnisotropy: 8,
    showSunImage: (image: SunImageTextures | null) => shown.push(image),
  } as unknown as LayerHost;
  return { layer: sunImageLayerWith(load)(host), loads, finish, fail, shown, dataset };
}

describe("the Sun's images", () => {
  it('Given a channel, Then its small images show first, then its large ones', async () => {
    const { layer, finish, shown, dataset } = setUp();
    layer.update(request('visible'));
    await finish('visible-map-512', 'visible-disc-512');
    expect(shown.at(-1)?.surface.name).toBe('visible-map-512');
    expect(dataset['sunImage']).toBe('small');
    await finish('visible-map-4096', 'visible-disc-2048');
    const large = shown.at(-1);
    expect(large?.surface.name).toBe('visible-map-4096');
    expect(large?.disc.name).toBe('visible-disc-2048');
    expect(large).toMatchObject({ tint: [1, 0.93, 0.8], diskRadius: 0.4, limbDarkening: 0.6 });
    expect(dataset).toMatchObject({ sunImage: 'large', sunLayer: 'visible' });
    // The map wraps round the far side; the frame does not. Both are filtered as well as the GPU allows.
    expect(large?.surface.wrapS).toBe(RepeatWrapping);
    expect(large?.disc.wrapS).not.toBe(RepeatWrapping);
    expect(large?.surface.anisotropy).toBe(8);
  });

  it('Given a channel already loaded, Then it shows its large images at once, loading nothing', async () => {
    const { layer, loads, finish, shown } = setUp();
    layer.update(request('visible'));
    await finish('visible-map-512', 'visible-disc-512');
    await finish('visible-map-4096', 'visible-disc-2048');
    const before = loads.length;
    layer.update(null);
    layer.update(request('visible'));
    expect(loads).toHaveLength(before);
    expect(shown.at(-1)?.surface.name).toBe('visible-map-4096');
  });

  it('Given a channel left while it loads, Then coming back reuses its small images', async () => {
    const { layer, loads, finish, shown } = setUp();
    layer.update(request('visible'));
    await finish('visible-map-512', 'visible-disc-512');
    layer.update(null);
    layer.update(request('visible'));
    // Its small images are kept: they show again without loading, and the large ones follow.
    await finish();
    expect(loads.filter((url) => url === 'visible-map-512')).toHaveLength(1);
    expect(shown.at(-1)?.surface.name).toBe('visible-map-512');
    await finish('visible-map-4096', 'visible-disc-2048');
    expect(shown.at(-1)?.surface.name).toBe('visible-map-4096');
  });

  it('Given another channel asked for while one loads, Then the slow one never shows', async () => {
    const { layer, finish, shown, dataset } = setUp();
    layer.update(request('visible'));
    layer.update(request('171'));
    await finish('171-map-512', '171-disc-512');
    await finish('visible-map-512', 'visible-disc-512');
    expect(shown.map((image) => image?.surface.name)).toEqual(['171-map-512']);
    expect(dataset['sunLayer']).toBe('171');
  });

  it('Given none, Then the Sun shows plain', () => {
    const { layer, shown, dataset } = setUp();
    layer.update(null);
    expect(shown).toEqual([null]);
    expect(dataset['sunImage']).toBe('none');
  });

  it('Given an image that fails to load, Then it says so, unless another was asked for since', async () => {
    const { layer, fail, dataset } = setUp();
    layer.update(request('visible'));
    await fail('visible-map-512');
    expect(dataset['sunImage']).toBe('error');
    const second = setUp();
    second.layer.update(request('visible'));
    second.layer.update(null);
    await second.fail('visible-map-512');
    expect(second.dataset['sunImage']).toBe('none');
    layer.dispose?.();
  });
});
