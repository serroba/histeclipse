/**
 * The panels fold on a short phone, so the globe has room. The date panel (#975) keeps the name,
 * the tools, the date and what was arrived at; the calendar line, the time spans and Layers, the
 * viewpoints and the sources wait behind one button. The year's bar (#1049) keeps its track and
 * Play; the year, the years shown and the speed wait behind another. On taller or wider screens
 * the stylesheet draws neither the buttons nor the folds.
 */

import { element } from '../../ui/dom';
import './hudFold.css';

/** A button that opens and folds `panel`, with its words for each state. */
function foldButton(
  panel: HTMLElement,
  className: string,
  words: { readonly folded: string; readonly open: string },
): HTMLButtonElement {
  const label = element('span', { class: 'panel-fold-label' });
  const button = element(
    'button',
    { type: 'button', class: `panel-fold ${className}` },
    label,
    element('span', { class: 'panel-fold-chevron', 'aria-hidden': 'true' }),
  );
  function set(open: boolean): void {
    panel.dataset['fold'] = open ? 'open' : 'folded';
    button.setAttribute('aria-expanded', String(open));
    label.textContent = open ? words.open : words.folded;
  }
  set(false);
  button.addEventListener('click', () => {
    set(panel.dataset['fold'] !== 'open');
  });
  return button;
}

/** Fold `hud`, adding the button that opens and closes it, and return that button. */
export function foldHud(hud: HTMLElement): HTMLButtonElement {
  const button = foldButton(hud, 'hud-fold', { folded: 'More controls', open: 'Fewer controls' });
  hud.append(button);
  return button;
}

/**
 * Fold the year's bar in `bottom`: its button goes just above the year's row, which it opens and
 * closes. Null when there is no such bar.
 */
export function foldBar(bottom: HTMLElement): HTMLButtonElement | null {
  const bar = bottom.querySelector<HTMLElement>('.holocene-bar');
  const year = bar?.querySelector(':scope > .timeline') ?? null;
  if (bar === null || year === null) return null;
  const button = foldButton(bar, 'bar-fold', {
    folded: 'Year and speed',
    open: 'Hide year and speed',
  });
  year.before(button);
  return button;
}
