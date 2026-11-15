import { describe, expect, it, vi } from 'vitest';

import { createRedrawRequests } from './redrawRequests';
import { createStore } from './store';
import { defaultViewState, type ViewState } from './viewState';

const NOW = defaultViewState(new Date('2026-11-15T00:00:00Z'));

describe('asking a part to redraw', () => {
  it('Given no answer yet, Then asking does nothing', () => {
    const requests = createRedrawRequests(createStore<ViewState>(NOW));
    expect(() => {
      requests.ask('deepTime')();
    }).not.toThrow();
  });

  it('Given an answer, Then asking redraws the view as it is now, or the view given', () => {
    const store = createStore<ViewState>(NOW);
    const requests = createRedrawRequests(store);
    const ask = requests.ask('layers');
    const draw = vi.fn();
    requests.answer('layers', draw);
    store.set((state) => ({ ...state, ma: 100 }));
    ask();
    expect(draw).toHaveBeenLastCalledWith(expect.objectContaining({ ma: 100 }));
    requests.askWith('layers')(NOW);
    expect(draw).toHaveBeenLastCalledWith(NOW);
  });

  it('Given several parts, Then each is asked for itself only', () => {
    const requests = createRedrawRequests(createStore<ViewState>(NOW));
    const years = vi.fn();
    const moment = vi.fn();
    requests.answer('years', years);
    requests.answer('moment', moment);
    requests.ask('years')();
    expect(years).toHaveBeenCalledOnce();
    expect(moment).not.toHaveBeenCalled();
  });
});
