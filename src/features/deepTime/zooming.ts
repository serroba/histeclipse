/**
 * Zooming deep time's bar (#1074) and fitting it to a geological unit (#1075), as deep time's
 * part applies them to the view: within deep time, into it from the years, or back out to the
 * years. A zoom keeps the moment; a fit keeps it if it lies within the unit, else goes to the
 * unit's start.
 */

import { maOfYear, yearOfMa } from '../../data/iceSheets';
import type { Store } from '../../state/store';
import { YEARS_FIRST } from '../../state/timeAxis';
import {
  type DeepBarWindow,
  deepAxisWindow,
  targetOf,
  zoomTarget,
  type ZoomTarget,
} from '../../state/timeZoom';
import { roundMa, type ViewState } from '../../state/viewState';

/** What zooming asks of deep time's part. */
export interface ZoomingParts {
  readonly store: Pick<Store<ViewState>, 'get' | 'set'>;
  /** The last year the bars reach. */
  readonly present: number;
  /** How far back the elevation maps reach, Ma, as known now. */
  mapsReach(): number;
  /** The part of the span the bar shows. */
  shown(state: ViewState): DeepBarWindow;
  enter(ma: number): void;
  leave(): void;
  /** A jump in time, playing stopped and the link's history stepped first. */
  jump(ma: number): void;
}

export interface Zooming {
  /** One zoom about the moment: `factor` over 1 shows more time. */
  readonly zoom: (factor: number) => void;
  /** Show where a zoom landed: a span of deep time and part of it, or a window of years. */
  readonly land: (target: ZoomTarget) => void;
  /** Fit the bar to a unit from `base` to `top` Ma. */
  readonly fit: (base: number, top: number) => void;
}

export function deepZooming(parts: ZoomingParts): Zooming {
  const { store, present } = parts;
  /** The axis year of `ma`: the date the years left, while it is that moment (today, not 1950). */
  function yearAt(ma: number): number {
    const { year } = store.get().time.date;
    return roundMa(maOfYear(year)) === ma ? year : yearOfMa(ma);
  }
  function land(target: ZoomTarget): void {
    if (target.model === 'years') {
      const { first, last } = target.window;
      const whole = first <= YEARS_FIRST && last >= present;
      parts.leave();
      store.set((state) => ({ ...state, yearsWindow: whole ? null : target.window }));
      return;
    }
    if (store.get().ma === null) parts.enter(target.ma);
    // The years' window is left behind: the bar's window is deep time's now.
    const { scale: deepScale, window: deepWindow } = target;
    store.set((state) => ({ ...state, deepScale, deepWindow, yearsWindow: null }));
  }
  return {
    land,
    zoom(factor) {
      const state = store.get();
      if (state.ma === null) return;
      const window = deepAxisWindow(parts.shown(state), present);
      land(zoomTarget(window, yearAt(state.ma), factor, present, parts.mapsReach()));
    },
    fit(base, top) {
      const { ma } = store.get();
      if (ma === null) return;
      // Its start to the thousand years within it: the Holocene's is 11,700 years ago, not 12,000.
      const at = ma <= base && ma >= top ? ma : Math.floor(base * 1000) / 1000;
      const year = yearAt(at);
      if (at !== ma) parts.jump(at);
      const window = deepAxisWindow({ oldest: base, youngest: top }, present);
      land(targetOf(window, year, present, parts.mapsReach()));
    },
  };
}
