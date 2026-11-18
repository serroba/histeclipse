/**
 * Beside the globe while El Niño and La Niña is on (#886): NOAA's two indices on one chart, the
 * ±0.5 °C that names an episode, and under it each index's episodes on a strip of its own, so
 * where they disagree shows; the month shown marked; under it what each says of that month, and
 * whom to credit (in full in the layer's Why).
 */

import type { LayerFactory } from '../../globe/layerHost';
import { element } from '../../ui/dom';
import { joinGlobePanels } from '../../ui/globePanels';
import { CHART_HEIGHT, CHART_WIDTH, type EnsoChart } from './chartModel';
import './enso.css';

const SVG = 'http://www.w3.org/2000/svg';
/** The strips' height, in the chart's units. */
const STRIP_HEIGHT = 40;

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Readonly<Record<string, string>>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

function across(y: number, kind: string): SVGLineElement {
  const at = y.toFixed(1);
  return svg('line', { x1: '0', x2: String(CHART_WIDTH), y1: at, y2: at, class: kind });
}

function cursor(chart: EnsoChart, height: number): SVGLineElement[] {
  if (chart.cursorX === null) return [];
  const at = chart.cursorX.toFixed(1);
  return [svg('line', { x1: at, x2: at, y1: '0', y2: String(height), class: 'enso-cursor' })];
}

function lines(chart: EnsoChart): SVGSVGElement {
  const root = svg('svg', {
    viewBox: `0 0 ${String(CHART_WIDTH)} ${String(CHART_HEIGHT)}`,
    preserveAspectRatio: 'none',
    'aria-hidden': 'true',
    class: 'enso-chart',
  });
  root.append(
    across(chart.warmY, 'enso-threshold is-warm'),
    across(chart.coolY, 'enso-threshold is-cool'),
    across(chart.zeroY, 'enso-zero'),
    ...chart.lines.map((line) => svg('path', { d: line.d, class: `enso-line is-${line.id}` })),
    ...cursor(chart, CHART_HEIGHT),
  );
  return root;
}

function strip(chart: EnsoChart, row: EnsoChart['strips'][number]): HTMLElement {
  const drawn = svg('svg', {
    viewBox: `0 0 ${String(CHART_WIDTH)} ${String(STRIP_HEIGHT)}`,
    preserveAspectRatio: 'none',
    'aria-hidden': 'true',
    class: 'enso-strip',
  });
  drawn.append(
    ...row.episodes.map((episode) =>
      svg('rect', {
        x: episode.x.toFixed(1),
        width: episode.width.toFixed(1),
        y: '0',
        height: String(STRIP_HEIGHT),
        class: `enso-episode is-${episode.phase}`,
      }),
    ),
    ...cursor(chart, STRIP_HEIGHT),
  );
  return element('div', { class: `enso-row is-${row.id}` }, element('span', {}, row.name), drawn);
}

export interface EnsoView {
  readonly chart: EnsoChart;
  /** The indices' names, in the chart's order, for its key. */
  readonly names: readonly { readonly id: string; readonly name: string }[];
  readonly text: string;
}

/** The panel; null takes it away. */
export const ensoPanel: LayerFactory<EnsoView | null> = (host) => {
  const figure = element('figure', { class: 'enso-figure' });
  const key = element('ul', { class: 'enso-key', 'aria-label': 'The indices' });
  const said = element('p', { class: 'enso-said', 'aria-live': 'polite' });
  const root = element(
    'section',
    { class: 'enso-panel', 'aria-label': 'El Niño and La Niña', hidden: '' },
    figure,
    key,
    said,
    element(
      'p',
      { class: 'enso-credit' },
      'NOAA Climate Prediction Center. Red: El Niño; blue: La Niña, as each index names them.',
    ),
  );
  joinGlobePanels(host.container, root, 4);
  let drawnFor = '';
  return {
    update(view) {
      root.hidden = view === null;
      if (view === null) return;
      said.textContent = view.text;
      const at = String(view.chart.cursorX);
      if (at === drawnFor) return;
      drawnFor = at;
      figure.replaceChildren(
        element(
          'figcaption',
          {},
          `The tropical Pacific, ${String(Math.floor(view.chart.first / 12))}–${String(Math.floor(view.chart.last / 12))}: °C from normal`,
        ),
        lines(view.chart),
        ...view.chart.strips.map((row) => strip(view.chart, row)),
      );
      key.replaceChildren(
        ...view.names.map(({ id, name }) =>
          element('li', { class: `is-${id}` }, element('span', { class: 'enso-swatch' }), name),
        ),
      );
    },
  };
};
