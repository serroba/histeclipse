/**
 * What LIGO and Virgo recorded of GW170817 (#1000), drawn as the discovery paper's Figure 1 draws
 * it: for Hanford, Livingston and Virgo, time across and frequency up, brighter where there was
 * more energy than the detector's noise. The chirp, under the noise in the strain itself, shows
 * here as a rising track in both LIGO detectors; Virgo's is too faint to see. The model's track is
 * dashed over each, Livingston's zeroed glitch is shaded, and a cursor and clock follow the wave.
 *
 * DOM glue: each map is painted into a canvas from its tiles (`recorded.ts`).
 */

import { element } from '../../ui/dom';
import { columnTime, tileColour, tilesOf, yOfFrequency, type Gw170817Recorded } from './recorded';
import { chirp, GW170817_MODEL } from './strain';
import type { DetectorId } from './trips';

const SVG = 'http://www.w3.org/2000/svg';
/** Each panel's drawing size, in its own units. */
const WIDTH = 600;
const HEIGHT = 80;

const PANELS: readonly { readonly detector: DetectorId; readonly label: string }[] = [
  { detector: 'H1', label: 'LIGO Hanford' },
  { detector: 'L1', label: 'LIGO Livingston · its glitch, 1.1 s before, zeroed (shaded)' },
  {
    detector: 'V1',
    label:
      'Virgo · too faint to see: a shorter reach, and the source near a blind spot of its antenna',
  },
];

function svgElement(tag: string, attributes: Readonly<Record<string, string>>): SVGElement {
  const made = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) made.setAttribute(name, value);
  return made;
}

/** Across a panel, for a time, s from the merger. */
function xOf(data: Gw170817Recorded, t: number): number {
  const first = columnTime(data, 0);
  const last = columnTime(data, data.columns - 1);
  return ((t - first) / (last - first)) * WIDTH;
}

/** The model's track, frequency against time, as an SVG path over a panel. */
export function trackPath(data: Gw170817Recorded): string {
  const wave = chirp({ ...GW170817_MODEL, from: Math.min(...data.frequencies) });
  const top = Math.max(...data.frequencies);
  const points: string[] = [];
  for (let column = 0; column < data.columns; column += 2) {
    const t = columnTime(data, column);
    const hertz = wave.frequency(Math.min(t, 0));
    if (t > 0 || hertz <= 0 || hertz > top) continue;
    const y = yOfFrequency(data, hertz, HEIGHT);
    points.push(`${points.length === 0 ? 'M' : 'L'}${xOf(data, t).toFixed(1)},${y.toFixed(1)}`);
  }
  return points.join('');
}

/** Paint a detector's tiles into a canvas, the lowest frequency at the foot. */
function paint(canvas: HTMLCanvasElement, data: Gw170817Recorded, detector: DetectorId): void {
  const context = canvas.getContext('2d');
  if (context === null) return;
  const rows = data.frequencies.length;
  const image = context.createImageData(data.columns, rows);
  tilesOf(data, detector).forEach((value, index) => {
    const row = Math.floor(index / data.columns);
    const column = index % data.columns;
    const [r, g, b] = tileColour(value);
    const at = 4 * ((rows - 1 - row) * data.columns + column);
    image.data.set([r, g, b, 255], at);
  });
  context.putImageData(image, 0, 0);
}

/** The true time, from s after 12:41:00 UTC: `12:41:04.416 UTC`. */
export function recordedClock(seconds: number): string {
  return `12:41:${seconds.toFixed(3).padStart(6, '0')} UTC`;
}

export interface RecordedPlot {
  readonly root: HTMLElement;
  /** Put the cursor and the clock at `seconds` after 12:41:00 UTC. */
  setTime(seconds: number): void;
}

/** The plot, its times counted from `merger` s after 12:41:00 UTC. */
export function createRecordedPlot(data: Gw170817Recorded, merger: number): RecordedPlot {
  const track = trackPath(data);
  const cursors: SVGElement[] = [];
  const panels = PANELS.map(({ detector, label }) => {
    const canvas = element('canvas', {
      class: 'recorded-map',
      width: String(data.columns),
      height: String(data.frequencies.length),
    });
    paint(canvas, data, detector);
    const cursor = svgElement('line', {
      class: 'strain-cursor',
      x1: '0',
      x2: '0',
      y1: '0',
      y2: String(HEIGHT),
    });
    cursors.push(cursor);
    const svg = svgElement('svg', {
      viewBox: `0 0 ${String(WIDTH)} ${String(HEIGHT)}`,
      preserveAspectRatio: 'none',
      'aria-hidden': 'true',
    });
    if (detector === data.gated.detector) {
      const from = xOf(data, data.gated.from);
      svg.append(
        svgElement('rect', {
          class: 'recorded-gate',
          'data-testid': 'recorded-gate',
          x: from.toFixed(1),
          y: '0',
          width: (xOf(data, data.gated.to) - from).toFixed(1),
          height: String(HEIGHT),
        }),
      );
    }
    svg.append(svgElement('path', { class: 'recorded-track', d: track }), cursor);
    return element(
      'div',
      { class: 'recorded-panel', 'data-testid': `recorded-${detector.toLowerCase()}` },
      element('span', { class: 'recorded-label' }, label),
      canvas,
      svg,
    );
  });
  const clock = element('span', { class: 'strain-clock', 'data-testid': 'strain-clock' });
  const key = element(
    'p',
    { class: 'strain-key' },
    `Time across, the last ${String(-data.from)} s; frequency up, ${String(Math.round(Math.min(...data.frequencies)))} to ${String(Math.round(Math.max(...data.frequencies)))} Hz. Brighter is more energy than each detector’s noise: the rising track is the chirp, under the noise in the strain itself; dashed, the model’s. From GWOSC’s data, as the paper’s Figure 1 · `,
    clock,
  );
  const root = element(
    'figure',
    {
      class: 'strain-plot recorded-plot',
      'data-testid': 'strain-plot',
      role: 'img',
      'aria-label':
        'What Hanford, Livingston and Virgo recorded, as time against frequency: a track rising toward the merger in both LIGO detectors, none in Virgo',
    },
    ...panels,
    key,
  );
  return {
    root,
    setTime(seconds) {
      const x = Math.min(WIDTH, Math.max(0, xOf(data, seconds - merger))).toFixed(1);
      for (const cursor of cursors) {
        cursor.setAttribute('x1', x);
        cursor.setAttribute('x2', x);
      }
      clock.textContent = recordedClock(seconds);
    },
  };
}
