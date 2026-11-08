import { describe, expect, it } from 'vitest';

import data from '../../public/data/radiocarbon-dates/heat.json';
import tileData from '../../public/data/radiocarbon-dates/tiles/50_-5.json';
import {
  datesHere,
  datesNear,
  datesNote,
  heatLevel,
  loadDatesHeat,
  loadDatesTile,
  stepOf,
  stepSpan,
  tileKeyOf,
  type DatesHeat,
  type DatesTile,
} from './radiocarbonDates';

const serve = (body: unknown) => (): Promise<Response> => Promise.resolve(Response.json(body));
const heat = data as DatesHeat;
const tile = tileData as DatesTile;

describe('archaeological radiocarbon dates (p3k14c)', () => {
  it('loads and checks the real files, and refuses broken ones', async () => {
    await expect(loadDatesHeat('/h.json', serve(heat))).resolves.toEqual(heat);
    await expect(
      loadDatesHeat('/h.json', serve({ ...heat, count: heat.count.slice(1) })),
    ).rejects.toThrow();
    await expect(loadDatesTile('/t.json', serve(tile))).resolves.toEqual(tile);
    await expect(
      loadDatesTile('/t.json', serve({ ...tile, samples: [[0, 0, 1, 0, 1, 0, '', '', '']] })),
    ).rejects.toThrow();
  });

  it('counts back in steps of 250 calendar years from 1950, to 12,500 years before it', () => {
    expect(stepOf(heat, 1950)).toBe(0);
    expect(stepOf(heat, 2026)).toBe(0);
    expect(stepOf(heat, 1700)).toBe(1);
    expect(stepOf(heat, -10_549)).toBe(49);
    expect(stepOf(heat, -10_551)).toBeNull();
    expect(stepSpan(heat, 1)).toEqual({ from: 1451, to: 1700 });
  });

  it('finds the cells of the step shown, and how strongly to shade them', () => {
    const near = datesNear(heat, -2000);
    expect(near).not.toBeNull();
    if (near === null) return;
    expect(near.cells.length).toBeGreaterThan(100);
    expect(near.total).toBe(near.cells.reduce((sum, cell) => sum + cell.count, 0));
    expect(datesNear(heat, -11_000)).toBeNull();
    expect(heatLevel(1, 100)).toBeGreaterThan(0);
    expect(heatLevel(100, 100)).toBeCloseTo(1, 9);
    expect(heatLevel(5, 0)).toBeGreaterThan(1);
  });

  it('lists a place’s dates and sites, in Britain, from its tile', () => {
    const place = { latitude: 51.5, longitude: -1.5 };
    expect(tileKeyOf(heat, place)).toBe('50_-5');
    // Somewhere in that square, some 250 years will have dates: find one.
    const year = [-2500, -2000, -1500, -500, 500, 1000].find(
      (each) => datesHere(heat, tile, place, each).samples.length > 0,
    );
    expect(year).toBeDefined();
    const here = datesHere(heat, tile, place, year ?? 0);
    const [first] = here.samples;
    expect(first?.age).toBeGreaterThan(0);
    expect(here.sites[0]?.[1]).toBeGreaterThan(0);
    expect(datesNote(datesNear(heat, year ?? 0), here)).toMatch(/^\d+ dates in this square for /);
  });

  it('says what the counts are, and are not', () => {
    const near = datesNear(heat, -2000);
    expect(datesNote(near, null)).toContain('not how many people lived');
    expect(datesNote(near, { samples: [], sites: [] })).toMatch(/^No dates in this square/);
    expect(datesNote(null, null)).toContain('10,550 BCE');
    const many = {
      samples: [1, 2, 3, 4].map((n) => ({
        latitude: 0,
        longitude: 0,
        age: 1000,
        error: 30,
        medianBP: 900,
        site: n === 4 ? '' : `S${String(n)}`,
        country: '',
        lab: '',
        material: '',
        period: '',
      })),
      sites: [
        ['S1', 1],
        ['S2', 1],
        ['', 1],
        ['S3', 1],
      ] as const,
    };
    expect(datesNote(near, many)).toContain('unnamed site (1), and 1 more');
  });
});
