/**
 * Beside the globe while the AMOC is on (#925): a row for each source, the array's measured flow
 * first and the reconstructions under it, each on its own scale over the years shown, with its
 * value for the year; the dispute in words; and whom to credit (in full in the layer's Why).
 */

import type { LayerFactory } from '../../globe/layerHost';
import { element } from '../../ui/dom';
import { joinGlobePanels } from '../../ui/globePanels';
import { ROW_HEIGHT, ROW_WIDTH, type AmocChart, type AmocRow } from './chartModel';
import './amoc.css';

const SVG = 'http://www.w3.org/2000/svg';

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Readonly<Record<string, string>>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

function drawn(row: AmocRow, cursorX: number | null): SVGSVGElement {
  const root = svg('svg', {
    viewBox: `0 0 ${String(ROW_WIDTH)} ${String(ROW_HEIGHT)}`,
    preserveAspectRatio: 'none',
    'aria-hidden': 'true',
    class: 'amoc-row-chart',
  });
  if (row.band !== '') root.append(svg('path', { d: row.band, class: 'amoc-band' }));
  if (row.zeroY !== null) {
    const at = row.zeroY.toFixed(1);
    root.append(
      svg('line', { x1: '0', x2: String(ROW_WIDTH), y1: at, y2: at, class: 'amoc-zero' }),
    );
  }
  if (row.line !== '') root.append(svg('path', { d: row.line, class: 'amoc-line' }));
  if (cursorX !== null) {
    const at = cursorX.toFixed(1);
    root.append(
      svg('line', { x1: at, x2: at, y1: '0', y2: String(ROW_HEIGHT), class: 'amoc-cursor' }),
    );
  }
  return root;
}

export interface AmocView {
  readonly chart: AmocChart;
  /** Whether it has weakened is disputed: what each side reads. */
  readonly disputed: string;
}

function rowElement(row: AmocRow, cursorX: number | null): HTMLElement {
  const units = row.units === 'index' ? 'an index' : row.units;
  return element(
    'div',
    { class: `amoc-row is-${row.id}`, title: row.measures },
    element(
      'p',
      { class: 'amoc-row-head' },
      element('span', { class: 'amoc-row-name' }, `${row.label}, ${units}`),
      element('span', { class: 'amoc-row-value' }, row.value ?? '–'),
    ),
    row.line === ''
      ? element('p', { class: 'amoc-row-empty' }, 'No readings in these years.')
      : drawn(row, cursorX),
  );
}

/** The panel; null takes it away. */
export const amocPanel: LayerFactory<AmocView | null> = (host) => {
  const caption = element('p', { class: 'amoc-caption' });
  const rows = element('div', { class: 'amoc-rows' });
  const disputed = element('p', { class: 'amoc-disputed' });
  // The dispute folded under a short question, so the rows keep the room.
  const dispute = element(
    'details',
    { class: 'amoc-dispute' },
    element('summary', {}, 'Has it weakened? The sources disagree'),
    disputed,
  );
  const root = element(
    'section',
    { class: 'amoc-panel', 'aria-label': 'The Atlantic overturning (AMOC)', hidden: '' },
    caption,
    rows,
    dispute,
    element(
      'p',
      { class: 'amoc-credit' },
      'RAPID-MOCHA-WBTS (NERC, NSF, NOAA); Caesar et al. 2018; Rahmstorf et al. 2015; Thornalley et al. 2018; Terhaar et al. 2025. Each on its own scale.',
    ),
  );
  joinGlobePanels(host.container, root, 5);
  let drawnFor = '';
  return {
    update(view) {
      root.hidden = view === null;
      if (view === null) return;
      disputed.textContent = view.disputed;
      const { chart } = view;
      const key = `${String(chart.first)}:${String(chart.last)}:${String(chart.cursorX)}`;
      if (key === drawnFor) return;
      drawnFor = key;
      caption.textContent = `The Atlantic overturning, ${String(chart.first)}–${String(chart.last)}: each source on its own scale`;
      rows.replaceChildren(...chart.rows.map((row) => rowElement(row, chart.cursorX)));
    },
  };
};
