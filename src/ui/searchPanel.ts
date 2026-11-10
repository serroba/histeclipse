/**
 * Search the site's texts (#392): a box, and the passages that match, each with the places and
 * times it is anchored to; a tap on one opens its view. The index is asked for on first opening.
 */

import { anchorLabel } from '../text/anchors';
import type { Anchor, PassageKind } from '../text/passages';
import { searchWords, snippet, type WordIndex } from '../text/wordSearch';
import { element } from './dom';
import { uiIcon } from './icons';

const KINDS: Readonly<Record<PassageKind, string>> = {
  why: 'How the site shows it',
  moon: 'Moon',
  eclipse: 'Eclipse record',
  landing: 'Landing',
};

/** Whether an anchor says more than "Earth": a place, a time, or another body. */
function telling(anchor: Anchor): boolean {
  return anchor.body !== 'earth' || anchor.at !== undefined || anchor.when !== undefined;
}

export interface SearchPanel {
  readonly button: HTMLButtonElement;
  readonly dialog: HTMLDialogElement;
  open(): void;
}

export function createSearchPanel(
  load: () => Promise<WordIndex>,
  onOpen: (anchor: Anchor) => void,
): SearchPanel {
  const button = element(
    'button',
    { type: 'button', class: 'search-open', 'aria-label': 'Search the texts', title: 'Search (/)' },
    uiIcon('search', 16),
    element('span', { class: 'icon-label' }, 'Search'),
  );
  const input = element('input', {
    type: 'search',
    class: 'search-input',
    placeholder: 'Places, people, missions, eclipses…',
    'aria-label': 'Search the texts',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const status = element('p', { class: 'famous-intro search-status', role: 'status' });
  const list = element('ul', { class: 'famous-list search-results' });
  const close = element(
    'button',
    { type: 'button', class: 'famous-close', 'aria-label': 'Close' },
    '×',
  );
  const dialog = element(
    'dialog',
    { class: 'famous-dialog search-dialog', 'aria-labelledby': 'search-title' },
    element(
      'header',
      { class: 'famous-header' },
      element('h2', { id: 'search-title' }, 'Search'),
      close,
    ),
    element('div', { class: 'search-box' }, input),
    status,
    list,
  );

  let index: WordIndex | null = null;
  let loading: Promise<void> | null = null;
  let failed = false;

  function render(): void {
    const query = input.value;
    if (index === null) {
      status.textContent = failed
        ? 'Could not load the texts. Try again later.'
        : 'Loading the texts…';
      list.replaceChildren();
      return;
    }
    const hits = query.trim() === '' ? [] : searchWords(index, query);
    status.textContent =
      query.trim() === ''
        ? `Search ${String(index.passages.length)} texts: what each view shows, the moons, eclipse records and landings.`
        : hits.length === 0
          ? 'Nothing found.'
          : `${String(hits.length)} found`;
    list.replaceChildren(
      ...hits.map(({ passage, matched }) => {
        const go = (anchor: Anchor) => () => {
          dialog.close();
          onOpen(anchor);
        };
        const [first, ...more] = passage.anchors;
        const title = element(
          'button',
          { type: 'button', class: 'famous-item search-hit' },
          element(
            'span',
            { class: 'famous-text' },
            element('span', { class: 'famous-title' }, passage.title),
            element(
              'span',
              { class: 'famous-meta' },
              [
                KINDS[passage.kind],
                ...(first === undefined || !telling(first) ? [] : [anchorLabel(first)]),
              ].join(' · '),
            ),
            element('span', { class: 'search-snippet' }, snippet(passage, matched)),
          ),
        );
        if (first === undefined) title.disabled = true;
        else title.addEventListener('click', go(first));
        const others = more.map((anchor) => {
          const other = element(
            'button',
            { type: 'button', class: 'search-anchor' },
            anchorLabel(anchor),
          );
          other.addEventListener('click', go(anchor));
          return other;
        });
        return element(
          'li',
          { 'data-passage': passage.id },
          title,
          ...(others.length === 0 ? [] : [element('div', { class: 'search-anchors' }, ...others)]),
        );
      }),
    );
  }

  function open(): void {
    if (!dialog.open) dialog.showModal();
    input.focus();
    input.select();
    if (index === null && loading === null) {
      failed = false;
      loading = load().then(
        (loaded) => {
          index = loaded;
          render();
        },
        () => {
          loading = null;
          failed = true;
          render();
        },
      );
    }
    render();
  }

  button.addEventListener('click', open);
  input.addEventListener('input', render);
  close.addEventListener('click', () => {
    dialog.close();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  return { button, dialog, open };
}
