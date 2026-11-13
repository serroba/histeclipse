import { Texture, type IUniform } from 'three';
import { describe, expect, it } from 'vitest';

import { EarthSurfaces, inOrder, surfaceUniforms } from './earthSurfaces';

/** A loader whose maps arrive, or fail, when the test says. */
function fakeLoads() {
  const pending = new Map<
    string,
    { resolve: (texture: Texture) => void; reject: (error: Error) => void }
  >();
  const asked: string[] = [];
  return {
    asked,
    load(url: string): Promise<Texture> {
      asked.push(url);
      return new Promise((resolve, reject) => pending.set(url, { resolve, reject }));
    },
    arrive(url: string): Texture {
      const texture = new Texture();
      texture.name = url;
      pending.get(url)?.resolve(texture);
      return texture;
    },
    fail(url: string): void {
      pending.get(url)?.reject(new Error(`no ${url}`));
    },
  };
}

function surfaces() {
  const loads = fakeLoads();
  const uniforms: Record<string, IUniform> = { ...surfaceUniforms() };
  const evenLight = { value: 0 };
  const dataset: Record<string, string> = {};
  let drawn = 0;
  const host = new EarthSurfaces({
    uniforms,
    evenLight,
    dataset: dataset,
    load: (url) => loads.load(url),
    invalidate: () => (drawn += 1),
  });
  return { host, loads, uniforms, evenLight, dataset, drawn: () => drawn };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const pair = (younger: string, older: string) => ({
  younger,
  older,
  mix: 0.25,
  columns: 4,
  rows: 2,
});

describe('maps shown in the order asked', () => {
  it('shows a newer ticket, refuses an older one, and drops what is pending', () => {
    const order = inOrder();
    const first = order.ask();
    const second = order.ask();
    expect(order.show(second)).toBe(true);
    expect(order.show(first)).toBe(false);
    const third = order.ask();
    order.drop();
    expect(order.show(third)).toBe(false);
  });
});

describe("Earth's surfaces", () => {
  it('starts with every surface off', () => {
    const uniforms = surfaceUniforms();
    for (const name of ['paleoActive', 'shelfActive', 'seaIceActive', 'iceActive', 'plateActive'])
      expect(uniforms[name]?.value).toBe(0);
  });

  it('shows deep time once both maps arrive, lit evenly, and returns to today', async () => {
    const { host, loads, uniforms, evenLight, dataset } = surfaces();
    host.setDeepTime({ ...pair('a.png', 'b.png'), seaDepth: 5000, landHeight: 3000 });
    expect(host.deepTime).toBe(true);
    expect(evenLight.value).toBe(1);
    expect(dataset['light']).toBe('even');
    const younger = loads.arrive('a.png');
    await settle();
    expect(uniforms['paleoActive']?.value).toBe(0);
    loads.arrive('b.png');
    await settle();
    expect(uniforms['paleoActive']?.value).toBe(1);
    expect(uniforms['paleoYounger']?.value).toBe(younger);
    expect(uniforms['seaDepth']?.value).toBe(5000);
    expect(dataset['deepTime']).toBe('a.png b.png');
    host.setDeepTime(null);
    expect(host.deepTime).toBe(false);
    expect(evenLight.value).toBe(0);
    expect(uniforms['paleoActive']?.value).toBe(0);
    expect(dataset['deepTime']).toBe('off');
  });

  it('shows a newer map arriving first, and not the older one after it', async () => {
    const { host, loads, uniforms } = surfaces();
    host.setIce({ ...pair('old1', 'old2'), metresPerStep: 16 });
    host.setIce({ ...pair('new1', 'new2'), metresPerStep: 32 });
    loads.arrive('new1');
    loads.arrive('new2');
    await settle();
    expect(uniforms['iceStep']?.value).toBe(32);
    loads.arrive('old1');
    loads.arrive('old2');
    await settle();
    expect(uniforms['iceStep']?.value).toBe(32);
  });

  it('drops what is still loading when turned off', async () => {
    const { host, loads, uniforms, dataset } = surfaces();
    host.setPlates({ ...pair('p1', 'p2'), turnYounger: 1, turnOlder: 2 });
    host.setPlates(null);
    loads.arrive('p1');
    loads.arrive('p2');
    await settle();
    expect(uniforms['plateActive']?.value).toBe(0);
    expect(dataset['plates']).toBe('off');
  });

  it('loads each map once, and the pair again after one failed', async () => {
    const { host, loads } = surfaces();
    host.prefetch(['t1', 't2']);
    host.setTemperature({ ...pair('t1', 't2'), coldest: -40, warmest: 40, change: true });
    expect(loads.asked).toEqual(['t1', 't2']);
    loads.fail('t1');
    await settle();
    host.setTemperature({ ...pair('t1', 't2'), coldest: -40, warmest: 40, change: false });
    expect(loads.asked).toEqual(['t1', 't2', 't1', 't2']);
  });

  it('colours by temperature and says whether it is the change from today', async () => {
    const { host, loads, uniforms, dataset } = surfaces();
    host.setTemperature({ ...pair('t1', 't2'), coldest: -40, warmest: 40, change: true });
    loads.arrive('t1');
    loads.arrive('t2');
    await settle();
    expect(uniforms['tempActive']?.value).toBe(1);
    expect(uniforms['tempChange']?.value).toBe(1);
    expect(dataset['temperatureChange']).toBe('true');
    host.setTemperature(null);
    expect(uniforms['tempActive']?.value).toBe(0);
  });

  it('cuts the shelves at a sea level, at once, and the map when it arrives', async () => {
    const { host, loads, uniforms, dataset } = surfaces();
    host.setShelf({ url: 's', columns: 4, rows: 2, lowest: -200, highest: 55, seaLevel: -120 });
    expect(uniforms['seaLevel']?.value).toBe(-120);
    expect(dataset['seaLevel']).toBe('-120.0');
    loads.arrive('s');
    await settle();
    expect(uniforms['shelfActive']?.value).toBe(1);
    expect(dataset['shelf']).toBe('s');
    host.setShelf(null);
    expect(uniforms['shelfActive']?.value).toBe(0);
    expect(dataset['shelf']).toBe('off');
  });

  it('a shelf map that fails is asked for again', async () => {
    const { host, loads } = surfaces();
    const shelf = { url: 's', columns: 4, rows: 2, lowest: -200, highest: 55, seaLevel: 0 };
    host.setShelf(shelf);
    loads.fail('s');
    await settle();
    host.setShelf(shelf);
    expect(loads.asked).toEqual(['s', 's']);
  });

  it('blends sea ice by season, or as the ice age', async () => {
    const { host, loads, uniforms, dataset } = surfaces();
    const ice = { todayMost: 'a', todayYearRound: 'b', pastMost: 'c', pastYearRound: 'd' };
    host.setSeaIce({ ...ice, mix: 0.5, columns: 4, rows: 2, season: null });
    for (const url of ['a', 'b', 'c', 'd']) loads.arrive(url);
    await settle();
    expect(uniforms['seaIceSeason']?.value).toBe(-1);
    expect(dataset['seaIce']).toBe('ice-age c 0.50');
    host.setSeaIce({ ...ice, mix: 0, columns: 4, rows: 2, season: 0.25 });
    await settle();
    expect(dataset['seaIce']).toBe('0.25 c 0.00');
    host.setSeaIce(null);
    expect(uniforms['seaIceActive']?.value).toBe(0);
  });

  it('lights evenly for the Holocene, outside deep time too', () => {
    const { host, evenLight, dataset } = surfaces();
    host.setEvenLight(true);
    expect(evenLight.value).toBe(1);
    host.setEvenLight(false);
    expect(dataset['light']).toBe('sun');
  });

  it('draws the plain globe and its sketch', () => {
    const { host, uniforms, dataset, drawn } = surfaces();
    host.setUncharted(true);
    expect(uniforms['uncharted']?.value).toBe(1);
    host.setSketch({ kind: 'magma', land: 0.3, iceEdge: 60 });
    expect(uniforms['sketchKind']?.value).toBe(1);
    expect(dataset['sketch']).toBe('magma 0.300 60');
    host.setSketch(null);
    expect(uniforms['sketchKind']?.value).toBe(0);
    expect(dataset['sketch']).toBe('off');
    expect(drawn()).toBe(3);
  });
});
