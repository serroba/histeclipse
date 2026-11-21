// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { foldBar, foldHud } from './hudFold';

describe('foldHud', () => {
  it('starts folded, with a button that says what it opens', () => {
    const hud = document.createElement('header');
    const button = foldHud(hud);
    expect(hud.lastElementChild).toBe(button);
    expect(hud.dataset['fold']).toBe('folded');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.textContent).toBe('More controls');
  });

  it('opens and folds again with each press', () => {
    const hud = document.createElement('header');
    const button = foldHud(hud);
    button.click();
    expect(hud.dataset['fold']).toBe('open');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.textContent).toBe('Fewer controls');
    button.click();
    expect(hud.dataset['fold']).toBe('folded');
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('foldBar', () => {
  /** A bottom bar: the year's bar, its track, then the year's row. */
  function bottom(): { bottom: HTMLElement; bar: HTMLElement; year: HTMLElement } {
    const root = document.createElement('div');
    const bar = document.createElement('div');
    bar.className = 'holocene-bar';
    const track = document.createElement('div');
    const year = document.createElement('nav');
    year.className = 'timeline';
    bar.append(track, year);
    root.append(bar);
    return { bottom: root, bar, year };
  }

  it('Given the year’s bar, Then its button goes just above the year’s row, folded (#1049)', () => {
    const { bottom: root, bar, year } = bottom();
    const button = foldBar(root);
    expect(year.previousElementSibling).toBe(button);
    expect(bar.dataset['fold']).toBe('folded');
    expect(button?.textContent).toBe('Year and speed');
    expect(button?.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the year’s row and folds it again with each press', () => {
    const { bottom: root, bar } = bottom();
    const button = foldBar(root);
    button?.click();
    expect(bar.dataset['fold']).toBe('open');
    expect(button?.textContent).toBe('Hide year and speed');
    button?.click();
    expect(bar.dataset['fold']).toBe('folded');
  });

  it('Given no year’s bar, Then there is nothing to fold', () => {
    expect(foldBar(document.createElement('div'))).toBeNull();
  });
});
