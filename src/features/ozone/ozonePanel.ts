/**
 * Beside the globe while the Ozone layer is on (#722): the hole's area each spring since 1979
 * and the ozone-depleting gases over Antarctica, as two small charts on one axis of years, the
 * Montreal Protocol and the year shown marked, and the year in words; with an October's map on
 * the globe, the key to its colours. Whom to credit is under
 * them; the layer's Why says more.
 */

import type { LayerFactory } from '../../globe/layerHost';
import { LEGEND_DU, ozoneColour } from '../../data/ozoneMaps';
import { element } from '../../ui/dom';
import { joinGlobePanels } from '../../ui/globePanels';
import { CHART_HEIGHT, CHART_WIDTH, type OzoneCharts } from './chartModel';
import './ozone.css';

/** The amount of ozone that marks the hole, Dobson units. */
const HOLE_DU = 220;

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
  /** What the globe's colours show, when it is a map or the surface; null for the cap or nothing. */
  readonly map: string | null;
  /** The globe shows the layer as a surface (#804), not a map: the key says what its opening is. */
  readonly surface: boolean;
}

/** The key to the map's colours: a swatch for each amount of ozone named. */
function legend(surface: boolean): HTMLElement {
  const scale = element('ol', { class: 'ozone-scale' });
  for (const du of LEGEND_DU) {
    const [r, g, b] = ozoneColour(du);
    const swatch = element('span', { class: 'ozone-swatch', 'aria-hidden': 'true' });
    swatch.style.background = `rgb(${String(Math.round(r))} ${String(Math.round(g))} ${String(Math.round(b))})`;
    scale.append(element('li', {}, swatch, String(du)));
  }
  scale.append(
    ...(surface
      ? [element('li', {}, 'Open: no height holds that much ozone')]
      : [
          element('li', {}, `Under ${String(HOLE_DU)}: the hole, left open`),
          element('li', {}, 'Grey: no value'),
        ]),
  );
  return scale;
}

/** The panel; null takes it away. */
export const ozonePanel: LayerFactory<OzoneView | null> = (host) => {
  const body = element('div', { class: 'ozone-charts' });
  const said = element('p', { class: 'ozone-said', 'aria-live': 'polite' });
  const mapped = element('p', { class: 'ozone-mapped' });
  const scale = element('div', {}, legend(false));
  const key = element('div', { class: 'ozone-key', hidden: '' }, mapped, scale);
  let surface = false;
  const root = element(
    'section',
    { class: 'ozone-panel', 'aria-label': 'The ozone hole and the gases', hidden: '' },
    body,
    said,
    key,
    element(
      'p',
      { class: 'ozone-credit' },
      'NASA Ozone Watch; NOAA Ozone Depleting Gas Index (Montzka, Dutton, Vimont). Dashed: the Montreal Protocol, 1987. Maps: MSR-2 reanalysis (KNMI), Copernicus Climate Change Service; the surface: CAMS reanalysis, Copernicus Atmosphere Monitoring Service; both CC BY 4.0.',
    ),
  );
  joinGlobePanels(host.container, root, 1);
  let drawnFor: OzoneCharts | null = null;
  return {
    update(view) {
      root.hidden = view === null;
      if (view === null) return;
      said.textContent = view.text;
      key.hidden = view.map === null;
      mapped.textContent = view.map ?? '';
      if (view.surface !== surface) {
        surface = view.surface;
        scale.replaceChildren(legend(surface));
      }
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
