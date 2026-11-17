/**
 * The card a marker on the globe opens: a title, what the source says of it, links to read
 * more, and a small picture where the source has one. A dialog (a bottom sheet on phones); a
 * picture of its own opened larger (#798) is a dialog within it, over it and gone with it.
 */

import { element } from './dom';
import { createPictureViewer, pictureStrip, type CardPictures } from './pictureStrip';
import './markerCard.css';

export interface MarkerCardContent {
  readonly title: string;
  readonly facts: readonly (readonly [string, string])[];
  readonly links: readonly { readonly label: string; readonly href: string }[];
  /** A thumbnail, with whose it is. */
  readonly image?: { readonly src: string; readonly alt: string; readonly credit: string };
  /** Pictures of its own, such as those a telescope took (#798): a strip, each opening larger. */
  readonly pictures?: CardPictures;
  /** A 3D model of it (#797), drawn while the card is open. */
  readonly model?: CardModel;
  /** A word on what the source can and cannot say. */
  readonly note?: string;
  /** Something to do with it, such as playing an impact: the card closes first, to show it. */
  readonly action?: { readonly label: string; readonly run: () => void };
  /** A few next views (#731), each saying where it goes: the card closes first. */
  readonly related?: readonly RelatedStep[];
}

/**
 * A 3D model in a card: what it shows, a word on how it was made, and how to draw it into a box
 * (giving back how to stop). Shown again with the same model, the card keeps the view it has.
 */
export interface CardModel {
  readonly label: string;
  readonly caption: string;
  mount(host: HTMLElement): () => void;
}

/** A next view from a card: what it is, where it goes (and any change of time), and going. */
export interface RelatedStep {
  readonly label: string;
  readonly explain: string;
  readonly run: () => void;
}

export interface MarkerCard {
  readonly dialog: HTMLDialogElement;
  readonly show: (content: MarkerCardContent) => void;
}

/** Only web links leave the page: anything else in a data file is not followed. */
function safeLink(href: string): boolean {
  try {
    return new URL(href).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * A thumbnail with its credit; gone without a trace if its host will not serve it. Asked for
 * without a referrer: the Smithsonian refuses photos to other sites' pages (403), and the
 * hosts need not learn which page a reader is on.
 */
function picture(image: NonNullable<MarkerCardContent['image']>): HTMLElement {
  const img = element('img', { src: image.src, alt: image.alt, referrerpolicy: 'no-referrer' });
  const figure = element(
    'figure',
    { class: 'marker-card-image' },
    img,
    element('figcaption', {}, image.credit),
  );
  img.addEventListener('error', () => {
    figure.remove();
  });
  return figure;
}

/** Related (#731): each next view, and where it goes. */
function relatedList(steps: readonly RelatedStep[], close: () => void): HTMLElement {
  return element(
    'section',
    { class: 'marker-card-related', 'aria-label': 'Related' },
    // A label, not a heading: the card's one heading is its title.
    element('p', { class: 'marker-card-related-title', 'aria-hidden': 'true' }, 'Related'),
    element(
      'ul',
      {},
      ...steps.map((step) => {
        const go = element('button', { type: 'button' }, step.label);
        go.addEventListener('click', () => {
          close();
          step.run();
        });
        return element('li', {}, go, element('span', {}, step.explain));
      }),
    ),
  );
}

/** Something to do with it: the card closes first, to show it. */
function actionButton(
  action: NonNullable<MarkerCardContent['action']>,
  close: () => void,
): HTMLButtonElement {
  const button = element('button', { type: 'button', class: 'marker-card-action' }, action.label);
  button.addEventListener('click', () => {
    close();
    action.run();
  });
  return button;
}

/** Where to read more, if anywhere. */
function readMore(links: MarkerCardContent['links']): HTMLElement[] {
  if (links.length === 0) return [];
  return [
    element(
      'p',
      { class: 'marker-card-links' },
      'Read more: ',
      ...links.flatMap((link, index) => [
        ...(index === 0 ? [] : [' · ']),
        element('a', { href: link.href, target: '_blank', rel: 'noopener noreferrer' }, link.label),
      ]),
    ),
  ];
}

/**
 * The card's 3D model: its figure, drawn once it is in the page and has a width, kept while the
 * card shows the same model again, and stopped when it shows another or closes.
 */
function modelSlot(dialog: HTMLDialogElement): {
  figure(model: CardModel | undefined): HTMLElement[];
  draw(): void;
} {
  let drawn: {
    model: CardModel;
    figure: HTMLElement;
    host: HTMLElement;
    stop: (() => void) | null;
  } | null = null;
  function stop(): void {
    drawn?.stop?.();
    drawn = null;
  }
  dialog.addEventListener('close', stop);
  return {
    figure(model) {
      if (model !== undefined && drawn?.model === model) return [drawn.figure];
      stop();
      if (model === undefined) return [];
      const host = element('div', {
        class: 'marker-card-model-view',
        role: 'img',
        'aria-label': model.label,
      });
      const figure = element(
        'figure',
        { class: 'marker-card-model' },
        host,
        element('figcaption', {}, model.caption),
      );
      drawn = { model, figure, host, stop: null };
      return [figure];
    },
    draw() {
      if (drawn !== null && drawn.stop === null) drawn.stop = drawn.model.mount(drawn.host);
    },
  };
}

export function createMarkerCard(): MarkerCard {
  const close = element(
    'button',
    { type: 'button', class: 'famous-close', 'aria-label': 'Close' },
    '×',
  );
  const title = element('h2', { id: 'marker-card-title' });
  const body = element('div', { class: 'marker-card-body' });
  const viewer = createPictureViewer();
  const dialog = element(
    'dialog',
    {
      class: 'famous-dialog marker-card',
      'aria-labelledby': 'marker-card-title',
      'data-testid': 'marker-card',
    },
    element('header', { class: 'famous-header' }, title, close),
    body,
    viewer.dialog,
  );
  close.addEventListener('click', () => {
    dialog.close();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  const models = modelSlot(dialog);
  return {
    dialog,
    show({ title: text, facts, links, image, pictures, model, note, action, related }) {
      title.textContent = text;
      body.replaceChildren(
        ...(image === undefined || !safeLink(image.src) ? [] : [picture(image)]),
        ...models.figure(model),
        element(
          'dl',
          { class: 'marker-card-facts' },
          ...facts.flatMap(([label, value]) => [
            element('dt', {}, label),
            element('dd', {}, value),
          ]),
        ),
        ...(pictures === undefined ? [] : [pictureStrip(pictures, viewer)]),
        ...(note === undefined ? [] : [element('p', { class: 'marker-card-note' }, note)]),
        ...(action === undefined
          ? []
          : [
              actionButton(action, () => {
                dialog.close();
              }),
            ]),
        ...(related === undefined || related.length === 0
          ? []
          : [
              relatedList(related, () => {
                dialog.close();
              }),
            ]),
        ...readMore(links.filter((link) => safeLink(link.href))),
      );
      if (!dialog.open) dialog.showModal();
      models.draw();
    },
  };
}
