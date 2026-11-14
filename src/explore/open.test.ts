import { describe, expect, it, vi } from 'vitest';

import { createStore } from '../state/store';
import { defaultViewState, type ViewState } from '../state/viewState';
import { anchorOpener } from './open';

describe('opening an anchor', () => {
  it('Given a reader today, When an anchor opens, Then playing stops, a step is made, and the view is the anchor’s', () => {
    const store = createStore<ViewState>(defaultViewState(new Date('2026-11-15T00:00:00Z')));
    const calls: string[] = [];
    const step = vi.fn(() => calls.push('step'));
    const stopPlay = vi.fn(() => calls.push('stop'));
    store.subscribe(() => calls.push('set'));
    anchorOpener({ store, deepTime: { stopPlay }, sync: () => ({ step }) })({
      body: 'earth',
      view: 'ma=100&explore=x1',
    });
    expect(calls).toEqual(['stop', 'step', 'set']);
    expect(store.get().ma).toBe(100);
    expect(store.get().explore).toBe('x1');
  });
});
