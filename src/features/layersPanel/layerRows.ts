/**
 * The Layers panel kept short to scan (#950): each row's one plain line, its full account and
 * sources folded under "More"; and a box at the top that narrows the rows to those that match.
 */

import { BOUNDARY_NAMES, type BoundaryId } from '../../data/planetaryBoundaries';
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
 * For a layer that draws a planetary boundary's pressure or effects (#434), a line naming the
 * boundary, and a button that turns the boundaries' layer on: the wheel and the layers it links
 * are one set. A toggle, like any in the panel: it never moves time.
 */
export function boundaryLink(boundary: BoundaryId | undefined, turnOn: () => void): HTMLElement[] {
  if (boundary === undefined) return [];
  const button = element(
    'button',
    { type: 'button', class: 'layer-boundary-show', 'data-boundary': boundary },
    'Show the boundaries',
  );
  button.addEventListener('click', turnOn);
  return [
    element(
      'p',
      { class: 'layer-boundary' },
      `Planetary boundary: ${BOUNDARY_NAMES[boundary]}. `,
      button,
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
