import { describe, expect, it, vi } from 'vitest';

import file from '../../../public/data/ocean-temperature/index.json';
import { sectionMaps } from './sectionMaps';

vi.mock('../../util/loadImage', () => ({
  loadImage: (url: string) => Promise.resolve({ width: 160, height: 41, url }),
}));

const month = (year: number, number: number): number => year * 12 + number - 1;

describe('the equatorial sections (#895)', () => {
  it('Given the index and a month, Then that month’s section with its depths, once loaded', async () => {
    const refresh = vi.fn();
    const sections = sectionMaps({
      base: '/',
      fetchJson: () => Promise.resolve(new Response(JSON.stringify(file))),
      notify: vi.fn(),
      refresh,
    });
    const at = month(1997, 12);
    sections.show(true, at);
    expect(sections.view(at)).toBeNull();
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    sections.show(true, at);
    await vi.waitFor(() => {
      expect(sections.view(at)).not.toBeNull();
    });
    const view = sections.view(at);
    expect(view?.at).toBe(at);
    expect(view?.levels).toHaveLength(41);
    expect(view?.packed).toMatchObject({
      bound: 4,
      image: { url: '/data/ocean-temperature/section/1997-12.png' },
    });
    expect(sections.view(month(1939, 6))).toBeNull();
    sections.show(false, at);
    expect(sections.view(at)).toBeNull();
  });
});
