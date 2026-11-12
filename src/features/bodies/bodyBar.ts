/**
 * Away from Earth, the bottom bar's own line for the body in view: its name and what can be
 * said of it at the moment shown (the Moon's phase, a planet's place in Earth's sky, the Sun's
 * distance), what the picture of it is and whose, the key to its colours where they stand for
 * heights or kinds of rock, and the book to where that comes from.
 *
 * DOM glue, covered by the Playwright suite; what it says is worked out in `astro/bodyFacts.ts`.
 */

import { element } from '../../ui/dom';
import './bodyBar.css';

interface BodyView {
  readonly name: string;
  readonly text: string;
  /** What the body is pictured with, when and by whom; none where nothing need be said. */
  readonly picture?: string;
  /** What is known of it: for a planet's moon, who found it and what it is known for (#335). */
  readonly about?: string;
  /** For a map coloured by height or by kind of rock, its key (#334). */
  readonly key?: BodyKey;
}

export type BodyKey = HeightKey | RockKey;

interface HeightKey {
  /** The colours as a CSS gradient, left to right. */
  readonly gradient: string;
  /** Heights labelled under it: the words, and the share of the way across. */
  readonly ticks: readonly { readonly label: string; readonly at: number }[];
  /** What the heights are measured from, and how the key was made. */
  readonly note: string;
}

interface RockKey {
  /** Each kind of rock, the place its colour was read at, and the colour. */
  readonly swatches: readonly {
    readonly kind: string;
    readonly place: string;
    readonly colour: string;
  }[];
  /** How the key was made. */
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
  const about = element('span', { class: 'body-bar-about', 'data-testid': 'body-about' });
  const strip = element('span', { class: 'body-key-strip' });
  const ticks = element('span', { class: 'body-key-ticks' });
  const swatches = element('ul', { class: 'body-key-swatches' });
  const note = element('span', { class: 'body-key-note' });
  const key = element(
    'span',
    { class: 'body-key', role: 'img', 'data-testid': 'colour-key', hidden: '' },
    strip,
    ticks,
    swatches,
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
    about,
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
      about.textContent = view.about ?? '';
      about.hidden = view.about === undefined;
      key.hidden = view.key === undefined;
      if (view.key === undefined) return;
      note.textContent = view.key.note;
      const rocks = 'swatches' in view.key;
      strip.hidden = rocks;
      ticks.hidden = rocks;
      swatches.hidden = !rocks;
      if ('swatches' in view.key) {
        swatches.replaceChildren(
          ...view.key.swatches.map(({ kind, place, colour }) => {
            const swatch = element('span', { class: 'body-key-swatch' });
            swatch.style.background = colour;
            return element(
              'li',
              {},
              swatch,
              element(
                'span',
                {},
                `${kind} `,
                element('span', { class: 'body-key-place' }, `(${place})`),
              ),
            );
          }),
        );
        key.setAttribute(
          'aria-label',
          `Colour key: ${view.key.swatches.map(({ kind }) => kind).join('; ')}. ${view.key.note}`,
        );
        return;
      }
      strip.style.background = view.key.gradient;
      ticks.replaceChildren(
        ...view.key.ticks.map(({ label, at }) => {
          const tick = element('span', { class: 'body-key-tick' }, label);
          tick.style.left = `${String(at * 100)}%`;
          // Shifted by its own width as far as it is across, so the end labels stay inside.
          tick.style.transform = `translateX(${String(-at * 100)}%)`;
          return tick;
        }),
      );
      key.setAttribute(
        'aria-label',
        `Colour key: height from ${view.key.ticks[0]?.label ?? ''} to ${view.key.ticks.at(-1)?.label ?? ''}, ${view.key.note}`,
      );
    },
  };
}
