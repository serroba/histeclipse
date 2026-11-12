/**
 * The history layers' slice of the view state (#381): whose borders of past states are drawn,
 * and a past state whose eclipses the year bar picks out.
 *
 * In a link:
 * - `borders` is whose borders of past states the empires layer draws: `cliopatria`
 *   (absent), `ohm` (OpenHistoricalMap) or `both`.
 * - `seen` names a past state, as Cliopatria names it (`Neo-Babylonian Empire`): the year bar
 *   marks which eclipses could be seen from its territory. Absent means anywhere.
 */

import { choice, type Params } from '../slice';

/** Whose borders of past states the empires layer shows. */
export const BORDER_SOURCES = ['cliopatria', 'ohm', 'both'] as const;
export type BorderSource = (typeof BORDER_SOURCES)[number];

export interface HistoryState {
  /** Whose borders the empires layer draws. */
  readonly borders: BorderSource;
  /** A past state (by its name in Cliopatria) whose eclipses the year bar picks out, if any. */
  readonly seenIn: string | null;
}

export const HISTORY_DEFAULTS: HistoryState = { borders: 'cliopatria', seenIn: null };

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
};
