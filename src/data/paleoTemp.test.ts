import { describe, expect, it } from 'vitest';

import index from '../../public/data/paleotemp/index.json';
import type { Fetch } from './fetchJson';
import { framesAround } from './paleoDem';
import { loadPaleoTempIndex } from './paleoTemp';

const serve =
  (body: unknown): Fetch =>
  () =>
    Promise.resolve(Response.json(body));

describe('the deep-time temperature maps', () => {
  it('cover 540 Ma to today in 100 steps, credited', async () => {
    const loaded = await loadPaleoTempIndex('/x', serve(index));
    expect(loaded.frames).toHaveLength(100);
    expect(loaded.frames.at(-1)?.ma).toBe(540);
    expect(loaded.credit).toContain('CC BY 4.0');
    // Today's global mean is about 14.6 °C.
    expect(loaded.frames[0]?.mean).toBeCloseTo(14.6, 1);
  });

  it('blend across the wider steps before 450 Ma', async () => {
    const loaded = await loadPaleoTempIndex('/x', serve(index));
    const between = framesAround(loaded.frames, 455);
    expect([between.younger.ma, between.older.ma]).toEqual([450, 460]);
    expect(between.mix).toBeCloseTo(0.5, 12);
  });

  it('carry the note on the map that stands out', async () => {
    const loaded = await loadPaleoTempIndex('/x', serve(index));
    expect(loaded.frames.find(({ ma }) => ma === 65)?.note).toContain('does not say why');
    expect(loaded.frames.filter(({ note }) => note !== undefined)).toHaveLength(1);
  });

  it('reject a scale that runs backwards', async () => {
    await expect(
      loadPaleoTempIndex('/x', serve({ ...index, coldest: 60, warmest: -60 })),
    ).rejects.toThrow(/coldest is below warmest/);
  });
});
