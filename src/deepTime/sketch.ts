/**
 * Before the continent reconstructions reach: what competing hypotheses say Earth's surface
 * was like, for the globe to sketch. Three questions, each answered by the reader's choice of
 * source: when the surface was molten, how much of it was land, and how far a snowball's ice
 * reached. Land shapes and places are never known this far back; only shares are given.
 */

import { elementAt } from '../util/arrays';

/** How far back the continent reconstruction (Cao et al. 2024) reaches, Ma. */
export const PLATES_REACH_MA = 1800;

/** Share of Earth's surface that is land today: 148.9 of 510.1 million km². */
export const LAND_TODAY = 0.292;

export interface Choice<Id extends string> {
  readonly id: Id;
  readonly label: string;
  readonly source: string;
  readonly url: string;
}

// When the Moon-forming impact struck. Before it and for a while after, the surface is drawn
// molten.

export const IMPACT_MODELS = ['early', 'intermediate', 'young'] as const;
export type ImpactModel = (typeof IMPACT_MODELS)[number];
export const DEFAULT_IMPACT_MODEL: ImpactModel = 'early';

export const IMPACTS: Readonly<Record<ImpactModel, Choice<ImpactModel> & { readonly ma: number }>> =
  {
    early: {
      id: 'early',
      label: 'Early: 4,510 million years ago',
      ma: 4510,
      source: 'Barboni et al. 2017, Science Advances 3',
      url: 'https://doi.org/10.1126/sciadv.1602365',
    },
    intermediate: {
      id: 'intermediate',
      label: 'Intermediate: 4,400–4,450 million years ago',
      ma: 4425,
      source: 'Maurice et al. 2020, Science Advances 6',
      url: 'https://doi.org/10.1126/sciadv.aba8949',
    },
    young: {
      id: 'young',
      label: 'Young: about 4,350 million years ago',
      ma: 4350,
      source: 'Borg & Carlson 2023, Annual Review of Earth and Planetary Sciences 51',
      url: 'https://doi.org/10.1146/annurev-earth-031621-060538',
    },
  };

/**
 * After the impact, a steam atmosphere keeps the surface molten until water condenses into an
 * ocean, after about 1.5 million years (Lebrun et al. 2013, JGR Planets 118).
 */
export const MAGMA_AFTER_IMPACT_MA = 1.5;

/** The oldest zircon, 4,404 ± 8 million years, carries signs of liquid water (Wilde et al. 2001). */
export const OLDEST_WATER_ZIRCON_MA = 4404;

// How much of the surface was land. Crust-growth curves give the share of today's continental
// crust that existed; drawn as land, assuming it stood as high above the sea as today's. One
// model says instead that the crust was mostly under water.

export const LAND_MODELS = ['dhuime', 'taylor', 'korenaga', 'armstrong', 'flooded'] as const;
export type LandModel = (typeof LAND_MODELS)[number];
export const DEFAULT_LAND_MODEL: LandModel = 'dhuime';

export interface LandChoice extends Choice<LandModel> {
  /** Share of today's crust, from the oldest point to today, Ma: read from published curves. */
  readonly crust: readonly (readonly [ma: number, share: number])[];
  readonly note: string;
}

/**
 * Curves read off the replots in Korenaga 2018 (Phil. Trans. R. Soc. A 376, Figs 2, 3 and 6),
 * to within a few hundredths, at 4.4, 4.0, 3.5 … 0.5 billion years.
 */
const CRUST_AGES = [4400, 4000, 3500, 3000, 2500, 2000, 1500, 1000, 500, 0] as const;

function curve(shares: readonly number[]): readonly (readonly [number, number])[] {
  return CRUST_AGES.map((ma, index) => [ma, elementAt(shares, index)] as const);
}

const DHUIME = curve([0.07, 0.25, 0.45, 0.63, 0.75, 0.82, 0.88, 0.93, 0.97, 1]);

