import { describe, expect, it } from 'vitest';

import index from '../../public/data/icesheets/index.json';
import type { Fetch } from './fetchJson';
import { iceFramesInMa, iceStandIn, loadIceSheets, oldestIceKa } from './iceSheets';
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

describe('a stand-in before the maps reach', () => {
  const index = {
    schemaVersion: 1 as const,
    credit: 'test',
    source: 'https://example.org',
    rows: 2,
    columns: 2,
    metresPerStep: 16,
    frames: [
      { ka: 0, file: '0.png', ice: 0.1 },
      { ka: 20, file: '20000.png', ice: 0.2 },
      { ka: 60, file: '60000.png', ice: 0.15 },
    ],
  };
  const levels: Record<number, number> = { 0: 0, 20: -120, 60: -60 };

  it('picks the map whose sea level is closest', () => {
    const levelAt = (ka: number) => levels[ka] ?? null;
    expect(iceStandIn(index, -55, levelAt)).toEqual({
      ka: 60,
      file: '60000.png',
      frameLevel: -60,
      level: -55,
    });
    expect(iceStandIn(index, -125, levelAt)?.ka).toBe(20);
    expect(iceStandIn(index, 6, levelAt)?.ka).toBe(0);
  });

  it('skips maps without a sea level, and gives none without any', () => {
    expect(iceStandIn(index, -55, (ka) => (ka === 60 ? null : (levels[ka] ?? null)))?.ka).toBe(0);
    expect(iceStandIn(index, -55, () => null)).toBeNull();
  });
});
