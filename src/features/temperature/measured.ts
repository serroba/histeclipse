/**
 * Over the ice ages, from 1850 the globe shows the measured warming as the chart beside it does
 * (#1283): Krapp et al.'s maps end before industry, so where the chart's year has reached the
 * industrial era, Berkeley Earth's maps against 1850–1900 colour the globe instead, the chart's
 * draw-on past 1950 included. As the boundaries story does (#485). Only while the colours show
 * the change: the measured maps are changes, not temperatures.
 */

import {
  loadMeasuredWarming,
  MAPS_END_YEAR,
  measuredAt,
  type MeasuredWarming,
} from '../../data/measuredWarming';
import { loadOnce } from '../../state/loadOnce';
import type { ViewState } from '../../state/viewState';
import type { FeatureCore } from '../feature';

/** What the bar's note says while the measured warming colours the globe. */
export const MEASURED_NOTE =
  'From 1850, measured: Berkeley Earth’s 5-year means, the change from 1850–1900, not from today.';

/** When to fetch the measured maps ahead: as the chart's line enters the industrial era. */
const FETCH_FROM_YEAR = 1750;

/** The globe's Temperature surface the measured warming gives. */
type Surface = NonNullable<ReturnType<typeof measuredAt>>;

export interface Measured {
  /** The chart's year, as it holds or draws; null when it is not shown. */
  at(year: number | null): void;
  /** The surface to colour the globe by now, if the measured warming has it. */
  surface(state: ViewState): Surface | null;
}

export function createMeasured(
  context: Pick<FeatureCore, 'base' | 'fetchJson' | 'notify' | 'refresh'> & {
    readonly prefetch: (urls: readonly string[]) => void;
  },
  /** Whether the chart shows at `state`: the measured warming follows it. */
  chartShown: (state: ViewState) => boolean,
): Measured {
  const url = (file: string): string => `${context.base}data/warming/${file}`;
  const warming = loadOnce<MeasuredWarming>({
    fetch: () => loadMeasuredWarming(url('index.json'), context.fetchJson),
    what: 'the measured warming',
    context,
    retryInNotice: true,
  });
  let year: number | null = null;
  let fetched = false;
  return {
    at(next) {
      year = next;
      const loaded = warming.value();
      if (next === null || next < FETCH_FROM_YEAR) return;
      if (loaded === null) warming.want();
      else if (!fetched) {
        fetched = true;
        context.prefetch(loaded.frames.map((frame) => url(frame.file)));
      }
    },
    surface(state) {
      if (!chartShown(state) || state.temperatureShow !== 'change') return null;
      if (year === null || year < MAPS_END_YEAR) return null;
      const loaded = warming.value();
      if (loaded === null) {
        warming.want();
        return null;
      }
      return measuredAt(loaded, year, url);
    },
  };
}