export const LAND_CHOICES: Readonly<Record<LandModel, LandChoice>> = {
  dhuime: {
    id: 'dhuime',
    label: 'Steady growth: Dhuime et al. 2012',
    crust: DHUIME,
    note: 'About 65% of today’s crust by 3 billion years ago, from the ages of zircons.',
    source: 'Dhuime et al. 2012, Science 335',
    url: 'https://doi.org/10.1126/science.1216066',
  },
  taylor: {
    id: 'taylor',
    label: 'Late burst: McLennan & Taylor 1982',
    crust: curve([0, 0, 0.09, 0.34, 0.78, 0.84, 0.88, 0.92, 0.96, 1]),
    note: 'Little crust before 3 billion years ago, then a burst at the end of the Archean.',
    source: 'McLennan & Taylor 1982, Journal of Geology 90',
    url: 'https://doi.org/10.1086/628690',
  },
  korenaga: {
    id: 'korenaga',
    label: 'Slow, a lower bound: Korenaga 2018',
    crust: curve([0.01, 0.05, 0.13, 0.24, 0.4, 0.52, 0.65, 0.75, 0.88, 1]),
    note: 'The ages of crust that survives: a lower bound, since older crust was recycled. Its author favours early growth.',
    source: 'Korenaga 2018, Earth and Planetary Science Letters 482',
    url: 'https://doi.org/10.1016/j.epsl.2017.11.039',
  },
  armstrong: {
    id: 'armstrong',
    label: 'Early and steady: Armstrong 1981',
    crust: curve([0.25, 0.73, 1, 1, 1, 1, 1, 1, 1, 1]),
    note: 'Nearly today’s crust by 3.5 billion years ago, recycled as fast as it formed since; Rosas & Korenaga 2018 reach it even earlier.',
    source: 'Armstrong 1981, Phil. Trans. R. Soc. A 301',
    url: 'https://doi.org/10.1098/rsta.1981.0122',
  },
  flooded: {
    id: 'flooded',
    label: 'Mostly flooded: Flament et al. 2008',
    crust: DHUIME,
    note: 'Hotter mantle, flatter continents: only 2–3% of the surface above the sea until about 2.5 billion years ago, when land rose quickly (Bindeman et al. 2018). Later, Dhuime’s curve.',
    source: 'Flament, Coltice & Rey 2008, Earth and Planetary Science Letters 275',
    url: 'https://doi.org/10.1016/j.epsl.2008.08.029',
  },
};

/** Before this the flooded model holds land to its emerged share. */
export const EMERGENCE_MA = 2500;
const FLOODED_SHARE = 0.025;

/** Share of today's crust at `ma` in a model, between its points and held beyond the oldest. */
export function crustShare(model: LandModel, ma: number): number {
  const points = LAND_CHOICES[model].crust;
  const oldest = elementAt(points, 0);
  if (ma >= oldest[0]) return oldest[1];
  const index = points.findIndex(([age]) => age <= ma);
  const [youngMa, youngShare] = elementAt(points, index);
  const [oldMa, oldShare] = elementAt(points, index - 1);
  return youngShare + ((oldShare - youngShare) * (ma - youngMa)) / (oldMa - youngMa);
}

/** Share of the whole surface drawn as land at `ma`. */
export function landShare(model: LandModel, ma: number): number {
  const asHigh = LAND_TODAY * crustShare(model, ma);
  return model === 'flooded' && ma > EMERGENCE_MA ? Math.min(FLOODED_SHARE, asHigh) : asHigh;
}

// How far the ice reached in a snowball.

export const SNOWBALL_MODELS = ['hard', 'jormungand', 'slush'] as const;
export type SnowballModel = (typeof SNOWBALL_MODELS)[number];
export const DEFAULT_SNOWBALL_MODEL: SnowballModel = 'hard';

export interface SnowballChoice extends Choice<SnowballModel> {
  /** Ice poleward of this latitude, degrees; below 0, everywhere. */
  readonly iceEdge: number;
  readonly note: string;
}

