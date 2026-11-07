/**
 * Away from Earth, the bottom bar's own line for the body in view: its name and what can be
 * said of it at the moment shown (the Moon's phase, a planet's place in Earth's sky, the Sun's
 * distance), what the picture of it is and whose, and the book to where that comes from.
 *
 * DOM glue, covered by the Playwright suite; what it says is worked out in `astro/bodyFacts.ts`.
 */

import { element } from './dom';

export interface BodyView {
  readonly name: string;
  readonly text: string;
  /** What the body is pictured with, when and by whom; none where nothing need be said. */
  readonly picture?: string;
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
  const root = element(
    'p',
    { class: 'body-bar', 'data-testid': 'body-bar', hidden: '' },
    name,
    ' ',
    text,
    ' ',
    why,
    picture,
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
    },
  };
}
