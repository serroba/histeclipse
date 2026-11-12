/**
 * One quantity through deep time, a small chart of its own (never two on two axes): its ranges
 * as shaded bands, widest palest, its best value as a line, estimates as dots where there are
 * any, a dashed line at today's (or 1750's) level, and a cursor at the moment shown. Across the
 * slider's span, so a point sits over its moment.
 *
 * DOM glue, covered by the Playwright suite; the values are read in `data/deepAir.ts`.
 */

import { element } from './dom';
import './gasChart.css';
import './bandChart.css';

const SVG = 'http://www.w3.org/2000/svg';
const WIDTH = 1000;
const HEIGHT = 56;

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Readonly<Record<string, string>>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

interface BandSeries {
  /** Each band: [Ma, low, high] rows, youngest first; the first band is the widest. */
  readonly bands: readonly (readonly (readonly [number, number, number])[])[];
  /** The best value: [Ma, value] rows. */
  readonly line: readonly (readonly [number, number])[];
  /** Single estimates: [Ma, value]. */
  readonly dots: readonly (readonly [number, number])[];
  /** Today's (or 1750's) level, drawn dashed. */
  readonly reference: number;
  /** Names what is drawn, so a change of it (another source's dots) is drawn again. */
  readonly key?: string;
}

export interface BandChart {
  readonly root: HTMLElement;
  /** Draw the series across a span back to `oldest` Ma, with the cursor at `ma`. */
  render(series: BandSeries, oldest: number, ma: number): void;
}

/** A chart with its value axis from `low` to `high`, on a log scale if `log`. */
export function createBandChart(options: {
  readonly low: number;
  readonly high: number;
  readonly log: boolean;
  readonly testId: string;
}): BandChart {
  const bands = svg('g', { class: 'band-areas' });
  // Dots as round ends of zero-length strokes: the chart stretches, a stroke's width does not.
  const dots = svg('path', { class: 'band-dots', fill: 'none' });
  const line = svg('path', { class: 'band-line', fill: 'none' });
  const reference = svg('line', { class: 'gas-preindustrial', x1: '0', x2: String(WIDTH) });
  const cursor = svg('line', { class: 'gas-cursor', y1: '0', y2: String(HEIGHT) });
  const chart = svg('svg', {
    class: 'gas-chart band-chart',
    viewBox: `0 0 ${String(WIDTH)} ${String(HEIGHT)}`,
    preserveAspectRatio: 'none',
    'aria-hidden': 'true',
  });
  chart.append(bands, reference, dots, line, cursor);
  const root = element('div', { class: 'gas-chart-box', 'data-testid': options.testId });
  root.append(chart);
  const scale = (value: number) => (options.log ? Math.log10(Math.max(value, 1)) : value);
  const top = scale(options.high);
  const bottom = scale(options.low);
  const y = (value: number) => {
    const share = (top - Math.min(Math.max(scale(value), bottom), top)) / (top - bottom);
    return (share * (HEIGHT - 4) + 2).toFixed(1);
  };
  let drawn = '';
  return {
    root,
    render(series, oldest, ma) {
      const x = (at: number) => ((1 - at / oldest) * WIDTH).toFixed(1);
      const within = <R extends readonly number[]>(rows: readonly R[]) =>
        rows.filter((row) => (row[0] ?? Infinity) <= oldest);
      const key = `${String(oldest)} ${series.key ?? ''} ${String(series.line.length)} ${String(series.dots.length)}`;
      if (key !== drawn) {
        drawn = key;
        bands.replaceChildren(
          ...series.bands.map((rows, index) => {
            const kept = within(rows);
            const upper = kept.map(([at, , high]) => `${x(at)},${y(high)}`);
            const lower = [...kept].reverse().map(([at, low]) => `${x(at)},${y(low)}`);
            return svg('polygon', {
              class: `band-area band-${String(index)}`,
              points: [...upper, ...lower].join(' '),
            });
          }),
        );
        line.setAttribute(
          'd',
          within(series.line)
            .map(([at, value], index) => `${index === 0 ? 'M' : 'L'}${x(at)},${y(value)}`)
            .join(''),
        );
        dots.setAttribute(
          'd',
          within(series.dots)
            .map(([at, value]) => `M${x(at)},${y(value)}h0`)
            .join(''),
        );
        const level = y(series.reference);
        reference.setAttribute('y1', level);
        reference.setAttribute('y2', level);
      }
      const at = x(Math.min(Math.max(ma, 0), oldest));
      cursor.setAttribute('x1', at);
      cursor.setAttribute('x2', at);
    },
  };
}
