/**
 * Temperature records (#526) on the feature contract (#380): in the years, every record of
 * global surface temperature since 1850 side by side beside the globe, the year shown marked
 * and each record's value then, none picked over the others; under it El Niño and La Niña by
 * each of NOAA's indices (#890), since global temperature jumps with El Niño and dips with La
 * Niña. Both loaded with the layer; the records show while the indices load, or if they fail.
 */

import { ensoYearText, loadEnso, type Enso } from '../../data/enso';
import {
  loadTemperatureRecords,
  recordsLine,
  recordsText,
  type TemperatureRecords,
} from '../../data/temperatureRecords';
import { errorMessage } from '../../util/errors';
import { feature } from '../feature';
import { loadOnce } from '../../state/loadOnce';
import { recordsChart } from './chartModel';
import { recordsPanel } from './recordsPanel';

export const warmingFeature = feature({
  id: 'warming',
  needs: [],
  watches: (state) => [state.layers, state.mode, state.ma, state.focus],
  mount(context) {
    const panel = context.globe.addLayer(recordsPanel);
    const load = loadOnce<TemperatureRecords>({
      fetch: () =>
        loadTemperatureRecords(
          `${context.base}data/temperature-records/index.json`,
          context.fetchJson,
        ),
      what: 'the temperature records',
      context,
    });
    let enso: Enso | null = null;
    let ensoLoading = false;
    let on = false;
    let said: string | null = null;
    // What was last shown, so the moments of one year cost nothing.
    let shownFor = '';

    function loadIndices(): void {
      if (ensoLoading) return;
      ensoLoading = true;
      loadEnso(`${context.base}data/enso/index.json`, context.fetchJson).then(
        (loaded) => {
          enso = loaded;
          shownFor = '';
          context.refresh();
        },
        (error: unknown) => {
          context.notify(`Could not load the El Niño indices: ${errorMessage(error)}`);
        },
      );
    }

    return {
      show(state) {
        on =
          state.layers.has('warming') &&
          state.mode === 'globe' &&
          state.ma === null &&
          state.focus === 'earth';
        const year = state.time.date.year;
        const records = load.value();
        const key = `${String(on)}:${load.status()}:${String(enso !== null)}:${String(year)}`;
        if (key === shownFor) return;
        shownFor = key;
        if (!on) {
          said = null;
          panel.update(null);
          return;
        }
        loadIndices();
        if (records === null) {
          load.want();
          said =
            load.status() === 'failed'
              ? 'Could not load the temperature records.'
              : 'Loading the temperature records…';
          return;
        }
        const ensoSaid = enso === null ? null : ensoYearText(enso, year);
        said =
          ensoSaid === null
            ? recordsText(records, year)
            : `${recordsText(records, year)} ${ensoSaid}`;
        panel.update({
          chart: recordsChart(records, year, enso),
          names: records.series.map(({ id, name }) => ({ id, name })),
          text: recordsLine(records, year),
          enso: ensoSaid,
        });
      },
      said: () => said,
      load: () => load.report(on),
    };
  },
});
