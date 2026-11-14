import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { loadTemperatureRecords, recordsIn, recordsLine, recordsText } from './temperatureRecords';

const file = readFileSync(
  new URL('../../public/data/temperature-records/index.json', import.meta.url),
  'utf8',
);
const records = await loadTemperatureRecords('index.json', () =>
  Promise.resolve(new Response(file)),
);

describe('the temperature records', () => {
  it('Given the real file, Then six records on one baseline, the spread from 1850', () => {
    expect(records.series.map((record) => record.id)).toEqual([
      'hadcrut5',
      'berkeley',
      'noaaglobaltemp',
      'gistemp',
      'era5',
      'jra3q',
    ]);
    expect(records.baseline).toBe('1850–1900');
    expect(records.spread[0]?.[0]).toBe(1850);
  });

  it('Given a year, Then each record that has it, in order; years they lack leave them out', () => {
    expect(recordsIn(records, 2020).map(({ record }) => record.id)).toHaveLength(6);
    expect(recordsIn(records, 1860).map(({ record }) => record.id)).toEqual([
      'hadcrut5',
      'berkeley',
      'noaaglobaltemp',
    ]);
    expect(recordsIn(records, 1800)).toEqual([]);
  });

  it('Given a year, Then it reads each value and how far apart they are; outside, the reach', () => {
    expect(recordsText(records, 2020)).toMatch(
      /^2020, °C above 1850–1900: HadCRUT5 \(Met Office\) \+\d\.\d\d; .* They are \d\.\d\d °C apart\.$/,
    );
    expect(recordsText(records, 1800)).toBe('The records run from 1850 to 2025: none for 1800.');
    const one = { ...records, series: records.series.slice(0, 1) };
    expect(recordsText(one, 1850)).toBe('1850, °C above 1850–1900: HadCRUT5 (Met Office) −0.07.');
  });

  it('Given a year, Then a short line for the panel: the range, how many records, or none', () => {
    expect(recordsLine(records, 2020)).toMatch(/^2020: \+\d\.\d\d to \+\d\.\d\d °C, 6 records\.$/);
    const one = { ...records, series: records.series.slice(0, 1) };
    expect(recordsLine(one, 1850)).toBe('1850: −0.07 °C, 1 record.');
    expect(recordsLine(records, 1800)).toBe('No record for 1800.');
  });
});
