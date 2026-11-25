// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { createEasingRow } from './easingRow';

describe('easing near milestones, a checkbox (#1077)', () => {
  it('shows the view’s choice, and tells the reader’s', () => {
    const onEasing = vi.fn();
    const easing = createEasingRow(onEasing);
    const box = easing.row.querySelector('input');
    easing.set(true);
    expect(box?.checked).toBe(true);
    if (box === null) throw new Error('no box');
    box.checked = false;
    box.dispatchEvent(new Event('change'));
    expect(onEasing).toHaveBeenCalledWith(false);
    expect(easing.row.textContent).toContain('Slow down near milestones');
  });
});
