/**
 * Pictures in a card (#798): a strip of small squares, each opening the picture larger with
 * what it shows, whose it is and its licence. The larger copy is asked for only when opened.
 */

import { element } from './dom';
import './pictureStrip.css';

interface CardPicture {
  readonly title: string;
  /** When its source released it, as written: "12 July 2022". */
  readonly released: string;
  readonly about: string;
  /** What it looks like, for a reader who cannot see it. */
  readonly alt: string;
  readonly credit: string;
  /** Its own page at its source. */
  readonly page: string;
  readonly thumb: string;
  readonly large: string;
  readonly width: number;
  readonly height: number;
}

export interface CardPictures {
  readonly heading: string;
  /** Who publishes them, and under what terms. */
  readonly source: string;
  readonly licence: string;
  readonly licenceUrl: string;
  readonly pictures: readonly CardPicture[];
}

export interface PictureViewer {
  readonly dialog: HTMLDialogElement;
  /** Open on one of a card's pictures; the others a step away. */
  show(content: CardPictures, index: number): void;
}

function outward(href: string, label: string): HTMLAnchorElement {
  return element('a', { href, target: '_blank', rel: 'noopener noreferrer' }, label);
}

/** The larger picture, in a dialog of its own over the card: Escape or its button closes it. */
export function createPictureViewer(): PictureViewer {
  const close = element(
    'button',
    { type: 'button', class: 'famous-close', 'aria-label': 'Close the picture' },
    '×',
  );
  const title = element('h2', { id: 'picture-view-title' });
  const body = element('div', { class: 'picture-view-body' });
  const dialog = element(
    'dialog',
    {
      class: 'famous-dialog picture-view',
      'aria-labelledby': 'picture-view-title',
      'data-testid': 'picture-view',
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

  function step(content: CardPictures, to: number, label: string): HTMLButtonElement {
    const button = element('button', { type: 'button' }, label);
    button.disabled = to < 0 || to >= content.pictures.length;
    button.addEventListener('click', () => {
      show(content, to);
    });
    return button;
  }

  function show(content: CardPictures, index: number): void {
    const picture = content.pictures[index];
    if (picture === undefined) return;
    title.textContent = picture.title;
    body.replaceChildren(
      element('img', {
        src: picture.large,
        alt: picture.alt,
        width: String(picture.width),
        height: String(picture.height),
      }),
      element('p', {}, picture.about),
      element(
        'p',
        { class: 'picture-view-credit' },
        `Picture: ${picture.credit}. Released ${picture.released} by `,
        outward(picture.page, content.source),
        ' under ',
        outward(content.licenceUrl, content.licence),
        '; made smaller here.',
      ),
      element(
        'nav',
        { class: 'picture-view-steps', 'aria-label': 'Other pictures' },
        step(content, index - 1, 'Previous'),
        element('span', {}, `${String(index + 1)} of ${String(content.pictures.length)}`),
        step(content, index + 1, 'Next'),
      ),
    );
    if (!dialog.open) dialog.showModal();
  }

  return { dialog, show };
}

/** The strip in a card: each picture a button named by its title. */
export function pictureStrip(content: CardPictures, viewer: PictureViewer): HTMLElement {
  return element(
    'section',
    { class: 'picture-strip', 'aria-label': content.heading },
    // A label, not a heading: the card's one heading is its title.
    element('p', { class: 'picture-strip-title', 'aria-hidden': 'true' }, content.heading),
    element(
      'ul',
      {},
      ...content.pictures.map((picture, index) => {
        const open = element(
          'button',
          { type: 'button', 'aria-label': `${picture.title}: see it larger` },
          // Named by its button: the square itself says nothing more.
          element('img', {
            src: picture.thumb,
            alt: '',
            width: '96',
            height: '96',
            loading: 'lazy',
          }),
        );
        open.addEventListener('click', () => {
          viewer.show(content, index);
        });
        return element('li', {}, open);
      }),
    ),
    element(
      'p',
      { class: 'picture-strip-credit' },
      `${content.source}, `,
      outward(content.licenceUrl, content.licence),
      '.',
    ),
  );
}
