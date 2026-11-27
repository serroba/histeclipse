/**
 * Measured records on an event's clock (#1229): readings drawn above its slider, each where its
 * dated moment falls on the slider's own scale, so the thumb is the chart's cursor. A reading
 * known only to lie between two dates is drawn across them. The record's words say whose it is
 * and what is assumed in placing it. Where a clock has more than one record, one is shown at a
 * time, picked by name.
 */

import type { ClockScale } from '../../deepTime/clockScale';
import { element } from '../../ui/dom';

/** One reading: when, seconds since the clock's zero, and its value. */
export interface ProxyReading {
  readonly seconds: number;
  readonly value: number;
  /** Which of the chart's series it is in. */
  readonly series: number;
  /** Where it is known only to lie between two moments, seconds: drawn across them. */
  readonly between?: readonly [number, number];
}

export interface ProxyChart {
  /** Its name to pick it by, where a clock has more than one: "Temperature". */
  readonly name: string;
  /** What is measured, and in what: "Sea-surface temperature at Meishan, °C". */
  readonly title: string;
  readonly low: number;
  readonly high: number;
  /** Each series' name: drawn in its own colour, as the key says. */
  readonly series: readonly string[];
  readonly readings: readonly ProxyReading[];
  /** Whose readings, how they are dated, and what is assumed. */
  readonly says: string;
}

export interface ProxyView {
  readonly root: HTMLElement;
  /** Move the cursor to `position` on the slider, 0–1. */
  at(position: number): void;
}

/** Percent along a span from `low` to `high`, kept within it. */
function percent(value: number, low: number, high: number): string {
  return `${String(Math.min(100, Math.max(0, (100 * (value - low)) / (high - low))))}%`;
}

/** The chart of `chart` above a slider running on `scale`. */
function chartView(chart: ProxyChart, scale: ClockScale): ProxyView {
  const along = (seconds: number) => percent(scale.positionAt(seconds), 0, scale.end);
  const dots = chart.readings.map((reading) => {
    const dot = element('span', { class: `proxy-dot proxy-series-${String(reading.series)}` });
    dot.style.bottom = percent(reading.value, chart.low, chart.high);
    if (reading.between === undefined) {
      dot.style.left = along(reading.seconds);
      return dot;
    }
    const [from, to] = reading.between;
    dot.classList.add('proxy-span');
    dot.style.left = along(from);
    dot.style.right = `calc(100% - ${along(to)})`;
    return dot;
  });
  const cursor = element('span', { class: 'proxy-cursor' });
  const plot = element(
    'div',
    { class: 'proxy-plot', 'aria-hidden': 'true' },
    element('span', { class: 'proxy-axis proxy-axis-high' }, String(chart.high)),
    element('span', { class: 'proxy-axis proxy-axis-low' }, String(chart.low)),
    ...dots,
    cursor,
  );
  const key = element(
    'p',
    { class: 'proxy-key' },
    ...chart.series.map((name, index) =>
      element('span', { class: `proxy-key-item proxy-series-${String(index)}` }, name),
    ),
  );
  const root = element(
    'figure',
    { class: 'proxy-chart' },
    element('figcaption', { class: 'proxy-title' }, chart.title),
    plot,
    key,
    element('p', { class: 'proxy-says' }, chart.says),
  );
  return {
    root,
    at(position) {
      cursor.style.left = percent(position, 0, 1);
    },
  };
}

/** The records `charts` above a slider running on `scale`: one at a time, if more than one. */
export function proxyView(charts: readonly ProxyChart[], scale: ClockScale): ProxyView | null {
  const views = charts.map((chart) => chartView(chart, scale));
  const [only] = views;
  if (only === undefined) return null;
  if (views.length === 1) return only;
  const buttons = charts.map((chart, index) =>
    element(
      'button',
      { type: 'button', class: 'proxy-pick', 'aria-pressed': String(index === 0) },
      chart.name,
    ),
  );
  const pick = (chosen: number): void => {
    views.forEach((view, index) => {
      view.root.hidden = index !== chosen;
      buttons[index]?.setAttribute('aria-pressed', String(index === chosen));
    });
  };
  buttons.forEach((button, index) => {
    button.addEventListener('click', () => {
      pick(index);
    });
  });
  pick(0);
  const root = element(
    'div',
    { class: 'proxy-charts' },
    element(
      'div',
      { class: 'proxy-picks', role: 'group', 'aria-label': 'Measured record' },
      ...buttons,
    ),
    ...views.map((view) => view.root),
  );
  return {
    root,
    at(position) {
      for (const view of views) view.at(position);
    },
  };
}
