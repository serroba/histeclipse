/**
 * Beside the globe while Ocean heat is on (#589): its own diverging legend in W/m² (never the
 * temperature legend), the three maps to pick from, what the one shown says, its caveats, and
 * whom to credit.
 */

import type { OceanHeatMap } from '../../data/oceanHeat';
import type { LayerFactory } from '../../globe/layerHost';
import { element } from '../../ui/dom';
import { joinGlobePanels } from '../../ui/globePanels';
import './oceanHeat.css';

export interface OceanHeatView {
  readonly maps: readonly OceanHeatMap[];
  readonly shown: string;
  readonly text: string;
}

/** Each map as the picker names it. */
function mapLabel(map: OceanHeatMap): string {
  return `${map.layer}, ${String(map.period[0])}–${String(map.period[1])}`;
}

/** The panel; `pick` hears the map chosen. Null takes it away. */
export function oceanHeatPanel(pick: (id: string) => void): LayerFactory<OceanHeatView | null> {
  return (host) => {
    const picker = element('select', { class: 'ocean-heat-pick', 'aria-label': 'Which map' });
    picker.addEventListener('change', () => {
      pick(picker.value);
    });
    const bound = element('span', { class: 'ocean-heat-bound' });
    const said = element('p', { class: 'ocean-heat-said', 'aria-live': 'polite' });
    const root = element(
      'section',
      { class: 'ocean-heat-panel', 'aria-label': 'Where the ocean gained heat', hidden: '' },
      element('p', { class: 'ocean-heat-title' }, 'Heat gained by the ocean, W/m²'),
      picker,
      element(
        'div',
        { class: 'ocean-heat-legend', 'aria-hidden': 'true' },
        element('span', { class: 'ocean-heat-scale' }),
        bound,
      ),
      said,
      element(
        'p',
        { class: 'ocean-heat-note' },
        'Heat content, not temperature. Faded where the trend is not significant at 10%. Before Argo (2005) the deep layer and the Southern Ocean are filled from model covariances; 0–2000 m includes 0–700 m.',
      ),
      element(
        'p',
        { class: 'ocean-heat-credit' },
        'IAP v4.2 (Cheng et al. 2024), Institute of Atmospheric Physics.',
      ),
    );
    joinGlobePanels(host.container, root, 3);
    let listed = '';
    return {
      update(view) {
        root.hidden = view === null;
        if (view === null) return;
        const ids = view.maps.map((map) => map.id).join(',');
        if (ids !== listed) {
          listed = ids;
          picker.replaceChildren(
            ...view.maps.map((map) => element('option', { value: map.id }, mapLabel(map))),
          );
        }
        picker.value = view.shown;
        const map = view.maps.find((each) => each.id === view.shown);
        bound.textContent =
          map === undefined ? '' : `−${String(map.bound)} · 0 · +${String(map.bound)}`;
        said.textContent = view.text;
      },
    };
  };
}
