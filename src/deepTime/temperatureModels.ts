/**
 * The climate models whose temperature maps deep time can show, side by side: Krapp et al.'s
 * (2021: the last 800,000 years every 1,000 or 2,000, land only, on today's geography, #457),
 * Scotese's (540 million years, 1°, adjusted to proxies) and CESM's (Li, Hu et al. 2023: 250
 * million years, a coarser model with its own geography). The reader picks which colours the
 * globe; where it does not reach, the next that does stands in, and every mean is given.
 */

import { framesAround } from '../data/paleoDem';
import type { PaleoTempIndex } from '../data/paleoTemp';

// In the order they stand in for each other: the ice ages' first, beyond its reach Scotese's.
export const TEMPERATURE_MODELS = ['krapp', 'scotese', 'cesm'] as const;
export type TemperatureModel = (typeof TEMPERATURE_MODELS)[number];
export const DEFAULT_TEMPERATURE_MODEL: TemperatureModel = 'krapp';

/** What the colours show: the change from today's map (on today's geography), or °C. */
export const TEMPERATURE_SHOWS = ['change', 'actual'] as const;
export type TemperatureShow = (typeof TEMPERATURE_SHOWS)[number];
export const DEFAULT_TEMPERATURE_SHOW: TemperatureShow = 'change';

export const TEMPERATURE_MODEL_LABELS: Readonly<Record<TemperatureModel, string>> = {
  krapp: 'Krapp et al. 2021',
  scotese: 'Scotese 2022',
  cesm: 'CESM, Li et al. 2023',
};

/** Where each model's maps live under `public/data/`. */
export const TEMPERATURE_MODEL_FOLDERS: Readonly<Record<TemperatureModel, string>> = {
  krapp: 'krapp',
  scotese: 'paleotemp',
  cesm: 'cesm',
};

export type TemperatureIndexes = Readonly<Record<TemperatureModel, PaleoTempIndex | null>>;

/** The oldest moment a model's maps reach, Ma. */
export function reachMa(index: PaleoTempIndex): number {
  return index.frames.at(-1)?.ma ?? 0;
}

/** A model's global mean at `ma`, between its maps; null where it does not reach. */
export function meanAt(index: PaleoTempIndex, ma: number): number | null {
  if (ma > reachMa(index)) return null;
  const { younger, older, mix } = framesAround(index.frames, ma);
  return younger.mean + (older.mean - younger.mean) * mix;
}

/**
 * Which model draws the globe at `ma`: the one asked for if it reaches, otherwise the first
 * that does, with `instead` naming the one asked for. Null while none is loaded or reaches.
 */
export function mapModel(
  wanted: TemperatureModel,
  indexes: TemperatureIndexes,
  ma: number,
): { readonly model: TemperatureModel; readonly instead: TemperatureModel | null } | null {
  for (const model of [wanted, ...TEMPERATURE_MODELS.filter((other) => other !== wanted)]) {
    const index = indexes[model];
    if (index !== null && ma <= reachMa(index)) {
      return { model, instead: model === wanted ? null : wanted };
    }
  }
  return null;
}
