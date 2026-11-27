/**
 * The temperature chart over the ice ages as part of the Temperature layer (#434): shown beside
 * the globe with the moment marked; dragged, it moves the view. Play goes at its pace (#1276),
 * and from 1850 on it the globe shows the measured warming (#1283).
 */

import {
  chartDateText,
  chartSecondsAt,
  latestYear,
  loadHoloceneTemperature,
  maAtChartSeconds,
  type HoloceneTemperature,
} from '../../data/holoceneTemperature';
import { maOfYear, yearOfMa } from '../../data/iceSheets';
import type { PlayAxis } from '../../deepTime/playAxis';
import type { StoryDate } from '../../deepTime/storyDate';
import { roundMa } from '../../deepTime/scale';
import { loadOnce, type LoadOnce } from '../../state/loadOnce';
import type { ViewState } from '../../state/viewState';
import type { TemperatureView } from '../../ui/temperatureLegend';
import type { FeatureContext } from '../feature';
import { holocenePanel, type HoloceneView } from './holocenePanel';
import { createMeasured, MEASURED_NOTE, type Measured, type Surface } from './measured';

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

/** Within the last thousand years the header says the chart's year, not "Today" (#1285). */
const YEARS_FROM = 950;

/** What the header says the globe shows while the measured warming colours it (#1283). */
const MEASURED_WHAT = 'Industrial era · measured warming, 5-year mean';

/** The header at today, off the chart, while the latest measured warming colours the globe. */
const TODAY_MEASURED: StoryDate = { when: 'Today', what: 'Measured warming since 1850–1900' };

export interface ChartPart {
  playAxis(state: ViewState): PlayAxis | null;
  /**
   * The chart's year lent to deep time's header and bar (#1285): deep time keeps the moment to
   * the thousand years, so through the last thousand it would read "Today".
   */
  storyDate(): StoryDate | null;
  show(state: ViewState): void;
  /**
   * Before the layer colours the globe: the measured warming to colour it by instead, if any,
   * and the bar's fields saying so. Only one surface is set a frame: two would trade places.
   */
  deep(
    state: ViewState,
    fields: Fields,
  ): { readonly fields: Fields; readonly surface: Surface | null };
}

/**
 * The chart's year, lent as the header's date while it is within the last thousand years and
 * `showing` says the chart shows (with what the globe shows then); deep time is shown again
 * when what it reads changes, as the view itself may not have moved.
 */
export function yearLender(
  deep: { again(): void },
  showing: () => { readonly what: string | null } | null,
): { set(year: number | null): void; check(): void; date(): StoryDate | null } {
  let year: number | null = null;
  let lent: string | null = null;
  const date = (): StoryDate | null => {
    const shown = showing();
    if (shown === null || year === null || year <= YEARS_FROM) return null;
    return { when: chartDateText(year), what: shown.what };
  };
  const check = (): void => {
    const when = date()?.when ?? null;
    if (when === lent) return;
    lent = when;
    deep.again();
  };
  return {
    date,
    check,
    set(next) {
      year = next;
      check();
    },
  };
}

/** The chart's own clock for play to follow (#1276): `showAt` puts the chart where play is. */
function chartAxis(showAt: (ma: number, drawOn: boolean) => void): PlayAxis {
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
}

/**
 * Today, off the ice ages' chart (#1289): Krapp et al.'s present set beside itself shows no
 * change, so where the colours show the change, the latest measured warming colours the globe.
 */
function measuredNow(
  state: ViewState,
  fields: Fields,
  measured: Measured,
): { readonly surface: Surface | null; readonly today: boolean } {
  const chart = measured.surface(state);
  if (chart !== null || state.ma !== 0 || !fields.temperature.changing || chartShown(state)) {
    return { surface: chart, today: false };
  }
  const surface = measured.latest();
  return { surface, today: surface !== null };
}

/** The measured warming, fetched when first wanted: arrived, deep time draws again with it. */
function measuredFor(context: FeatureContext<'temperatureMaps' | 'deepTime'>): Measured {
  return createMeasured(
    {
      ...context,
      prefetch: context.temperatureMaps.prefetch,
      refresh: () => {
        context.deepTime.again();
      },
    },
    chartShown,
  );
}

/** The chart's records, fetched once, the first time it is shown. */
function chartLoad(context: FeatureContext<'temperatureMaps'>): LoadOnce<HoloceneTemperature> {
  return loadOnce<HoloceneTemperature>({
    fetch: () =>
      loadHoloceneTemperature(`${context.base}data/holocene-temperature.json`, context.fetchJson),
    what: 'the temperature over 800,000 years',
    context,
  });
}

export function createChartPart(
  context: FeatureContext<'temperatureMaps' | 'deepTime'>,
): ChartPart {
  const chart = chartLoad(context);
  // From 1850 on the chart, and at today, the globe shows the measured warming (#1283, #1289).
  const measured = measuredFor(context);
  let lastState: ViewState | null = null;
  let todayLent = false;
  /** The measured warming on the globe, where the chart's year has it. */
  const paint = (): void => {
    const surface = lastState === null ? null : measured.surface(lastState);
    if (surface !== null) context.temperatureMaps.setTemperature(surface);
  };
  // The chart's year lent to the header through the last thousand years (#1285).
  const lender = yearLender(context.deepTime, () =>
    lastState === null || !chartShown(lastState)
      ? null
      : { what: measured.surface(lastState) === null ? null : MEASURED_WHAT },
  );
  const chartPanel = context.globe.addLayer(
    holocenePanel((year) => {
      // The reader's drag, or the chart drawing on past 1950: kept finer than the view (#1285).
      measured.at(year);
      paint();
      followed = Math.min(CHART_REACHES_MA, Math.max(0, maOfYear(year)));
      lender.set(year);
      const ma = maOfChart(year);
      context.change((state) => (state.ma === ma ? state : { ...state, ma }));
    }),
  );
  let shownAt: number | null = null;
  let shownData: HoloceneTemperature | null = null;
  // Where play along the chart has reached, finer than the moment the view keeps (#1276).
  let followed: number | null = null;
  const panel = (view: HoloceneView | null): void => {
    chartPanel.update(view);
    measured.at(view?.year ?? null);
    paint();
    lender.set(view?.year ?? null);
  };
  return {
    // While the chart shows, play goes at its pace: each of its panels gets its time (#1276).
    playAxis(state) {
      const data = chartShown(state) ? chart.value() : null;
      if (data === null) return null;
      return chartAxis((ma, drawOn) => {
        followed = ma;
        panel({ data, year: yearAt(ma), drawOn });
      });
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
      // Today, the chart's latest measured year, not deep time's present, 1950 (#1285).
      const year = ma === 0 && data !== null ? latestYear(data).year : yearOfMa(ma ?? 0);
      panel(data === null || ma === null ? null : { data, year });
    },
    storyDate: () => lender.date() ?? (todayLent ? TODAY_MEASURED : null),
    deep(state, fields) {
      lastState = state;
      // The header read before the bar: what it lends may have changed with the state.
      lender.check();
      const { surface, today } = measuredNow(state, fields, measured);
      // Recorded before asking: deep time draws again at once, and would ask again.
      const changed = today !== todayLent;
      todayLent = today;
      if (changed) context.deepTime.again();
      if (surface === null) return { fields, surface };
      return {
        fields: { ...fields, temperature: { ...fields.temperature, note: MEASURED_NOTE } },
        surface,
      };
    },
  };
}
