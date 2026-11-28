/**
 * A source as the "why" panel shows it (#220): its link, its full reference, its licence and the
 * ways to cite it. The references come with the panel's content, loaded when first needed.
 */

import type * as ContentModule from '../sources/content';
import { bibtexUrl, SOURCES, type Source, type SourceId } from '../sources/registry';
import { element } from './dom';
import { KIND_NAMES, kindIcon } from './icons';

/** The whys and the full references, a chunk of their own (#220). */
export type Content = typeof ContentModule;

/** A source's link, opened beside the site. */
export function sourceLink(source: Source): HTMLAnchorElement {
  return element(
    'a',
    { href: source.url, target: '_blank', rel: 'noopener noreferrer' },
    source.name,
  );
}

/** Put `text` on the clipboard; say on `button` whether it worked, for a moment. */
export function copyFrom(button: HTMLButtonElement, text: string): void {
  const label = button.textContent;
  const say = (words: string): void => {
    button.textContent = words;
    window.setTimeout(() => {
      button.textContent = label;
    }, 1600);
  };
  navigator.clipboard.writeText(text).then(
    () => {
      say('Copied');
    },
    () => {
      say('Could not copy');
    },
  );
}

/** A source as the panel lists it: its kind, its full reference and link, its licence, and
 * ways to cite it. */
export function sourceItem(content: Content, id: SourceId): HTMLElement {
  const source = SOURCES[id];
  const copy = element(
    'button',
    {
      type: 'button',
      class: 'why-cite-action',
      'aria-label': `Copy the reference to ${source.name}`,
    },
    'Copy reference',
  );
  copy.addEventListener('click', () => {
    copyFrom(copy, content.citation(id));
  });
  const bibtex = bibtexUrl(source);
  const actions = element(
    'span',
    { class: 'why-cite-actions' },
    copy,
    ...(bibtex === null
      ? []
      : [
          element(
            'a',
            {
              class: 'why-cite-action',
              href: bibtex,
              target: '_blank',
              rel: 'noopener noreferrer',
              'aria-label': `BibTeX for ${source.name}, from Crossref`,
            },
            'BibTeX',
          ),
        ]),
  );
  const kind = element('span', { class: 'why-kind', title: KIND_NAMES[source.kind] });
  kind.append(kindIcon(source.kind));
  return element(
    'li',
    { class: 'why-source', 'data-kind': source.kind },
    kind,
    element(
      'div',
      { class: 'why-source-text' },
      sourceLink(source),
      element('span', { class: 'why-cite' }, content.CITATIONS[id]),
      ...(source.licence === undefined
        ? []
        : [
            element(
              'span',
              {
                class: `why-licence${'nonCommercial' in source ? ' is-nc' : ''}`,
                title:
                  'nonCommercial' in source
                    ? 'Non-commercial terms: the site may use it only as it does, without charge'
                    : 'Licence',
              },
              source.licence,
            ),
          ]),
      actions,
    ),
  );
}
