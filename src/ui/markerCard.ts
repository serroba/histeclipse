/**
 * The card a marker on the globe opens: a title, what the source says of it, links to read
 * more, and a small picture where the source has one. A dialog (a bottom sheet on phones).
 */

import { element } from './dom';

export interface MarkerCardContent {
  readonly title: string;
  readonly facts: readonly (readonly [string, string])[];
  readonly links: readonly { readonly label: string; readonly href: string }[];
  /** A thumbnail, with whose it is. */
  readonly image?: { readonly src: string; readonly alt: string; readonly credit: string };
  /** A word on what the source can and cannot say. */
  readonly note?: string;
}

export interface MarkerCard {
  readonly dialog: HTMLDialogElement;
  show(content: MarkerCardContent): void;
}

/** Only web links leave the page: anything else in a data file is not followed. */
function safeLink(href: string): boolean {
  try {
    return new URL(href).protocol === 'https:';
  } catch {
    return false;
  }
}

export function createMarkerCard(): MarkerCard {
  const close = element(
    'button',
    { type: 'button', class: 'famous-close', 'aria-label': 'Close' },
    '×',
  );
  const title = element('h2', { id: 'marker-card-title' });
  const body = element('div', { class: 'marker-card-body' });
  const dialog = element(
    'dialog',
    {
      class: 'famous-dialog marker-card',
      'aria-labelledby': 'marker-card-title',
      'data-testid': 'marker-card',
    },
    element('header', { class: 'famous-header' }, title, close),
    body,
  );
  close.addEventListener('click', () => {
    dialog.close();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  return {
    dialog,
    show({ title: text, facts, links, image, note }) {
      title.textContent = text;
      const shown = links.filter((link) => safeLink(link.href));
      body.replaceChildren(
        ...(image === undefined || !safeLink(image.src)
          ? []
          : [
              element(
                'figure',
                { class: 'marker-card-image' },
                element('img', { src: image.src, alt: image.alt, loading: 'lazy' }),
                element('figcaption', {}, image.credit),
              ),
            ]),
        element(
          'dl',
          { class: 'marker-card-facts' },
          ...facts.flatMap(([label, value]) => [
            element('dt', {}, label),
            element('dd', {}, value),
          ]),
        ),
        ...(note === undefined ? [] : [element('p', { class: 'marker-card-note' }, note)]),
        ...(shown.length === 0
          ? []
          : [
              element(
                'p',
                { class: 'marker-card-links' },
                'Read more: ',
                ...shown.flatMap((link, index) => [
                  ...(index === 0 ? [] : [' · ']),
                  element(
                    'a',
                    { href: link.href, target: '_blank', rel: 'noopener noreferrer' },
                    link.label,
                  ),
                ]),
              ),
            ]),
      );
      if (!dialog.open) dialog.showModal();
    },
  };
}
