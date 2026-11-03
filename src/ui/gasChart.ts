/**
 * One gas through the ice ages, a small chart per gas (never two gases on two axes): its
 * record across the slider's span, so a point sits over its moment; a dashed line at its 1750
 * level; a cursor at the moment shown.
 *
 * DOM glue, covered by the Playwright suite; the values are read in `data/atmosphere.ts`.
 */

import type { Gas } from '../data/atmosphere';
import { element } from './dom';

const SVG = 'http://www.w3.org/2000/svg';
const WIDTH = 1000;
const HEIGHT = 40;

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Readonly<Record<string, string>>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

export interface GasChart {
  readonly root: HTMLElement;
  render(gas: Gas, oldestKa: number, ka: number): void;
}

export function createGasChart(): GasChart {
  const line = svg('path', { class: 'gas-line', fill: 'none' });
  const preindustrial = svg('line', { class: 'gas-preindustrial', x1: '0', x2: String(WIDTH) });
  const cursor = svg('line', { class: 'gas-cursor', y1: '0', y2: String(HEIGHT) });
  const chart = svg('svg', {
    class: 'gas-chart',
    viewBox: `0 0 ${String(WIDTH)} ${String(HEIGHT)}`,
    preserveAspectRatio: 'none',
    'aria-hidden': 'true',
  });
  chart.append(preindustrial, line, cursor);
  const root = element('div', { class: 'gas-chart-box' });
  root.append(chart);
  let drawn = '';
  return {
    root,
    render(gas, oldestKa, ka) {
      const values = gas.points
        .filter(([at]) => at >= 0 && at <= oldestKa)
        .map(([, value]) => value);
      const low = Math.min(...values, gas.preindustrial);
      const high = Math.max(...values, gas.preindustrial);
      const x = (at: number) => (1 - at / oldestKa) * WIDTH;
      const y = (value: number) =>
        high === low ? HEIGHT / 2 : ((high - value) / (high - low)) * (HEIGHT - 4) + 2;
      const key = `${gas.id} ${String(oldestKa)}`;
      if (key !== drawn) {
        drawn = key;
        const path = gas.points
          .filter(([at]) => at >= 0 && at <= oldestKa)
          .map(
            ([at, value], index) =>
              `${index === 0 ? 'M' : 'L'}${x(at).toFixed(1)},${y(value).toFixed(1)}`,
          )
          .join('');
        line.setAttribute('d', path);
        const level = y(gas.preindustrial).toFixed(1);
        preindustrial.setAttribute('y1', level);
        preindustrial.setAttribute('y2', level);
      }
      const at = x(Math.min(Math.max(ka, 0), oldestKa)).toFixed(1);
      cursor.setAttribute('x1', at);
      cursor.setAttribute('x2', at);
    },
  };
}
