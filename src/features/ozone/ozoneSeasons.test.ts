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
/** No idle moment comes: nothing is asked for ahead. */
const never = (): void => undefined;

describe('each season of the ozone surface', () => {
  it('Given a day first shown, Then its season is asked for once, and the day is there once it has come, the same field while the day is the same', async () => {
    const arrived = vi.fn();
    const read = vi.fn<(url: string) => Promise<Uint8ClampedArray | null>>(() =>
      Promise.resolve(season()),
    );
    const day = ozoneSeasons('/base/', arrived, read, never);
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
    const read = vi.fn<(url: string) => Promise<Uint8ClampedArray | null>>(() =>
      Promise.resolve(season()),
    );
    const day = ozoneSeasons('/', vi.fn(), read, never);
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
    const day = ozoneSeasons('/', arrived, read, never);
    expect(day(shell, september)).toBeNull();
    expect(day(shell, { ...september, year: 2007 })).toBeNull();
    await Promise.resolve();
    await Promise.resolve();
    expect(day(shell, september)).toBeNull();
    expect(day(shell, { ...september, year: 2007 })).toBeNull();
    expect(read).toHaveBeenCalledTimes(2);
    expect(arrived).not.toHaveBeenCalled();
  });

  it('Given four seasons shown in turn, Then the first is let go, and asked for again if shown again', async () => {
    const read = vi.fn<(url: string) => Promise<Uint8ClampedArray | null>>(() =>
      Promise.resolve(season()),
    );
    const day = ozoneSeasons('/', vi.fn(), read, never);
    for (const year of [2006, 2007, 2008, 2009]) {
      day(shell, { ...september, year });
      await vi.waitFor(() => {
        expect(day(shell, { ...september, year })).not.toBeNull();
      });
    }
    expect(read).toHaveBeenCalledTimes(4);
    expect(day(shell, { ...september, year: 2008 })).not.toBeNull();
    expect(day(shell, { ...september, year: 2006 })).toBeNull();
    expect(read).toHaveBeenCalledTimes(5);
  });

  it('Given a season read and the page idle, Then the seasons either side are asked for ahead, once, and not the ones beyond (#819)', async () => {
    const read = vi.fn<(url: string) => Promise<Uint8ClampedArray | null>>(() =>
      Promise.resolve(season()),
    );
    const idle = vi.fn((run: () => void) => {
      run();
    });
    const day = ozoneSeasons('/', vi.fn(), read, idle);
    day(shell, september);
    await vi.waitFor(() => {
      expect(read).toHaveBeenCalledTimes(3);
    });
    const asked = read.mock.calls.map(([url]) => url).sort();
    expect(asked).toEqual([
      '/data/ozone/shell-2005.png',
      '/data/ozone/shell-2006.png',
      '/data/ozone/shell-2007.png',
    ]);
    // Next season's first day is there when the turn comes, with no wait.
    expect(day(shell, { year: 2007, month: 7, day: 2 })).not.toBeNull();
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('Given the ends of the record, Then no season is asked for beyond them', async () => {
    const read = vi.fn<(url: string) => Promise<Uint8ClampedArray | null>>(() =>
      Promise.resolve(season()),
    );
    const idle = (run: () => void): void => {
      run();
    };
    const day = ozoneSeasons('/', vi.fn(), read, idle);
    day(shell, { year: 2003, month: 8, day: 1 });
    await vi.waitFor(() => {
      expect(read).toHaveBeenCalledTimes(2);
    });
    expect(read.mock.calls.map(([url]) => url).sort()).toEqual([
      '/data/ozone/shell-2003.png',
      '/data/ozone/shell-2004.png',
    ]);
  });

  it('Given the next season still coming, Then the last day of the one before stays; a far-off one shows nothing', async () => {
    let release: (pixels: Uint8ClampedArray) => void = () => undefined;
    const read = vi
      .fn<(url: string) => Promise<Uint8ClampedArray | null>>()
      .mockResolvedValueOnce(season())
      .mockReturnValueOnce(
        new Promise<Uint8ClampedArray>((resolve) => {
          release = resolve;
        }),
      )
      .mockResolvedValue(null);
    const day = ozoneSeasons('/', vi.fn(), read, never);
    day(shell, { year: 2006, month: 12, day: 31 });
    await vi.waitFor(() => {
      expect(day(shell, { year: 2006, month: 12, day: 31 })).not.toBeNull();
    });
    const held = day(shell, { year: 2006, month: 12, day: 31 });
    expect(day(shell, { year: 2007, month: 7, day: 1 })).toBe(held);
    expect(day(shell, { year: 2010, month: 7, day: 1 })).toBeNull();
    release(season());
  });
});
