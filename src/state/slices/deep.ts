/**
 * Deep time's slice of the view state (#381): the moment in millions of years, the span of the
 * bar, and every choice of how its globe is drawn.
 *
 * In a link:
 * - `ma` switches the globe to deep time: Earth's surface that many million years ago (0 to
 *   4,568, to a thousandth). Absent means historical time, given by `t`.
 * - `scale` is the span the bar runs over: `all` (absent), `ice` or `eons`.
 * - `coast`, `seaice`, `temp` and `tshow` pick whose sea level, sea ice and temperature maps the
 *   globe follows, and whether the temperature shows the change from today or °C.
 * - `dispersal` shades Timmermann & Friedrich's dispersal model with Humans: `off` (absent),
 *   `a` or `b`.
 * - `impact`, `land` and `snowball` pick the hypotheses the deep-time globe sketches before
 *   the reconstructions reach: when the Moon-forming impact struck, how much of the surface
 *   was land, and how far a snowball's ice reached. Absent means the first of each.
 */

import { COAST_SOURCES, DEFAULT_COAST, type CoastSource } from '../../deepTime/coastline';
import { DEFAULT_SEA_ICE_MODEL, SEA_ICE_MODELS, type SeaIceModel } from '../../data/seaIce';
import { DEEP_SCALES, EARTH_AGE_MA, roundMa, type DeepScale } from '../../deepTime/scale';
import {
  DEFAULT_IMPACT_MODEL,
  DEFAULT_LAND_MODEL,
  DEFAULT_SNOWBALL_MODEL,
  IMPACT_MODELS,
  LAND_MODELS,
  SNOWBALL_MODELS,
  type ImpactModel,
  type LandModel,
  type SnowballModel,
} from '../../deepTime/sketch';
import {
  DEFAULT_TEMPERATURE_MODEL,
  DEFAULT_TEMPERATURE_SHOW,
  TEMPERATURE_MODELS,
  TEMPERATURE_SHOWS,
  type TemperatureModel,
  type TemperatureShow,
} from '../../deepTime/temperatureModels';
import { choice, type Params } from '../slice';

/** Timmermann & Friedrich's dispersal model: off, or the early or the late exit from Africa. */
export const DISPERSAL_SCENARIOS = ['off', 'a', 'b'] as const;
export type DispersalScenario = (typeof DISPERSAL_SCENARIOS)[number];

const MA_RANGE = { min: 0, max: EARTH_AGE_MA } as const;

export interface DeepState {
  /** Deep time: millions of years ago the globe shows Earth's surface for; null for history. */
  readonly ma: number | null;
  /** Which span the deep-time bar runs over. */
  readonly deepScale: DeepScale;
  /** Whose sea level the ice-age coastlines follow. */
  readonly coast: CoastSource;
  /** Timmermann & Friedrich's dispersal model shaded with Humans: off, early or late exit. */
  readonly dispersal: DispersalScenario;
  /** Which climate model's ice-age sea ice the globe blends towards. */
  readonly seaIce: SeaIceModel;
  /** Whose temperature maps colour the deep-time globe. */
  readonly temperatureModel: TemperatureModel;
  /** What its colours show: the change from today (where the map allows) or °C (#457). */
  readonly temperatureShow: TemperatureShow;
  /** Before the reconstructions: which hypotheses the sketched surface follows. */
  readonly impact: ImpactModel;
  readonly land: LandModel;
  readonly snowball: SnowballModel;
}

export const DEEP_DEFAULTS: DeepState = {
  ma: null,
  deepScale: 'all',
  coast: DEFAULT_COAST,
  dispersal: 'off',
  seaIce: DEFAULT_SEA_ICE_MODEL,
  temperatureModel: DEFAULT_TEMPERATURE_MODEL,
  temperatureShow: DEFAULT_TEMPERATURE_SHOW,
  impact: DEFAULT_IMPACT_MODEL,
  land: DEFAULT_LAND_MODEL,
  snowball: DEFAULT_SNOWBALL_MODEL,
};

export const DEEP_PARAMS: Params<DeepState> = {
  ma: {
    key: 'ma',
    parse: parseMa,
    // Millions of years to a thousandth (a thousand years), without trailing zeros: 250, 0.021.
    format: (ma) => (ma === null ? null : String(roundMa(ma))),
  },
  deepScale: choice('scale', DEEP_SCALES, DEEP_DEFAULTS.deepScale),
  coast: choice('coast', COAST_SOURCES, DEEP_DEFAULTS.coast),
  dispersal: choice('dispersal', DISPERSAL_SCENARIOS, DEEP_DEFAULTS.dispersal),
  seaIce: choice('seaice', SEA_ICE_MODELS, DEEP_DEFAULTS.seaIce),
  temperatureModel: choice('temp', TEMPERATURE_MODELS, DEEP_DEFAULTS.temperatureModel),
  temperatureShow: choice('tshow', TEMPERATURE_SHOWS, DEEP_DEFAULTS.temperatureShow),
  impact: choice('impact', IMPACT_MODELS, DEEP_DEFAULTS.impact),
  land: choice('land', LAND_MODELS, DEEP_DEFAULTS.land),
  snowball: choice('snowball', SNOWBALL_MODELS, DEEP_DEFAULTS.snowball),
};

function parseMa(raw: string): number {
  const ma = Number(raw);
  if (raw.trim() === '' || !Number.isFinite(ma)) throw new Error('is not a number');
  if (ma < MA_RANGE.min || ma > MA_RANGE.max) {
    throw new Error(
      `must be between ${String(MA_RANGE.min)} and ${String(MA_RANGE.max)} million years ago`,
    );
  }
  return roundMa(ma);
}
