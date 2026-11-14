/**
 * The column of small panels beside the globe (#722, #526): bottom left, between the page's
 * panels as the globe is. A layer's panel joins it, in its `order`, so two layers on at once
 * stack rather than overlap.
 */

import { element } from './dom';
import './globePanels.css';

/** Put `panel` in the column inside `container` (made the first time), at `order`. */
export function joinGlobePanels(container: HTMLElement, panel: HTMLElement, order: number): void {
  let column = container.querySelector<HTMLElement>(':scope > .globe-panels');
  if (column === null) {
    column = element('div', { class: 'globe-panels' });
    container.append(column);
  }
  panel.style.order = String(order);
  column.append(panel);
}
