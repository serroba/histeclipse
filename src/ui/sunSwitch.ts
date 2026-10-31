/** Which channel of light the Sun is shown in, close up, and what that channel shows. */

import type { SunImage, SunLayer } from '../data/sunImages';
import { element } from './dom';

export interface SunSwitch {
  readonly root: HTMLElement;
  setLayers(layers: readonly SunImage[], credit: string): void;
  render(layer: SunLayer, visible: boolean): void;
}

export function createSunSwitch(onSelect: (layer: SunLayer) => void): SunSwitch {
  const buttons = element('div', {
    class: 'view-switch sun-switch',
    role: 'group',
    'aria-label': 'Light',
  });
  const about = element('p', { class: 'sun-caption', 'data-testid': 'sun-caption' });
  const root = element('div', { class: 'sun-panel', hidden: '' }, buttons, about);
  let layers: readonly SunImage[] = [];
  let credit = '';

  return {
    root,
    setLayers(next, nextCredit) {
      layers = next;
      credit = nextCredit;
      buttons.replaceChildren(
        element('span', { class: 'switch-label' }, 'Light'),
        ...next.map(({ key, label }) => {
          const button = element(
            'button',
            { type: 'button', 'aria-pressed': 'false', 'data-layer': key },
            label,
          );
          button.addEventListener('click', () => {
            onSelect(key);
          });
          return button;
        }),
      );
    },
    render(layer, visible) {
      root.hidden = !visible || layers.length === 0;
      for (const button of buttons.querySelectorAll('button')) {
        button.setAttribute('aria-pressed', String(button.dataset['layer'] === layer));
      }
      const shown = layers.find(({ key }) => key === layer);
      if (shown === undefined) return;
      const day = new Date(shown.observed).toUTCString().slice(5, 16);
      about.textContent =
        `${shown.description} SDO image of ${day}: the Sun's surface changes daily, ` +
        'so on the date shown it looked different. SDO sees the side facing Earth; the far ' +
        `side is left dark. Credit: ${credit}.`;
    },
  };
}
