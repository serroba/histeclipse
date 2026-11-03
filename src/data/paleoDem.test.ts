import { describe, expect, it } from 'vitest';

import index from '../../public/data/paleodem/index.json';
import type { Fetch } from './fetchJson';
import { framesAhead, framesAround, loadPaleoDemIndex, oldestMa } from './paleoDem';

const serve =
  (body: unknown): Fetch =>
  () =>
    Promise.resolve(Response.json(body));

describe('the deep-time elevation maps', () => {
  it('cover 540 Ma to today every 5 million years, credited', async () => {
    const loaded = await loadPaleoDemIndex('/x', serve(index));
    expect(loaded.frames).toHaveLength(109);
    expect(oldestMa(loaded)).toBe(540);
    expect(loaded.credit).toContain('CC BY 4.0');
    // Today's map is about 29% land, as Earth is.
    expect(loaded.frames[0]?.land).toBeCloseTo(0.29, 1);
  });

  it('blend the two maps either side of a moment', async () => {
    const loaded = await loadPaleoDemIndex('/x', serve(index));
    const between = framesAround(loaded.frames, 252);
    expect([between.younger.ma, between.older.ma]).toEqual([250, 255]);
    expect(between.mix).toBeCloseTo(0.4, 12);
    expect(framesAround(loaded.frames, 250)).toMatchObject({ mix: 1 });
    expect(framesAround(loaded.frames, 0)).toMatchObject({ younger: { ma: 0 }, mix: 0 });
    expect(framesAround(loaded.frames, 600)).toMatchObject({
      younger: { ma: 540 },
      older: { ma: 540 },
    });
  });

  it('reject an index whose maps are out of order', async () => {
    const shuffled = { ...index, frames: [...index.frames].reverse() };
    await expect(loadPaleoDemIndex('/x', serve(shuffled))).rejects.toThrow(/present back/);
  });
});

describe('framesAhead', () => {
  const frames = [0, 5, 10, 15, 20].map((ma) => ({ ma }));

  it('gives the frames playing comes to next, nearest first', () => {
    expect(framesAhead(frames, 17, 2)).toEqual([{ ma: 15 }, { ma: 10 }]);
    expect(framesAhead(frames, 15, 4)).toEqual([{ ma: 10 }, { ma: 5 }, { ma: 0 }]);
  });

  it('has none left at the present', () => {
    expect(framesAhead(frames, 0, 4)).toEqual([]);
  });
});
