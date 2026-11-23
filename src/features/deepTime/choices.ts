/**
 * Deep time's bar's choices of what is drawn (#445): the coast's and the sea ice's source, the temperature model and how it shows, and the sketch's
 * hypotheses, each a change to the view. Pure but for the store it writes to. Layers are turned
 * on and off in Layers and its chips (#1137).
 */

import type { Store } from '../../state/store';
import type { ViewState } from '../../state/viewState';
import type { createDeepTimeBar } from '../../ui/deepTimeBar';

type Handlers = Parameters<typeof createDeepTimeBar>[0];

/** The handlers that only change what the view shows. */
export type Choices = Pick<
  Handlers,
  'onCoast' | 'onSeaIce' | 'onTemperatureModel' | 'onTemperatureShow' | 'onSketch'
>;

export function deepChoices(store: Pick<Store<ViewState>, 'set'>): Choices {
  return {
    onCoast: (coast) => {
      store.set((state) => ({ ...state, coast }));
    },
    onSeaIce: (seaIce) => {
      store.set((state) => ({ ...state, seaIce }));
    },
    onTemperatureModel: (temperatureModel) => {
      store.set((state) => ({ ...state, temperatureModel }));
    },
    onTemperatureShow: (temperatureShow) => {
      store.set((state) => ({ ...state, temperatureShow }));
    },
    onSketch: (choice) => {
      store.set((state) => ({ ...state, ...choice }));
    },
  };
}
