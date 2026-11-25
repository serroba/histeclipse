/**
 * Deep time's slice of the view state (#381): the moment in millions of years, the span of the
 * bar, and every choice of how its globe is drawn.
 *
 * In a link:
 * - `ma` switches the globe to deep time: Earth's surface that many million years ago (0 to
 *   4,568, to a thousandth). Absent means historical time, given by `t`.
 * - `scale` is the span the bar runs over: `all` (absent), `ice` or `eons`.
 * - `dw` is the part of it the bar shows (#1074), `oldest,youngest` in Ma to a thousandth
 *   (`124,76`). Absent means the whole span.
 * - `coast`, `seaice`, `temp` and `tshow` pick whose sea level, sea ice and temperature maps the
 *   globe follows, and whether the temperature shows the change from today or °C.
 * - `dispersal` shades Timmermann & Friedrich's dispersal model with Humans: `off` (absent),
 *   `a` or `b`.
 * - `species` shows only one Homo species' finds with Humans (#1047): `all` (absent), or a
 *   species, such as `neanderthal`; or `dna`, only the finds and places with ancient DNA (#1059).
 * - `story=humans` plays the human story once on opening (#177): the link a reader shares, or
 *   Explore's, to watch it; it leaves the address as soon as it starts.
 * - `growth` picks how fast Earth grew before the Moon-forming impact (#1219), `theia` how that
 *   impact went (#1220).
 * - `impact`, `water`, `land` and `snowball` pick the hypotheses the deep-time globe sketches
 *   before the reconstructions reach: when the Moon-forming impact struck, where the oceans'
 *   water came from (#1142), how much of the surface was land, and how far a snowball's ice
 *   reached. Absent means the first of each.
 */

import { COAST_SOURCES, DEFAULT_COAST, type CoastSource } from '../../deepTime/coastline';
import { DEFAULT_SEA_ICE_MODEL, SEA_ICE_MODELS, type SeaIceModel } from '../../data/seaIce';
import { DEEP_SCALES, EARTH_AGE_MA, roundMa, type DeepScale } from '../../deepTime/scale';
import { DEFAULT_GROWTH_MODEL, GROWTH_MODELS, type GrowthModel } from '../../deepTime/growth';
import { DEFAULT_THEIA_MODEL, THEIA_MODELS, type TheiaModel } from '../../deepTime/theia';
import {
  DEFAULT_IMPACT_MODEL,
  DEFAULT_LAND_MODEL,
  DEFAULT_SNOWBALL_MODEL,
  DEFAULT_WATER_MODEL,
  IMPACT_MODELS,
  LAND_MODELS,
  SNOWBALL_MODELS,
  WATER_MODELS,
  type ImpactModel,
  type LandModel,
  type SnowballModel,
  type WaterModel,
} from '../../deepTime/sketch';
import {
  DEFAULT_TEMPERATURE_MODEL,
  DEFAULT_TEMPERATURE_SHOW,
  TEMPERATURE_MODELS,
  TEMPERATURE_SHOWS,
  type TemperatureModel,
  type TemperatureShow,
} from '../../deepTime/temperatureModels';
import { HUMAN_SPECIES, type HumanSpecies } from '../../data/humanClaims';
import { choice, type Params } from '../slice';

/** Timmermann & Friedrich's dispersal model: off, or the early or the late exit from Africa. */
export const DISPERSAL_SCENARIOS = ['off', 'a', 'b'] as const;
export type DispersalScenario = (typeof DISPERSAL_SCENARIOS)[number];

/** A part of deep time's span the bar shows (#1074), in Ma: `oldest` before `youngest`. */
interface DeepWindow {
  readonly oldest: number;
  readonly youngest: number;
}

/** A story told by playing deep time, started by a link: none, or the human story (#177). */
const STORIES = ['off', 'humans'] as const;
type Story = (typeof STORIES)[number];

const MA_RANGE = { min: 0, max: EARTH_AGE_MA } as const;

