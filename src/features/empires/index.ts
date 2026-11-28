/**
 * The borders of past states as a feature (#380, #446, #909), its front (#220): what it watches
 * and when it is wanted, loaded with the site. Its body (`body.ts`), the borders drawn, the states
 * that came and went, and what they have at the place picked, loads the first time the layer is
 * on in historical time.
 */

import { lazyFeature } from '../lazyFeature';
import { NEEDS } from './needs';

export { createBorderFiles, createStatesNote } from './files';

export const empiresFeature = lazyFeature({
  id: 'empires',
  needs: NEEDS,
  watches: (state) => [state.layers, state.ma, state.borders],
  // Past states belong to historical time, not deep time.
  wanted: (state) => state.layers.has('empires') && state.ma === null,
  body: () => import('./body').then(({ mountEmpires }) => mountEmpires),
});
