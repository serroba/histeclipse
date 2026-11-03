import { describe, expect, it } from 'vitest';

import data from '../../public/data/atmosphere.json';
import { gasAt, gasText, loadAtmosphere, oldestKa, type Gas } from './atmosphere';

const serve = (body: unknown) => (): Promise<Response> => Promise.resolve(Response.json(body));

const co2: Gas = {
  id: 'co2',
  name: 'Carbon dioxide',
  unit: 'ppm',
  credit: 'Bereiter et al. 2015',
  doi: '10.1002/2014GL061957',
  preindustrial: 278,
  points: [
    [0, 280, 1],
    [20, 190, 2],
    [800, 200, 3],
  ],
};

describe('the ice-core gases', () => {
  it('load and check, the real file too', async () => {
    const loaded = await loadAtmosphere('atmosphere.json', serve(data));
    expect(loaded.gases.map((gas) => gas.id)).toEqual(['co2', 'ch4']);
    const backwards = {
      ...data,
      gases: [
        {
          ...co2,
          points: [
            [5, 1, 1],
            [1, 1, 1],
          ],
        },
      ],
    };
    await expect(loadAtmosphere('x', serve(backwards))).rejects.toThrow();
  });

  it('read a gas between measurements, with the larger 1σ, and nothing beyond the record', () => {
    expect(gasAt(co2, 10)).toEqual({ value: 235, sigma: 2 });
    expect(gasAt(co2, 20)).toEqual({ value: 190, sigma: 2 });
    expect(gasAt(co2, 0)).toEqual({ value: 280, sigma: 1 });
    expect(gasAt(co2, 900)).toBeNull();
    expect(gasAt(co2, -1)).toEqual({ value: 280, sigma: 1 });
    expect(oldestKa(co2)).toBe(800);
  });

  it('say the level and how it compares with 1750', () => {
    const ch4: Gas = { ...co2, id: 'ch4', name: 'Methane', unit: 'ppb', preindustrial: 729 };
    expect(
      gasText(
        {
          ...ch4,
          points: [
            [0, 700, 0.2],
            [10, 365, 0.4],
          ],
        },
        10,
      ),
    ).toBe('Methane (CH₄): 365 ppb (±1), 50% of the 1750 level (729 ppb).');
    expect(gasText(co2, 20)).toBe(
      'Carbon dioxide (CO₂): 190 ppm (±2), 68% of the 1750 level (278 ppm).',
    );
    expect(gasText(co2, 1000)).toBe(
      'Carbon dioxide (CO₂): the ice cores reach 800,000 years back, not this far.',
    );
  });

  it('find glacial CO₂ near 190 ppm at the Last Glacial Maximum in the real record', async () => {
    const loaded = await loadAtmosphere('atmosphere.json', serve(data));
    const real = loaded.gases[0];
    if (real === undefined) throw new Error('no CO2');
    const lgm = gasAt(real, 21);
    expect(lgm?.value).toBeGreaterThan(180);
    expect(lgm?.value).toBeLessThan(200);
  });
});
