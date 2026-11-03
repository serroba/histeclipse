import { describe, expect, it } from 'vitest';

import data from '../../public/data/air-deep.json';
import {
  co2At,
  co2Reach,
  co2Text,
  estimatesNear,
  loadDeepAir,
  NITROGEN_NOTE,
  o2At,
  o2Text,
  type DeepAir,
} from './deepAir';

const serve = (body: unknown) => (): Promise<Response> => Promise.resolve(Response.json(body));

const small: DeepAir = {
  schemaVersion: 1,
  co2: {
    credit: 'Foster et al. 2017',
    doi: '10.1038/ncomms14845',
    fit: [
      [0, 280, 180, 230, 310, 340],
      [10, 380, 200, 300, 460, 560],
    ],
    proxies: [
      {
        name: 'Boron',
        estimates: [
          [9, 390, 350, 420],
          [3, 400, null, null],
        ],
      },
      { name: 'Stomata', estimates: [[2, 300, 250, 350]] },
    ],
  },
  o2: {
    credit: 'Mills et al. 2023',
    doi: '10.1146/annurev-earth-032320-095425',
    points: [
      [0, 20.6, 18.2, 28.0],
      [10, 22.6, 17.2, 26.0],
    ],
  },
};

describe('the air of the last 540 million years', () => {
  it('loads and checks, the real file too', async () => {
    await expect(loadDeepAir('x', serve(small))).resolves.toEqual(small);
    const real = await loadDeepAir('air-deep.json', serve(data));
    expect(co2Reach(real)).toBe(419);
    expect(real.o2.points.at(-1)?.[0]).toBe(541);
    // CO2 low in the late Paleozoic ice age, high in the early Jurassic; O2 highest near the
    // end of the Permian.
    expect(co2At(real, 300)?.best).toBeLessThan(500);
    expect(co2At(real, 200)?.best).toBeGreaterThan(1500);
    expect(o2At(real, 252)?.best).toBeGreaterThan(30);
  });

  it('reads CO2 between the fit’s steps, with its ranges, and nothing beyond it', () => {
    expect(co2At(small, 5)).toEqual({ best: 330, likely: [265, 385], possible: [190, 450] });
    expect(co2At(small, 0)?.best).toBe(280);
    expect(co2At(small, 11)).toBeNull();
  });

  it('reads O2 between the steps, with the range', () => {
    expect(o2At(small, 5)).toEqual({ best: 21.6, range: [17.7, 27] });
    expect(o2At(small, 20)).toBeNull();
  });

  it('counts the estimates near a moment by proxy, most first', () => {
    expect(estimatesNear(small, 3, 2)).toEqual([
      { name: 'Boron', count: 1 },
      { name: 'Stomata', count: 1 },
    ]);
    expect(estimatesNear(small, 8, 1)).toEqual([{ name: 'Boron', count: 1 }]);
    expect(estimatesNear(small, 20, 5)).toEqual([]);
  });

  it('says what CO2 was, against 1750, and from how many estimates', () => {
    expect(co2Text(small, 5)).toBe(
      'Carbon dioxide (CO₂): about 330 ppm (1.2× the 1750 level); likely 265–385, possibly 190–450. Estimates within 5 million years: Boron 2, Stomata 1.',
    );
    expect(co2Text({ ...small, co2: { ...small.co2, proxies: [] } }, 5)).toContain(
      'No estimates within 5 million years: the fit bridges the gap.',
    );
    expect(co2Text(small, 50)).toBe(
      'Carbon dioxide (CO₂): the compilation’s fit reaches 10 million years back, not this far.',
    );
  });

  it('says what O2 was, against today', () => {
    expect(o2Text(small, 5)).toBe(
      'Oxygen (O₂): about 22% of the air (today 20.9%); the methods combined range 18–27%.',
    );
    expect(
      o2Text(
        {
          ...small,
          o2: {
            ...small.o2,
            points: [
              [0, 5.5, 0.2, 9.5],
              [1, 5.5, 0.2, 9.5],
            ],
          },
        },
        0,
      ),
    ).toBe(
      'Oxygen (O₂): about 5.5% of the air (today 20.9%); the methods combined range 0.2–9.5%.',
    );
    expect(o2Text(small, 600)).toBe('Oxygen (O₂): the estimate begins 541 million years ago.');
  });

  it('gives nitrogen in words, with each view’s source', () => {
    expect(NITROGEN_NOTE.text).toContain('no record is firm enough to chart');
    expect(NITROGEN_NOTE.sources.map(({ doi }) => doi)).toEqual([
      '10.1130/G22470.1',
      '10.1029/2017GC007392',
      '10.1038/nature10890',
      '10.1038/ngeo2713',
    ]);
  });
});
