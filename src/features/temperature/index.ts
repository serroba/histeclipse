/**
 * The temperature maps in deep time as a feature (#380, #457, #909): what the bar says of them,
 * and the globe coloured by them. Outside this folder, import from here only (#487). Over the
 * ice ages, beside the globe, global temperature over 800,000 years with the moment marked: the
 * chart the planetary boundaries' story opens on (#434), as part of the layer.
 */

import { feature } from '../feature';
import { createChartPart } from './chartPart';
import { createTemperatureLayer } from './temperatureLayer';

export { chartShown, maOfChart } from './chartPart';

export const temperatureFeature = feature({
  id: 'temperature',
  needs: ['temperatureMaps', 'deepTime'],
  watches: (state) => [
    state.layers,
    state.ma,
    state.deepScale,
    state.temperatureModel,
    state.temperatureShow,
    state.mode,
    state.focus,
  ],
  mount(context) {
    const chart = createChartPart(context);
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
    let on = false;
    return {
      load: () => layer.load(on),
      playAxis: (state) => chart.playAxis(state),
      show(state) {
        chart.show(state);
      },
      deepBar(state, moment) {
        on = state.layers.has('temperature');
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
        return chart.deep(state, fields);
      },
    };
  },
});
