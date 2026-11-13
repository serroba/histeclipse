/**
 * The Temperature layer in deep time: each model's maps, asked for once; which one colours the
 * globe at a moment; what the deep-time bar says about it; and the maps handed to the globe,
 * with today's beside them when the colours show the change from today (#457).
 *
 * On the ice-age scale only Krapp et al.'s maps draw: they are 1,000 or 2,000 years apart on
 * today's geography, where the others' nearest are 5 million years apart and would show today's
 * climate through every ice age. Beyond its 800,000 years the ice-age scale shows none, as
 * before it came. Moving towards the present, by play or carried by a story, it fetches the
 * maps ahead.
 */

import { framesAhead, framesAround } from '../../data/paleoDem';
import type { Fetch } from '../../util/fetchJson';
import { loadPaleoTempIndex, type PaleoTempIndex } from '../../data/paleoTemp';
import type { Globe } from '../../globe/globe';
import type { ViewState } from '../../state/viewState';
import type { TemperatureView } from '../../ui/temperatureLegend';
import { errorMessage } from '../../util/errors';
import {
  mapModel,
  meanAt,
  reachMa,
  TEMPERATURE_MODEL_FOLDERS,
  TEMPERATURE_MODEL_LABELS,
  TEMPERATURE_MODELS,
  type TemperatureIndexes,
  type TemperatureModel,
} from '../../deepTime/temperatureModels';

export interface TemperatureLayerContext {
  /** Where a file under `public/data/` is served. */
  readonly dataUrl: (path: string) => string;
  readonly fetchJson: Fetch;
  readonly globe: Pick<Globe, 'setTemperature' | 'prefetch'>;
  readonly notify: (message: string) => void;
  /** A model's maps arrived: draw again. */
  readonly arrived: () => void;
  /** Milliseconds, for how fast the moment moves; `performance.now` unless a test sets it. */
  readonly clock?: () => number;
}

/** Where the moment is drawn: which scale, and whether before the elevation maps reach. */
interface TemperatureMoment {
  readonly ma: number;
  readonly ice: boolean;
  readonly uncharted: boolean;
}

export interface TemperatureLayer {
  /** What the deep-time bar says. */
  view(state: ViewState, moment: TemperatureMoment): TemperatureView;
  /** Whether the globe is coloured by temperature at this moment. */
  drawn(state: ViewState, moment: TemperatureMoment): boolean;
  /** Colour the globe, or not; while playing at `maPerSecond`, the maps ahead are fetched. */
  show(state: ViewState, moment: TemperatureMoment, maPerSecond: number | null): void;
}

/** A moment shown, and when. */
export interface Seen {
  readonly ma: number;
  readonly at: number;
}

/**
 * How fast the moment moves towards the present, Myr a second, from the last moment shown: as
 * deep time plays, or a story such as the boundaries' Holocene (#475) carries the globe along.
 * Null when it stands, goes back, or last moved more than half a second ago.
 */
export function towardsNow(last: Seen | null, now: Seen): number | null {
  if (last === null || now.ma >= last.ma) return null;
  const seconds = (now.at - last.at) / 1000;
  return seconds > 0 && seconds <= 0.5 ? (last.ma - now.ma) / seconds : null;
}

/** Enough maps ahead for four seconds of play, and at least four. */
export function framesToFetch(index: PaleoTempIndex, maPerSecond: number): number {
  const step = (index.frames[1]?.ma ?? 1) - (index.frames[0]?.ma ?? 0);
  return Math.max(4, Math.ceil((4 * maPerSecond) / step));
}

