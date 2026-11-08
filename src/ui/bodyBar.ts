/**
 * Away from Earth, the bottom bar's own line for the body in view: its name and what can be
 * said of it at the moment shown (the Moon's phase, a planet's place in Earth's sky, the Sun's
 * distance), what the picture of it is and whose, the key to its colours where they stand for
 * heights, and the book to where that comes from.
 *
 * DOM glue, covered by the Playwright suite; what it says is worked out in `astro/bodyFacts.ts`.
 */

import { element } from './dom';

export interface BodyView {
  readonly name: string;
  readonly text: string;
  /** What the body is pictured with, when and by whom; none where nothing need be said. */
  readonly picture?: string;
  /** For a map coloured by height, its key (#334). */
  readonly key?: BodyKey;
}

export interface BodyKey {
  /** The colours as a CSS gradient, left to right. */
  readonly gradient: string;
  /** Heights labelled under it: the words, and the share of the way across. */
  readonly ticks: readonly { readonly label: string; readonly at: number }[];
  /** What the heights are measured from, and how the key was made. */
  readonly note: string;
}

export interface BodyBar {
  readonly root: HTMLElement;
  /** The body in view and what is said of it; null on Earth, which has its own bar. */
  render(view: BodyView | null): void;
}

export function createBodyBar(why: HTMLElement): BodyBar {
  const name = element('strong', { class: 'body-bar-name' });
  const text = element('span', { class: 'body-bar-text', 'data-testid': 'body-facts' });
  const picture = element('span', { class: 'body-bar-picture', 'data-testid': 'body-picture' });
  const strip = element('span', { class: 'colour-key-strip' });
  const ticks = element('span', { class: 'colour-key-ticks' });
  const note = element('span', { class: 'colour-key-note' });
  const key = element(
    'span',
    { class: 'colour-key', role: 'img', 'data-testid': 'colour-key', hidden: '' },
    strip,
    ticks,
    note,
  );
  const root = element(
    'p',
    { class: 'body-bar', 'data-testid': 'body-bar', hidden: '' },
    name,
    ' ',
    text,
    ' ',
    why,
    picture,
    key,
  );
  return {
    root,
    render(view) {
      root.hidden = view === null;
      if (view === null) return;
      name.textContent = view.name;
      text.textContent = view.text;
      picture.textContent = view.picture ?? '';
      picture.hidden = view.picture === undefined;
      key.hidden = view.key === undefined;
      if (view.key === undefined) return;
      strip.style.background = view.key.gradient;
      ticks.replaceChildren(
        ...view.key.ticks.map(({ label, at }) => {
          const tick = element('span', { class: 'colour-key-tick' }, label);
          tick.style.left = `${String(at * 100)}%`;
          // Shifted by its own width as far as it is across, so the end labels stay inside.
          tick.style.transform = `translateX(${String(-at * 100)}%)`;
          return tick;
        }),
      );
      note.textContent = view.key.note;
      key.setAttribute(
        'aria-label',
        `Colour key: height from ${view.key.ticks[0]?.label ?? ''} to ${view.key.ticks.at(-1)?.label ?? ''}, ${view.key.note}`,
      );
    },
  };
}
