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
import type { Feature } from '../feature';
import { recordsChart } from './chartModel';
import { recordsPanel } from './recordsPanel';

export const warmingFeature: Feature = {
  id: 'warming',
  watches: (state) => [state.layers, state.mode, state.ma, state.focus],
  mount(context) {
    const panel = context.globe.addLayer(recordsPanel);
    let records: TemperatureRecords | null = null;
    let enso: Enso | null = null;
    let loading = false;
    let ensoLoading = false;
    let said: string | null = null;
    // What was last shown, so the moments of one year cost nothing.
    let shownFor = '';

    function load(): void {
      if (loading) return;
      loading = true;
      loadTemperatureRecords(
        `${context.base}data/temperature-records/index.json`,
        context.fetchJson,
      ).then(
        (loaded) => {
          records = loaded;
          context.refresh();
        },
        (error: unknown) => {
          loading = false;
          shownFor = '';
          context.notify(`Could not load the temperature records: ${errorMessage(error)}`);
        },
      );
    }

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
        const on =
          state.layers.has('warming') &&
          state.mode === 'globe' &&
          state.ma === null &&
          state.focus === 'earth';
        const year = state.time.date.year;
        const key = `${String(on)}:${String(records !== null)}:${String(enso !== null)}:${String(year)}`;
        if (key === shownFor) return;
        shownFor = key;
        if (!on) {
          said = null;
          panel.update(null);
          return;
        }
        loadIndices();
        if (records === null) {
          said = 'Loading the temperature records…';
          load();
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
    };
  },
};