export interface DeepState {
  /** Deep time: millions of years ago the globe shows Earth's surface for; null for history. */
  readonly ma: number | null;
  /** Which span the deep-time bar runs over. */
  readonly deepScale: DeepScale;
  /** The part of it the bar shows, oldest and youngest Ma (#1074); null for the whole span. */
  readonly deepWindow: DeepWindow | null;
  /** Whose sea level the ice-age coastlines follow. */
  readonly coast: CoastSource;
  /** Timmermann & Friedrich's dispersal model shaded with Humans: off, early or late exit. */
  readonly dispersal: DispersalScenario;
  /** The one Homo species whose finds Humans shows, all of them, or those with DNA (#1059). */
  readonly humanSpecies: HumanSpecies | 'all' | 'dna';
  /** A story to play on opening, asked for by a link; off once it starts. */
  readonly story: Story;
  /** Which climate model's ice-age sea ice the globe blends towards. */
  readonly seaIce: SeaIceModel;
  /** Whose temperature maps colour the deep-time globe. */
  readonly temperatureModel: TemperatureModel;
  /** What its colours show: the change from today (where the map allows) or °C (#457). */
  readonly temperatureShow: TemperatureShow;
  /** Before the reconstructions: which hypotheses the sketched surface follows. */
  readonly impact: ImpactModel;
  /** How fast Earth grew before the impact (#1219). */
  readonly growth: GrowthModel;
  /** How the impact went (#1220). */
  readonly theia: TheiaModel;
  readonly land: LandModel;
  readonly snowball: SnowballModel;
  readonly water: WaterModel;
}

export const DEEP_DEFAULTS: DeepState = {
  ma: null,
  deepScale: 'all',
  deepWindow: null,
  coast: DEFAULT_COAST,
  dispersal: 'off',
  humanSpecies: 'all',
  story: 'off',
  seaIce: DEFAULT_SEA_ICE_MODEL,
  temperatureModel: DEFAULT_TEMPERATURE_MODEL,
  temperatureShow: DEFAULT_TEMPERATURE_SHOW,
  impact: DEFAULT_IMPACT_MODEL,
  growth: DEFAULT_GROWTH_MODEL,
  theia: DEFAULT_THEIA_MODEL,
  land: DEFAULT_LAND_MODEL,
  snowball: DEFAULT_SNOWBALL_MODEL,
  water: DEFAULT_WATER_MODEL,
};

export const DEEP_PARAMS: Params<DeepState> = {
  ma: {
    key: 'ma',
    parse: parseMa,
    // Millions of years to a thousandth (a thousand years), without trailing zeros: 250, 0.021.
    format: (ma) => (ma === null ? null : String(roundMa(ma))),
  },
  deepScale: choice('scale', DEEP_SCALES, DEEP_DEFAULTS.deepScale),
  deepWindow: {
    key: 'dw',
    parse: (raw) => {
      const [oldest, youngest, extra] = raw.split(',').map((part) => parseMa(part));
      if (extra !== undefined || oldest === undefined || youngest === undefined) {
        throw new Error('expected two moments in Ma, the oldest first');
      }
      if (oldest <= youngest) throw new Error('expected the oldest moment first');
      return { oldest, youngest };
    },
    format: (window) =>
      window === null
        ? null
        : `${String(roundMa(window.oldest))},${String(roundMa(window.youngest))}`,
  },
  coast: choice('coast', COAST_SOURCES, DEEP_DEFAULTS.coast),
  dispersal: choice('dispersal', DISPERSAL_SCENARIOS, DEEP_DEFAULTS.dispersal),
  humanSpecies: choice(
    'species',
    ['all', 'dna', ...HUMAN_SPECIES] as const,
    DEEP_DEFAULTS.humanSpecies,
  ),
  story: choice('story', STORIES, DEEP_DEFAULTS.story),
  seaIce: choice('seaice', SEA_ICE_MODELS, DEEP_DEFAULTS.seaIce),
  temperatureModel: choice('temp', TEMPERATURE_MODELS, DEEP_DEFAULTS.temperatureModel),
  temperatureShow: choice('tshow', TEMPERATURE_SHOWS, DEEP_DEFAULTS.temperatureShow),
  impact: choice('impact', IMPACT_MODELS, DEEP_DEFAULTS.impact),
  growth: choice('growth', GROWTH_MODELS, DEEP_DEFAULTS.growth),
  theia: choice('theia', THEIA_MODELS, DEEP_DEFAULTS.theia),
  land: choice('land', LAND_MODELS, DEEP_DEFAULTS.land),
  snowball: choice('snowball', SNOWBALL_MODELS, DEEP_DEFAULTS.snowball),
  water: choice('water', WATER_MODELS, DEEP_DEFAULTS.water),
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