export function createTemperatureLayer(context: TemperatureLayerContext): TemperatureLayer {
  const { dataUrl, fetchJson, globe, notify, arrived } = context;
  const clock = context.clock ?? (() => performance.now());
  let lastSeen: Seen | null = null;
  // Whether this layer may have coloured the globe: it clears only what it drew (and once at
  // first, so the globe says it is off), so a story's own surface (the boundaries' measured
  // warming, #492) stays while deep time draws again.
  let colouring = true;
  let loading: Readonly<Record<TemperatureModel, Promise<PaleoTempIndex> | null>> = {
    krapp: null,
    scotese: null,
    cesm: null,
  };
  let loaded: TemperatureIndexes = { krapp: null, scotese: null, cesm: null };

  /** Every model's maps, each asked for once, the first time the layer is shown. */
  function indexes(): TemperatureIndexes {
    for (const model of TEMPERATURE_MODELS) {
      if (loaded[model] !== null || loading[model] !== null) continue;
      const asked = loadPaleoTempIndex(
        dataUrl(`${TEMPERATURE_MODEL_FOLDERS[model]}/index.json`),
        fetchJson,
      );
      loading = { ...loading, [model]: asked };
      asked.then(
        (index) => {
          loaded = { ...loaded, [model]: index };
          arrived();
        },
        (error: unknown) => {
          loading = { ...loading, [model]: null };
          notify(
            `Could not load the ${TEMPERATURE_MODEL_LABELS[model]} temperature maps: ${errorMessage(error)}`,
          );
        },
      );
    }
    return loaded;
  }

  /** The model colouring the globe, if any: on the ice-age scale, only the ice ages' own. */
  function drawnModel(state: ViewState, moment: TemperatureMoment) {
    if (!state.layers.has('temperature') || moment.uncharted) return null;
    const all = indexes();
    const usable = moment.ice ? { ...all, scotese: null, cesm: null } : all;
    const drawn = mapModel(state.temperatureModel, usable, moment.ma);
    const index = drawn === null ? null : usable[drawn.model];
    return drawn === null || index === null ? null : { ...drawn, index };
  }

  /** Whether the colours show the change from today: Krapp's maps only, on today's geography. */
  function changing(state: ViewState, model: TemperatureModel | undefined): boolean {
    return model === 'krapp' && state.temperatureShow === 'change';
  }

  return {
    view(state, moment) {
      const { temperatureModel: wanted, temperatureShow: show } = state;
      if (!state.layers.has('temperature')) {
        return { on: false, wanted, shown: null, show, changing: false, readings: [], note: null };
      }
      const all = indexes();
      const readings = TEMPERATURE_MODELS.flatMap((model) => {
        const index = all[model];
        if (index === null) return [];
        const mean = meanAt(index, moment.ma);
        const today = index.frames[0]?.mean ?? null;
        return [{ model, mean, today, reach: reachMa(index), coverage: index.coverage }];
      });
      const drawn = drawnModel(state, moment);
      let note: string | null = null;
      if (drawn !== null) {
        // The note of the map nearer the moment, if it has one.
        const { younger, older, mix } = framesAround(drawn.index.frames, moment.ma);
        note = (mix < 0.5 ? younger : older).note ?? null;
      }
      const shown = drawn?.model ?? null;
      return {
        on: true,
        wanted,
        shown,
        show,
        changing: changing(state, drawn?.model),
        readings,
        note,
      };
    },

    drawn(state, moment) {
      return drawnModel(state, moment) !== null;
    },

    show(state, moment, maPerSecond) {
      const drawn = drawnModel(state, moment);
      if (drawn === null) {
        if (colouring) globe.setTemperature(null);
        colouring = false;
        return;
      }
      const { index } = drawn;
      const url = (file: string) => dataUrl(`${TEMPERATURE_MODEL_FOLDERS[drawn.model]}/${file}`);
      const { younger, older, mix } = framesAround(index.frames, moment.ma);
      const seen = { ma: moment.ma, at: clock() };
      const moving = maPerSecond ?? towardsNow(lastSeen, seen);
      lastSeen = seen;
      if (moving !== null) {
        globe.prefetch(
          framesAhead(index.frames, moment.ma, framesToFetch(index, moving)).map((frame) =>
            url(frame.file),
          ),
        );
      }
      colouring = true;
      globe.setTemperature({
        younger: url(younger.file),
        older: url(older.file),
        mix,
        columns: index.columns,
        rows: index.rows,
        coldest: index.coldest,
        warmest: index.warmest,
        change: changing(state, drawn.model),
      });
    },
  };
}
