/**
 * What the two detectors measured (#831), drawn as the paper's Figure 1 draws it: Livingston's
 * strain, and Hanford's shifted 6.9 ms earlier and turned upside down so it lies on Livingston's
 * (the wave reached Hanford later, and its arms lie the other way about), with the best-fit
 * waveform faint behind. A cursor follows the wave as it plays; a clock beside it gives the true
 * time, to the millisecond.
 */

import { element } from '../../ui/dom';
import type { Gw150914 } from './measured';

/** How much later the wave reached Hanford, s (Abbott et al. 2016). */
const HANFORD_LATER = 0.0069;

const SVG = 'http://www.w3.org/2000/svg';
const WIDTH = 600;
const HEIGHT = 120;

export interface PlotFrame {
  /** The times shown, s after 09:50:45 UTC. */
  readonly from: number;
  readonly to: number;
  /** The strain at the top edge (and its negative at the foot), in the data's units. */
  readonly range: number;
  readonly width: number;
  readonly height: number;
}

/** Across the plot, for a time. */
export function xOf(t: number, frame: PlotFrame): number {
  return ((t - frame.from) / (frame.to - frame.from)) * frame.width;
}

/** A series as an SVG path, each sample `shift` s along and times `sign`; outside, left out. */
export function plotPath(
  series: readonly number[],
  data: Pick<Gw150914, 'start' | 'rate'>,
  frame: PlotFrame,
  shift = 0,
  sign = 1,
): string {
  const points: string[] = [];
  series.forEach((value, index) => {
    const t = data.start + index / data.rate + shift;
    if (t < frame.from || t > frame.to) return;
    const y = frame.height / 2 - ((sign * value) / frame.range) * (frame.height / 2);
    points.push(`${points.length === 0 ? 'M' : 'L'}${xOf(t, frame).toFixed(1)},${y.toFixed(1)}`);
  });
  return points.join('');
}

/** The true time, from s after 09:50:45 UTC: `09:50:45.392 UTC`. */
export function clockText(t: number): string {
  const seconds = 45 + t;
  return `09:50:${seconds.toFixed(3).padStart(6, '0')} UTC`;
}

function svgElement(tag: string, attributes: Readonly<Record<string, string>>): SVGElement {
  const made = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) made.setAttribute(name, value);
  return made;
}

export interface StrainPlot {
  readonly root: HTMLElement;
  /** Put the cursor and the clock at `t` s after 09:50:45 UTC. */
  setTime(t: number): void;
}

export function createStrainPlot(data: Gw150914): StrainPlot {
  const frame: PlotFrame = {
    from: data.start,
    to: data.start + (data.plus.length - 1) / data.rate,
    range: 1.5,
    width: WIDTH,
    height: HEIGHT,
  };
  const { H1, L1 } = data.detectors;
  const cursor = svgElement('line', {
    class: 'strain-cursor',
    x1: '0',
    x2: '0',
    y1: '0',
    y2: String(HEIGHT),
  });
  const svg = svgElement('svg', {
    viewBox: `0 0 ${String(WIDTH)} ${String(HEIGHT)}`,
    preserveAspectRatio: 'none',
    role: 'img',
    'aria-label':
      'The strain measured at Livingston and at Hanford, 0.25 to 0.46 s after 09:50:45 UTC, rising to about 10⁻²¹ and falling away',
  });
  svg.append(
    svgElement('line', { class: 'strain-axis', x1: '0', x2: String(WIDTH), y1: '60', y2: '60' }),
    svgElement('path', { class: 'strain-fit', d: plotPath(L1.waveform, data, frame) }),
    svgElement('path', {
      class: 'strain-h1',
      'data-testid': 'strain-h1',
      d: plotPath(H1.observed, data, frame, -HANFORD_LATER, -1),
    }),
    svgElement('path', {
      class: 'strain-l1',
      'data-testid': 'strain-l1',
      d: plotPath(L1.observed, data, frame),
    }),
    cursor,
  );
  const clock = element('span', { class: 'strain-clock', 'data-testid': 'strain-clock' });
  const key = element(
    'p',
    { class: 'strain-key' },
    element('span', { class: 'strain-key-l1' }, 'Livingston'),
    ' and ',
    element('span', { class: 'strain-key-h1' }, 'Hanford, 6.9 ms earlier and upside down'),
    ', strain × 10⁻²¹; the best fit faint behind · ',
    clock,
  );
  const root = element('figure', { class: 'strain-plot', 'data-testid': 'strain-plot' }, key);
  root.prepend(svg);
  return {
    root,
    setTime(t) {
      const x = Math.min(WIDTH, Math.max(0, xOf(t, frame))).toFixed(1);
      cursor.setAttribute('x1', x);
      cursor.setAttribute('x2', x);
      clock.textContent = clockText(t);
    },
  };
}
