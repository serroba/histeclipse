/**
 * Find an animal: a box that takes the name a reader knows, and the animals in the fossil
 * groups it finds, each opening its story. The groups' files load when it first opens.
 */

import type { LifeData } from '../../data/lifeStories';
import { element } from '../../ui/dom';
import type { LifePictures } from './lifePictures';
import { findAnimals, SUGGESTED, type Found } from './names';
import { pictureOf, silhouetteImage } from './pictures';

export interface LifeFinder {
  readonly button: HTMLButtonElement;
  readonly dialog: HTMLDialogElement;
  readonly open: () => void;
}

const INTRO =
  'Follow an animal’s line back through the fossil record: where its kind was found as the continents moved, and how warm the world was. Mammals and dinosaurs so far. Try:';
const NONE =
  'No such animal among the fossil mammals and dinosaurs. Birds, reptiles and fish are not in yet.';

/** What a found animal is, under its name: a kind or a lineage, in what, living or not. */
export function described(found: Found, data: LifeData): string {
  const { node } = found;
  const genus = node.sites.length > 0;
  const kind = genus ? 'a kind (genus)' : `a lineage (${node.rank})`;
  const parent = data.nodes[node.parent];
  return [
    found.known === '' ? kind : `${node.name}, ${kind}`,
    parent === undefined ? data.name : `in ${parent.name}`,
    ...(node.living ? ['living'] : genus ? ['extinct'] : []),
  ].join(' · ');
}

/** A found animal in the list: its silhouette, or its group's colour, and what it is. */
function item(
  found: Found,
  data: LifeData,
  pictures: LifePictures | null,
  pick: () => void,
): HTMLElement {
  const silhouette = pictureOf(pictures, found.node.name)?.silhouette ?? null;
  const row = element(
    'button',
    { type: 'button', class: 'famous-item' },
    silhouette === null
      ? element('span', { class: `fossil-key is-${found.group}` })
      : silhouetteImage(silhouette, 28),
    element(
      'span',
      { class: 'famous-text' },
      element(
        'span',
        { class: 'famous-title' },
        found.known === '' ? found.node.name : found.known,
      ),
      element('span', { class: 'famous-meta' }, described(found, data)),
    ),
  );
  row.addEventListener('click', pick);
  return element('li', {}, row);
}

/** The finder's elements, made once. */
function frame() {
  const button = element(
    'button',
    {
      type: 'button',
      class: 'search-open life-open',
      'aria-label': 'Find an animal and follow its story',
      title: 'An animal’s story',
    },
    element('span', { class: 'life-open-mark', 'aria-hidden': 'true' }, '🦴'),
    element('span', { class: 'icon-label' }, 'Animals'),
  );
  const input = element('input', {
    type: 'search',
    class: 'search-input',
    placeholder: 'Lion, horse, mammoth, Tyrannosaurus…',
    'aria-label': 'Find an animal',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const status = element('p', { class: 'famous-intro', role: 'status' });
  const list = element('ul', { class: 'famous-list life-found' });
  const close = element(
    'button',
    { type: 'button', class: 'famous-close', 'aria-label': 'Close' },
    '×',
  );
  const dialog = element(
    'dialog',
    { class: 'famous-dialog life-finder', 'aria-labelledby': 'life-finder-title' },
    element(
      'header',
      { class: 'famous-header' },
      element('h2', { id: 'life-finder-title' }, 'An animal’s story'),
      close,
    ),
    element('div', { class: 'search-box' }, input),
    status,
    list,
  );
  return { button, input, status, list, close, dialog };
}

export function createLifeFinder(
  load: () => Promise<readonly LifeData[]>,
  onPick: (found: Found, data: LifeData) => void,
  pictures: () => LifePictures | null,
): LifeFinder {
  const made = frame();
  let groups: readonly LifeData[] | null = null;
  let state: 'idle' | 'loading' | 'failed' = 'idle';

  function show(found: readonly { readonly found: Found; readonly data: LifeData }[]): void {
    made.list.replaceChildren(
      ...found.map(({ found: each, data }) =>
        item(each, data, pictures(), () => {
          made.dialog.close();
          onPick(each, data);
        }),
      ),
    );
  }

  function render(): void {
    if (groups === null) {
      made.status.textContent =
        state === 'failed' ? 'Could not load the animals. Try again later.' : 'Loading…';
      made.list.replaceChildren();
      return;
    }
    const all = groups;
    const query = made.input.value.trim();
    const found = (
      query === ''
        ? SUGGESTED.flatMap((name) => findAnimals(all, name, 1))
        : findAnimals(all, query)
    ).flatMap((each) =>
      all.flatMap((data) => (data.id === each.group ? [{ found: each, data }] : [])),
    );
    made.status.textContent =
      query === '' ? INTRO : found.length === 0 ? NONE : `${String(found.length)} found`;
    show(found);
  }

  function open(): void {
    if (!made.dialog.open) made.dialog.showModal();
    made.input.focus();
    made.input.select();
    if (groups === null && state !== 'loading') {
      state = 'loading';
      load().then(
        (loaded) => {
          groups = loaded;
          state = 'idle';
          render();
        },
        () => {
          state = 'failed';
          render();
        },
      );
    }
    render();
  }

  made.button.addEventListener('click', open);
  made.input.addEventListener('input', render);
  made.close.addEventListener('click', () => {
    made.dialog.close();
  });
  made.dialog.addEventListener('click', (event) => {
    if (event.target === made.dialog) made.dialog.close();
  });
  return { button: made.button, dialog: made.dialog, open };
}
