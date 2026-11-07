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
  // What the channel shows, in a line; how the map was made and whose it is, one tap below. On
  // a phone that part starts folded, so the panel leaves the Sun in view (#238).
  const lead = element('span', { class: 'sun-caption-lead' });
  const made = element('span', {});
  const more = element(
    'details',
    { class: 'sun-caption-more' },
    element('summary', {}, 'How it was made, and credit'),
    made,
  );
  more.open = !window.matchMedia('(max-width: 600px)').matches;
  const about = element(
    'div',
    { class: 'sun-caption', 'data-testid': 'sun-caption' },
    lead,
    ' ',
    more,
  );
  const root = element('div', { class: 'sun-panel', hidden: '' }, buttons, about);
  let layers: readonly SunImage[] = [];
  let credit = '';

  return {
    root,
    setLayers(next, nextCredit) {
      layers = next;
      credit = nextCredit;
      buttons.replaceChildren(
        // The label and its book head the channels, which share the rows below.
        element('span', { class: 'switch-label' }, 'Light', ...(why === undefined ? [] : [why])),
        ...next.map(({ key, label, detail }) => {
          // What it shows, and beneath it the light it is: its wavelength and temperature.
          const button = element(
            'button',
            { type: 'button', 'aria-pressed': 'false', 'data-layer': key },
            element('span', { class: 'sun-channel-name' }, label),
            element('span', { class: 'sun-channel-detail' }, detail),
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
        const pressed = button.dataset['layer'] === layer;
        button.setAttribute('aria-pressed', String(pressed));
        // On a phone the channels are one row that scrolls: keep the one picked in it.
        if (pressed && !root.hidden && buttons.scrollWidth > buttons.clientWidth) {
          buttons.scrollLeft = Math.max(0, button.offsetLeft - buttons.clientWidth / 3);
        }
      }
      const shown = layers.find(({ key }) => key === layer);
      if (shown === undefined) return;
      const [first, last] = frameSpan(shown);
      lead.textContent = shown.description;
      made.textContent =
        `Stitched from ${String(shown.frames.length)} SDO images, ` +
        `${first} – ${last}: each side as it last faced Earth, so not one moment, with the ` +
        'poles, which SDO barely sees, smoothed in. This is the Sun of 2024; on the date shown ' +
        `it looked different, in ways unknown. Credit: ${credit}.`;
    },
  };
}
