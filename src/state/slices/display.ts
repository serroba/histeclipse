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
}

export const DISPLAY_DEFAULTS: DisplayState = {
  figures: 'famous',
  years: 'western',
  sunLayer: 'visible',
  planetLight: 'look',
  culture: 'modern',
};

export const DISPLAY_PARAMS: Params<DisplayState> = {
  figures: choice('figures', FIGURES, DISPLAY_DEFAULTS.figures),
  years: choice('years', YEAR_CALENDARS, DISPLAY_DEFAULTS.years),
  sunLayer: choice('sun', SUN_LAYERS, DISPLAY_DEFAULTS.sunLayer),
  planetLight: choice('light', PLANET_LIGHTS, DISPLAY_DEFAULTS.planetLight),
  culture: choice('culture', SKY_CULTURES, DISPLAY_DEFAULTS.culture),
};
