// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { foldHud } from './hudFold';

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
