import { describe, expect, it, vi } from 'vitest';

import { createStore } from '../state/store';
import { defaultViewState, type ViewState } from '../state/viewState';
import { viewOpener } from './open';

describe('opening an anchor', () => {
  it('Given a reader today, When an anchor opens, Then playing stops, a step is made, and the view is the anchor’s', () => {
    const store = createStore<ViewState>(defaultViewState(new Date('2026-11-15T00:00:00Z')));
    const calls: string[] = [];
    const step = vi.fn(() => calls.push('step'));
    const stopPlay = vi.fn(() => calls.push('stop'));
    store.subscribe(() => calls.push('set'));
    viewOpener({
      store,
      deepTime: { stopPlay },
      sync: () => ({ step }),
      globe: { setCamera: vi.fn() },
    }).anchor({
      body: 'earth',
      view: 'ma=100&explore=x1',
    });
    expect(calls).toEqual(['stop', 'step', 'set']);
    expect(store.get().ma).toBe(100);
    expect(store.get().explore).toBe('x1');
  });

  it('Given a reader looking elsewhere, When an anchor names a camera, Then the globe glides there (#942)', () => {
    const store = createStore<ViewState>(defaultViewState(new Date('2026-11-15T00:00:00Z')));
    const setCamera = vi.fn();
    viewOpener({
      store,
      deepTime: { stopPlay: vi.fn() },
      sync: () => ({ step: vi.fn() }),
      globe: { setCamera },
    }).anchor({
      body: 'earth',
      view: 'cam=37.9715,23.7257,3.00&sel=solar:-0430-08-03',
    });
    expect(setCamera).toHaveBeenCalledWith({
      target: { latitude: 37.9715, longitude: 23.7257 },
      distance: 3,
    });
  });

  it('Given an anchor that keeps the reader’s camera, When it opens, Then the globe is left alone', () => {
    const store = createStore<ViewState>(defaultViewState(new Date('2026-11-15T00:00:00Z')));
    const setCamera = vi.fn();
    viewOpener({
      store,
      deepTime: { stopPlay: vi.fn() },
      sync: () => ({ step: vi.fn() }),
      globe: { setCamera },
    }).anchor({
      body: 'earth',
      view: 'ma=100',
    });
    expect(setCamera).not.toHaveBeenCalled();
  });
});
