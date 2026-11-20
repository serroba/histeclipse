/**
 * The date panel folds on a short phone (#975), so the globe has room. The name, the tools, the
 * date and what was arrived at stay. The calendar line, the time spans and Layers, the viewpoints
 * and the sources wait behind one button. On taller or wider screens the stylesheet draws
 * neither the button nor the fold.
 */

import { element } from '../../ui/dom';
import './hudFold.css';

/** Fold `hud`, adding the button that opens and closes it, and return that button. */
export function foldHud(hud: HTMLElement): HTMLButtonElement {
  const label = element('span', {});
  const button = element(
    'button',
    { type: 'button', class: 'hud-fold' },
    label,
    element('span', { class: 'hud-fold-chevron', 'aria-hidden': 'true' }),
  );
  function set(open: boolean): void {
    hud.dataset['fold'] = open ? 'open' : 'folded';
    button.setAttribute('aria-expanded', String(open));
    label.textContent = open ? 'Fewer controls' : 'More controls';
  }
  set(false);
  button.addEventListener('click', () => {
    set(hud.dataset['fold'] !== 'open');
  });
  hud.append(button);
  return button;
}
