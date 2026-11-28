/**
 * Find an animal (a prototype): a box that takes the name a reader knows, and the animals in
 * the fossil groups it finds, each opening its story. The groups' files load when it first
 * opens.
 */

import type { LifePictures } from '../../data/lifePictures';
import type { LifeData } from '../../data/lifeStories';
import { element } from '../../ui/dom';
import { pictureOf, silhouetteImage } from './pictures';
import { findAnimals, SUGGESTED, type Found } from './names';

export interface LifeFinder {
  readonly button: HTMLButtonElement;
  readonly dialog: HTMLDialogElement;
  open(): void;
}

function described(found: Found, data: LifeData): string {
  const { node } = found;
  const parent = data.nodes[node.parent];
  const kind = node.sites.length > 0 ? 'a kind (genus)' : `a lineage (${node.rank})`;
  return [
    found.known === '' ? kind : `${node.name}, ${kind}`,
    parent === undefined ? data.name : `in ${parent.name}`,
    node.living ? 'living' : node.sites.length > 0 ? 'extinct' : null,
  ]
    .filter((part) => part !== null)
    .join(' · ');
}

export function createLifeFinder(
  load: () => Promise<readonly LifeData[]>,
  onPick: (found: Found, data: LifeData) => void,
  pictures: () => LifePictures | null,
): LifeFinder {
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

  let groups: readonly LifeData[] | null = null;
  let loading = false;
  let failed = false;

  function show(found: readonly Found[]): void {
    list.replaceChildren(
      ...found.flatMap((each) => {
        const data = groups?.find((group) => group.id === each.group);
        if (data === undefined) return [];
        const item = element(
          'button',
          { type: 'button', class: 'famous-item' },
          (() => {
            const silhouette = pictureOf(pictures(), each.node.name)?.silhouette;
            return silhouette == null
              ? element('span', { class: `fossil-key is-${each.group}` })
              : silhouetteImage(silhouette, 28);
          })(),
          element(
            'span',
            { class: 'famous-text' },
            element(
              'span',
              { class: 'famous-title' },
              each.known === '' ? each.node.name : each.known,
            ),
            element('span', { class: 'famous-meta' }, described(each, data)),
          ),
        );
        item.addEventListener('click', () => {
          dialog.close();
          onPick(each, data);
        });
        return [element('li', {}, item)];
      }),
    );
  }

  function render(): void {
    if (groups === null) {
      status.textContent = failed ? 'Could not load the animals. Try again later.' : 'Loading…';
      list.replaceChildren();
      return;
    }
    const all = groups;
    const query = input.value.trim();
    if (query === '') {
      status.textContent =
        'Follow an animal’s line back through the fossil record: where its kind was found as the continents moved, and how warm the world was. Mammals and dinosaurs so far. Try:';
      show(SUGGESTED.flatMap((name) => findAnimals(all, name, 1)));
      return;
    }
    const found = findAnimals(all, query);
    status.textContent =
      found.length === 0
        ? 'No such animal among the fossil mammals and dinosaurs. Birds, reptiles and fish are not in yet.'
        : `${String(found.length)} found`;
    show(found);
  }

  function open(): void {
    if (!dialog.open) dialog.showModal();
    input.focus();
    input.select();
    if (groups === null && !loading) {
      loading = true;
      failed = false;
      load().then(
        (loaded) => {
          groups = loaded;
          loading = false;
          render();
        },
        () => {
          loading = false;
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
