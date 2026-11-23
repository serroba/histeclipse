import { describe, expect, it } from 'vitest';

import { createStore } from '../../state/store';
import { defaultViewState, type ViewState } from '../../state/viewState';
import { deepChoices } from './choices';

function fresh() {
  const store = createStore<ViewState>(defaultViewState(new Date('2026-01-01T00:00:00Z')));
  return { store, choices: deepChoices(store) };
}

describe('deepChoices', () => {
  it('picks the coast’s and the sea ice’s source, the temperature model and how it shows, and the sketch', () => {
    const { store, choices } = fresh();
    choices.onCoast('spratt-2016');
    choices.onSeaIce('miroc-es2l');
    choices.onTemperatureModel('cesm');
    choices.onTemperatureShow('actual');
    choices.onSketch({ snowball: 'slush' });
    const state = store.get();
    expect(state.coast).toBe('spratt-2016');
    expect(state.seaIce).toBe('miroc-es2l');
    expect(state.temperatureModel).toBe('cesm');
    expect(state.temperatureShow).toBe('actual');
    expect(state.snowball).toBe('slush');
  });
});
