// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { createLayersPanel } from './layersPanel';

const nothing = () => undefined;

describe('the Layers panel opened from elsewhere (#752)', () => {
  it('Given it opened from the dock’s Add, Then closing it gives the focus back there', () => {
    const panel = createLayersPanel(nothing, nothing, nothing);
    const add = document.createElement('button');
    document.body.append(panel.button, panel.dialog, add);
    panel.open(add);
    expect(panel.dialog.open).toBe(true);
    expect(panel.button.getAttribute('aria-expanded')).toBe('true');
    panel.dialog.querySelector<HTMLButtonElement>('button')?.focus();
    panel.dialog.close();
    panel.dialog.dispatchEvent(new Event('close'));
    expect(document.activeElement).toBe(add);
    expect(panel.button.getAttribute('aria-expanded')).toBe('false');
    // Opened from Layers again, it goes back to Layers.
    panel.button.click();
    panel.dialog.querySelector<HTMLButtonElement>('button')?.focus();
    panel.button.click();
    panel.dialog.dispatchEvent(new Event('close'));
    expect(document.activeElement).toBe(panel.button);
    panel.button.remove();
    panel.dialog.remove();
    add.remove();
  });

  it('Given the reader went on elsewhere, Then closing it leaves the focus where it is', () => {
    const panel = createLayersPanel(nothing, nothing, nothing);
    const add = document.createElement('button');
    const elsewhere = document.createElement('input');
    document.body.append(panel.button, panel.dialog, add, elsewhere);
    panel.open(add);
    elsewhere.focus();
    panel.dialog.close();
    panel.dialog.dispatchEvent(new Event('close'));
    expect(document.activeElement).toBe(elsewhere);
    for (const each of [panel.button, panel.dialog, add, elsewhere]) each.remove();
  });
});
