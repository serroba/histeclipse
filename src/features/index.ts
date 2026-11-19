/** Every feature on the contract (#380), in the order they are mounted and shown. */

import { amocFeature } from './amoc';
import { asteroidsFeature } from './asteroids';
import { fossilsFeature } from './fossils';
import { genomesFeature } from './genomes';
import { humansFeature } from './humans';
import { spacecraftFeature } from './spacecraft';
import { oceanHeatFeature } from './oceanHeat';
import { oceanTempFeature } from './oceanTemp';
import { ensoFeature } from './enso';
import { ozoneFeature } from './ozone';
import { periodsFeature } from './periods';
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
  oceanTempFeature,
  ensoFeature,
  amocFeature,
  genomesFeature,
  periodsFeature,
  // Before the fossils: its chip comes first in the deep-time bar, as it did.
  humansFeature,
  fossilsFeature,
];
