import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import index from '../../public/data/sealevel/index.json';
import type { Fetch } from './fetchJson';
import { loadSeaLevel, seaLevelAt, type SeaLevelSeries } from './seaLevel';

const serve =
  (body: unknown): Fetch =>
  () =>
    Promise.resolve(Response.json(body));

const series = (id: string): Promise<SeaLevelSeries> =>
  loadSeaLevel('/x', serve(index)).then((loaded) => {
    const found = loaded.series.find((each) => each.id === id);
    if (found === undefined) throw new Error(id);
    return found;
  });

describe('the sea-level reconstructions', () => {
  it('are four, each credited', async () => {
    const loaded = await loadSeaLevel('/x', serve(index));
    expect(loaded.series.map(({ id }) => id)).toEqual([
      'van-der-meer-2022',
      'miller-2020',
      'bintanja-2008',
      'spratt-2016',
    ]);
    for (const { licence, url } of loaded.series) {
      expect(licence.length).toBeGreaterThan(0);
      expect(url).toMatch(/^https:\/\//);
    }
  });

  it('agree on the last glacial maximum, within their spread', async () => {
    const bintanja = seaLevelAt(await series('bintanja-2008'), 20);
    const spratt = seaLevelAt(await series('spratt-2016'), 20);
    expect(bintanja?.level).toBeCloseTo(-123.4, 1);
    expect(spratt?.level).toBeCloseTo(-116.4, 0);
    expect(spratt?.low).toBeLessThan(spratt?.level ?? 0);
    expect(bintanja?.low).toBeNull();
  });

  it('interpolate between ages and stop at their span', async () => {
    const miller = await series('miller-2020');
    expect(seaLevelAt(miller, 990)?.level).toBeCloseTo((-33.0 + -32.2) / 2, 6);
    expect(seaLevelAt(miller, 500)).toBeNull();
    expect(seaLevelAt(miller, 70_000)).toBeNull();
    const meer = await series('van-der-meer-2022');
    expect(seaLevelAt(meer, 0)?.level).toBe(0);
    expect(seaLevelAt(meer, 540_000)).not.toBeNull();
  });

  it('stay between their neighbours', async () => {
    const meer = await series('van-der-meer-2022');
    fc.assert(
      fc.property(fc.double({ min: 0, max: 540_000, noNaN: true }), (ka) => {
        const at = seaLevelAt(meer, ka);
        const before = Math.floor(ka / 1000);
        const after = Math.min(540, before + 1);
        const a = meer.level[before] ?? 0;
        const b = meer.level[after] ?? 0;
        expect(at?.level).toBeGreaterThanOrEqual(Math.min(a, b) - 1e-9);
        expect(at?.level).toBeLessThanOrEqual(Math.max(a, b) + 1e-9);
      }),
    );
  });

  it('reject a column shorter than its ages', async () => {
    const [first] = index.series;
    const broken = { ...index, series: [{ ...first, level: [0] }] };
    await expect(loadSeaLevel('/x', serve(broken))).rejects.toThrow(/every column/);
  });
});
