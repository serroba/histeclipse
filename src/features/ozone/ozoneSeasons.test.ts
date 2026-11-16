import { describe, expect, it, vi } from 'vitest';

import served from '../../../public/data/ozone/shell.json' with { type: 'json' };
import type { OzoneShell } from '../../data/ozoneShell';
import { ozoneSeasons } from './ozoneSeasons';

const shell = served as unknown as OzoneShell;
const cells = shell.grid.rows * shell.grid.columns;
/** A season's pixels: every column of air from 20 to 26 km with 300 Dobson units. */
function season(): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(184 * cells * 4);
  for (let at = 0; at < pixels.length; at += 4) pixels.set([100, 160, 100, 255], at);
  return pixels;
}
const september = { year: 2006, month: 9, day: 25 };

describe('each season of the ozone surface', () => {
  it('Given a day first shown, Then its season is asked for once, and the day is there once it has come, the same field while the day is the same', async () => {
    const arrived = vi.fn();
    const read = vi.fn(() => Promise.resolve<Uint8ClampedArray | null>(season()));
    const day = ozoneSeasons('/base/', arrived, read);
    expect(day(shell, september)).toBeNull();
    expect(day(shell, september)).toBeNull();
    expect(read).toHaveBeenCalledExactlyOnceWith('/base/data/ozone/shell-2006.png');
    await vi.waitFor(() => {
      expect(arrived).toHaveBeenCalledOnce();
    });
    const found = day(shell, september);
    expect(found?.of.day).toBe(86);
    expect(found?.field.lowerKm[0]).toBeCloseTo(20, 5);
    expect(found?.field.du[0]).toBe(300);
    expect(day(shell, september)).toBe(found);
    expect(day(shell, { ...september, day: 26 })?.of.day).toBe(87);
    expect(read).toHaveBeenCalledOnce();
  });

  it('Given a date outside every season, Then nothing is asked for', () => {
    const read = vi.fn(() => Promise.resolve<Uint8ClampedArray | null>(season()));
    const day = ozoneSeasons('/', vi.fn(), read);
    expect(day(shell, { year: 2006, month: 3, day: 1 })).toBeNull();
    expect(day(shell, { year: 1990, month: 9, day: 25 })).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });

  it('Given a season that cannot be fetched or read, Then there is none, and it is not asked for again', async () => {
    const arrived = vi.fn();
    const read = vi
      .fn<(url: string) => Promise<Uint8ClampedArray | null>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(null);
    const day = ozoneSeasons('/', arrived, read);
    expect(day(shell, september)).toBeNull();
    expect(day(shell, { ...september, year: 2007 })).toBeNull();
    await Promise.resolve();
    await Promise.resolve();
    expect(day(shell, september)).toBeNull();
    expect(day(shell, { ...september, year: 2007 })).toBeNull();
    expect(read).toHaveBeenCalledTimes(2);
    expect(arrived).not.toHaveBeenCalled();
  });

  it('Given a third season shown, Then the first is let go, and asked for again if shown again', async () => {
    const read = vi.fn(() => Promise.resolve<Uint8ClampedArray | null>(season()));
    const day = ozoneSeasons('/', vi.fn(), read);
    for (const year of [2006, 2007, 2008]) {
      expect(day(shell, { ...september, year })).toBeNull();
      await vi.waitFor(() => {
        expect(day(shell, { ...september, year })).not.toBeNull();
      });
    }
    expect(read).toHaveBeenCalledTimes(3);
    expect(day(shell, { ...september, year: 2008 })).not.toBeNull();
    expect(day(shell, { ...september, year: 2006 })).toBeNull();
    expect(read).toHaveBeenCalledTimes(4);
  });
});
