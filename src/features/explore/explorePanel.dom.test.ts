// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DESTINATIONS, TOPICS, type Destination } from '../../explore/destinations';
import { createExplorePanel } from './explorePanel';

function mount(narrow = false) {
  const picked: Destination[] = [];
  const onSearch = vi.fn();
  const panel = createExplorePanel({
    onDestination: (destination) => picked.push(destination),
    onSearch,
    narrow: () => narrow,
  });
  document.body.append(panel.button, panel.dialog);
  return { panel, picked, onSearch };
}

const tab = (name: string): HTMLButtonElement | undefined =>
  [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
    (each) => each.textContent === name,
  );

const titles = (): string[] =>
  [...document.querySelectorAll('.explore-go')].map((go) => go.textContent);

afterEach(() => {
  document.body.replaceChildren();
});

describe('Explore', () => {
  it('Given it opens, Then it shows the topics, Space first, and its destinations, with focus on the topic', () => {
    const { panel } = mount();
    panel.button.click();
    expect(panel.dialog.open).toBe(true);
    expect(panel.button.getAttribute('aria-expanded')).toBe('true');
    expect([...document.querySelectorAll('[role="tab"]')].map((each) => each.textContent)).toEqual([
      'Space',
      'Earth',
      'Life',
      'People',
      'Climate',
    ]);
    expect(tab('Space')?.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab('Space'));
    expect(titles()).toContain('Moon landings');
  });

  it('Given every destination, Then each can be found under one of the topics', () => {
    mount();
    const found = new Set<string>();
    for (const topic of TOPICS) {
      tab(topic.charAt(0).toUpperCase() + topic.slice(1))?.click();
      for (const title of titles()) found.add(title);
    }
    expect(found).toEqual(new Set(DESTINATIONS.map((destination) => destination.label)));
  });

  it('Given the topics, When arrow keys, Home and End are pressed, Then the topic moves and takes focus', () => {
    const { panel } = mount();
    panel.button.click();
    const press = (key: string): void => {
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    };
    press('ArrowRight');
    expect(document.activeElement).toBe(tab('Earth'));
    expect(titles()).toContain('Ancient Australia');
    press('ArrowLeft');
    press('ArrowLeft');
    expect(document.activeElement).toBe(tab('Climate'));
    press('Home');
    expect(document.activeElement).toBe(tab('Space'));
    press('End');
    expect(tab('Climate')?.getAttribute('aria-selected')).toBe('true');
    press('x');
    expect(tab('Climate')?.getAttribute('aria-selected')).toBe('true');
  });

  it('Given a wide page, When a destination or its question is picked, Then it opens and the panel stays, marking it', () => {
    const { panel, picked } = mount();
    panel.button.click();
    tab('People')?.click();
    document.querySelector<HTMLButtonElement>('[data-destination="human-origins"]')?.click();
    document.querySelector<HTMLButtonElement>('.explore-question')?.click();
    expect(picked.map((destination) => destination.id)).toEqual(['human-origins', 'human-origins']);
    expect(panel.dialog.open).toBe(true);
    panel.render('human-origins');
    expect(
      document.querySelector('[data-destination="human-origins"]')?.getAttribute('aria-current'),
    ).toBe('true');
    panel.render(null);
    expect(document.querySelector('[aria-current]')).toBeNull();
  });

  it('Given a phone, When a destination is picked, Then the sheet closes for the globe', () => {
    const { panel, picked } = mount(true);
    panel.button.click();
    document.querySelector<HTMLButtonElement>('.explore-go')?.click();
    expect(picked).toHaveLength(1);
    expect(panel.dialog.open).toBe(false);
  });

  it('Given it was arrived at a destination, When it opens, Then it opens on that destination’s topic', () => {
    const { panel } = mount();
    panel.render('last-ice-age');
    panel.button.click();
    expect(tab('Climate')?.getAttribute('aria-selected')).toBe('true');
  });

  it('Given it is open, When Search, Escape, Close or its button are used, Then it closes', () => {
    const { panel, onSearch } = mount();
    panel.button.click();
    document.querySelector<HTMLButtonElement>('.explore-search')?.click();
    expect(onSearch).toHaveBeenCalledOnce();
    expect(panel.dialog.open).toBe(false);

    panel.button.click();
    panel.dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(panel.dialog.open).toBe(false);
    expect(document.activeElement).toBe(panel.button);

    panel.button.click();
    panel.dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(panel.dialog.open).toBe(true);
    document.querySelector<HTMLButtonElement>('.famous-close')?.click();
    expect(panel.dialog.open).toBe(false);

    panel.button.click();
    panel.button.click();
    expect(panel.dialog.open).toBe(false);
  });

  it('Given Layers is open, When Explore opens, Then Layers closes: they share a side', () => {
    const { panel } = mount();
    const layers = document.createElement('dialog');
    layers.className = 'layers-dialog';
    document.body.append(layers);
    layers.show();
    panel.button.click();
    expect(layers.open).toBe(false);
  });
});
