/**
 * Sea level through time, drawn above the deep-time slider and sharing its span, so a point on
 * the chart sits over its moment on the slider. One line per reconstruction, its range as a faint
 * band where it gives one; a dashed line at today's level; a cursor at the moment shown. Hovering
 * reads every series at that time; a click goes there. A legend under the bar names each source
 * with its value at the moment shown, so nothing rests on colour alone.
 *
 * Colours: the reference palette's dark categorical slots 1–4, validated against the bar's
 * surface (CVD ΔE ≥ 8.4, contrast ≥ 3:1).
 */

import { seaLevelAt, type SeaLevelIndex, type SeaLevelSeries } from '../data/seaLevel';
import { element } from './dom';

const SVG = 'http://www.w3.org/2000/svg';

/** Fixed per source, never by rank. */
export const SERIES_COLOURS: Readonly<Record<string, string>> = {
  'van-der-meer-2022': '#3987e5',
  'miller-2020': '#d95926',
  'bintanja-2008': '#199e70',
  'spratt-2016': '#c98500',
};
const FALLBACK_COLOUR = '#93a0bb';

/** The chart's drawing box, in SVG units; it stretches to the slider's width. */
export const CHART_WIDTH = 1000;
export const CHART_HEIGHT = 80;

export interface ChartFrame {
  /** The span shown, thousands of years: the slider's oldest moment on the left, today right. */
  readonly oldestKa: number;
  readonly minMetres: number;
  readonly maxMetres: number;
}

export function xOf(ka: number, frame: ChartFrame): number {
  return (1 - ka / frame.oldestKa) * CHART_WIDTH;
}

export function yOf(metres: number, frame: ChartFrame): number {
  return ((frame.maxMetres - metres) / (frame.maxMetres - frame.minMetres)) * CHART_HEIGHT;
}

/** The moment under a point on the chart, thousands of years, clamped to its span. */
export function kaAt(x: number, frame: ChartFrame): number {
  return Math.min(frame.oldestKa, Math.max(0, (1 - x / CHART_WIDTH) * frame.oldestKa));
}

/**
 * Points for a column of values within the span, at most a lowest and a highest per unit of
 * width, so a dense record keeps its swings without thousands of points.
 */
export function columnPoints(
  ages: readonly number[],
  values: readonly number[],
  frame: ChartFrame,
): readonly (readonly [number, number])[] {
  const points: [number, number][] = [];
  let column = Number.NaN;
  let lowest: [number, number] | null = null;
  let highest: [number, number] | null = null;
  const flush = (): void => {
    if (lowest === null || highest === null) return;
    // In time order (older first, left to right), whichever came first.
    if (lowest === highest) points.push(lowest);
    else points.push(...[lowest, highest].sort((a, b) => a[0] - b[0]));
  };
  for (let index = ages.length - 1; index >= 0; index -= 1) {
    const ka = ages[index] ?? 0;
    const metres = values[index] ?? 0;
    if (ka > frame.oldestKa) continue;
    const point: [number, number] = [xOf(ka, frame), yOf(metres, frame)];
    const here = Math.floor(point[0]);
    if (here !== column) {
      flush();
      column = here;
      lowest = point;
      highest = point;
    } else {
      if (lowest === null || point[1] > lowest[1]) lowest = point;
      if (highest === null || point[1] < highest[1]) highest = point;
    }
  }
  flush();
  return points;
}

function path(points: readonly (readonly [number, number])[]): string {
  return points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join('');
}

/** A filled band between two columns, for a source's range. */
export function bandPath(series: SeaLevelSeries, frame: ChartFrame): string | null {
  if (series.low === undefined || series.high === undefined) return null;
  const upper = columnPoints(series.ages, series.high, frame);
  const lower = columnPoints(series.ages, series.low, frame);
  if (upper.length === 0) return null;
  return `${path(upper)}${path([...lower].reverse()).replace(/^M/, 'L')}Z`;
}

/** The vertical span to draw: every value and range within the span, and today's level. */
export function chartFrame(index: SeaLevelIndex, oldestKa: number): ChartFrame {
  let minMetres = 0;
  let maxMetres = 0;
  for (const series of index.series) {
    for (const column of [series.level, series.low ?? [], series.high ?? []]) {
      for (const [position, metres] of column.entries()) {
        if ((series.ages[position] ?? Infinity) > oldestKa) continue;
        minMetres = Math.min(minMetres, metres);
        maxMetres = Math.max(maxMetres, metres);
      }
    }
  }
  const pad = (maxMetres - minMetres) * 0.08 || 10;
  return { oldestKa, minMetres: minMetres - pad, maxMetres: maxMetres + pad };
}

/** "+202 m", "−116 m (−127 to −105)", or null where the series does not reach. */
export function levelText(series: SeaLevelSeries, ka: number): string | null {
  const at = seaLevelAt(series, ka);
  if (at === null) return null;
  const metres = (value: number): string =>
    `${value > 0.5 ? '+' : value < -0.5 ? '−' : ''}${Math.abs(Math.round(value)).toString()}`;
  const range =
    at.low === null || at.high === null ? '' : ` (${metres(at.low)} to ${metres(at.high)})`;
  return `${metres(at.level)} m${range}`;
}

