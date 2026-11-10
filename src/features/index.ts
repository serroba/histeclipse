/** Every feature on the contract (#380), in the order they are mounted and shown. */

import { asteroidsFeature } from './asteroids';
import { spacecraftFeature } from './spacecraft';
import type { Feature } from './feature';

export const FEATURES: readonly Feature[] = [spacecraftFeature, asteroidsFeature];
