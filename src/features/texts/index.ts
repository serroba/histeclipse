/**
 * The site's texts as a part of the page (#391, #392): searched by their words, or by meaning
 * once the reader turns it on (#393), a passage opening the view of its place; and what is
 * written about where the reader looks, at the moment shown. The passages load once, when
 * either first asks.
 */

import type { PartContext } from '../part';
import { type ViewState } from '../../state/viewState';
import { element } from '../../ui/dom';
import { createSearchPanel } from '../../ui/searchPanel';
import { anchorLabel } from '../../text/anchors';
import { loadMeaningSearch } from '../../text/meaningLoader';
import { nearby } from '../../text/nearby';
import { cachedPassages, type Anchor, type Passage } from '../../text/passages';
import { indexPassages } from '../../text/wordSearch';

/** What the texts ask of the rest of the page. */
export interface TextsContext extends PartContext {
  /** Open a passage's anchor: its view laid over the reader's. */
  openAnchor(anchor: Anchor): void;
}

export interface TextsPart {
  readonly search: { readonly button: HTMLElement; readonly dialog: HTMLElement; open(): void };
  /** "About here", folded until opened. */
  readonly here: HTMLElement;
  /** What is written about here, while open. */
  readonly show: (state: ViewState) => void;
}

export function mountTexts(context: TextsContext): TextsPart {
  const { base, fetchJson, store } = context;
  // The site's texts as passages, asked for once, by search or by what is written about here.
  const passages = cachedPassages(`${base}data/passages.json`, fetchJson);
  // The site's texts, searched by their words; a passage opens the view of its place (#392).
  const searchPanel = createSearchPanel(
    () => passages().then(indexPassages),
    // Search by meaning (#393), asked for only once the reader turns it on.
    () => loadMeaningSearch(base, passages),
    (anchor) => {
      context.openAnchor(anchor);
    },
  );
  // What is written about where the reader looks, at the moment shown (#391).
  const hereList = element('ul', { class: 'here-list', 'data-testid': 'here-list' });
  const hereText = element(
    'details',
    { class: 'here-text' },
    element('summary', {}, 'About here'),
    hereList,
  );
  let herePassages: readonly Passage[] | null = null;
  hereText.addEventListener('toggle', () => {
    if (!hereText.open || herePassages !== null) return;
    hereList.replaceChildren(element('li', { class: 'here-empty' }, 'Loading…'));
    passages().then(
      (loaded) => {
        herePassages = loaded;
        showHere(store.get());
      },
      () => {
        hereList.replaceChildren(
          element('li', { class: 'here-empty' }, 'Could not load the texts.'),
        );
      },
    );
  });

  let hereShown: string | null = null;
  /** What is written about here: the passages anchored where the reader looks, when. */
  function showHere(state: ViewState): void {
    if (!hereText.open || herePassages === null) return;
    const sky = state.mode === 'sky';
    const found = nearby(herePassages, {
      body: sky ? 'earth' : state.focus,
      target: sky ? (state.location ?? state.camera.target) : state.camera.target,
      distance: sky ? 3 : state.camera.distance,
      year: state.ma === null ? state.time.date.year : null,
    });
    const key = found.map(({ passage }) => passage.id).join(' ');
    if (key === hereShown) return;
    hereShown = key;
    if (found.length === 0) {
      hereList.replaceChildren(
        element('li', { class: 'here-empty' }, 'Nothing written about here yet. Try Search.'),
      );
      return;
    }
    hereList.replaceChildren(
      ...found.map(({ passage, anchor }) => {
        const open = element(
          'button',
          { type: 'button', class: 'here-item' },
          element('span', { class: 'here-title' }, passage.title),
          element('span', { class: 'here-meta' }, anchorLabel(anchor)),
        );
        open.addEventListener('click', () => {
          context.openAnchor(anchor);
        });
        return element('li', { 'data-passage': passage.id }, open);
      }),
    );
  }

  return {
    search: {
      button: searchPanel.button,
      dialog: searchPanel.dialog,
      open: () => {
        searchPanel.open();
      },
    },
    here: hereText,
    show: showHere,
  };
}
