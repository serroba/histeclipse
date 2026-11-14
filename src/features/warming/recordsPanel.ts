/**
 * Beside the globe while Temperature records is on (#526): every record of global surface
 * temperature since 1850 on one chart, the band where they spread, the 1850–1900 mean and the
 * year shown marked; under it each record's value that year and how far apart they are, and
 * whom to credit (each in full in the layer's Why).
 */

import type { LayerFactory } from '../../globe/layerHost';
import { element } from '../../ui/dom';
import { joinGlobePanels } from '../../ui/globePanels';
import { CHART_HEIGHT, CHART_WIDTH, type RecordsChart } from './chartModel';
import './warming.css';

const SVG = 'http://www.w3.org/2000/svg';

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Readonly<Record<string, string>>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

function drawn(chart: RecordsChart): SVGSVGElement {
  const root = svg('svg', {
    viewBox: `0 0 ${String(CHART_WIDTH)} ${String(CHART_HEIGHT)}`,
    preserveAspectRatio: 'none',
    'aria-hidden': 'true',
    class: 'records-chart',
  });
  const zero = String(chart.zeroY);
  root.append(
    svg('path', { d: chart.band, class: 'records-band' }),
    svg('line', { x1: '0', x2: String(CHART_WIDTH), y1: zero, y2: zero, class: 'records-zero' }),
    ...chart.lines.map((line) =>
      svg('path', { d: line.d, class: `records-line is-${line.id} is-${line.kind}` }),
    ),
  );
  if (chart.cursorX !== null) {
    const at = String(chart.cursorX);
    root.append(
      svg('line', { x1: at, x2: at, y1: '0', y2: String(CHART_HEIGHT), class: 'records-cursor' }),
    );
  }
  return root;
}

export interface RecordsView {
  readonly chart: RecordsChart;
  /** The records' names, in the chart's order, for its key. */
  readonly names: readonly { readonly id: string; readonly name: string }[];
  readonly text: string;
}

/** The panel; null takes it away. */
export const recordsPanel: LayerFactory<RecordsView | null> = (host) => {
  const figure = element('figure', { class: 'records-figure' });
  const key = element('ul', { class: 'records-key', 'aria-label': 'The records' });
  const said = element('p', { class: 'records-said', 'aria-live': 'polite' });
  const root = element(
    'section',
    { class: 'records-panel', 'aria-label': 'Temperature records side by side', hidden: '' },
    figure,
    key,
    said,
    element(
      'p',
      { class: 'records-credit' },
      'Met Office; Berkeley Earth; NOAA NCEI; NASA GISS; Copernicus C3S (ERA5); JMA (JRA-3Q). Shaded: where they spread.',
    ),
  );
  joinGlobePanels(host.container, root, 2);
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
          `Global temperature, ${String(view.chart.first)}–${String(view.chart.last)}: °C above 1850–1900`,
        ),
        drawn(view.chart),
      );
      key.replaceChildren(
        ...view.names.map(({ id, name }) =>
          element('li', { class: `is-${id}` }, element('span', { class: 'records-swatch' }), name),
        ),
      );
    },
  };
};
