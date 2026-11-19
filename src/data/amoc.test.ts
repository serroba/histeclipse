import { describe, expect, it } from 'vitest';

import file from '../../public/data/amoc/index.json';
import { amocText, loadAmoc, rangeOf, seriesSpan, valueIn, valueText, type Amoc } from './amoc';

const amoc = file as unknown as Amoc;
const byId = (id: string) => {
  const found = amoc.series.find((series) => series.id === id);
  if (found === undefined) throw new Error(id);
  return found;
};

describe('the AMOC’s sources (#925)', () => {
  it('Given the published file, Then it reads: the array and five reconstructions', async () => {
    const read = await loadAmoc('/a.json', () =>
      Promise.resolve(new Response(JSON.stringify(file))),
    );
    expect(read.series.map(({ id }) => id)).toEqual([
      'rapid',
      'caesar-2018',
      'rahmstorf-2015',
      'thornalley-2018',
      'terhaar-2025-era5',
      'terhaar-2025-jra55',
    ]);
    expect(seriesSpan(byId('rapid')).first).toBeCloseTo(2004.29, 2);
  });

  it('Given a year, Then each source’s value: RAPID’s months averaged, a yearly one as is, none outside', () => {
    const rapid = byId('rapid');
    const months = rapid.values.filter((_, at) => Math.floor(rapid.years[at] ?? 0) === 2010);
    expect(months).toHaveLength(12);
    expect(valueIn(rapid, 2010)).toBeCloseTo(months.reduce((a, b) => a + b, 0) / 12, 9);
    expect(valueIn(byId('caesar-2018'), 1900)).toBe(byId('caesar-2018').values[29]);
    expect(valueIn(rapid, 1990)).toBeNull();
  });

  it('Given a source, Then its range: low and high as given, or ± its standard deviation, or none', () => {
    expect(rangeOf(byId('caesar-2018'))?.low[0]).toBe(byId('caesar-2018').low?.[0]);
    const terhaar = byId('terhaar-2025-era5');
    const spread = rangeOf(terhaar);
    expect(spread?.high[0]).toBeCloseTo((terhaar.values[0] ?? 0) + (terhaar.std?.[0] ?? 0), 9);
    expect(rangeOf(byId('rapid'))).toBeNull();
    const odd = { ...terhaar, std: [] };
    expect(rangeOf(odd)?.low[0]).toBe(terhaar.values[0]);
  });

  it('Given values, Then in each source’s own units, and a year in words', () => {
    expect(valueText(byId('rapid'), 17.26)).toBe('17.3 Sv');
    expect(valueText(byId('caesar-2018'), -8.4)).toBe('−8.40 K');
    expect(valueText(byId('thornalley-2018'), 2.81)).toBe('+2.81');
    expect(valueText(byId('terhaar-2025-era5'), 0)).toBe('0.00 Sv');
    expect(amocText(amoc, 2010)).toMatch(
      /^2010: RAPID array, 26\.5°N \d+\.\d Sv; Caesar et al\. 2018 /,
    );
    expect(amocText(amoc, 300)).toBe('No source reaches 300.');
  });
});
