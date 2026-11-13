import { SRGBColorSpace, Texture, type IUniform } from 'three';
import { describe, expect, it, vi } from 'vitest';

import type { MoonName } from '../astro/moonOrbits';
import type { PlanetName } from '../astro/planets';
import { BodyMaps } from './bodyMaps';

/** A loader whose images arrive, or fail, when the test says. */
function fakeLoads() {
  const pending = new Map<string, { resolve: (map: Texture) => void; reject: () => void }>();
  const asked: string[] = [];
  return {
    asked,
    load(url: string): Promise<Texture> {
      asked.push(url);
      return new Promise((resolve, reject) => {
        pending.set(url, {
          resolve,
          reject: () => {
            reject(new Error(url));
          },
        });
      });
    },
    arrive(url: string): Texture {
      const map = new Texture();
      map.name = url;
      pending.get(url)?.resolve(map);
      return map;
    },
    fail(url: string): void {
      pending.get(url)?.reject();
    },
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function bodyMaps(first: { earth?: Promise<Texture>; moon?: Promise<Texture> } = {}) {
  const loads = fakeLoads();
  const earth: Record<string, IUniform> = {};
  const moon: Record<string, IUniform> = {};
  const dataset: Record<string, string> = {};
  const planetMaps = new Map<PlanetName, Texture | null>();
  const moonMaps = new Map<MoonName, Texture | null>();
  let rings: Texture | null = null;
  const plainEarth = new Texture();
  const plainMoon = new Texture();
  const maps = new BodyMaps(
    {
      dataset: dataset,
      earth,
      moon,
      planets: {
        setMap: (planet, map) => planetMaps.set(planet, map),
        setRings: (strip) => (rings = strip),
      },
      moons: { setMap: (name, map) => moonMaps.set(name, map) },
      anisotropy: 8,
      load: (url) => loads.load(url),
      invalidate: () => undefined,
    },
    {
      earth: first.earth ?? new Promise(() => undefined),
      moon: first.moon ?? new Promise(() => undefined),
      plainEarth,
      plainMoon,
    },
  );
  return { maps, loads, earth, moon, dataset, planetMaps, moonMaps, rings: () => rings };
}

describe('the first maps', () => {
  it("dresses Earth and the Moon as their maps arrive, and says Earth's has", async () => {
    const earthMap = new Texture();
    const moonMap = new Texture();
    const { maps, earth, moon } = bodyMaps({
      earth: Promise.resolve(earthMap),
      moon: Promise.resolve(moonMap),
    });
    expect(maps.earthMapped).toBe(false);
    await settle();
    expect(maps.earthMapped).toBe(true);
    expect(earth['dayMap']?.value).toBe(earthMap);
    expect(earthMap.colorSpace).toBe(SRGBColorSpace);
    expect(earthMap.anisotropy).toBe(8);
    expect(moon['map']?.value).toBe(moonMap);
  });

  it('leaves the plain colours when a first map fails, the globe drawn all the same', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { maps, earth, moon } = bodyMaps({
      earth: Promise.reject(new Error('earth')),
      moon: Promise.reject(new Error('moon')),
    });
    await settle();
    expect(maps.earthMapped).toBe(true);
    expect(earth['dayMap']).toBeUndefined();
    expect(moon['map']).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('keeps a sharp map that came before the first', async () => {
    let earthFirst: (map: Texture) => void = () => undefined;
    let moonFirst: (map: Texture) => void = () => undefined;
    const { maps, loads, earth, moon, dataset } = bodyMaps({
      earth: new Promise((resolve) => (earthFirst = resolve)),
      moon: new Promise((resolve) => (moonFirst = resolve)),
    });
    maps.setBodyMap('earth', 'earth-sharp');
    maps.setBodyMap('moon', 'moon-sharp');
    const earthSharp = loads.arrive('earth-sharp');
    const moonSharp = loads.arrive('moon-sharp');
    await settle();
    expect(dataset['sharp']).toBe('earth moon');
    earthFirst(new Texture());
    moonFirst(new Texture());
    await settle();
    expect(maps.earthMapped).toBe(true);
    expect(earth['dayMap']?.value).toBe(earthSharp);
    expect(moon['map']?.value).toBe(moonSharp);
  });
});

describe('sharper maps for Earth and the Moon', () => {
  it('asks once for each, and again after one failed', async () => {
    const { maps, loads } = bodyMaps();
    maps.setBodyMap('earth', 'e');
    maps.setBodyMap('earth', 'e');
    expect(loads.asked).toEqual(['e']);
    loads.fail('e');
    await settle();
    maps.setBodyMap('earth', 'e');
    expect(loads.asked).toEqual(['e', 'e']);
  });

  it("gives the Moon's view its sharper map once the Moon is sharp", async () => {
    const { maps, loads, moon, dataset } = bodyMaps();
    const view = { map: 'view', sharp: 'view-sharp' };
    maps.showMoonView(view);
    loads.arrive('view');
    await settle();
    expect(dataset['moonMap']).toBe('view');
    maps.setBodyMap('moon', 'moon-sharp');
    loads.arrive('moon-sharp');
    await settle();
    expect(loads.asked).toContain('view-sharp');
    const sharp = loads.arrive('view-sharp');
    await settle();
    expect(moon['map']?.value).toBe(sharp);
    maps.showMoonView(null);
    expect(dataset['moonMap']).toBe('usual');
    expect(moon['map']?.value).not.toBe(sharp);
  });

  it("shows only the Moon's latest view", async () => {
    const { maps, loads, moon } = bodyMaps();
    maps.showMoonView({ map: 'a', sharp: null });
    maps.showMoonView({ map: 'b', sharp: null });
    const b = loads.arrive('b');
    loads.arrive('a');
    await settle();
    expect(moon['map']?.value).toBe(b);
  });
});

describe("the planets' views", () => {
  it('wears the first map, then the sharp one close up, once each', async () => {
    const { maps, loads, planetMaps, dataset } = bodyMaps();
    const view = { map: 'mars', sharp: 'mars-sharp' };
    maps.showPlanetView('mars', view);
    const first = loads.arrive('mars');
    await settle();
    expect(planetMaps.get('mars')).toBe(first);
    expect(dataset['planetMap']).toBe('mars');
    maps.sharpenPlanet('mars');
    maps.sharpenPlanet('mars');
    const sharp = loads.arrive('mars-sharp');
    await settle();
    expect(planetMaps.get('mars')).toBe(sharp);
    expect(dataset['sharp']).toBe('mars');
    maps.showPlanetView('mars', view);
    await settle();
    expect(loads.asked).toEqual(['mars', 'mars-sharp']);
  });

  it('goes back to painted colours, and ignores a view no longer wanted', async () => {
    const { maps, loads, planetMaps } = bodyMaps();
    maps.showPlanetView('venus', { map: 'radar', sharp: null });
    maps.showPlanetView('venus', null);
    expect(planetMaps.get('venus')).toBeNull();
    loads.arrive('radar');
    await settle();
    expect(planetMaps.get('venus')).toBeNull();
  });

  it('fetches a failed map again the next time it is asked for', async () => {
    const { maps, loads } = bodyMaps();
    maps.showPlanetView('jupiter', { map: 'j', sharp: null });
    loads.fail('j');
    await settle();
    maps.showPlanetView('jupiter', { map: 'j', sharp: null });
    expect(loads.asked).toEqual(['j', 'j']);
  });

  it("draws Saturn's measured rings, fetched once", async () => {
    const { maps, loads, rings, dataset } = bodyMaps();
    maps.setSaturnRings('rings');
    maps.setSaturnRings('rings');
    const strip = loads.arrive('rings');
    await settle();
    expect(rings()).toBe(strip);
    expect(dataset['rings']).toBe('measured');
    expect(loads.asked).toEqual(['rings']);
  });
});

describe("the planets' moons", () => {
  it('wears the latest map asked for, or its painted colour', async () => {
    const { maps, loads, moonMaps, dataset } = bodyMaps();
    maps.setMoonMap('io', 'io-1');
    maps.setMoonMap('io', 'io-1');
    maps.setMoonMap('io', 'io-2');
    const second = loads.arrive('io-2');
    loads.arrive('io-1');
    await settle();
    expect(moonMaps.get('io')).toBe(second);
    expect(dataset['moonMap']).toBe('io');
    maps.setMoonMap('titan', null);
    expect(moonMaps.get('titan')).toBeNull();
    expect(dataset['moonMap']).toBe('titan painted');
  });
});
