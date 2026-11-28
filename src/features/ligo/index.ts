/**
 * A gravitational wave passing (#829, epic #834; #990, epic #994), as a part of the page, its
 * front (#220): what it watches, loaded with the site. Its body (`body.ts`), the stage, the plots,
 * the waves' stories and the sound, loads the first time the view names a wave
 * (`wave=gw150914`, or `wave=gw170817`); the 3D view's own code loads after it, as before.
 */

import { lazyPart } from '../lazyPart';
import type { MountedPart } from '../part';
import type { WaveContext } from './body';

export type { WaveContext } from './body';

export function mountWave(context: WaveContext): MountedPart {
  return lazyPart<WaveContext>(
    {
      watches: (state) => [state.wave, state.waveChapter],
      wanted: (state) => state.wave !== null,
      what: 'the gravitational wave',
      body: () => import('./body').then(({ mountWave: mountBody }) => mountBody),
    },
    context,
  );
}
