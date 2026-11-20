/**
 * The temperature maps in deep time as a feature (#380, #457, #909): what the bar says of them,
 * and the globe coloured by them. Outside this folder, import from here only (#487).
 */

import { feature } from '../feature';
import { createTemperatureLayer } from './temperatureLayer';

export const temperatureFeature = feature({
  id: 'temperature',
  needs: ['temperatureMaps', 'deepTime'],
  watches: (state) => [
    state.layers,
    state.ma,
    state.deepScale,
    state.temperatureModel,
    state.temperatureShow,
  ],
  mount(context) {
    const layer = createTemperatureLayer({
      dataUrl: (path) => `${context.base}data/${path}`,
      fetchJson: context.fetchJson,
      globe: context.temperatureMaps,
      notify: (message) => {
        context.notify(message);
      },
      arrived: () => {
        context.deepTime.again();
      },
    });
    return {
      deepBar(state, moment) {
        const at = {
          ma: moment.ma,
          ice: moment.scale === 'ice',
          uncharted: moment.uncharted ?? false,
        };
        const fields = {
          temperature: layer.view(state, at),
          temperatureDrawn: layer.drawn(state, at),
        };
        layer.show(state, at, moment.maPerSecond ?? null);
        return fields;
      },
    };
  },
});
