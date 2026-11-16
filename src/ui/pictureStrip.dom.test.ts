// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { createMarkerCard } from './markerCard';
import type { CardPictures } from './pictureStrip';

const picture = (title: string, key: string) => ({
  title,
  released: '12 July 2022',
  about: `What ${title} shows.`,
  alt: `What ${title} looks like.`,
  credit: 'NASA, ESA, CSA, and STScI',
  page: `https://esawebb.org/images/${key}/`,
  thumb: `/pictures/webb/${key}-thumb.webp`,
  large: `/pictures/webb/${key}.webp`,
  width: 1280,
  height: 720,
});

const PICTURES: CardPictures = {
  heading: 'Pictures it took',
  source: 'ESA/Webb',
  licence: 'CC BY 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
  pictures: [picture('The Deep Field', 'a'), picture('The Cosmic Cliffs', 'b')],
};

function opened(pictures?: CardPictures) {
  const card = createMarkerCard();
  document.body.replaceChildren(card.dialog);
  card.show({
    title: 'James Webb Space Telescope',
    facts: [],
    links: [],
    ...(pictures === undefined ? {} : { pictures }),
  });
  const view = card.dialog.querySelector<HTMLDialogElement>('[data-testid="picture-view"]');
  if (view === null) throw new Error('no picture view');
  const strip = card.dialog.querySelector('.picture-strip');
  return { card, view, strip };
}

describe('a card’s pictures', () => {
  it('Given a card without pictures, Then it has no strip', () => {
    expect(opened().strip).toBeNull();
  });

  it('Given a telescope’s card, Then each picture is a button named by its title, with the source and its licence', () => {
    const { strip, view } = opened(PICTURES);
    expect(strip?.getAttribute('aria-label')).toBe('Pictures it took');
    const buttons = [...(strip?.querySelectorAll('button') ?? [])];
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'The Deep Field: see it larger',
      'The Cosmic Cliffs: see it larger',
    ]);
    expect(buttons[0]?.querySelector('img')?.getAttribute('src')).toBe(
      '/pictures/webb/a-thumb.webp',
    );
    expect(strip?.querySelector('.picture-strip-credit')?.textContent).toBe('ESA/Webb, CC BY 4.0.');
    // The larger copies are not asked for until one is opened.
    expect(view.open).toBe(false);
    expect(view.querySelector('img')).toBeNull();
  });

  it('When a picture is opened, Then it is shown larger with what it shows, its credit, its licence and its page; and the next is a step away', () => {
    const { strip, view } = opened(PICTURES);
    strip?.querySelectorAll('button')[0]?.click();
    expect(view.open).toBe(true);
    expect(view.querySelector('h2')?.textContent).toBe('The Deep Field');
    const img = view.querySelector('img');
    expect(img?.getAttribute('src')).toBe('/pictures/webb/a.webp');
    expect(img?.getAttribute('alt')).toBe('What The Deep Field looks like.');
    expect(view.textContent).toContain('What The Deep Field shows.');
    expect(view.querySelector('.picture-view-credit')?.textContent).toBe(
      'Picture: NASA, ESA, CSA, and STScI. Released 12 July 2022 by ESA/Webb under CC BY 4.0; made smaller here.',
    );
    const links = [...view.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toEqual([
      'https://esawebb.org/images/a/',
      'https://creativecommons.org/licenses/by/4.0/',
    ]);

    const [previous, next] = [...view.querySelectorAll<HTMLButtonElement>('nav button')];
    expect(previous?.disabled).toBe(true);
    expect(view.querySelector('nav span')?.textContent).toBe('1 of 2');
    next?.click();
    expect(view.querySelector('h2')?.textContent).toBe('The Cosmic Cliffs');
    const [back, further] = [...view.querySelectorAll<HTMLButtonElement>('nav button')];
    expect(further?.disabled).toBe(true);
    back?.click();
    expect(view.querySelector('h2')?.textContent).toBe('The Deep Field');
  });

  it('When its close button or the backdrop is pressed, Then the picture closes and the card stays', () => {
    const { card, strip, view } = opened(PICTURES);
    strip?.querySelectorAll('button')[1]?.click();
    view.querySelector<HTMLButtonElement>('.famous-close')?.click();
    expect(view.open).toBe(false);
    expect(card.dialog.open).toBe(true);
    strip?.querySelectorAll('button')[1]?.click();
    view.dispatchEvent(new MouseEvent('click'));
    expect(view.open).toBe(false);
    expect(card.dialog.open).toBe(true);
  });
});
