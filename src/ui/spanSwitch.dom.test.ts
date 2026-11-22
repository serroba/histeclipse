// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { createSpanSwitch } from './spanSwitch';

describe('the span switch’s icons (#1068)', () => {
  it('Given the switch, Then each span carries its own icon beside its word, and the word names it', () => {
    const onSpan = vi.fn();
    const spans = createSpanSwitch(onSpan);
    const { root } = spans;
    const buttons = [...root.querySelectorAll('button')];
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Years',
      'Ice ages',
      '540 Myr',
      '4.6 Gyr',
    ]);
    const drawings = buttons.map((button) => {
      const svg = button.querySelector('svg');
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
      return svg?.innerHTML;
    });
    expect(new Set(drawings).size).toBe(4);
    for (const button of buttons) {
      // Kept on a phone too: 540 Myr and 4.6 Gyr cannot be told apart by an icon alone.
      expect(button.querySelector('.icon-label')?.classList.contains('icon-label-kept')).toBe(true);
    }
    spans.render('ice');
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
      'false',
    ]);
    buttons[3]?.click();
    expect(onSpan).toHaveBeenCalledWith('eons');
  });

  it('Given part of the ice ages shown (#1074), Then no preset is picked, the ice ages ringed', () => {
    const spans = createSpanSwitch(vi.fn());
    const buttons = [...spans.root.querySelectorAll('button')];
    spans.render('ice', false);
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'false',
      'false',
    ]);
    expect(buttons.map((button) => button.classList.contains('is-within'))).toEqual([
      false,
      true,
      false,
      false,
    ]);
    spans.render('ice');
    expect(buttons[1]?.getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1]?.classList.contains('is-within')).toBe(false);
  });
});
