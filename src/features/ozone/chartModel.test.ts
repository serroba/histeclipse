import { describe, expect, it } from 'vitest';

import type { OzoneHistory } from '../../data/ozone';
import { CHART_HEIGHT, CHART_WIDTH, ozoneCharts } from './chartModel';

const HISTORY = {
  schemaVersion: 1,
  hole: {
    credit: 'NASA Ozone Watch',
    source: 'https://ozonewatch.gsfc.nasa.gov/',
    licence: 'Public domain',
    columns: ['year', 'areaMkm2', 'minimumDU'],
    area: 'Mean area',
    minimum: 'Mean minimum',
    missing: [1995],
    rows: [
      [1979, 0, 225],
      [1995, null, null],
      [2011, 32, 100],
    ],
  },
  gases: {
    credit: 'NOAA',
    source: 'https://gml.noaa.gov/odgi/',
    licence: 'Public domain',
    columns: ['year', 'eescPpt', 'odgi'],
    index: '100 at the peak',
    antarctic: [
      [1992, 3544, 100],
      [2011, 3500, 50],
    ],
    midlatitude: [],
  },
} as const satisfies OzoneHistory;

describe('the ozone charts', () => {
  it('Given the record, Then the area line breaks at the missing year, and the index runs on', () => {
    const charts = ozoneCharts(HISTORY, 2000);
    expect(charts.area).toBe(`M0.0,${CHART_HEIGHT.toFixed(1)}M${CHART_WIDTH.toFixed(1)},0.0`);
    expect(charts.gases).toBe('M406.3,0.0L1000.0,60.0');
    expect(charts.missing).toEqual([1995]);
  });

  it('Given years inside and outside the record, Then the cursor is placed or left out; Montreal is marked', () => {
    expect(ozoneCharts(HISTORY, 1979).cursorX).toBe(0);
    expect(ozoneCharts(HISTORY, 2011).cursorX).toBe(CHART_WIDTH);
    expect(ozoneCharts(HISTORY, 1900).cursorX).toBeNull();
    expect(ozoneCharts(HISTORY, 2026).cursorX).toBeNull();
    expect(ozoneCharts(HISTORY, 2000).montrealX).toBeCloseTo(((1987 - 1979) / 32) * CHART_WIDTH);
  });

  it('Given no years, Then the axis falls back to the Montreal Protocol and nothing is drawn', () => {
    const charts = ozoneCharts({ ...HISTORY, hole: { ...HISTORY.hole, rows: [] } }, 1987);
    expect([charts.first, charts.last, charts.area]).toEqual([1987, 1987, '']);
  });
});
