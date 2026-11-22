/**
 * The Atlantic overturning (#925) on the feature contract (#380): in the years, a row for each
 * source beside the globe, the measured flow at 26.5°N (RAPID) and the reconstructions that
 * disagree on whether it has weakened, each on its own scale over the years the bar shows; and
 * on the globe, the line the array measures across. Loaded with the layer.
 */

import { amocText, loadAmoc, seriesSpan, type Amoc } from '../../data/amoc';
import type { ViewState } from '../../state/viewState';
import { feature } from '../feature';
import { loadOnce } from '../layerLoad';
import { amocChart } from './chartModel';
import { amocPanel } from './amocPanel';
import { rapidLine } from './rapidLine';

/** Whether the layer shows: on, on Earth's globe, in the years. */
function shownOn(state: ViewState): boolean {
  return (
    state.layers.has('amoc') &&
    state.mode === 'globe' &&
    state.ma === null &&
    state.focus === 'earth'
  );
}

/** The years the charts span: the bar's window, else the sources' own years to the last. */
function spanOf(amoc: Amoc, state: ViewState): { first: number; last: number } {
  if (state.yearsWindow !== null) return state.yearsWindow;
  const spans = amoc.series.map(seriesSpan);
  return {
    first: Math.floor(Math.min(...spans.map(({ first }) => first))),
    last: Math.floor(Math.max(...spans.map(({ last }) => last))),
  };
}

export const amocFeature = feature({
  id: 'amoc',
  needs: [],
  watches: (state) => [state.layers, state.mode, state.ma, state.focus, state.yearsWindow],
  mount(context) {
    const panel = context.globe.addLayer(amocPanel);
    const line = context.globe.addLayer(rapidLine);
    const records = loadOnce<Amoc>({
      fetch: () => loadAmoc(`${context.base}data/amoc/index.json`, context.fetchJson),
      what: 'the AMOC records',
      context,
    });
    let on = false;
    let said: string | null = null;
    let shownFor = '';

    return {
      show(state) {
        on = shownOn(state);
        const year = state.time.date.year;
        const window = state.yearsWindow;
        const amoc = records.value();
        const key = `${String(on)}:${records.status()}:${String(year)}:${String(window?.first)}:${String(window?.last)}`;
        if (key === shownFor) return;
        shownFor = key;
        line.update(on);
        if (!on) {
          said = null;
          panel.update(null);
          return;
        }
        if (amoc === null) {
          records.want();
          said =
            records.status() === 'failed'
              ? 'Could not load the AMOC records.'
              : 'Loading the AMOC records…';
          return;
        }
        said = amocText(amoc, year);
        panel.update({
          chart: amocChart(amoc, spanOf(amoc, state), year),
          disputed: amoc.disputed,
        });
      },
      said: () => said,
      load: () => records.report(on),
    };
  },
});
