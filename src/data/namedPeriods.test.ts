import { describe, expect, it } from 'vitest';

import data from '../../public/data/periods.json';
import {
  countryRings,
  loadNamedPeriods,
  periodsHere,
  periodsText,
  type NamedPeriods,
} from './namedPeriods';

const serve = (body: unknown) => (): Promise<Response> => Promise.resolve(Response.json(body));

const small: NamedPeriods = {
  schemaVersion: 1,
  credit: 'PeriodO',
  source: 'https://perio.do',
  accessed: '2026-11-03',
  countries: [{ name: 'Israel', rings: [[3400, 2900, 3600, 2900, 3600, 3300, 3400, 3300]] }],
  citations: ['King & Stager 2001', 'Levy 1995'],
  periods: [
    ['Early Bronze', -3499, -2249, 0, [0]],
    ['Early Bronze II', -2999, -2699, 1, [0]],
    ['Iron Age', -1199, -585, 0, [0]],
  ],
};

describe('named periods', () => {
  it('load and check, the real file too', async () => {
    const loaded = await loadNamedPeriods('periods.json', serve(data));
    expect(loaded.periods.length).toBeGreaterThan(1000);
    await expect(loadNamedPeriods('x', serve({ ...small, periods: [['x']] }))).rejects.toThrow();
  });

  it('find the periods covering the country of a place in a year, narrowest first', () => {
    const here = periodsHere(small, countryRings(small), { latitude: 31, longitude: 35 }, -2799);
    expect(here?.country).toBe('Israel');
    expect(here?.periods.map((period) => period.name)).toEqual(['Early Bronze II', 'Early Bronze']);
    expect(
      periodsHere(small, countryRings(small), { latitude: 0, longitude: 0 }, -2799),
    ).toBeNull();
  });

  it('say them with their sources', () => {
    const here = periodsHere(small, countryRings(small), { latitude: 31, longitude: 35 }, -2799);
    expect(periodsText(here, '2800 BCE')).toBe(
      'Periods named for Israel in 2800 BCE, each by its source: Early Bronze II (Levy 1995); Early Bronze (King & Stager 2001).',
    );
    expect(periodsText(null, '2800 BCE')).toContain('Pick a place on land');
    expect(periodsText({ country: 'Israel', periods: [] }, '2026 CE')).toBe(
      'No named periods for Israel in 2026 CE in PeriodO.',
    );
  });

  it('find several definitions of the Bronze Age in Greece in the real file', async () => {
    const loaded = await loadNamedPeriods('periods.json', serve(data));
    const here = periodsHere(loaded, countryRings(loaded), { latitude: 38, longitude: 23 }, -1999);
    expect(here?.country).toBe('Greece');
    expect(here?.periods.length).toBeGreaterThan(3);
  });
});
