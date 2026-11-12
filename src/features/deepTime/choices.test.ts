import { describe, expect, it } from 'vitest';

import { createStore } from '../../state/store';
import { defaultViewState, type ViewState } from '../../state/viewState';
import { deepChoices } from './choices';

function fresh() {
  const store = createStore<ViewState>(defaultViewState(new Date('2026-01-01T00:00:00Z')));
  return { store, choices: deepChoices(store) };
}

describe('deepChoices', () => {
  it('turns each of deep time’s layers on and off', () => {
    const { store, choices } = fresh();
    choices.onPlates(true);
    choices.onAir(true);
    choices.onImpacts(true);
    choices.onSeaLevel(true);
    choices.onTemperature(true);
    choices.onLayer('fossils', true);
    for (const layer of [
      'plates',
      'air',
      'impacts',
      'sealevel',
      'temperature',
      'fossils',
    ] as const) {
      expect(store.get().layers.has(layer)).toBe(true);
    }
    choices.onSeaLevel(false);
    choices.onPlates(false);
    expect(store.get().layers.has('sealevel')).toBe(false);
    expect(store.get().layers.has('plates')).toBe(false);
  });

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
