/**
 * Go to a time (#730): the date in the header opens it. Type a year or an age (1969, 44 BCE,
 * 60 ka, 100 Ma, 3.5 Ga) to go there, each in the range that draws it; it says the moment and
 * range shown, and which layers on have no data there and how far they reach. The ranges
 * (Years, Ice ages, 540 Myr, 4.6 Gyr) stay as presets beside Layers.
 */

import { activeLayers, spanShown } from '../../state/activeLayers';
import type { Span, ViewState } from '../../state/viewState';
import { formatDate, formatMa } from '../../time/format';
import { parseTimeEntry, type TimeEntry } from '../../time/timeEntry';
import { element } from '../../ui/dom';

/** Each range, as the dialog says it. */
const RANGES: Readonly<Record<Span, string>> = {
  years: 'the years, from 9700 BCE to today',
  ice: 'the ice ages, the last 2.6 million years',
  all: 'the last 540 million years',
  eons: 'all of Earth’s history, 4.6 billion years',
};

/** The other panels on its side, closed when it opens. */
const SAME_SIDE = 'dialog.layers-dialog[open], dialog.explore-dialog[open]';

export interface TimeDialog {
  readonly dialog: HTMLDialogElement;
  /** The header's date, as the button that opens it. */
  trigger(date: Node): HTMLButtonElement;
  render(state: ViewState): void;
}

function form(onEntry: (entry: TimeEntry) => void, present: number, close: () => void) {
  const input = element('input', {
    type: 'text',
    class: 'time-entry-input',
    id: 'time-entry-input',
    'aria-describedby': 'time-entry-help',
    autocomplete: 'off',
    spellcheck: 'false',
    enterkeyhint: 'go',
  });
  const error = element('p', { class: 'time-entry-error', role: 'alert', hidden: '' });
  const root = element(
    'form',
    { class: 'time-entry' },
    element('label', { for: 'time-entry-input' }, 'A year or an age'),
    element(
      'div',
      { class: 'time-entry-row' },
      input,
      element('button', { type: 'submit', class: 'time-entry-go' }, 'Go'),
    ),
    element(
      'p',
      { class: 'time-entry-help', id: 'time-entry-help' },
      'Such as 1969, 44 BCE, 60 ka, 100 Ma or 3.5 Ga.',
    ),
    error,
  );
  root.addEventListener('submit', (event) => {
    event.preventDefault();
    const read = parseTimeEntry(input.value, present);
    error.hidden = read.ok;
    if (!read.ok) {
      error.textContent = read.message;
      input.setAttribute('aria-invalid', 'true');
      return;
    }
    input.removeAttribute('aria-invalid');
    input.value = '';
    close();
    onEntry(read.entry);
  });
  return { root, input };
}

export function createTimeDialog(onEntry: (entry: TimeEntry) => void, present: number): TimeDialog {
  const close = element(
    'button',
    { type: 'button', class: 'famous-close', 'aria-label': 'Close' },
    '×',
  );
  const showing = element('p', { class: 'time-showing' });
  const gaps = element('ul', { class: 'time-gaps', 'aria-label': 'Layers with no data here' });
  const shut = (): void => {
    if (dialog.open) dialog.close();
  };
  const entry = form(onEntry, present, shut);
  const dialog = element(
    'dialog',
    { id: 'time-dialog', class: 'famous-dialog time-dialog', 'aria-labelledby': 'time-title' },
    element(
      'header',
      { class: 'famous-header' },
      element('h2', { id: 'time-title' }, 'Go to a time'),
      close,
    ),
    entry.root,
    showing,
    gaps,
  );
  const triggers: HTMLButtonElement[] = [];
  close.addEventListener('click', shut);
  dialog.addEventListener('close', () => {
    for (const trigger of triggers) trigger.setAttribute('aria-expanded', 'false');
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    shut();
    triggers[0]?.focus();
  });
  return {
    dialog,
    trigger(date) {
      if (date instanceof Element && date.id === '') date.id = 'hud-date';
      const button = element(
        'button',
        {
          type: 'button',
          class: 'hud-date-button',
          'aria-haspopup': 'dialog',
          'aria-controls': 'time-dialog',
          'aria-expanded': 'false',
          // Named for what it does, the date shown as its description: other controls name years.
          'aria-label': 'Go to another date or age',
          'aria-describedby': 'hud-date',
          title: 'Go to another date or age',
        },
        date,
      );
      button.addEventListener('click', () => {
        if (dialog.open) {
          shut();
          return;
        }
        for (const other of document.querySelectorAll<HTMLDialogElement>(SAME_SIDE)) other.close();
        dialog.show();
        button.setAttribute('aria-expanded', 'true');
        entry.input.focus();
      });
      triggers.push(button);
      return button;
    },
    render(state) {
      const date = state.ma === null ? formatDate(state.time) : formatMa(state.ma);
      showing.textContent = `Showing ${date}, in ${RANGES[spanShown(state)]}.`;
      const missing = activeLayers(state).flatMap((layer) =>
        layer.why === null ? [] : [`${layer.label}: ${layer.why}. ${layer.reach}`],
      );
      gaps.hidden = missing.length === 0;
      gaps.replaceChildren(...missing.map((line) => element('li', {}, line)));
    },
  };
}
