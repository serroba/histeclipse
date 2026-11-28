/**
 * The great mass extinctions as a feature (#1190), its front (#220): what it watches and when it
 * is wanted, loaded with the site, with the extinctions' parts of the Earth shader, which the
 * globe is made with. Its body (`body.ts`), the places, cards, clocks and the camera following
 * them, loads the first time the layer is on in deep time.
 */

import type { EarthPart } from '../../globe/earthParts';
import { lazyFeature } from '../lazyFeature';
import { ANOXIC_SEAS_PART } from './anoxicSeasPart';
import { LAVA_FLOWS_PART } from './lavaFlowsPart';
import { NEEDS } from './needs';

/**
 * The extinctions' parts of the Earth shader: the flood lavas (#1212), the oxygen-poor seas
 * (#1202).
 */
export const EXTINCTION_EARTH_PARTS: readonly EarthPart[] = [LAVA_FLOWS_PART, ANOXIC_SEAS_PART];

export const extinctionsFeature = lazyFeature({
  id: 'extinctions',
  needs: NEEDS,
  picks: 'extinction',
  watches: (state) => [state.layers, state.mode, state.ma, state.deepScale],
  // On in deep time: it draws on the whole span only, but play eases near each extinction on any.
  wanted: (state) => state.layers.has('extinctions') && state.ma !== null,
  body: () => import('./body').then(({ mountExtinctions }) => mountExtinctions),
});
