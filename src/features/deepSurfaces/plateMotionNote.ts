/**
 * How far the plates have moved since the moment shown, on the ice-age scale: the file loads the
 * first time that scale is shown, and a failed load is asked again the next time.
 */

import { loadPlateMotion, motionText, type PlateMotion } from '../../data/plateMotion';
import type { ViewState } from '../../state/viewState';
import { errorMessage } from '../../util/errors';
import type { Fetch } from '../../util/fetchJson';

export function createPlateMotionNote(options: {
  readonly base: string;
  readonly fetchJson: Fetch;
  /** The page: shown again when something comes in, and told what could not load. */
  readonly page: { refresh(): void; notify(message: string): void };
}): (state: Pick<ViewState, 'deepScale'>, ma: number) => string | null {
  let plateMotion: PlateMotion | null = null;
  let loading: Promise<PlateMotion> | null = null;
  return (state, ma) => {
    if (state.deepScale !== 'ice') return null;
    if (plateMotion !== null) return motionText(plateMotion, ma);
    if (loading === null) {
      loading = loadPlateMotion(`${options.base}data/plates-motion.json`, options.fetchJson);
      loading.then(
        (loaded) => {
          plateMotion = loaded;
          options.page.refresh();
        },
        (error: unknown) => {
          loading = null;
          options.page.notify(`Could not load how far the plates moved: ${errorMessage(error)}`);
        },
      );
    }
    return null;
  };
}
