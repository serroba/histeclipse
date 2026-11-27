/**
 * The temperature chart over the ice ages as part of the Temperature layer (#434): shown beside
 * the globe with the moment marked; dragged, it moves the view. Play goes at its pace (#1276),
 * and from 1850 on it the globe shows the measured warming (#1283).
 */

import {
  chartSecondsAt,
  loadHoloceneTemperature,
  maAtChartSeconds,
  type HoloceneTemperature,
} from '../../data/holoceneTemperature';
import { maOfYear, yearOfMa } from '../../data/iceSheets';
import type { PlayAxis } from '../../deepTime/playAxis';
import { roundMa } from '../../deepTime/scale';
import { loadOnce } from '../../state/loadOnce';
import type { ViewState } from '../../state/viewState';
import type { TemperatureView } from '../../ui/temperatureLegend';
import type { FeatureContext } from '../feature';
import { holocenePanel, type HoloceneView } from './holocenePanel';
import { createMeasured, MEASURED_NOTE } from './measured';

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

/** What the deep-time bar says of the layer, and whether it drew. */
interface Fields {
  readonly temperature: TemperatureView;
  readonly temperatureDrawn: boolean;
}

export interface ChartPart {
  playAxis(state: ViewState): PlayAxis | null;
  show(state: ViewState): void;
  /** After the layer coloured the globe: the measured warming over it, and the note's words. */
  deep(state: ViewState, fields: Fields): Fields;
}

export function createChartPart(context: FeatureContext<'temperatureMaps'>): ChartPart {
  const chart = loadOnce<HoloceneTemperature>({
    fetch: () =>
      loadHoloceneTemperature(`${context.base}data/holocene-temperature.json`, context.fetchJson),
    what: 'the temperature over 800,000 years',
    context,
  });
  // From 1850 on the chart, the globe shows the measured warming (#1283).
  const measured = createMeasured(
    {
      ...context,
      prefetch: (urls) => {
        context.temperatureMaps.prefetch(urls);
      },
    },
    chartShown,
  );
  let lastState: ViewState | null = null;
  /** The measured warming on the globe, where the chart's year has it. */
  const paint = (): void => {
    const surface = lastState === null ? null : measured.surface(lastState);
    if (surface !== null) context.temperatureMaps.setTemperature(surface);
  };
  const chartPanel = context.globe.addLayer(
    holocenePanel((year) => {
      // The reader's drag, or the chart drawing on past 1950, which the view does not keep.
      measured.at(year);
      paint();
      const ma = maOfChart(year);
      context.change((state) => (state.ma === ma ? state : { ...state, ma }));
    }),
  );
  const panel = (view: HoloceneView | null): void => {
    chartPanel.update(view);
    measured.at(view?.year ?? null);
    paint();
  };
  let shownAt: number | null = null;
  let shownData: HoloceneTemperature | null = null;
  // Where play along the chart has reached, finer than the moment the view keeps (#1276).
  let followed: number | null = null;
  return {
    // While the chart shows, play goes at its pace: each of its panels gets its time (#1276).
    playAxis(state) {
      const data = chartShown(state) ? chart.value() : null;
      if (data === null) return null;
      const showAt = (ma: number, drawOn: boolean): void => {
        followed = ma;
        panel({ data, year: yearAt(ma), drawOn });
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
      panel(data === null || ma === null ? null : { data, year: yearOfMa(ma) });
    },
    deep(state, fields) {
      lastState = state;
      const surface = measured.surface(state);
      if (surface === null) return fields;
      context.temperatureMaps.setTemperature(surface);
      return { ...fields, temperature: { ...fields.temperature, note: MEASURED_NOTE } };
    },
  };
}
