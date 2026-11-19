/**
 * Beside the globe while Ocean temperature is on (#590): the depth to show, the scale, what the
 * globe shows of the month, and whom to credit (in full in the layer's Why).
 */

import type { LayerFactory } from '../../globe/layerHost';
import { element } from '../../ui/dom';
import { joinGlobePanels } from '../../ui/globePanels';
import './oceanTemp.css';

export interface OceanTempView {
  /** The depths to pick, as their ids and names, and the one shown. */
  readonly depths: readonly { readonly id: string; readonly name: string }[];
  readonly depth: string;
  /** The scale's ends in words: `−4 · 0 · +4 °C`. */
  readonly ends: string;
  readonly text: string;
}

/** The panel; `pick` hears the depth chosen. Null takes it away. */
export function oceanTempPanel(pick: (depth: string) => void): LayerFactory<OceanTempView | null> {
  return (host) => {
    const picker = element('select', { class: 'ocean-temp-pick', 'aria-label': 'Depth' });
    picker.addEventListener('change', () => {
      pick(picker.value);
    });
    const ends = element('span', { class: 'ocean-temp-ends' });
    const said = element('p', { class: 'ocean-temp-said', 'aria-live': 'polite' });
    const root = element(
      'section',
      { class: 'ocean-temp-panel', 'aria-label': 'Ocean temperature', hidden: '' },
      element('p', { class: 'ocean-temp-title' }, 'The ocean’s temperature, °C from normal'),
      picker,
      element(
        'div',
        { class: 'ocean-temp-legend', 'aria-hidden': 'true' },
        element('span', { class: 'ocean-temp-scale' }),
        ends,
      ),
      said,
      element(
        'p',
        { class: 'ocean-temp-credit' },
        'IAP v4.2 (Cheng et al. 2024), Institute of Atmospheric Physics.',
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
        ends.textContent = view.ends;
        said.textContent = view.text;
      },
    };
  };
}
