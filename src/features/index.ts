/** Every feature on the contract (#380), in the order they are mounted and shown. */

import { amocFeature } from './amoc';
import { asteroidsFeature } from './asteroids';
import { carbonMadeFeature } from './carbonMade';
import { datesFeature } from './dates';
import { airFeature, platesFeature } from './deepSurfaces';
import { fossilsFeature } from './fossils';
import { genomesFeature } from './genomes';
import { humansFeature } from './humans';
import { iceAgesFeature } from './iceAges';
import { impactsFeature } from './impacts';
import { spacecraftFeature } from './spacecraft';
import { oceanHeatFeature } from './oceanHeat';
import { oceanTempFeature } from './oceanTemp';
import { empiresFeature } from './empires';
import { ensoFeature } from './enso';
import { ozoneFeature } from './ozone';
import { periodsFeature } from './periods';
import { rocksFeature } from './rocks';
import { warmingFeature } from './warming';
import { telescopesFeature } from './telescopes';
import { volcanoesFeature } from './volcanoes';
import { waysFeature } from './ways';
import type { Feature } from './feature';

export const FEATURES: readonly Feature[] = [
  // First, in this order: their names and markers go on the globe before the others', as they did.
  empiresFeature,
  impactsFeature,
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
  waysFeature,
  rocksFeature,
  datesFeature,
  carbonMadeFeature,
  platesFeature,
  airFeature,
  iceAgesFeature,
];
