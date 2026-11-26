/**
 * The temperature maps in deep time as a feature (#380, #457, #909): what the bar says of them,
 * and the globe coloured by them. Outside this folder, import from here only (#487). Over the
 * ice ages, the bar shows temperature over 800,000 years above the colour scale: the chart the
 * planetary boundaries' story opens on (#434), as part of the layer. While the story has the
 * globe on its Holocene chapter, its own chart shows it, and the bar's does not.
 */

import { loadHoloceneTemperature, type HoloceneTemperature } from '../../data/holoceneTemperature';
import { yearOfMa } from '../../data/iceSheets';
import { loadOnce } from '../../state/loadOnce';
import type { ViewState } from '../../state/viewState';
import { CHART_REACHES_MA } from '../../ui/temperatureChart';
import { feature } from '../feature';
import { createTemperatureLayer } from './temperatureLayer';

/** Whether the bar shows the chart: Temperature on, over the ice ages it covers, no story open. */
export function chartShown(state: ViewState): boolean {
  return (
    state.layers.has('temperature') &&
    state.mode === 'globe' &&
    state.focus === 'earth' &&
    state.deepScale === 'ice' &&
    state.ma !== null &&
    state.ma <= CHART_REACHES_MA &&
    state.boundaries !== 'holocene'
  );
}

export const temperatureFeature = feature({
  id: 'temperature',
  needs: ['temperatureMaps', 'deepTime'],
  watches: (state) => [
    state.layers,
    state.ma,
    state.deepScale,
    state.temperatureModel,
    state.temperatureShow,
    state.boundaries,
  ],
  mount(context) {
    const again = (): void => {
      context.deepTime.again();
    };
    const records = loadOnce<HoloceneTemperature>({
      fetch: () =>
        loadHoloceneTemperature(`${context.base}data/holocene-temperature.json`, context.fetchJson),
      what: 'the temperature over 800,000 years',
      context: {
        notify: (message) => {
          context.notify(message);
        },
        refresh: again,
      },
    });
    const layer = createTemperatureLayer({
      dataUrl: (path) => `${context.base}data/${path}`,
      fetchJson: context.fetchJson,
      globe: context.temperatureMaps,
      notify: (message) => {
        context.notify(message);
      },
      arrived: again,
    });
    let on = false;

    /** The chart for the bar at `ma`, once its records are in; asked for the first time shown. */
    function chartAt(state: ViewState, ma: number) {
      if (!chartShown(state)) return null;
      const data = records.value();
      if (data === null) records.want();
      return data === null ? null : { data, year: yearOfMa(ma) };
    }

    return {
      load: () => layer.load(on),
      deepBar(state, moment) {
        on = state.layers.has('temperature');
        const at = {
          ma: moment.ma,
          ice: moment.scale === 'ice',
          uncharted: moment.uncharted ?? false,
        };
        const fields = {
          temperature: { ...layer.view(state, at), chart: chartAt(state, moment.ma) },
          temperatureDrawn: layer.drawn(state, at),
        };
        layer.show(state, at, moment.maPerSecond ?? null);
        return fields;
      },
    };
  },
});
