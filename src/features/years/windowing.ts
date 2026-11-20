/**
 * The Years bar's window (#749), as the years part holds it: the years shown, a window picked,
 * and the fit when the reader turns on a layer with a span of years.
 */

import { layerEntry, type Layer } from '../../layers/layers';
import type { Store } from '../../state/store';
import type { ViewState } from '../../state/viewState';
import {
  clampWindow,
  fitFor,
  layerSpan,
  windowChoices,
  windowValue,
  type WindowChoice,
  type YearsWindow,
} from '../../state/yearsWindow';
import type { Moment } from '../../time/moment';
import {
  byMonth,
  defaultLevel,
  speedAt,
  speedsFor,
  type PlaySpeed,
  type SpeedLevel,
} from '../../time/playSpeeds';
import { astronomicalYear } from '../../time/year';
import { moveToMonth, moveToYear } from '../../time/yearInput';
import type { YearPlayhead } from '../../time/yearPlay';

/** The travel view's own layers: borders and how people lived, for a trip through history. */
const TRAVEL_LAYERS: readonly Layer[] = ['empires', 'ways'];

/**
 * The layers playing brings, of the travel view's own that are off: none when a layer with
 * years of its own is on, as El Niño is; the reader came for that, not for borders.
 */
export function travelBrings(layers: ReadonlySet<Layer>): Layer[] {
  if ([...layers].some((layer) => layerSpan(layer) !== null)) return [];
  return TRAVEL_LAYERS.filter((layer) => !layers.has(layer));
}

export interface Windowing {
  /** The years the bar shows: the window picked, held to the track, or the whole track. */
  shown(state: ViewState): YearsWindow;
  /** Shows a window (null for the whole track); a year outside it moves to its last. */
  set(window: YearsWindow | null): void;
  /**
   * Fits the bar to the layers turned on since last seen, and the year shown, so turning a
   * layer on never moves the reader in time. Not while playing (the travel view's own layers),
   * in deep time, or on the first showing (a link's layers).
   */
  fitNew(state: ViewState, playing: boolean): void;
  /** The windows the picker offers, and the one shown, as its value. */
  choices(state: ViewState): { readonly windows: WindowChoice[]; readonly window: string };
  /** The speeds for the years shown (#915), and the one at the level picked, or, none picked,
   * at the years' own default (#984). */
  speeds(state: ViewState, level: SpeedLevel | null): { speeds: PlaySpeed[]; speed: PlaySpeed };
  /** Where playing starts: the window's start if the moment is at its end or outside it. */
  start(state: ViewState): Moment | null;
  /**
   * One frame of play, `seconds` long, at the level picked: the moment to show next (null if
   * the same), and whether the window's end is reached. Month by month under a year a second.
   */
  step(
    state: ViewState,
    level: SpeedLevel | null,
    seconds: number,
    head: YearPlayhead,
  ): { readonly time: Moment | null; readonly done: boolean };
}

/** Months since January of year 0. */
const monthIndex = (year: number, month: number): number => year * 12 + month - 1;

/**
 * One frame of play in a window: month by month under a year a second, to its last month
 * (`last`, months since January of year 0); else year by year, to its last year.
 */
function playStep(
  state: ViewState,
  window: YearsWindow,
  last: number,
  { yearsPerSecond }: PlaySpeed,
  seconds: number,
  head: YearPlayhead,
): { readonly time: Moment | null; readonly done: boolean } {
  const { year, month } = state.time.date;
  if (byMonth(yearsPerSecond)) {
    const at = monthIndex(year, month);
    const next = head.step(at, yearsPerSecond * 12, seconds, last);
    const time =
      next === at
        ? null
        : moveToMonth(
            state.time,
            astronomicalYear(Math.floor(next / 12)),
            (((next % 12) + 12) % 12) + 1,
          );
    return { time, done: next >= last };
  }
  const next = head.step(year, yearsPerSecond, seconds, window.last);
  const time = next === year ? null : moveToYear(state.time, astronomicalYear(next));
  return { time, done: next >= window.last };
}

export function windowing(
  store: Pick<Store<ViewState>, 'get' | 'set'>,
  whole: () => YearsWindow,
  /** Today's month (1–12): playing to the present stops there. */
  thisMonth: () => number = () => new Date().getUTCMonth() + 1,
): Windowing {
  let before: ReadonlySet<Layer> | null = null;
  const shown = (state: ViewState): YearsWindow =>
    state.yearsWindow === null ? whole() : (clampWindow(state.yearsWindow, whole()) ?? whole());
  function set(window: YearsWindow | null): void {
    const held = window === null ? null : clampWindow(window, whole());
    const range = held ?? whole();
    store.set((state) => {
      const year = state.time.date.year;
      const inside = year >= range.first && year <= range.last;
      return {
        ...state,
        yearsWindow: held,
        ...(inside ? {} : { time: moveToYear(state.time, astronomicalYear(range.last)) }),
      };
    });
  }
  /** The last month the window plays to: today's if it ends in the present. */
  function lastMonth(window: YearsWindow): number {
    return window.last === whole().last
      ? monthIndex(window.last, thisMonth())
      : monthIndex(window.last, 12);
  }
  const speedOf = (state: ViewState, level: SpeedLevel | null): PlaySpeed => {
    const years = shown(state).last - shown(state).first;
    return speedAt(years, level ?? defaultLevel(years));
  };
  return {
    shown,
    set,
    speeds(state, level) {
      const window = shown(state);
      return { speeds: speedsFor(window.last - window.first), speed: speedOf(state, level) };
    },
    start(state) {
      const window = shown(state);
      const { year, month } = state.time.date;
      const at = monthIndex(year, month);
      if (at < lastMonth(window) && year >= window.first) return null;
      return moveToMonth(state.time, astronomicalYear(window.first), 1);
    },
    step(state, level, seconds, head) {
      const window = shown(state);
      return playStep(state, window, lastMonth(window), speedOf(state, level), seconds, head);
    },
    fitNew(state, playing) {
      const was = before;
      before = state.layers;
      if (was === null || playing || state.ma !== null) return;
      const fit = fitFor([...state.layers].filter((layer) => !was.has(layer)));
      if (fit === null) return;
      const year = state.time.date.year;
      const around = { first: Math.min(fit.first, year), last: Math.max(fit.last, year) };
      // After the change being shown has reached every listener: a change made inside it would
      // reach the listeners after this one as the state before it.
      queueMicrotask(() => {
        set(around);
      });
    },
    choices(state) {
      return {
        windows: windowChoices(
          state.layers,
          state.yearsWindow,
          whole(),
          (layer) => layerEntry(layer).label,
        ),
        window: windowValue(state.yearsWindow),
      };
    },
  };
}
