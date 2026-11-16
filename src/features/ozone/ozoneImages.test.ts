import { describe, expect, it, vi } from 'vitest';

import served from '../../../public/data/ozone/maps.json' with { type: 'json' };
import type { OzoneMaps } from '../../data/ozoneMaps';
import { ozoneImages } from './ozoneImages';

const maps = served as unknown as OzoneMaps;
const picture = { width: 361, height: 181 } as unknown as HTMLImageElement;

describe('each October’s image', () => {
  it('Given a year first shown, Then its file is asked for once, and it is there once it has come', async () => {
    const arrived = vi.fn();
    const load = vi.fn(() => Promise.resolve(picture));
    const image = ozoneImages('/base/', arrived, load);
    expect(image(maps, 2006)).toBeNull();
    expect(image(maps, 2006)).toBeNull();
    expect(load).toHaveBeenCalledExactlyOnceWith('/base/data/ozone/october-2006.png');
    await vi.waitFor(() => {
      expect(arrived).toHaveBeenCalledOnce();
    });
    expect(image(maps, 2006)).toEqual({ year: 2006, image: picture, encoding: maps.encoding });
    expect(load).toHaveBeenCalledOnce();
  });

  it('Given a year the reanalysis lacks, Then nothing is asked for', () => {
    const load = vi.fn(() => Promise.resolve(picture));
    expect(ozoneImages('/', vi.fn(), load)(maps, 1960)).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('Given an image that cannot be fetched, Then there is none, and it is not asked for again', async () => {
    const arrived = vi.fn();
    const load = vi.fn(() => Promise.reject(new Error('offline')));
    const image = ozoneImages('/', arrived, load);
    expect(image(maps, 1990)).toBeNull();
    await Promise.resolve();
    await Promise.resolve();
    expect(image(maps, 1990)).toBeNull();
    expect(load).toHaveBeenCalledOnce();
    expect(arrived).not.toHaveBeenCalled();
  });
});
