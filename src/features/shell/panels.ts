/**
 * Full view (#451): the panels hidden for a clear view. Show controls, Escape, or a tap on open
 * sky or empty space brings them back. A tap on open sky clears them too, as does one on the
 * globe or the space around it in deep time; in historical time a tap on the globe picks a
 * place.
 */

import { element } from '../../ui/dom';
import { uiIcon } from '../../ui/icons';

export interface Panels {
  /** The HUD's Full view button. */
  readonly fullView: HTMLElement;
  /** The button that brings them back. */
  readonly showControls: HTMLElement;
  readonly toggle: () => void;
  readonly show: () => void;
}

export function createPanels(root: HTMLElement): Panels {
  const fullView = element(
    'button',
    { type: 'button', class: 'full-view', 'aria-label': 'Hide the panels for a full view' },
    uiIcon('fullView', 16),
    element('span', { class: 'icon-label' }, 'Full view'),
  );
  const showControls = element(
    'button',
    { type: 'button', class: 'show-controls' },
    'Show controls',
  );
  function toggle(): void {
    const hidden = root.dataset['panels'] !== 'hidden';
    root.dataset['panels'] = hidden ? 'hidden' : 'shown';
    if (!hidden) fullView.focus();
    else showControls.focus();
  }
  fullView.addEventListener('click', toggle);
  showControls.addEventListener('click', toggle);
  return {
    fullView,
    showControls,
    toggle,
    show() {
      if (root.dataset['panels'] === 'hidden') toggle();
    },
  };
}
