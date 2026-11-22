/**
 * El Niño and La Niña (#886) on the feature contract (#380): in the years, NOAA's two indices of
 * the tropical Pacific since 1950 side by side beside the globe, the month shown marked, and what
 * each says of it, none picked over the other; and on the globe, from September 1981, that
 * month's sea surface temperature against its 1991–2020 mean (NOAA OISST), or, picked instead,
 * what El Niño or La Niña usually does to rain or temperature by either index (#891, #892).
 * Loaded with the layer.
 */

import { ensoText, loadEnso, monthName, monthOf, spanned, type Enso } from '../../data/enso';
import { latestFor } from '../../data/ensoSst';
import type { ViewState } from '../../state/viewState';
import { feature } from '../feature';
import { loadOnce } from '../layerLoad';
import { ensoChart } from './chartModel';
import { ensoMapLayer } from './ensoMapLayer';
import { ensoPanel } from './ensoPanel';
import { globeMaps } from './globeMaps';

/** January 1950, the first month of NOAA's indices: ours from two reconstructions before. */
const NOAA_FROM = monthOf(1950, 1);
const EARLY_NOTE =
  ' Before 1950 NOAA publishes no index: these are computed here by its RONI method from two reconstructions of the sea, ERSST and HadISST.';

/**
 * What the panel says of a month, and the month it charts: today, while the indices catch up,
 * the latest month there is, said so; before 1950, whose indices they are.
 */
function sayMonth(
  enso: { readonly now: Enso; readonly early: Enso },
  at: number,
): { readonly shown: Enso; readonly month: number; readonly text: string } {
  const before = at < NOAA_FROM;
  const shown = before ? enso.early : enso.now;
  const month = latestFor(spanned(shown).last, at);
  const waiting = month === at ? '' : `No index yet for ${monthName(at)}; the latest, `;
  return { shown, month, text: `${waiting}${ensoText(shown, month)}${before ? EARLY_NOTE : ''}` };
}

/** Whether the layer shows: on, on Earth's globe, in the years. */
function shownOn(state: ViewState): boolean {
  return (
    state.layers.has('enso') &&
    state.mode === 'globe' &&
    state.ma === null &&
    state.focus === 'earth'
  );
}

export const ensoFeature = feature({
  id: 'enso',
  needs: [],
  watches: (state) => [state.layers, state.mode, state.ma, state.focus],
  mount(context) {
    // What was last shown, so the moments of one month cost nothing.
    let shownFor = '';
    const painted = context.globe.addLayer(ensoMapLayer);
    const maps = globeMaps({
      base: context.base,
      fetchJson: context.fetchJson,
      paint: (packed) => {
        painted.update(packed);
      },
      notify: (message) => {
        context.notify(message);
      },
      refresh: () => {
        shownFor = '';
        context.refresh();
      },
    });
    const panel = context.globe.addLayer(
      ensoPanel((map, index) => {
        maps.pick(map, index);
      }),
    );
    // NOAA's indices from 1950, and ours from two reconstructions before (#894).
    const load = loadOnce({
      fetch: () =>
        Promise.all([
          loadEnso(`${context.base}data/enso/index.json`, context.fetchJson),
          loadEnso(`${context.base}data/enso/early.json`, context.fetchJson),
        ]).then(([now, early]) => ({ now, early })),
      what: 'the El Niño indices',
      context,
    });
    let on = false;
    let said: string | null = null;

    return {
      show(state) {
        on = shownOn(state);
        const at = monthOf(state.time.date.year, state.time.date.month);
        const enso = load.value();
        const key = `${String(on)}:${load.status()}:${String(at)}`;
        if (key === shownFor) return;
        shownFor = key;
        maps.show(on, at);
        if (!on) {
          said = null;
          panel.update(null);
          return;
        }
        if (enso === null) {
          load.want();
          said =
            load.status() === 'failed'
              ? 'Could not load the El Niño indices.'
              : 'Loading the El Niño indices…';
          return;
        }
        const { shown, month, text } = sayMonth(enso, at);
        said = text;
        panel.update({
          chart: ensoChart(shown, month),
          names: shown.indices.map((index) => ({ id: index.id, name: index.label })),
          text: said,
          ...maps.view(at),
        });
      },
      said: () => said,
      load: () => load.report(on),
      here(state) {
        if (!shownOn(state) || state.location === null) return null;
        const at = monthOf(state.time.date.year, state.time.date.month);
        const text = maps.here(state.location, at);
        return text === null ? null : { title: 'El Niño and La Niña', text, why: 'enso' };
      },
    };
  },
});