export const SNOWBALL_CHOICES: Readonly<Record<SnowballModel, SnowballChoice>> = {
  hard: {
    id: 'hard',
    label: 'Hard snowball: frozen over',
    iceEdge: -1,
    note: 'The whole ocean frozen, the ice roughly a kilometre thick, hundreds of metres in the tropics.',
    source: 'Pierrehumbert et al. 2011, Annual Review of Earth and Planetary Sciences 39',
    url: 'https://doi.org/10.1146/annurev-earth-040809-152447',
  },
  jormungand: {
    id: 'jormungand',
    label: 'Jormungand: a thin open band',
    iceEdge: 10,
    note: 'Sea ice stops 5–15° from the equator, leaving a narrow strip of open water.',
    source: 'Abbot, Voigt & Koll 2011, Journal of Geophysical Research 116',
    url: 'https://doi.org/10.1029/2011JD015927',
  },
  slush: {
    id: 'slush',
    label: 'Slushball: open tropics',
    iceEdge: 25,
    note: 'In a coupled climate model, sea ice reached only about 25° latitude, leaving the tropical ocean open.',
    source: 'Hyde et al. 2000, Nature 405',
    url: 'https://doi.org/10.1038/35013005',
  },
};

export interface SnowballEpisode {
  readonly name: string;
  readonly young: number;
  readonly old: number;
  readonly source: string;
}

/** The glaciations argued to have reached the tropics, youngest first. */
export const SNOWBALL_EPISODES: readonly SnowballEpisode[] = [
  { name: 'Marinoan', young: 634.7, old: 649.9, source: 'Hoffman et al. 2017' },
  { name: 'Sturtian', young: 658.5, old: 717.5, source: 'Hoffman et al. 2017' },
  {
    name: 'Makganyene',
    young: 2426,
    old: 2460,
    source: 'Gumsley et al. 2017; redated from about 2,220 million years (Cornell et al. 1996)',
  },
];

export function snowballAt(ma: number): SnowballEpisode | null {
  return SNOWBALL_EPISODES.find(({ young, old }) => ma >= young && ma <= old) ?? null;
}

export interface SketchChoices {
  readonly impact: ImpactModel;
  readonly land: LandModel;
  readonly snowball: SnowballModel;
}

/** Which question the sketch at a moment answers, so only its choice is offered. */
export type SketchQuestion = 'impact' | 'land' | 'snowball';

export interface Sketch {
  readonly kind: 'magma' | 'ocean';
  /** Share of the surface drawn as land, of invented shape. */
  readonly land: number;
  /** Ice poleward of this latitude, degrees; 90 draws none. */
  readonly iceEdge: number;
  readonly questions: readonly SketchQuestion[];
  readonly episode: SnowballEpisode | null;
}

/**
 * The sketch at `ma`. Where a reconstruction draws the continents (`continentsDrawn`), no
 * invented land is added. Ice is drawn only in the snowball episodes: polar ice at other times
 * is not known well enough to draw.
 */
export function sketchAt(ma: number, choices: SketchChoices, continentsDrawn: boolean): Sketch {
  const episode = snowballAt(ma);
  const iceEdge = episode === null ? 90 : SNOWBALL_CHOICES[choices.snowball].iceEdge;
  if (ma > IMPACTS[choices.impact].ma - MAGMA_AFTER_IMPACT_MA) {
    return { kind: 'magma', land: 0, iceEdge: 90, questions: ['impact'], episode: null };
  }
  // While any camp's impact is still to come, which camp is a question here too.
  const youngest = Math.min(...IMPACT_MODELS.map((model) => IMPACTS[model].ma));
  const questions: SketchQuestion[] = ma > youngest - MAGMA_AFTER_IMPACT_MA ? ['impact'] : [];
  if (!continentsDrawn) questions.push('land');
  if (episode !== null) questions.push('snowball');
  return {
    kind: 'ocean',
    land: continentsDrawn ? 0 : landShare(choices.land, ma),
    iceEdge,
    questions,
    episode,
  };
}

/** Faint young Sun: brightness as a share of today's (Gough 1981), with the Sun 4,570 Myr old. */
export function sunBrightness(ma: number): number {
  return 1 / (1 + 0.4 * (ma / 4570));
}
