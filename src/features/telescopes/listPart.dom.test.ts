// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createStore } from '../../state/store';
import { defaultViewState, type ViewState } from '../../state/viewState';
import type { MarkerCardContent } from '../../ui/markerCard';
import { mountTelescopeList, type TelescopeListContext } from './listPart';

// From the repository's root: in this environment the module's own URL is the page's.
const record = readFileSync('public/data/telescopes.json', 'utf8');
const settled = (): Promise<unknown> => new Promise((resolve) => setTimeout(resolve, 0));

function mount(failing = false) {
  const store = createStore<ViewState>(defaultViewState(new Date('2026-01-01T00:00:00Z')));
  const cards: MarkerCardContent[] = [];
  const notify = vi.fn();
  const context = {
    base: '/',
    fetchJson: () =>
      failing ? Promise.reject(new Error('offline')) : Promise.resolve(new Response(record)),
    store,
    notify,
    showCard: (card: MarkerCardContent) => cards.push(card),
  } as unknown as TelescopeListContext;
  const part = mountTelescopeList(context);
  document.body.append(...part.elements);
  store.subscribe((state) => {
    part.render(state);
  });
  return { store, cards, notify, part, dialog: part.elements[0] as HTMLDialogElement };
}

const rows = (dialog: HTMLElement): HTMLButtonElement[] => [
  ...dialog.querySelectorAll<HTMLButtonElement>('[data-telescope]'),
];
const choice = (dialog: HTMLElement, text: string): HTMLButtonElement | undefined =>
  [...dialog.querySelectorAll<HTMLButtonElement>('.telescope-choice')].find(
    (button) => button.textContent === text,
  );

describe('the telescopes’ list, as a part of the page (#850)', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('Given the view names it, Then it opens, says it is loading, then lists them all, Webb first', async () => {
    const { store, dialog, part } = mount();
    expect(part.watches({ list: 'telescopes' } as ViewState)).toEqual(['telescopes']);
    store.set((state) => ({ ...state, list: 'telescopes' }));
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain('Loading the telescopes…');
    await settled();
    expect(rows(dialog).length).toBeGreaterThan(35);
    expect(rows(dialog)[0]?.dataset['telescope']).toBe('webb');
  });

  it('Given a filter, Then only those show: on Earth, in X-rays, or none for both', async () => {
    const { store, dialog } = mount();
    store.set((state) => ({ ...state, list: 'telescopes' }));
    await settled();
    choice(dialog, 'On Earth')?.click();
    expect(rows(dialog).some((row) => row.dataset['telescope'] === 'webb')).toBe(false);
    expect(choice(dialog, 'On Earth')?.getAttribute('aria-pressed')).toBe('true');
    choice(dialog, 'X-rays')?.click();
    expect(rows(dialog)).toHaveLength(0);
    expect(dialog.textContent).toContain('None of these telescopes sees that.');
    choice(dialog, 'All')?.click();
    expect(rows(dialog).map((row) => row.dataset['telescope'])).toContain('chandra');
  });

  it('Given a tap on one, Then the view goes to it, its layer on, the list shut, and its card opens', async () => {
    const { store, dialog, cards } = mount();
    store.set((state) => ({ ...state, list: 'telescopes' }));
    await settled();
    rows(dialog)
      .find((row) => row.dataset['telescope'] === 'arecibo')
      ?.click();
    expect(store.get().layers.has('telescopes')).toBe(true);
    expect(store.get().list).toBeNull();
    expect(store.get().time.date.year).toBe(1963);
    expect(cards.at(-1)?.title).toBe('Arecibo Telescope');
    expect(dialog.open).toBe(false);
  });

  it('Given it closed by its button, Then the view no longer names it; reopened, it lists at once', async () => {
    const { store, dialog } = mount();
    store.set((state) => ({ ...state, list: 'telescopes' }));
    await settled();
    dialog.querySelector<HTMLButtonElement>('.famous-close')?.click();
    expect(store.get().list).toBeNull();
    store.set((state) => ({ ...state, list: 'telescopes' }));
    await settled();
    expect(rows(dialog).length).toBeGreaterThan(35);
  });

  it('Given the telescopes cannot load, Then the reader is told and the list shuts', async () => {
    const { store, dialog, notify } = mount(true);
    store.set((state) => ({ ...state, list: 'telescopes' }));
    await settled();
    expect(notify).toHaveBeenCalledWith('Could not load the telescopes: offline');
    expect(dialog.open).toBe(false);
    expect(store.get().list).toBeNull();
  });

  it('Given it shut before the telescopes came, Then it stays shut, loaded or not', async () => {
    for (const failing of [false, true]) {
      const { store, dialog } = mount(failing);
      store.set((state) => ({ ...state, list: 'telescopes' }));
      store.set((state) => ({ ...state, list: null }));
      await settled();
      expect(dialog.open).toBe(false);
      expect(rows(dialog)).toHaveLength(0);
      document.body.replaceChildren();
    }
  });

  it('Given a space telescope picked, Then its card goes to its model; one on the ground has no such step (#863)', async () => {
    const { store, dialog, cards } = mount();
    store.set((state) => ({ ...state, list: 'telescopes' }));
    await settled();
    rows(dialog)
      .find((row) => row.dataset['telescope'] === 'chandra')
      ?.click();
    const card = cards.at(-1);
    expect(card?.action?.label).toBe('Go to it');
    card?.action?.run();
    expect(store.get().craft).toBe('s25867');
    expect(store.get().focus).toBe('earth');
    store.set((state) => ({ ...state, list: 'telescopes' }));
    await settled();
    rows(dialog)
      .find((row) => row.dataset['telescope'] === 'alma')
      ?.click();
    expect(cards.at(-1)?.action).toBeUndefined();
  });
});
