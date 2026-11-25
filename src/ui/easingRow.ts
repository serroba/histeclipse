/**
 * Easing near milestones and finds as deep time plays (#1077), unless less motion is asked for:
 * a checkbox under the milestones, telling `onEasing` when it is changed.
 */

import { element } from './dom';

export interface EasingRow {
  readonly row: HTMLElement;
  /** Show whether play eases, as the view has it. */
  set(on: boolean): void;
}

export function createEasingRow(onEasing: (on: boolean) => void): EasingRow {
  const box = element('input', { type: 'checkbox', 'data-testid': 'deep-easing' });
  box.addEventListener('change', () => {
    onEasing(box.checked);
  });
  return {
    row: element(
      'label',
      { class: 'deep-easing' },
      box,
      'Slow down near milestones and finds while playing',
    ),
    set(on) {
      box.checked = on;
    },
  };
}
