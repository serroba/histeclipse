import { describe, expect, it } from 'vitest';

import json from '../../public/data/holocene-temperature.json';
import {
  bandPath,
  completePoints,
  corridorOf,
  glacialLow,
  latestYear,
  linePath,
  loadHoloceneTemperature,
  PANELS,
  seriesOf,
  xOf,
  yOf,
  type HoloceneTemperature,
  type TemperatureSeries,
} from './holoceneTemperature';

const data: HoloceneTemperature = await loadHoloceneTemperature('/t.json', () =>
  Promise.resolve(new Response(JSON.stringify(json))),
);

describe('the temperature records', () => {
  it('are the four the report cites, one of them Antarctic', () => {
    expect(data.series.map((each) => each.id)).toEqual(['epica', 'lgmr', 'pages2k', 'hadcrut5']);
    expect(data.series.filter((each) => each.scope === 'antarctic').map((each) => each.id)).toEqual(
      ['epica'],
    );
    expect(seriesOf(data, 'epica').points[0]?.[0]).toBeLessThan(-790_000);
  });

  it('reject a file of another shape', async () => {
    await expect(
      loadHoloceneTemperature('/t.json', () =>
        Promise.resolve(new Response(JSON.stringify({ schemaVersion: 2, series: [] }))),
      ),
    ).rejects.toThrow();
  });

  it('name a missing series', () => {
    expect(() => seriesOf({ ...data, series: [] }, 'lgmr')).toThrow(/No lgmr/);
  });
});

describe('what the chapter says of them', () => {
  // The caption's words, held to the data.
  it('the last 10,000 years before industry stayed within about a degree', () => {
    const { low, high } = corridorOf(data);
    expect(high - low).toBeGreaterThan(0.8);
    expect(high - low).toBeLessThan(1.2);
  });

  it('the last ice age was about 7 °C colder, globally', () => {
    const { year, celsius } = glacialLow(data);
    expect(celsius).toBeLessThan(-6.5);
    expect(celsius).toBeGreaterThan(-8);
    expect(year).toBeLessThan(-15_000);
  });

  it('the last full year measured was about 1.4 °C above 1850–1900, out of the corridor', () => {
    const { year, celsius } = latestYear(data);
    expect(year).toBe(2025);
    expect(celsius).toBeCloseTo(1.41, 2);
    expect(celsius).toBeGreaterThan(corridorOf(data).high + 1);
  });

  it('leaves out a year the file marks as perhaps incomplete', () => {
    const series = seriesOf(data, 'hadcrut5');
    expect(completePoints(series).at(-1)?.[0]).toBe((series.lastYear ?? 0) - 1);
    expect(completePoints(seriesOf(data, 'lgmr'))).toBe(seriesOf(data, 'lgmr').points);
    expect(() => latestYear({ ...data, series: [{ ...series, points: [] }] })).toThrow(
      /No complete year/,
    );
  });
});

describe('the chart’s scales', () => {
  it('spread time over three panels, each linear, edge to edge', () => {
    expect(PANELS.reduce((sum, panel) => sum + panel.share, 0)).toBeCloseTo(1, 9);
    expect(xOf(-900_000)).toBe(0);
    expect(xOf(-800_000)).toBe(0);
    expect(xOf(-20_000)).toBeCloseTo(PANELS[0]?.share ?? 0, 9);
    expect(xOf(1750)).toBeCloseTo(1 - (PANELS[2]?.share ?? 0), 9);
    expect(xOf(2030)).toBeCloseTo(1, 9);
    expect(xOf(3000)).toBe(1);
    expect(xOf(1900)).toBeGreaterThan(xOf(1800));
  });

  it('put warm at the top and clamp what falls outside', () => {
    expect(yOf(4)).toBe(0);
    expect(yOf(-10)).toBe(1);
    expect(yOf(20)).toBe(0);
    expect(yOf(-20)).toBe(1);
    expect(yOf(0)).toBeCloseTo(4 / 14, 9);
  });

  it('draw a line through the medians and a band round the range', () => {
    const points: TemperatureSeries['points'] = [
      [-800_000, 4, null, null],
      [2030, -10, -10, -10],
    ];
    expect(linePath(points, 100, 50)).toBe('M0.0 0.0L100.0 50.0');
    expect(bandPath(points, 100, 50)).toBe('M100.0 50.0L100.0 50.0Z');
    expect(bandPath([[0, 0, null, null]], 100, 50)).toBe('');
  });
});
