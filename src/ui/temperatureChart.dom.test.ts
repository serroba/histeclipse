// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import type { HoloceneTemperature } from '../data/holoceneTemperature';

// The chart itself is SVG glue the Playwright suite covers: here, what it is asked, and its year.
const charts = vi.hoisted(() => ({
  made: [] as { onYear: (year: number) => void; held: number[] }[],
}));
vi.mock('../story/holoceneChart', () => ({
  createHoloceneChart: (_stage: HTMLElement, _data: unknown, onYear: (year: number) => void) => {
    const chart = { onYear, held: [] as number[] };
    charts.made.push(chart);
    // Drawn, it names its first year at once.
    onYear(-798_050);
    return {
      holdAt: (year: number) => {
        chart.held.push(year);
        onYear(year);
        return year;
      },
    };
  },
}));

const { createTemperatureChart, maOfChart } = await import('./temperatureChart');

const data = {} as HoloceneTemperature;

describe('temperature over 800,000 years in deep time’s bar (#434)', () => {
  it('takes a year on the chart to deep time’s moment, to the thousand years, within its reach', () => {
    expect(maOfChart(-18_050)).toBe(0.02);
    expect(maOfChart(2020)).toBe(0);
    expect(maOfChart(-2_000_000)).toBe(0.8);
  });

  it('Given the bar’s moment, Then the chart held there, its echoes not taken for the reader’s', () => {
    charts.made.length = 0;
    const onMa = vi.fn();
    const chart = createTemperatureChart(onMa);
    expect(chart.root.hidden).toBe(true);
    chart.render({ data, year: -19_050 });
    expect(chart.root.hidden).toBe(false);
    expect(charts.made).toHaveLength(1);
    expect(charts.made[0]?.held).toEqual([-19_050]);
    // The same moment again asks nothing; another holds it there.
    chart.render({ data, year: -19_050 });
    chart.render({ data, year: -9_050 });
    expect(charts.made[0]?.held).toEqual([-19_050, -9_050]);
    expect(onMa).not.toHaveBeenCalled();
    chart.render(null);
    expect(chart.root.hidden).toBe(true);
  });

  it('Given the reader drags it, Then the bar goes to that moment, once, and the cursor to the bar’s', () => {
    charts.made.length = 0;
    const onMa = vi.fn();
    const chart = createTemperatureChart(onMa);
    chart.render({ data, year: -19_050 });
    charts.made[0]?.onYear(-120_050);
    expect(onMa).toHaveBeenCalledWith(0.122);
    // Within the same thousand years, nothing more.
    charts.made[0]?.onYear(-120_300);
    expect(onMa).toHaveBeenCalledTimes(1);
    // The bar then shows that moment, and the cursor is put on it.
    chart.render({ data, year: -120_050 });
    expect(charts.made[0]?.held).toEqual([-19_050, -120_050]);
    expect(onMa).toHaveBeenCalledTimes(1);
  });
});
