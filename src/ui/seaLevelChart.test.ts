import { describe, expect, it } from 'vitest';

import type { SeaLevelIndex, SeaLevelSeries } from '../data/seaLevel';
import {
  bandPath,
  CHART_HEIGHT,
  CHART_WIDTH,
  chartFrame,
  columnPoints,
  kaAt,
  levelText,
  spanText,
  xOf,
  yOf,
} from './seaLevelChart';

const series = (overrides: Partial<SeaLevelSeries> = {}): SeaLevelSeries => ({
  id: 'test',
  label: 'Test 2024',
  method: 'm',
  source: 's',
  url: 'https://example.org',
  licence: 'CC BY 4.0',
  ages: [0, 1000, 2000],
  level: [0, -100, 50],
  ...overrides,
});

const frame = { oldestKa: 2000, minMetres: -100, maxMetres: 100 };

describe('the chart frame', () => {
  it('puts the oldest moment on the left and today on the right', () => {
    expect(xOf(2000, frame)).toBe(0);
    expect(xOf(0, frame)).toBe(CHART_WIDTH);
    expect(kaAt(CHART_WIDTH / 2, frame)).toBe(1000);
    expect(kaAt(-5, frame)).toBe(2000);
    expect(kaAt(CHART_WIDTH + 5, frame)).toBe(0);
  });

  it('puts higher seas higher', () => {
    expect(yOf(100, frame)).toBe(0);
    expect(yOf(-100, frame)).toBe(CHART_HEIGHT);
  });

  it('spans every value within the span, and today’s level', () => {
    const index: SeaLevelIndex = {
      schemaVersion: 1,
      series: [series({ low: [-10, -120, 40], high: [10, -80, 300] })],
    };
    const near = chartFrame(index, 1000);
    expect(near.minMetres).toBeLessThan(-120);
    // The 300 m high at 2000 ka is outside a 1000 ka span.
    expect(near.maxMetres).toBeLessThan(50);
    expect(chartFrame(index, 2000).maxMetres).toBeGreaterThan(300);
  });
});

describe('columnPoints', () => {
  it('runs left to right, older first', () => {
    const points = columnPoints([0, 1000, 2000], [0, -100, 50], frame);
    expect(points.map(([x]) => x)).toEqual([0, CHART_WIDTH / 2, CHART_WIDTH]);
  });

  it('keeps the highest and lowest within a unit of width', () => {
    // All within one unit of width (x from 499.9 down to 499.6).
    const ages = [1000.2, 1000.4, 1000.6, 1000.8];
    const points = columnPoints(ages, [0, 80, -90, 10], { ...frame, oldestKa: 2000 });
    expect(points).toHaveLength(2);
    expect(points.map(([, y]) => y).sort((a, b) => a - b)).toEqual([
      yOf(80, frame),
      yOf(-90, frame),
    ]);
  });

  it('leaves out ages beyond the span', () => {
    expect(columnPoints([0, 3000], [0, 10], frame)).toHaveLength(1);
  });
});

describe('bandPath', () => {
  it('closes a band between the range’s edges, or has none', () => {
    expect(bandPath(series({ low: [-1, -2, -3], high: [1, 2, 3] }), frame)).toMatch(/^M.*Z$/);
    expect(bandPath(series(), frame)).toBeNull();
    expect(
      bandPath(series({ ages: [5000, 6000], level: [0, 0], low: [0, 0], high: [0, 0] }), frame),
    ).toBeNull();
  });
});

describe('the legend’s words', () => {
  it('gives the level, its range, and where a series stops', () => {
    expect(levelText(series(), 0)).toBe('0 m');
    expect(levelText(series(), 500)).toBe('−50 m');
    expect(levelText(series({ low: [0, 0, 40], high: [0, 0, 60] }), 2000)).toBe(
      '+50 m (+40 to +60)',
    );
    expect(levelText(series(), 3000)).toBeNull();
    expect(spanText(series())).toBe('covers today to 2 Ma');
    expect(spanText(series({ ages: [980, 64_820] }))).toBe('covers 980 ka to 65 Ma');
  });
});
