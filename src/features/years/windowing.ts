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
  windowChoices,
  windowValue,
  type WindowChoice,
  type YearsWindow,
} from '../../state/yearsWindow';
import { astronomicalYear } from '../../time/year';
import { moveToYear } from '../../time/yearInput';

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
}

export function windowing(
  store: Pick<Store<ViewState>, 'get' | 'set'>,
  whole: () => YearsWindow,
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
  return {
    shown,
    set,
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
