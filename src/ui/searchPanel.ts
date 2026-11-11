/**
 * Search the site's texts (#392, #393): a box, and the passages that match, each with the places
 * and times it is anchored to; a tap on one opens its view. Words are matched at once; search by
 * meaning, once the reader turns it on (it downloads a model), merges its results in as they
 * come. The index is asked for on first opening, the model on first turning it on.
 */

import { fused } from '../text/meaning';
import { anchorLabel } from '../text/anchors';
import type { Anchor, PassageKind } from '../text/passages';
import { searchWords, snippet, type Hit, type WordIndex } from '../text/wordSearch';
import { element } from './dom';
import { uiIcon } from './icons';
import './searchPanel.css';

const KINDS: Readonly<Record<PassageKind, string>> = {
  why: 'How the site shows it',
  moon: 'Moon',
  eclipse: 'Eclipse record',
  landing: 'Landing',
};

/** Where the reader's choice to search by meaning is remembered, in this browser only. */
const MEANING_KEY = 'histeclipse.searchByMeaning';
/** How long typing must pause before the model is asked. */
const MEANING_PAUSE_MS = 200;

/** Whether an anchor says more than "Earth": a place, a time, or another body. */
function telling(anchor: Anchor): boolean {
  return anchor.body !== 'earth' || anchor.at !== undefined || anchor.when !== undefined;
}

function remembered(): boolean {
  try {
    return localStorage.getItem(MEANING_KEY) === 'on';
  } catch {
    return false;
  }
}

function remember(on: boolean): void {
  try {
    if (on) localStorage.setItem(MEANING_KEY, 'on');
    else localStorage.removeItem(MEANING_KEY);
  } catch {
    // Without storage the choice lasts as long as the page.
  }
}

export interface SearchPanel {
  readonly button: HTMLButtonElement;
  readonly dialog: HTMLDialogElement;
  open(): void;
}

/** Ranks the passages by meaning, once its model has loaded. */
export type MeaningSearch = (query: string) => Promise<Hit[]>;

export function createSearchPanel(
  load: () => Promise<WordIndex>,
  loadMeaning: () => Promise<MeaningSearch>,
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
    placeholder: 'Places, people, missions, or a question…',
    'aria-label': 'Search the texts',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const meaningBox = element('input', { type: 'checkbox', class: 'search-meaning-box' });
  const meaningNote = element(
    'span',
    { class: 'search-meaning-note' },
    'Downloads a 48 MB model once (bge-small, MIT); it runs in your browser, and nothing you type leaves it.',
  );
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
    element(
      'label',
      { class: 'search-meaning' },
      meaningBox,
      element('span', {}, 'Search by meaning too', element('br'), meaningNote),
    ),
    status,
    list,
  );

  let index: WordIndex | null = null;
  let loading: Promise<void> | null = null;
  let failed = false;
  let meaning: MeaningSearch | null = null;
  let meaningLoading = false;
  let meaningFailed = false;
  let pause: ReturnType<typeof setTimeout> | null = null;
  meaningBox.checked = remembered();

  function show(hits: readonly Hit[]): void {
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

  function counted(hits: readonly Hit[], byMeaning: boolean): string {
    if (hits.length === 0) return 'Nothing found.';
    return `${String(hits.length)} found${byMeaning ? ', by words and meaning' : ''}`;
  }

  /** The word results now; the merged ones once the model answers, if the query still stands. */
  function render(): void {
    const query = input.value;
    if (pause !== null) clearTimeout(pause);
    if (index === null) {
      status.textContent = failed
        ? 'Could not load the texts. Try again later.'
        : 'Loading the texts…';
      list.replaceChildren();
      return;
    }
    if (query.trim() === '') {
      status.textContent = `Search ${String(index.passages.length)} texts: what each view shows, the moons, eclipse records and landings.`;
      list.replaceChildren();
      return;
    }
    const words = searchWords(index, query);
    const ask = meaningBox.checked ? meaning : null;
    status.textContent = meaningFailed
      ? `${counted(words, false)} Could not load search by meaning.`
      : meaningBox.checked && meaning === null
        ? `${counted(words, false)} Loading search by meaning…`
        : counted(words, false);
    show(words);
    if (ask === null) return;
    pause = setTimeout(() => {
      ask(query).then(
        (byMeaning) => {
          if (input.value !== query) return;
          const merged = fused(words, byMeaning);
          status.textContent = counted(merged, true);
          show(merged);
        },
        () => {
          status.textContent = `${counted(words, false)} Search by meaning failed.`;
        },
      );
    }, MEANING_PAUSE_MS);
  }

  function startMeaning(): void {
    if (!meaningBox.checked || meaning !== null || meaningLoading) return;
    meaningLoading = true;
    meaningFailed = false;
    loadMeaning().then(
      (loaded) => {
        meaning = loaded;
        meaningLoading = false;
        render();
      },
      () => {
        meaningLoading = false;
        meaningFailed = true;
        render();
      },
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
    startMeaning();
    render();
  }

  button.addEventListener('click', open);
  input.addEventListener('input', render);
  meaningBox.addEventListener('change', () => {
    remember(meaningBox.checked);
    startMeaning();
    render();
  });
  close.addEventListener('click', () => {
    dialog.close();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  return { button, dialog, open };
}
