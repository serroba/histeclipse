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

export function createFamousPanel(
  onPick: (eclipse: FamousEclipse) => void,
  onTablet: () => void,
): FamousPanel {
  const button = element(
    'button',
    { type: 'button', class: 'famous-open', 'aria-haspopup': 'dialog' },
    'Famous eclipses',
  );
  const list = element('ul', { class: 'famous-list' });
  // Not an eclipse, but the same kind of question: does a record fit the sky of its date?
  const tabletButton = element(
    'button',
    { type: 'button', class: 'famous-item famous-tablet' },
    element(
      'span',
      { class: 'famous-text' },
      element('span', { class: 'famous-title' }, 'Check a Babylonian tablet against the sky'),
      element(
        'span',
        { class: 'famous-meta' },
        'VAT 4956: Nebuchadnezzar’s year 37, Moon and planets, tested against candidate years',
      ),
    ),
  );
  tabletButton.addEventListener('click', () => {
    dialog.close();
    onTablet();
  });
  const tablet = element('div', { class: 'famous-list' }, tabletButton);
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
      'Eclipses known from history and science, each with its source. “Probable” and “debated” mark how firmly scholars tie a record to its eclipse.',
    ),
    list,
    tablet,
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
                ...(eclipse.confidence === 'secure'
                  ? []
                  : [' · ', element('span', { class: 'famous-debated' }, eclipse.confidence)]),
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
