import { describe, expect, it } from 'vitest';

import type { TemperatureRecords } from '../../data/temperatureRecords';
import { CHART_HEIGHT, CHART_WIDTH, recordsChart } from './chartModel';

const series = (id: string, kind: 'station and ship record' | 'reanalysis') => ({
  id,
  name: id,
  kind,
  sourceId: id,
  credit: id,
  source: 'https://example.org/',
  ownBaseline: '1961-1990',
  baseline: '1850-1900',
  shift: 0,
  note: 'n',
});

const RECORDS = {
  schemaVersion: 1,
  units: '°C',
  baseline: '1850–1900',
  lastYear: 1950,
  credit: 'c',
  source: [],
  range: 'r',
  series: [
    {
      ...series('a', 'station and ship record'),
      points: [
        [1850, -0.6, null, null],
        [1950, 1.8, null, null],
      ],
    },
    { ...series('b', 'reanalysis'), points: [[1900, 5, null, null]] },
  ],
  spread: [
    [1850, -0.6, -0.6, 1],
    [1950, 0, 1.8, 2],
  ],
} as const satisfies TemperatureRecords;

describe('the records chart', () => {
  it('Given two records, Then one line each, reanalyses told apart, values held to the axis', () => {
    const chart = recordsChart(RECORDS, 1900);
    expect(chart.lines).toEqual([
      {
        id: 'a',
        kind: 'record',
        d: `M0.0,${CHART_HEIGHT.toFixed(1)}L${CHART_WIDTH.toFixed(1)},0.0`,
      },
      { id: 'b', kind: 'reanalysis', d: 'M500.0,0.0' },
    ]);
    expect(chart.band).toBe('M0.0,300.0L1000.0,0.0L1000.0,225.0L0.0,300.0Z');
    expect(chart.zeroY).toBe(225);
    expect(chart.cursorX).toBe(500);
  });

  it('Given a year outside, or no spread, Then no cursor, and no band', () => {
    expect(recordsChart(RECORDS, 1800).cursorX).toBeNull();
    expect(recordsChart(RECORDS, 2000).cursorX).toBeNull();
    const empty = recordsChart({ ...RECORDS, spread: [] }, 1950);
    expect([empty.band, empty.first]).toEqual(['', 1950]);
  });
});
