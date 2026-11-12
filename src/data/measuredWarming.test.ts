import { describe, expect, it } from 'vitest';

import json from '../../public/data/warming/index.json';
import { loadMeasuredWarming, warmingAt, type MeasuredWarming } from './measuredWarming';

const respond = (body: unknown) => () => Promise.resolve(new Response(JSON.stringify(body)));

async function index(): Promise<MeasuredWarming> {
  return loadMeasuredWarming('/data/warming/index.json', respond(json));
}

describe('the measured warming maps', () => {
  it('are Berkeley Earth’s, of land, against 1850–1900, credited with their licence', async () => {
    const warming = await index();
    expect(warming.baseline).toBe('1850–1900');
    expect(warming.licence).toBe('CC BY-NC 4.0');
    expect(warming.credit).toMatch(/^Berkeley Earth \(Rohde & Hausfather 2020/);
    expect(warming.frames[0]?.year).toBe(1850);
  });

  it('estimate the baseline where its records were too few, about a third of the land', async () => {
    const { estimated } = await index();
    expect(estimated.from).toBe('1951–1980');
    expect(estimated.share).toBeGreaterThan(0.2);
    expect(estimated.share).toBeLessThan(0.4);
    // 1951–1980 was some 0.3 to 0.6 °C warmer than 1850–1900, band by band.
    for (const { shift } of estimated.bands) {
      expect(shift).toBeGreaterThan(0.2);
      expect(shift).toBeLessThan(0.8);
    }
  });

  it('show land some 2 °C warmer in the last five years than in 1850–1900', async () => {
    const last = (await index()).frames.at(-1);
    expect(last?.year).toBeGreaterThanOrEqual(2024);
    expect(last?.mean).toBeGreaterThan(1.8);
    expect(last?.mean).toBeLessThan(2.5);
  });

  it('reject a file of another shape', async () => {
    await expect(loadMeasuredWarming('/x', respond({ ...json, frames: [] }))).rejects.toThrow();
  });
});

describe('the frames either side of a year', () => {
  const frame = (year: number) => ({ year, file: `${String(year)}.png`, mean: 0 });
  const warming = {
    ...json,
    frames: [frame(1855), frame(1850), frame(1860), frame(1862)],
  } as MeasuredWarming;

  it('blend from the earlier towards the later', () => {
    const at = warmingAt(warming, 1851);
    expect([at.older.year, at.younger.year]).toEqual([1850, 1855]);
    expect(at.mix).toBeCloseTo(0.8);
    expect(warmingAt(warming, 1861).mix).toBeCloseTo(0.5);
  });

  it('show a frame alone on its year, and the ends beyond them', () => {
    expect(warmingAt(warming, 1855)).toMatchObject({ younger: { year: 1855 }, mix: 0 });
    expect(warmingAt(warming, 1849)).toMatchObject({
      younger: { year: 1850 },
      older: { year: 1850 },
      mix: 0,
    });
    expect(warmingAt(warming, 2030)).toMatchObject({
      younger: { year: 1862 },
      older: { year: 1862 },
      mix: 0,
    });
    expect(() => warmingAt({ ...warming, frames: [] }, 1900)).toThrow('No measured-warming');
  });
});
