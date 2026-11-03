import { describe, expect, it } from 'vitest';

import { iceOutlinesAt, loadIceOutlines, type IceOutlineIndex } from './iceOutlines';

const ring = [-10000, 5000, -6000, 5000, -6000, 7000];
const index: IceOutlineIndex = {
  schemaVersion: 1,
  credit: 'Batchelor et al. (2019)',
  source: 'https://osf.io/7jen3/',
  scale: 100,
  slices: [
    { name: 'LGM', fromKa: 24, toKa: 29, min: [], best: [ring], max: [] },
    { name: '30 ka', fromKa: 27.5, toKa: 32.5, min: [ring], best: [ring], max: [ring] },
    { name: 'MIS 6', fromKa: 132, toKa: 190, min: [], best: [ring], max: [ring, ring] },
  ],
};

describe('ice-sheet outlines', () => {
  it('finds the time slice of a moment, in degrees', () => {
    const mis6 = iceOutlinesAt(index, 150);
    expect(mis6?.name).toBe('MIS 6');
    expect(mis6?.best).toEqual([
      [
        [-100, 50],
        [-60, 50],
        [-60, 70],
      ],
    ]);
    expect(mis6?.max).toHaveLength(2);
    expect(mis6?.min).toEqual([]);
  });

  it('shows nothing between the time slices', () => {
    expect(iceOutlinesAt(index, 100)).toBeNull();
    expect(iceOutlinesAt(index, 10)).toBeNull();
  });

  it('picks the slice whose middle is nearer where two meet', () => {
    expect(iceOutlinesAt(index, 28)?.name).toBe('LGM');
    expect(iceOutlinesAt(index, 29)?.name).toBe('30 ka');
  });

  it('loads and checks the file', async () => {
    const fetchJson = (): Promise<Response> => Promise.resolve(Response.json(index));
    await expect(loadIceOutlines('batchelor.json', fetchJson)).resolves.toEqual(index);
    const odd = { ...index, slices: [{ ...index.slices[0], best: [[1, 2, 3]] }] };
    const bad = (): Promise<Response> => Promise.resolve(Response.json(odd));
    await expect(loadIceOutlines('batchelor.json', bad)).rejects.toThrow();
  });
});
