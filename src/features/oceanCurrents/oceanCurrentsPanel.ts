/**
 * Beside the globe while Ocean currents is on (#927): the depth to show (near the surface, where
 * the AMOC's warm water flows north, or 1,500 m, where its cold water returns south), what the
 * streaks mean, and whom to credit (in full in the layer's Why).
 */

import type { LayerFactory } from '../../globe/layerHost';
import { element } from '../../ui/dom';
import { joinGlobePanels } from '../../ui/globePanels';
import './oceanCurrents.css';

export interface OceanCurrentsView {
  readonly depths: readonly { readonly id: string; readonly name: string }[];
  readonly depth: string;
  readonly text: string;
}

/** The panel; `pick` hears the depth chosen. Null takes it away. */
export function oceanCurrentsPanel(
  pick: (depth: string) => void,
): LayerFactory<OceanCurrentsView | null> {
  return (host) => {
    const picker = element('select', { class: 'ocean-currents-pick', 'aria-label': 'Depth' });
    picker.addEventListener('change', () => {
      pick(picker.value);
    });
    const said = element('p', { class: 'ocean-currents-said', 'aria-live': 'polite' });
    const root = element(
      'section',
      { class: 'ocean-currents-panel', 'aria-label': 'Ocean currents', hidden: '' },
      element('p', { class: 'ocean-currents-title' }, 'The ocean’s currents'),
      picker,
      said,
      element(
        'p',
        { class: 'ocean-currents-note' },
        'Streaks are sped up to be seen, slow water more than fast, and the deep currents, a few centimetres a second, as much as the surface’s: brightness tells the speed. None is drawn near the equator, where these currents cannot be worked out.',
      ),
      element(
        'p',
        { class: 'ocean-currents-credit' },
        'IAP geostrophic currents (Cheng and Zhu 2016), Institute of Atmospheric Physics.',
      ),
    );
    joinGlobePanels(host.container, root, 3);
    let listed = '';
    return {
      update(view) {
        root.hidden = view === null;
        if (view === null) return;
        const ids = view.depths.map(({ id }) => id).join(',');
        if (ids !== listed) {
          listed = ids;
          picker.replaceChildren(
            ...view.depths.map(({ id, name }) => element('option', { value: id }, name)),
          );
        }
        picker.value = view.depth;
        said.textContent = view.text;
      },
    };
  };
}
