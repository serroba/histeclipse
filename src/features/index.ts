/** Every feature on the contract (#380), in the order they are mounted and shown. */

import { asteroidsFeature } from './asteroids';
import { fossilsFeature } from './fossils';
import { genomesFeature } from './genomes';
import { spacecraftFeature } from './spacecraft';
import { volcanoesFeature } from './volcanoes';
import type { Feature } from './feature';

export const FEATURES: readonly Feature[] = [
  spacecraftFeature,
  asteroidsFeature,
  volcanoesFeature,
  genomesFeature,
  fossilsFeature,
];
