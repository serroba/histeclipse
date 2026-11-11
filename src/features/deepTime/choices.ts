/**
 * Deep time's bar's choices of what is drawn (#445): each layer turned on or off, the coast's
 * and the sea ice's source, the temperature model and how it shows, and the sketch's
 * hypotheses, each a change to the view. Pure but for the store it writes to.
 */

import type { Store } from '../../state/store';
import { withLayer, type ViewState } from '../../state/viewState';
import type { createDeepTimeBar } from '../../ui/deepTimeBar';

type Handlers = Parameters<typeof createDeepTimeBar>[0];

/** The handlers that only change what the view shows. */
export type Choices = Pick<
  Handlers,
  | 'onPlates'
  | 'onAir'
  | 'onImpacts'
  | 'onLayer'
  | 'onSeaLevel'
  | 'onCoast'
  | 'onSeaIce'
  | 'onTemperatureModel'
  | 'onTemperatureShow'
  | 'onSketch'
  | 'onTemperature'
>;

export function deepChoices(store: Pick<Store<ViewState>, 'set'>): Choices {
  const layer = (id: Parameters<typeof withLayer>[1], on: boolean): void => {
    store.set((state) => ({ ...state, layers: withLayer(state.layers, id, on) }));
  };
  return {
    onPlates: (on) => {
      layer('plates', on);
    },
    onAir: (on) => {
      layer('air', on);
    },
    onImpacts: (on) => {
      layer('impacts', on);
    },
    onLayer: (id, on) => {
      layer(id, on);
    },
    onSeaLevel: (on) => {
      layer('sealevel', on);
    },
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
    onTemperature: (on) => {
      layer('temperature', on);
    },
  };
}
