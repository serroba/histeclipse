/**
 * Temperature over 800,000 years in deep time's bar (#434, #453), above its slider: the chart
 * the planetary boundaries' story opens on, at full size, following the moment shown, its
 * colours keyed by the Temperature layer's scale in the bar's details. Dragged, or stepped with
 * the arrow keys, it takes the bar there, and the globe is coloured by the maps of that moment:
 * the chart's line and the globe's colours read together. Deep time keeps moments to the
 * thousand years, so the chart takes the bar no nearer the present than 1950; the story itself
 * carries the globe on to the measured warming.
 */

import type { HoloceneTemperature } from '../data/holoceneTemperature';
import { maOfYear } from '../data/iceSheets';
import { roundMa } from '../deepTime/scale';
import { createHoloceneChart } from '../story/holoceneChart';
import { element } from './dom';
import './temperatureChart.css';

/** The oldest moment the chart reaches, Ma. */
export const CHART_REACHES_MA = 0.8;

/** The moment a year on the chart is, as deep time keeps it: to the thousand years, in reach. */
export function maOfChart(year: number): number {
  return Math.min(CHART_REACHES_MA, roundMa(maOfYear(year)));
}

/** What the chart shows: the records, and the year the bar is at (astronomical). */
export interface TemperatureChartView {
  readonly data: HoloceneTemperature;
  readonly year: number;
}

export interface TemperatureChart {
  readonly root: HTMLElement;
  /** Show it at the view's year; null hides it. */
  render(view: TemperatureChartView | null): void;
}

export function createTemperatureChart(onMa: (ma: number) => void): TemperatureChart {
  const stage = element('div', { class: 'temperature-chart-stage' });
  const root = element(
    'figure',
    { class: 'temperature-chart', 'data-testid': 'temperature-chart', hidden: '' },
    element(
      'figcaption',
      {},
      'Global temperature over 800,000 years, against 1850–1900. Drag along it to go there: the globe shows how much warmer or colder each place was than today.',
    ),
    stage,
  );
  let chart: ReturnType<typeof createHoloceneChart> | null = null;
  let heldAt: number | null = null;
  let asked: number | null = null;
  // While the bar holds the chart, the years it names back are that hold's echo, not the reader's.
  let holding = false;
  // The reader's move goes to the bar; the bar, at that moment, then holds the chart there, so
  // the cursor and the bar name the same moment, to the thousand years.
  const heard = (year: number): void => {
    const ma = maOfChart(year);
    if (holding || ma === asked) return;
    asked = ma;
    onMa(ma);
  };
  return {
    root,
    render(view) {
      root.hidden = view === null;
      if (view === null) return;
      const ma = maOfChart(view.year);
      if (chart !== null && ma === heldAt) return;
      holding = true;
      chart ??= createHoloceneChart(stage, view.data, heard);
      chart.holdAt(view.year);
      heldAt = ma;
      holding = false;
    },
  };
}
