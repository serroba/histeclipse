// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { createMarkerCard, type CardModel } from './markerCard';

function model(): CardModel & { mounted: HTMLElement[]; stopped: number } {
  const made = {
    label: 'A model',
    caption: 'Built here.',
    mounted: [] as HTMLElement[],
    stopped: 0,
    mount(host: HTMLElement) {
      made.mounted.push(host);
      return () => {
        made.stopped += 1;
      };
    },
  };
  return made;
}

const card = { title: 'Webb', facts: [['Set out', '25 December 2021']] as const, links: [] };

describe('a card’s 3D model (#797)', () => {
  it('Given a card with a model, When it opens, Then the model is drawn into a labelled box with its caption', () => {
    const shown = createMarkerCard();
    document.body.append(shown.dialog);
    const webb = model();
    shown.show({ ...card, model: webb });
    const host = shown.dialog.querySelector('.marker-card-model-view');
    expect(host?.getAttribute('aria-label')).toBe('A model');
    expect(webb.mounted).toEqual([host]);
    expect(shown.dialog.querySelector('.marker-card-model figcaption')?.textContent).toBe(
      'Built here.',
    );
  });

  it('Given it is shown again with the same model, Then the view drawn is kept, not drawn anew', () => {
    const shown = createMarkerCard();
    document.body.append(shown.dialog);
    const webb = model();
    shown.show({ ...card, model: webb });
    shown.show({ ...card, model: webb, note: 'With its pictures now.' });
    expect(webb.mounted).toHaveLength(1);
    expect(webb.stopped).toBe(0);
    expect(shown.dialog.querySelectorAll('.marker-card-model')).toHaveLength(1);
  });

  it('Given another card, or the card closed, Then the model is stopped', () => {
    const shown = createMarkerCard();
    document.body.append(shown.dialog);
    const webb = model();
    shown.show({ ...card, model: webb });
    shown.show(card);
    expect(webb.stopped).toBe(1);
    expect(shown.dialog.querySelector('.marker-card-model')).toBeNull();
    shown.show({ ...card, model: webb });
    expect(webb.mounted).toHaveLength(2);
    shown.dialog.close();
    shown.dialog.dispatchEvent(new Event('close'));
    expect(webb.stopped).toBe(2);
    // Closed again, nothing is stopped twice.
    shown.dialog.dispatchEvent(new Event('close'));
    expect(webb.stopped).toBe(2);
  });
});

describe('a marker’s card', () => {
  function opened(): ReturnType<typeof createMarkerCard> {
    const shown = createMarkerCard();
    document.body.append(shown.dialog);
    return shown;
  }

  it('Given what a source says, Then the card has its title, its facts, its picture and its note', () => {
    const shown = opened();
    shown.show({
      ...card,
      image: { src: 'https://upload.wikimedia.org/a.jpg', alt: 'A crater', credit: 'NASA' },
      note: 'As the source has it.',
    });
    expect(shown.dialog.open).toBe(true);
    expect(shown.dialog.querySelector('h2')?.textContent).toBe('Webb');
    expect(shown.dialog.querySelector('dt')?.textContent).toBe('Set out');
    expect(shown.dialog.querySelector('dd')?.textContent).toBe('25 December 2021');
    expect(shown.dialog.querySelector('figcaption')?.textContent).toBe('NASA');
    expect(shown.dialog.querySelector('.marker-card-note')?.textContent).toBe(
      'As the source has it.',
    );
  });

  it('Given a picture its host will not serve, Then it is gone without a trace', () => {
    const shown = opened();
    shown.show({
      ...card,
      image: { src: 'https://volcano.si.edu/a.jpg', alt: 'A volcano', credit: 'Smithsonian' },
    });
    shown.dialog.querySelector('img')?.dispatchEvent(new Event('error'));
    expect(shown.dialog.querySelector('.marker-card-image')).toBeNull();
  });

  it('Given links, Then only web links are offered, each opening apart', () => {
    const shown = opened();
    shown.show({
      ...card,
      image: { src: 'javascript:alert(1)', alt: '', credit: '' },
      links: [
        { label: 'NASA', href: 'https://nasa.gov/' },
        { label: 'Not a link', href: 'javascript:alert(1)' },
        { label: 'Broken', href: 'not a url' },
        { label: 'ESA', href: 'https://esa.int/' },
      ],
    });
    expect(shown.dialog.querySelector('.marker-card-image')).toBeNull();
    const links = [...shown.dialog.querySelectorAll('.marker-card-links a')];
    expect(links.map((link) => link.textContent)).toEqual(['NASA', 'ESA']);
    expect(links[0]?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(shown.dialog.querySelector('.marker-card-links')?.textContent).toBe(
      'Read more: NASA · ESA',
    );
  });

  it('Given something to do and next views, Then each closes the card first and goes', () => {
    const shown = opened();
    const run = vi.fn();
    const go = vi.fn();
    shown.show({
      ...card,
      action: { label: 'Play the impact', run },
      related: [{ label: 'Its journey', explain: 'From launch to L2', run: go }],
    });
    shown.dialog.querySelector<HTMLButtonElement>('.marker-card-action')?.click();
    expect(run).toHaveBeenCalledOnce();
    expect(shown.dialog.open).toBe(false);
    shown.dialog.showModal();
    shown.dialog.querySelector<HTMLButtonElement>('.marker-card-related button')?.click();
    expect(go).toHaveBeenCalledOnce();
    expect(shown.dialog.querySelector('.marker-card-related span')?.textContent).toBe(
      'From launch to L2',
    );
    shown.show({ ...card, related: [] });
    expect(shown.dialog.querySelector('.marker-card-related')).toBeNull();
  });

  it('Given its close button or a tap outside it, Then the card closes', () => {
    const shown = opened();
    shown.show(card);
    shown.dialog.querySelector<HTMLButtonElement>('.famous-close')?.click();
    expect(shown.dialog.open).toBe(false);
    shown.show(card);
    shown.dialog.querySelector('dl')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(shown.dialog.open).toBe(true);
    shown.dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(shown.dialog.open).toBe(false);
  });
});
