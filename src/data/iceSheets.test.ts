import { describe, expect, it } from 'vitest';

import index from '../../public/data/icesheets/index.json';
import type { Fetch } from './fetchJson';
import { iceFramesInMa, loadIceSheets, oldestIceKa } from './iceSheets';
import { framesAround } from './paleoDem';

const serve =
  (body: unknown): Fetch =>
  () =>
    Promise.resolve(Response.json(body));

describe('the ice-sheet maps', () => {
  it('cover the last 80,000 years every 2,500, credited', async () => {
    const loaded = await loadIceSheets('/x', serve(index));
    expect(loaded.frames).toHaveLength(33);
    expect(oldestIceKa(loaded)).toBe(80);
    expect(loaded.credit).toContain('CC BY 4.0');
    // More of Earth under ice at the last glacial maximum than today.
    const glacial = loaded.frames.find(({ ka }) => ka === 20)?.ice ?? 0;
    expect(glacial).toBeGreaterThan(2 * (loaded.frames[0]?.ice ?? 1));
  });

  it('blend like the other deep-time maps, in millions of years', async () => {
    const frames = iceFramesInMa(await loadIceSheets('/x', serve(index)));
    const between = framesAround(frames, 0.021);
    expect([between.younger.file, between.older.file]).toEqual(['20000.png', '22500.png']);
    expect(between.mix).toBeCloseTo(0.4, 9);
  });

  it('reject frames out of order', async () => {
    const shuffled = { ...index, frames: [...index.frames].reverse() };
    await expect(loadIceSheets('/x', serve(shuffled))).rejects.toThrow(/present back/);
  });
});
