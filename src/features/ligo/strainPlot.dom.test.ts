// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { GW150914_SCHEMA } from './measured';
import { clockText, createStrainPlot, plotPath, xOf, type PlotFrame } from './strainPlot';

const data = v.parse(
  GW150914_SCHEMA,
  JSON.parse(readFileSync('public/data/gw150914.json', 'utf8')),
);
const frame: PlotFrame = { from: 0, to: 1, range: 2, width: 100, height: 40 };

describe('what the two detectors measured, drawn (#831)', () => {
  it('lays time across and strain up, leaving out what is outside', () => {
    const series = { start: 0, rate: 2 };
    expect(plotPath([0, 2, -2, 1], series, frame)).toBe('M0.0,20.0L50.0,0.0L100.0,40.0');
    expect(plotPath([2], series, frame, 0.5, -1)).toBe('M50.0,40.0');
    expect(xOf(0.25, frame)).toBe(25);
  });

  it('gives the true time to the millisecond', () => {
    expect(clockText(0.392)).toBe('09:50:45.392 UTC');
    expect(clockText(0.4)).toBe('09:50:45.400 UTC');
  });

  it('draws both detectors from the file, Hanford shifted and turned, and a cursor that follows', () => {
    const plot = createStrainPlot(data);
    document.body.append(plot.root);
    const path = (id: string): string =>
      plot.root.querySelector(`[data-testid="${id}"]`)?.getAttribute('d') ?? '';
    // Every sample inside the window drawn: Livingston's all, Hanford's less those shifted out.
    expect(path('strain-l1').split('L')).toHaveLength(data.plus.length);
    expect(path('strain-h1').split('L').length).toBeLessThan(data.plus.length);
    expect(path('strain-h1').split('L').length).toBeGreaterThan(data.plus.length - 20);
    plot.setTime(data.merger);
    expect(plot.root.querySelector('[data-testid="strain-clock"]')?.textContent).toBe(
      clockText(data.merger),
    );
    const cursor = plot.root.querySelector('.strain-cursor');
    expect(Number(cursor?.getAttribute('x1'))).toBeGreaterThan(400);
    plot.setTime(-5);
    expect(cursor?.getAttribute('x1')).toBe('0.0');
  });
});
