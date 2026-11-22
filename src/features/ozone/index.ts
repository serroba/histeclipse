/**
 * The ozone layer (#722) on the feature contract (#380): in the years, the Antarctic ozone hole
 * each spring since 1979 as a cap of its mean area round the South Pole, and beside the globe
 * the hole's area and the ozone-depleting gases since, the year shown marked. Where the MSR-2
 * reanalysis has the year (1970 on), the globe shows instead that October's ozone over the whole
 * Earth, the hole in its own shape, each year's map fetched when first shown. On a day from
 * July to December of 2003 to 2025, the globe shows that day's ozone layer as a surface round
 * the Earth (#804), its season fetched when first shown. Loaded with the
 * layer; a year the record lacks is said, not drawn. A load that fails is said on its chip, and
 * tried again only when the reader asks (#751), not at every moment while time plays.
 */

import {
  holeIn,
  loadOzone,
  ozoneLine,
  ozoneText,
  ozoneWords,
  type OzoneHistory,
} from '../../data/ozone';
import { loadOzoneMaps, mapOf, mapText, omittedText, type OzoneMaps } from '../../data/ozoneMaps';
import type { ViewState } from '../../state/viewState';
import { feature, type FeatureContext } from '../feature';
import { loadOnce } from '../../state/loadOnce';
import { ozoneCharts } from './chartModel';
import {
  HEIGHTS_DRAWN,
  loadOzoneShell,
  shellDate,
  shellDayOf,
  shellText,
  type OzoneShell,
} from '../../data/ozoneShell';
import { ozoneImages } from './ozoneImages';
import { ozoneSeasons, type ShellDay } from './ozoneSeasons';
import { ozoneShellLayer } from './ozoneShellLayer';
import { ozoneLayer, type OzoneDrawn, type OzoneMapImage } from './ozoneLayer';
import { ozonePanel, type OzoneView } from './ozonePanel';

/** What is shown: on the globe, in words, and beside the globe. */
interface Shown {
  readonly drawn: OzoneDrawn;
  readonly said: string;
  readonly view: OzoneView;
}

/** What a year shows: on the globe its October's map, else the hole's cap; and in words. */
function yearShown(
  history: OzoneHistory,
  maps: OzoneMaps,
  map: OzoneMapImage | null,
  year: number,
): Shown {
  const found = holeIn(history, year);
  const october = map === null ? null : mapOf(maps, year);
  const capped = found.kind === 'hole' ? { capMkm2: found.hole.areaMkm2 } : null;
  return {
    drawn: map === null ? capped : { map },
    said:
      october === null
        ? [ozoneText(history, year), omittedText(maps, year)].filter(Boolean).join(' ')
        : `${mapText(maps, october)} ${ozoneWords(history, year)}`,
    view: {
      charts: ozoneCharts(history, year),
      text: ozoneLine(history, year),
      map: october === null ? null : `Globe: ozone in October ${String(year)}, Dobson units.`,
      surface: false,
    },
  };
}

/** All the layer loads at once: NASA's and NOAA's record, the maps' index, the surface's. */
interface OzoneRecord {
  readonly history: OzoneHistory;
  readonly maps: OzoneMaps;
  readonly shell: OzoneShell;
}

/** What a day of a season shows: its surface round the Earth, nothing painted on the ground. */
function dayShown(record: OzoneRecord, shell: ShellDay): Shown {
  const { year } = shell.of.season;
  return {
    drawn: null,
    said: `${shellText(record.shell, shell.of)} ${ozoneWords(record.history, year)}`,
    view: {
      charts: ozoneCharts(record.history, year),
      text: ozoneLine(record.history, year),
      map: `Globe: the ozone layer on ${shellDate(shell.of)}, coloured by total ozone, Dobson units; its heights drawn ${String(HEIGHTS_DRAWN)} times larger.`,
      surface: true,
    },
  };
}

async function loadRecord(context: FeatureContext): Promise<OzoneRecord> {
  const [history, maps, shell] = await Promise.all([
    loadOzone(`${context.base}data/ozone/history.json`, context.fetchJson),
    loadOzoneMaps(`${context.base}data/ozone/maps.json`, context.fetchJson),
    loadOzoneShell(`${context.base}data/ozone/shell.json`, context.fetchJson),
  ]);
  return { history, maps, shell };
}

export { mountOzoneBar } from './ozoneBar';

/** Whether the ozone layer is drawn: on, on Earth's globe, in the years. */
function ozoneDrawn(state: ViewState): boolean {
  return (
    state.layers.has('ozone') &&
    state.mode === 'globe' &&
    state.ma === null &&
    state.focus === 'earth'
  );
}

export const ozoneFeature = feature({
  id: 'ozone',
  needs: ['evenLight'],
  // On or off with its layer, on Earth's globe, in the years.
  watches: (state) => [state.layers, state.mode, state.ma, state.focus],
  mount(context) {
    const cap = context.globe.addLayer(ozoneLayer);
    const surface = context.globe.addLayer(ozoneShellLayer);
    const panel = context.globe.addLayer(ozonePanel);
    const load = loadOnce<OzoneRecord>({
      fetch: () => loadRecord(context),
      what: 'the ozone record',
      context,
    });
    const again = (): void => {
      shownFor = '';
      context.refresh();
    };
    const mapImage = ozoneImages(context.base, again);
    const shellDay = ozoneSeasons(context.base, again);
    let on = false;
    /** Whether the globe has been asked to light evenly. */
    let lit = false;
    let said: string | null = null;
    // What was last shown, so the moments of one year (many a second as time plays) cost nothing.
    let shownFor = '';

    return {
      show(state) {
        on = ozoneDrawn(state);
        // The sun's day and night mean nothing for a daily value at noon UT, and the dark half
        // hides the layer and the land: the globe is lit evenly while it is on (#823).
        if (on !== lit) {
          lit = on;
          context.evenLight.setEvenLight(on, 'ozone');
        }
        const { date } = state.time;
        const record = load.value();
        // A day of a season has its own surface; any other moment, its year's map.
        const day = record === null ? null : shellDayOf(record.shell, date);
        const key = `${String(on)}:${load.status()}:${String(date.year)}/${String(day?.day)}`;
        if (key === shownFor) return;
        shownFor = key;
        if (!on) {
          said = null;
          cap.update(null);
          surface.update(null);
          panel.update(null);
          return;
        }
        if (record === null) {
          load.want();
          said =
            load.status() === 'failed'
              ? 'Could not load the ozone record.'
              : 'Loading the ozone record…';
          return;
        }
        const shell = shellDay(record.shell, date);
        const shown =
          shell === null
            ? yearShown(record.history, record.maps, mapImage(record.maps, date.year), date.year)
            : dayShown(record, shell);
        cap.update(shown.drawn);
        surface.update(shell?.field ?? null);
        said = shown.said;
        panel.update(shown.view);
      },
      said: () => said,
      load: () => load.report(on),
    };
  },
});
