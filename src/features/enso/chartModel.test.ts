import { describe, expect, it } from 'vitest';

import { monthOf, type Enso } from '../../data/enso';
import { CHART_HEIGHT, CHART_WIDTH, ensoChart } from './chartModel';

const index = (id: string, values: number[], episodes: Enso['indices'][number]['episodes']) => ({
  id,
  label: id,
  official: 'o',
  method: 'm',
  baseline: 'b',
  url: 'https://example.org/',
  first: '2000-01',
  values,
  episodes,
});

const ENSO: Enso = {
  schemaVersion: 1,
  credit: 'c',
  source: 'https://example.org/',
  licence: 'l',
  accessed: '2026-11-19',
  units: '°C',
  placed: 'p',
  threshold: 0.5,
  seasons: 5,
  provisionalMonths: 2,
  indices: [
    index(
      'roni',
      [0, 3, -2.5, 9],
      [{ phase: 'elNino', first: '2000-02', last: '2000-02', peak: 3, peakAt: '2000-02' }],
    ),
    index('oni', [0, 1, 0, 0], []),
  ],
};

describe('the ENSO chart', () => {
  it('Given the indices, Then a line each over the shared months, clipped to the axis', () => {
    const chart = ensoChart(ENSO, monthOf(2000, 1));
    expect(chart.lines.map(({ id }) => id)).toEqual(['roni', 'oni']);
    // Four months, each a quarter of the width, drawn at their middles; 3 °C at the top, 9 clipped.
    expect(chart.lines[0]?.d).toBe('M125.0,163.6L375.0,0.0L625.0,300.0L875.0,0.0');
    expect(chart.cursorX).toBe(CHART_WIDTH / 8);
  });

  it('Given the threshold, Then lines for it either side of zero', () => {
    const chart = ensoChart(ENSO, monthOf(2000, 1));
    expect(chart.zeroY).toBeCloseTo((3 / 5.5) * CHART_HEIGHT);
    expect(chart.warmY).toBeLessThan(chart.zeroY);
    expect(chart.coolY).toBeGreaterThan(chart.zeroY);
  });

  it('Given episodes, Then each index’s strip spans them, month by month', () => {
    const chart = ensoChart(ENSO, monthOf(2000, 1));
    expect(chart.strips).toEqual([
      { id: 'roni', name: 'RONI', episodes: [{ x: 250, width: 250, phase: 'elNino' }] },
      { id: 'oni', name: 'ONI', episodes: [] },
    ]);
  });

  it('Given a month outside, Then no cursor', () => {
    expect(ensoChart(ENSO, monthOf(1990, 1)).cursorX).toBeNull();
    expect(ensoChart(ENSO, monthOf(2000, 5)).cursorX).toBeNull();
  });
});
