/**
 * The Layers panel kept short to scan (#950): each row's one plain line, its full account and
 * sources folded under "More"; and a box at the top that narrows the rows to those that match.
 */

import { element } from '../../ui/dom';

/** A row's words: the plain line, then the full account, folded. */
export function layerAbout(layer: { readonly summary: string; readonly about: string }): Node[] {
  return [
    element('p', { class: 'layer-about' }, layer.summary),
    element(
      'details',
      { class: 'layer-more' },
      element('summary', {}, 'More'),
      element('p', {}, layer.about),
    ),
  ];
}

/**
 * The box that narrows the panel: a row shows while its words hold every word typed, and a
 * group while any of its rows show. `groups` are the panel's fieldsets of `.layer-item`s.
 */
export function layerFilter(groups: readonly HTMLElement[]): HTMLElement {
  const box = element('input', {
    type: 'search',
    class: 'layers-filter',
    placeholder: 'Find a layer',
    'aria-label': 'Find a layer',
  });
  box.addEventListener('input', () => {
    const words = box.value.toLowerCase().split(/\s+/).filter(Boolean);
    for (const group of groups) {
      let any = false;
      for (const item of group.querySelectorAll<HTMLElement>('.layer-item')) {
        const text = item.textContent.toLowerCase();
        const shown = words.every((word) => text.includes(word));
        item.hidden = !shown;
        any ||= shown;
      }
      group.hidden = !any;
    }
  });
  return box;
}
