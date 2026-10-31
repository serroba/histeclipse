/** A list of well-known eclipses to jump to, as a dialog (a bottom sheet on phones). */

import type { FamousEclipse } from '../data/famousEclipses';
import { famousDateParts } from '../data/famousEclipses';
import { astronomicalYear, formatYear } from '../time/year';
import { element } from './dom';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function famousDateLabel(eclipse: FamousEclipse): string {
  const [year, month, day] = famousDateParts(eclipse);
  return `${String(day)} ${MONTHS[month - 1] ?? ''} ${formatYear(astronomicalYear(year))}`;
}

export interface FamousPanel {
  readonly button: HTMLButtonElement;
  readonly dialog: HTMLDialogElement;
  setEclipses(eclipses: readonly FamousEclipse[]): void;
}

export function createFamousPanel(onPick: (eclipse: FamousEclipse) => void): FamousPanel {
  const button = element(
    'button',
    { type: 'button', class: 'famous-open', 'aria-haspopup': 'dialog' },
    'Famous eclipses',
  );
  const list = element('ul', { class: 'famous-list' });
  const close = element(
    'button',
    { type: 'button', class: 'famous-close', 'aria-label': 'Close' },
    '×',
  );
  const dialog = element(
    'dialog',
    { class: 'famous-dialog', 'aria-labelledby': 'famous-title' },
    element(
      'header',
      { class: 'famous-header' },
      element('h2', { id: 'famous-title' }, 'Famous eclipses'),
      close,
    ),
    element(
      'p',
      { class: 'famous-intro' },
      'Eclipses known from history and science. Each links to its source; “debated” marks records whose identification historians disagree on.',
    ),
    list,
  );

  button.addEventListener('click', () => {
    dialog.showModal();
  });
  close.addEventListener('click', () => {
    dialog.close();
  });
  // A tap on the backdrop (outside the sheet) closes it too.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  return {
    button,
    dialog,
    setEclipses(eclipses) {
      list.replaceChildren(
        ...eclipses.map((eclipse) => {
          const pick = element(
            'button',
            { type: 'button', class: `famous-item body-${eclipse.kind}` },
            element('span', { class: 'eclipse-dot', 'aria-hidden': 'true' }),
            element(
              'span',
              { class: 'famous-text' },
              element('span', { class: 'famous-title' }, eclipse.title),
              element(
                'span',
                { class: 'famous-meta' },
                `${famousDateLabel(eclipse)} · ${eclipse.kind === 'solar' ? 'solar' : 'lunar'}`,
                ...(eclipse.debated
                  ? [' · ', element('span', { class: 'famous-debated' }, 'debated')]
                  : []),
              ),
            ),
          );
          pick.addEventListener('click', () => {
            dialog.close();
            onPick(eclipse);
          });
          return element('li', {}, pick);
        }),
      );
    },
  };
}
