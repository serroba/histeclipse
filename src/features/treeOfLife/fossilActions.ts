/**
 * The tree of life's ways from a fossil genus (#309): to where it was found, on the globe at its
 * first appearance, and to its line through time.
 */

import type { LineageGroup } from '../../data/lineages';
import { element } from '../../ui/dom';

/** Where a fossil genus's way leads: its finds on the globe, or its line through time. */
type FossilWay = 'globe' | 'time';

export type OnFossil = (to: FossilWay, group: LineageGroup, genus: string) => void;

/** Its two buttons, for a fossil genus; nothing for any other taxon. */
export function fossilActions(
  fossil: { readonly genus: string; readonly group: LineageGroup } | null,
  onFossil: OnFossil,
): HTMLElement[] {
  if (fossil === null) return [];
  const { genus, group } = fossil;
  const action = (label: string, to: FossilWay): HTMLButtonElement => {
    const button = element('button', { type: 'button', class: 'why-all' }, label);
    button.addEventListener('click', () => {
      onFossil(to, group, genus);
    });
    return button;
  };
  return [
    element(
      'div',
      { class: 'why-actions' },
      action(`Where ${genus} was found`, 'globe'),
      action(`${genus} through time`, 'time'),
    ),
  ];
}
