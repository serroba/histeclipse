/**
 * The telescopes' list as a sheet (#850): a dialog, a bottom sheet on a phone, of the most
 * significant telescopes, filtered to space or the ground and to a band of light; a tap on one
 * goes to it. DOM glue; what it lists and where a tap goes are in `telescopeList.ts`.
 */

import type { Telescope, Telescopes } from '../../data/telescopes';
import { element } from '../../ui/dom';
import { BAND_WORDS } from './telescopeMarks';
import { bandsIn, listed, rowText, type Band, type Kind, type ListFilter } from './telescopeList';

const KINDS: readonly (readonly [Kind, string])[] = [
  ['all', 'All'],
  ['space', 'In space'],
  ['ground', 'On Earth'],
];

export interface TelescopeListSheet {
  readonly dialog: HTMLDialogElement;
  /** The record to list, or what to say while there is none. */
  show(record: Telescopes | string): void;
}

/** Its first letter a capital, as a button's label. */
function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A row of buttons, one pressed. */
function choices<T>(
  label: string,
  options: readonly (readonly [T, string])[],
  pressed: T,
  pick: (value: T) => void,
): HTMLElement {
  return element(
    'div',
    { class: 'telescope-filter', role: 'group', 'aria-label': label },
    ...options.map(([value, text]) => {
      const made = element(
        'button',
        { type: 'button', class: 'telescope-choice', 'aria-pressed': String(value === pressed) },
        text,
      );
      made.addEventListener('click', () => {
        pick(value);
      });
      return made;
    }),
  );
}

/** A telescope's row: its name, and its size, light, years and place under it; a tap goes. */
function row(telescope: Telescope, onPick: (telescope: Telescope) => void): HTMLElement {
  const { title, meta } = rowText(telescope);
  const go = element(
    'button',
    { type: 'button', class: 'famous-item', 'data-telescope': telescope.id },
    element(
      'span',
      { class: 'famous-text' },
      element('span', { class: 'famous-title' }, title),
      element('span', { class: 'famous-meta' }, meta),
    ),
  );
  go.addEventListener('click', () => {
    onPick(telescope);
  });
  return element('li', {}, go);
}

export function createTelescopeListSheet(
  onPick: (telescope: Telescope) => void,
  onClose: () => void,
): TelescopeListSheet {
  const close = element(
    'button',
    { type: 'button', class: 'famous-close', 'aria-label': 'Close' },
    '×',
  );
  const filters = element('div', { class: 'telescope-filters' });
  const list = element('ul', { class: 'famous-list', 'data-testid': 'telescope-list' });
  const dialog = element(
    'dialog',
    { class: 'famous-dialog telescope-list', 'aria-labelledby': 'telescope-list-title' },
    element(
      'header',
      { class: 'famous-header' },
      element('h2', { id: 'telescope-list-title' }, 'Telescopes'),
      close,
    ),
    element(
      'p',
      { class: 'famous-intro' },
      'The most significant telescopes, in space and on Earth: the largest of their kind in their time, firsts in their band of light, or known for landmark discoveries. Tap one to go to it.',
    ),
    filters,
    list,
  );
  close.addEventListener('click', () => {
    dialog.close();
  });
  dialog.addEventListener('close', onClose);
  let record: Telescopes | null = null;
  let filter: ListFilter = { kind: 'all', band: null };

  function draw(): void {
    if (record === null) return;
    const bands: (readonly [Band | null, string])[] = [
      [null, 'All light'],
      ...bandsIn(record).map((band) => [band, capitalised(BAND_WORDS[band])] as const),
    ];
    filters.replaceChildren(
      choices('Where', KINDS, filter.kind, (kind) => {
        filter = { ...filter, kind };
        draw();
      }),
      choices('Light', bands, filter.band, (band) => {
        filter = { ...filter, band };
        draw();
      }),
    );
    const shown = listed(record, filter);
    list.replaceChildren(
      ...(shown.length === 0
        ? [element('li', { class: 'famous-intro' }, 'None of these telescopes sees that.')]
        : shown.map((telescope) => row(telescope, onPick))),
    );
  }

  return {
    dialog,
    show(shown) {
      if (typeof shown === 'string') {
        record = null;
        filters.replaceChildren();
        list.replaceChildren(element('li', { class: 'famous-intro' }, shown));
      } else if (shown !== record) {
        record = shown;
        draw();
      }
      if (!dialog.open) dialog.showModal();
    },
  };
}
