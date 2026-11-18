/**
 * How things are shown (#381): the sky's figures and whose they are, the calendar the years are
 * counted in, and the light the Sun and the planets are shown in, close up.
 *
 * In a link:
 * - `figures` picks the constellation figures the sky view draws: `famous` (absent), `all`
 *   or `none`.
 * - `years` is the calendar the year bar counts in: `western` (absent), `hebrew`, `islamic`,
 *   `egyptian` or `roman`. It changes how years are listed, not the moment in `t`.
 * - `sun` is the channel of light the Sun is drawn in, close up: `visible` (absent),
 *   `magnetogram`, `304`, `171`, `193` or `131`.
 * - `light` is how a planet is shown close up: `look` (absent) or another light it has.
 * - `culture` is whose constellations the sky view draws: `modern` (absent) or a sky culture
 *   such as `babylonian_mulapin` or `chinese`.
 * - `mission` names a launch beyond Earth orbit by its first craft's GCAT id (`d00271`): with
 *   the spacecraft on, only its craft are drawn, with their whole route, and the bar plays
 *   that mission (#712). Absent means every launch.
 * - `craft` names the craft the camera is on (#796), by its GCAT id (`d01093`, `s20580`): the
 *   camera orbits it, close enough to see it, and `cam` is then in the craft's own size (half
 *   its longest side, its "radius"). `focus` stays the body it is about, which leaving it goes
 *   back to. Absent means a body is in focus. `site` (`url.ts`) names a telescope on the ground
 *   the camera is at instead (#864, #876), by its id in the record (`lovell`); links from before
 *   it say `craft=lovell`, and are still read so.
 * - `wave` opens a gravitational wave passing (#829): `gw150914`, the first one heard, its
 *   ring of test masses and the space about it stretched and squeezed. Absent shows none.
 * - `chapter` is the part of the wave's story shown (#833): `source` (absent), `journey`,
 *   `space` or `detector`. Only read with a wave.
 * - `explore` names the destination the view was arrived at from (#726), such as
 *   `human-origins`; absent when the reader found their own way. A link with it and no view of
 *   its own (no `t`, `ma` or `cam`) opens that destination.
 */

import { SKY_CULTURES, type SkyCulture } from '../../data/skyCultures';
import { SUN_LAYERS, type SunLayer } from '../../data/sunImages';
import { YEAR_CALENDARS, type YearCalendar } from '../../time/calendars';
import { choice, type Params } from '../slice';

/** Which constellation figures the sky view draws: the best-known ones, all 88, or none. */
export const FIGURES = ['famous', 'all', 'none'] as const;
export type Figures = (typeof FIGURES)[number];

/** How a planet is shown close up: as it looks, or another way where a mission gives one:
 * Venus's ground by radar, Mercury's minerals in enhanced colour, Jupiter recently. */
export const PLANET_LIGHTS = ['look', 'radar', 'minerals', 'recent', 'height', 'haze'] as const;
export type PlanetLight = (typeof PLANET_LIGHTS)[number];

/** The gravitational waves that can be shown passing (#829). */
const WAVES = ['gw150914'] as const;
export type Wave = (typeof WAVES)[number];

/** The wave's story, in order (#833): its source, its journey, what it does to space, and how
 * Livingston heard it. */
export const WAVE_CHAPTERS = ['source', 'journey', 'space', 'detector'] as const;
export type WaveChapter = (typeof WAVE_CHAPTERS)[number];

/** What the camera is on, close enough to see it (#796, #864, #876): a craft or a telescope's site. */
interface CameraOn {
  readonly kind: 'craft' | 'site';
  /** A craft's GCAT id, or a telescope's id in the record; lower case. */
  readonly id: string;
}

/** A craft's GCAT id: `d…` beyond Earth, `s…` about it. */
const CRAFT_ID = /^[ds]\d{5}$/i;

