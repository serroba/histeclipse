import { describe, expect, it } from 'vitest';

import data from '../../public/data/dipole.json';
import { dipoleAt, loadDipole, type DipoleSeries } from './dipoleMoment';

const serve = (body: unknown) => (): Promise<Response> => Promise.resolve(Response.json(body));
const real = data as DipoleSeries;

describe('the dipole moment (GGF100k)', () => {
  it('loads and checks the real file, and refuses a broken one', async () => {
    await expect(loadDipole('/d.json', serve(real))).resolves.toEqual(real);
    await expect(
      loadDipole('/d.json', serve({ ...real, ka: [...real.ka].reverse() })),
    ).rejects.toThrow();
    await expect(
      loadDipole('/d.json', serve({ ...real, dipole: real.dipole.slice(1) })),
    ).rejects.toThrow();
  });

  it('reaches back 55,000 years, every 50', () => {
    expect(real.ka[0]).toBe(0);
    expect(real.ka.at(-1)).toBe(55);
    expect(real.ka[1]).toBeCloseTo(0.05, 9);
  });

  it('falls to its lowest in the Laschamp excursion, about 41,000 years ago', () => {
    const lowest = Math.min(...real.dipole);
    expect(real.ka[real.dipole.indexOf(lowest)]).toBeCloseTo(40.85, 2);
    expect(lowest).toBeLessThan(3);
    expect(dipoleAt(real, 2)).toBeGreaterThan(9);
  });

  it('reads between its values, holds 1950’s after it, and stops at its end', () => {
    const series: DipoleSeries = { ...real, ka: [0, 1], dipole: [8, 6] };
    expect(dipoleAt(series, 0.5)).toBeCloseTo(7, 9);
    expect(dipoleAt(series, 1)).toBe(6);
    expect(dipoleAt(series, -0.07)).toBe(8);
    expect(dipoleAt(series, 1.01)).toBeNull();
  });
});
