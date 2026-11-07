/** Which channel of light the Sun is shown in, close up, and what that channel shows. */

import { frameSpan, type SunImage, type SunLayer } from '../data/sunImages';
import { element } from './dom';

export interface SunSwitch {
  readonly root: HTMLElement;
  setLayers(layers: readonly SunImage[], credit: string): void;
  render(layer: SunLayer, visible: boolean): void;
}

export function createSunSwitch(
  onSelect: (layer: SunLayer) => void,
  /** The book that says where the Sun's pictures come from, beside the picker's label. */
  why?: HTMLElement,
): SunSwitch {
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
        ...(why === undefined ? [] : [why]),
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
      const [first, last] = frameSpan(shown);
      about.textContent =
        `${shown.description} Stitched from ${String(shown.frames.length)} SDO images, ` +
        `${first} – ${last}: each side as it last faced Earth, so not one moment, with the ` +
        'poles, which SDO barely sees, smoothed in. This is the Sun of 2024; on the date shown ' +
        `it looked different, in ways unknown. Credit: ${credit}.`;
    },
  };
}
