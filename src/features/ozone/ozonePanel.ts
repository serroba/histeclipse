/**
 * Beside the globe while the Ozone layer is on (#722): the hole's area each spring since 1979
 * and the ozone-depleting gases over Antarctica, as two small charts on one axis of years, the
 * Montreal Protocol and the year shown marked, and the year in words. Whom to credit is under
 * them; the layer's Why says more.
 */

import type { LayerFactory } from '../../globe/layerHost';
import { element } from '../../ui/dom';
import { CHART_HEIGHT, CHART_WIDTH, type OzoneCharts } from './chartModel';
import './ozone.css';

const SVG = 'http://www.w3.org/2000/svg';

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Readonly<Record<string, string>>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

/** One small chart: its line, the Montreal Protocol and the year shown. */
function chart(label: string, path: string, kind: string, charts: OzoneCharts): HTMLElement {
  const drawn = svg('svg', {
    viewBox: `0 0 ${String(CHART_WIDTH)} ${String(CHART_HEIGHT)}`,
    preserveAspectRatio: 'none',
    'aria-hidden': 'true',
    class: 'ozone-chart',
  });
  const montreal = String(charts.montrealX);
  drawn.append(
    svg('line', {
      x1: montreal,
      x2: montreal,
      y1: '0',
      y2: String(CHART_HEIGHT),
      class: 'ozone-montreal',
    }),
    svg('path', { d: path, class: `ozone-line is-${kind}` }),
  );
  if (charts.cursorX !== null) {
    const at = String(charts.cursorX);
    drawn.append(
      svg('line', { x1: at, x2: at, y1: '0', y2: String(CHART_HEIGHT), class: 'ozone-cursor' }),
    );
  }
  return element('figure', { class: 'ozone-figure' }, element('figcaption', {}, label), drawn);
}

export interface OzoneView {
  readonly charts: OzoneCharts;
  /** The year shown, in words. */
  readonly text: string;
}

/** The panel; null takes it away. */
export const ozonePanel: LayerFactory<OzoneView | null> = (host) => {
  const body = element('div', { class: 'ozone-charts' });
  const said = element('p', { class: 'ozone-said', 'aria-live': 'polite' });
  const root = element(
    'section',
    { class: 'ozone-panel', 'aria-label': 'The ozone hole and the gases', hidden: '' },
    body,
    said,
    element(
      'p',
      { class: 'ozone-credit' },
      'NASA Ozone Watch; NOAA Ozone Depleting Gas Index (Montzka, Dutton, Vimont). Dashed: the Montreal Protocol, 1987.',
    ),
  );
  host.container.append(root);
  let drawnFor: OzoneCharts | null = null;
  return {
    update(view) {
      root.hidden = view === null;
      if (view === null) return;
      said.textContent = view.text;
      if (view.charts === drawnFor) return;
      drawnFor = view.charts;
      const { first, last } = view.charts;
      body.replaceChildren(
        chart(
          `The hole each spring, ${String(first)}–${String(last)}: its area`,
          view.charts.area,
          'area',
          view.charts,
        ),
        chart(
          'The ozone-depleting gases over Antarctica: 100 at their peak',
          view.charts.gases,
          'gases',
          view.charts,
        ),
      );
    },
  };
};