/** A telescope's id in the record, as `site` gives it, or an error saying what was expected. */
export function parseSite(raw: string): string {
  if (!/^[a-z][a-z-]{1,39}$/i.test(raw)) {
    throw new Error('expected a craft’s GCAT id, such as d01093, or a telescope’s, such as lovell');
  }
  return raw.toLowerCase();
}

/** The craft the camera is on, by its GCAT id; null at a site or a body. */
export function craftOn(state: Pick<DisplayState, 'on'>): string | null {
  return state.on?.kind === 'craft' ? state.on.id : null;
}

/** The telescope on the ground the camera is at, by its id; null on a craft or a body. */
export function siteOn(state: Pick<DisplayState, 'on'>): string | null {
  return state.on?.kind === 'site' ? state.on.id : null;
}

export interface DisplayState {
  readonly figures: Figures;
  /** The calendar the year bar counts in. */
  readonly years: YearCalendar;
  /** The channel of light the Sun is shown in, close up. */
  readonly sunLayer: SunLayer;
  /** How a planet is shown close up (#239): as it looks, or by another light where it has one. */
  readonly planetLight: PlanetLight;
  /** Whose constellations the sky view draws. */
  readonly culture: SkyCulture;
  /** The launch followed, by its first craft's GCAT id, lower case; null for every launch. */
  readonly mission: string | null;
  /** What the camera is on (#796, #864): a craft or a telescope's site; null for a body. */
  readonly on: CameraOn | null;
  /** The gravitational wave shown passing (#829); null when none. */
  readonly wave: Wave | null;
  /** The part of the wave's story shown (#833). */
  readonly waveChapter: WaveChapter;
  /** The destination the view was arrived at from, by its id; null when none. */
  readonly explore: string | null;
}

export const DISPLAY_DEFAULTS: DisplayState = {
  figures: 'famous',
  years: 'western',
  sunLayer: 'visible',
  planetLight: 'look',
  culture: 'modern',
  mission: null,
  on: null,
  wave: null,
  waveChapter: 'source',
  explore: null,
};

export const DISPLAY_PARAMS: Params<DisplayState> = {
  figures: choice('figures', FIGURES, DISPLAY_DEFAULTS.figures),
  years: choice('years', YEAR_CALENDARS, DISPLAY_DEFAULTS.years),
  sunLayer: choice('sun', SUN_LAYERS, DISPLAY_DEFAULTS.sunLayer),
  planetLight: choice('light', PLANET_LIGHTS, DISPLAY_DEFAULTS.planetLight),
  culture: choice('culture', SKY_CULTURES, DISPLAY_DEFAULTS.culture),
  mission: {
    key: 'mission',
    parse: (raw) => {
      if (!/^d\d{5}$/i.test(raw)) throw new Error('expected a craft’s GCAT id, such as d00271');
      return raw.toLowerCase();
    },
    format: (id) => id,
  },
  on: {
    key: 'craft',
    parse: (raw) => {
      if (CRAFT_ID.test(raw)) return { kind: 'craft', id: raw.toLowerCase() };
      // A telescope on the ground, as links from before `site` named it (#864).
      return { kind: 'site', id: parseSite(raw) };
    },
    // A site is written as `site` (`url.ts`).
    format: (on) => (on?.kind === 'craft' ? on.id : null),
  },
  wave: {
    key: 'wave',
    parse: (raw) => {
      const wave = WAVES.find((name) => name === raw.toLowerCase());
      if (wave === undefined) throw new Error('expected a gravitational wave, such as gw150914');
      return wave;
    },
    format: (wave) => wave,
  },
  waveChapter: choice('chapter', WAVE_CHAPTERS, DISPLAY_DEFAULTS.waveChapter),
  explore: {
    key: 'explore',
    parse: (raw) => {
      if (!/^[a-z][a-z0-9-]{0,47}$/.test(raw)) {
        throw new Error('expected a destination’s id, such as human-origins');
      }
      return raw;
    },
    format: (id) => id,
  },
};
