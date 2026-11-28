/**
 * Volcanic eruptions near the year shown, in historical time (Smithsonian GVP), on the feature
 * contract (#380), its front (#220): what it watches and when it is wanted, loaded with the site.
 * Its body (`body.ts`), the eruptions' markers and cards, loads the first time the layer is on, on
 * the globe in historical time.
 */

import { lazyFeature } from '../lazyFeature';
import { NEEDS } from './needs';

export const volcanoesFeature = lazyFeature({
  id: 'volcanoes',
  needs: NEEDS,
  picks: 'volcano',
  // On or off with its layer, and only on the globe, in historical time.
  watches: (state) => [state.layers, state.mode, state.ma],
  wanted: (state) => state.layers.has('volcanoes') && state.mode === 'globe' && state.ma === null,
  body: () => import('./body').then(({ mountVolcanoes }) => mountVolcanoes),
});
