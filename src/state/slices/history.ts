/**
 * The history layers' slice of the view state (#381): whose borders of past states are drawn,
 * and a past state whose eclipses the year bar picks out.
 *
 * In a link:
 * - `borders` is whose borders of past states the empires layer draws: `cliopatria`
 *   (absent), `ohm` (OpenHistoricalMap) or `both`.
 * - `seen` names a past state, as Cliopatria names it (`Neo-Babylonian Empire`): the year bar
 *   marks which eclipses could be seen from its territory. Absent means anywhere.
 * - `yw` is the years the Years bar shows (#749), `first,last` in astronomical years
 *   (`1854,2026`). Absent means the whole Holocene track.
 */

import { choice, type Params } from '../slice';
import type { YearsWindow } from '../yearsWindow';

/** Whose borders of past states the empires layer shows. */
export const BORDER_SOURCES = ['cliopatria', 'ohm', 'both'] as const;
export type BorderSource = (typeof BORDER_SOURCES)[number];

export interface HistoryState {
  /** Whose borders the empires layer draws. */
  readonly borders: BorderSource;
  /** A past state (by its name in Cliopatria) whose eclipses the year bar picks out, if any. */
  readonly seenIn: string | null;
  /** The years the Years bar shows; null for its whole track. */
  readonly yearsWindow: YearsWindow | null;
}

export const HISTORY_DEFAULTS: HistoryState = {
  borders: 'cliopatria',
  seenIn: null,
  yearsWindow: null,
};

export const HISTORY_PARAMS: Params<HistoryState> = {
  borders: choice('borders', BORDER_SOURCES, HISTORY_DEFAULTS.borders),
  seenIn: {
    key: 'seen',
    // A state's name: any text, trimmed, of a sensible length. Whether it exists depends on the year.
    parse: (raw) => {
      const name = raw.trim();
      if (name.length === 0 || name.length > 120)
        throw new Error('expected the name of a past state');
      return name;
    },
    format: (name) => name,
  },
  yearsWindow: {
    key: 'yw',
    parse: (raw) => {
      const [first, last, extra] = raw.split(',').map(Number);
      if (
        extra !== undefined ||
        first === undefined ||
        last === undefined ||
        !Number.isInteger(first) ||
        !Number.isInteger(last) ||
        last <= first
      ) {
        throw new Error('expected two whole years, the first before the last');
      }
      return { first, last };
    },
    format: (window) => (window === null ? null : `${String(window.first)},${String(window.last)}`),
  },
};
