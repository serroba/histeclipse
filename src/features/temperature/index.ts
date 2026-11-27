/**
 * The temperature maps in deep time as a feature (#380, #457, #909): what the bar says of them,
 * and the globe coloured by them. Outside this folder, import from here only (#487). Over the
 * ice ages, beside the globe, global temperature over 800,000 years with the moment marked: the
 * chart the planetary boundaries' story opens on (#434), as part of the layer.
 */

import {
  chartSecondsAt,
  loadHoloceneTemperature,
  maAtChartSeconds,
  type HoloceneTemperature,
} from '../../data/holoceneTemperature';
import { maOfYear, yearOfMa } from '../../data/iceSheets';
import { roundMa } from '../../deepTime/scale';
import { loadOnce } from '../../state/loadOnce';
import type { ViewState } from '../../state/viewState';
import { feature } from '../feature';
import { holocenePanel } from './holocenePanel';
import { createTemperatureLayer } from './temperatureLayer';

/** The oldest moment the chart reaches, Ma: beyond, over the ice ages, it is not shown. */
const CHART_REACHES_MA = 0.8;

/** Whether the chart shows beside the globe: Temperature on, over the ice ages it covers. */
export function chartShown(state: ViewState): boolean {
  return (
    state.layers.has('temperature') &&
    state.mode === 'globe' &&
    state.focus === 'earth' &&
    state.deepScale === 'ice' &&
    state.ma !== null &&
    state.ma <= CHART_REACHES_MA
  );
}

/** The moment a year on the chart is, as deep time keeps it: to the thousand years, at most today. */
export function maOfChart(year: number): number {
  return Math.max(0, Math.min(CHART_REACHES_MA, roundMa(maOfYear(year))));
}

/** The chart's year at a moment kept finer than a thousand years, as play reaches it (#1276). */
const yearAt = (ma: number): number => 1950 - ma * 1e6;

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
    const chart = loadOnce<HoloceneTemperature>({
      fetch: () =>
        loadHoloceneTemperature(`${context.base}data/holocene-temperature.json`, context.fetchJson),
      what: 'the temperature over 800,000 years',
      context,
    });
    const panel = context.globe.addLayer(
      holocenePanel((year) => {
        const ma = maOfChart(year);
        context.change((state) => (state.ma === ma ? state : { ...state, ma }));
      }),
    );
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
    let shownAt: number | null = null;
    let shownData: HoloceneTemperature | null = null;
    // Where play along the chart has reached, finer than the moment the view keeps (#1276).
    let followed: number | null = null;
    return {
      load: () => layer.load(on),
      // While the chart shows, play goes at its pace: each of its panels gets its time (#1276).
      playAxis(state) {
        const data = chartShown(state) ? chart.value() : null;
        if (data === null) return null;
        const showAt = (ma: number, drawOn: boolean): void => {
          followed = ma;
          panel.update({ data, year: yearAt(ma), drawOn });
        };
        return {
          at: chartSecondsAt,
          ma: maAtChartSeconds,
          follow: (ma) => {
            showAt(ma, false);
          },
          // Today, deep time's present (1950): the chart draws on to its latest year.
          ended: () => {
            showAt(0, true);
          },
        };
      },
      show(state) {
        const data = chartShown(state) ? chart.value() : null;
        if (chartShown(state) && data === null) chart.want();
        const ma = data === null ? null : state.ma;
        // The moment play along the chart reached, kept rounded: the chart already shows it.
        if (followed !== null && ma !== null && roundMa(followed) === ma) {
          shownAt = ma;
          shownData = data;
          return;
        }
        followed = null;
        if (ma === shownAt && data === shownData) return;
        shownAt = ma;
        shownData = data;
        panel.update(data === null || ma === null ? null : { data, year: yearOfMa(ma) });
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
        return fields;
      },
    };
  },
});