/** Where a series reaches, for the legend when the moment is outside it. */
export function spanText(series: SeaLevelSeries): string {
  const years = (ka: number): string =>
    ka >= 1000 ? `${String(Math.round(ka / 1000))} Ma` : `${String(Math.round(ka))} ka`;
  const first = series.ages[0] ?? 0;
  const last = series.ages.at(-1) ?? 0;
  return `covers ${first === 0 ? 'today' : years(first)} to ${years(last)}`;
}

export interface SeaLevelChart {
  /** The chart, to sit directly above the slider. */
  readonly chart: HTMLElement;
  /** The legend with each source's value, under the bar's label. */
  readonly legend: HTMLElement;
  render(index: SeaLevelIndex | null, ka: number, oldestKa: number): void;
}

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Readonly<Record<string, string>> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

export function createSeaLevelChart(handlers: { onKa(ka: number): void }): SeaLevelChart {
  const drawing = svg('svg', {
    class: 'sea-chart',
    viewBox: `0 0 ${String(CHART_WIDTH)} ${String(CHART_HEIGHT)}`,
    preserveAspectRatio: 'none',
    role: 'img',
    'aria-label': 'Global sea level through time, by four reconstructions',
  });
  const bands = svg('g');
  const lines = svg('g');
  const today = svg('line', { class: 'sea-today', x1: '0', x2: String(CHART_WIDTH) });
  const cursor = svg('line', { class: 'sea-cursor', y1: '0', y2: String(CHART_HEIGHT) });
  drawing.append(bands, today, lines, cursor);
  const tip = element('div', { class: 'sea-tip', hidden: '' });
  const chart = element('div', { class: 'sea-chart-box', hidden: '' }, drawing, tip);
  const legend = element('ul', {
    class: 'sea-legend',
    hidden: '',
    'data-testid': 'sea-legend',
  });

  let shown: SeaLevelIndex | null = null;
  let frame: ChartFrame | null = null;
  let drawnFor: { readonly index: SeaLevelIndex; readonly oldestKa: number } | null = null;

  const kaUnder = (event: PointerEvent): number | null => {
    if (frame === null) return null;
    const box = drawing.getBoundingClientRect();
    return kaAt(((event.clientX - box.left) / box.width) * CHART_WIDTH, frame);
  };
  drawing.addEventListener('pointermove', (event) => {
    const ka = kaUnder(event);
    if (ka === null || shown === null) return;
    const readings = shown.series.flatMap((series) => {
      const text = levelText(series, ka);
      return text === null ? [] : [`${series.label}: ${text}`];
    });
    const when = ka >= 1000 ? `${(ka / 1000).toFixed(1)} Ma` : `${Math.round(ka).toString()} ka`;
    tip.replaceChildren(
      element('strong', {}, when),
      ...readings.map((reading) => element('div', {}, reading)),
    );
    tip.hidden = false;
    // Centred on the pointer, but kept within the chart's width.
    const box = drawing.getBoundingClientRect();
    const half = tip.offsetWidth / 2;
    const x = Math.min(Math.max(event.clientX - box.left, half), Math.max(half, box.width - half));
    tip.style.left = `${String(x)}px`;
  });
  drawing.addEventListener('pointerleave', () => {
    tip.hidden = true;
  });
  drawing.addEventListener('click', (event) => {
    const ka = kaUnder(event);
    if (ka !== null) handlers.onKa(ka);
  });

  return {
    chart,
    legend,
    render(index, ka, oldestKa) {
      shown = index;
      chart.hidden = index === null;
      legend.hidden = index === null;
      if (index === null) return;
      if (drawnFor?.index !== index || drawnFor.oldestKa !== oldestKa) {
        drawnFor = { index, oldestKa };
        frame = chartFrame(index, oldestKa);
        const at = frame;
        bands.replaceChildren(
          ...index.series.flatMap((series) => {
            const d = bandPath(series, at);
            const colour = SERIES_COLOURS[series.id] ?? FALLBACK_COLOUR;
            return d === null ? [] : [svg('path', { d, fill: colour, class: 'sea-band' })];
          }),
        );
        lines.replaceChildren(
          ...index.series.map((series) =>
            svg('path', {
              d: path(columnPoints(series.ages, series.level, at)),
              stroke: SERIES_COLOURS[series.id] ?? FALLBACK_COLOUR,
              class: 'sea-line',
              'data-series': series.id,
            }),
          ),
        );
        const zero = yOf(0, at).toFixed(1);
        today.setAttribute('y1', zero);
        today.setAttribute('y2', zero);
      }
      if (frame !== null) {
        const x = xOf(ka, frame).toFixed(1);
        cursor.setAttribute('x1', x);
        cursor.setAttribute('x2', x);
      }
      legend.replaceChildren(
        element('li', { class: 'sea-legend-title' }, 'Sea level vs today:'),
        ...index.series.map((series) => {
          const text = levelText(series, ka);
          return element(
            'li',
            { 'data-series': series.id },
            element('span', {
              class: 'sea-swatch',
              style: `background: ${SERIES_COLOURS[series.id] ?? FALLBACK_COLOUR}`,
            }),
            element(
              'a',
              { href: series.url, target: '_blank', rel: 'noopener noreferrer' },
              series.label,
            ),
            element('span', { class: 'sea-value' }, text ?? `— ${spanText(series)}`),
          );
        }),
      );
    },
  };
}
