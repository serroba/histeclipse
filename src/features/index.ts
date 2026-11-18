/** Every feature on the contract (#380), in the order they are mounted and shown. */

import { asteroidsFeature } from './asteroids';
import { fossilsFeature } from './fossils';
import { genomesFeature } from './genomes';
import { humansFeature } from './humans';
import { spacecraftFeature } from './spacecraft';
import { oceanHeatFeature } from './oceanHeat';
import { ozoneFeature } from './ozone';
import { warmingFeature } from './warming';
import { telescopesFeature } from './telescopes';
import { volcanoesFeature } from './volcanoes';
import type { Feature } from './feature';

export const FEATURES: readonly Feature[] = [
  spacecraftFeature,
  asteroidsFeature,
  telescopesFeature,
  volcanoesFeature,
  ozoneFeature,
  warmingFeature,
  oceanHeatFeature,
  genomesFeature,
  // Before the fossils: its chip comes first in the deep-time bar, as it did.
  humansFeature,
  fossilsFeature,
];
