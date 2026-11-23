/**
 * Deep time's plates as a feature (#380, #444, #909): a second reconstruction's continents
 * outlined, by its chip in the bar, and how far the plates have moved since the moment shown.
 * Before the elevation maps, where they reach, their continents are the sketch's land too,
 * Plates on or not (#1149). Each file loads the first time it is asked for.
 */

import { framesAhead, framesAround } from '../../data/paleoDem';
import { prefetchFrames } from '../../deepTime/playSpeed';
import { loadPlateMotion, motionText, type PlateMotion } from '../../data/plateMotion';
import { platesBeyondText, plateText, type PlateMaskIndex } from '../../data/plateMasks';
import type { ViewState } from '../../state/viewState';
import { errorMessage } from '../../util/errors';
import { feature } from '../feature';
import { PLATES_CHIP, platesChip } from './platesChip';

/** The masks that playing at `maPerSecond` from `ma` comes to next: to load before they are needed. */
function masksAhead(
  index: PlateMaskIndex,
  ma: number,
  maPerSecond: number,
  base: string,
): readonly string[] {
  return framesAhead(index.frames, ma, prefetchFrames(maPerSecond)).map(
    (frame) => `${base}data/plates/${frame.file}`,
  );
}

export const platesFeature = feature({
  id: 'plates',
  needs: ['plateOutlines', 'plateMasks'],
  watches: (state) => [state.layers, state.ma, state.deepScale],
  deepChip: PLATES_CHIP,
  // Before the others' chips in deep time's bar, as it was.
  deepChipOrder: -1,
  mount(context) {
    const { base, fetchJson } = context;
    const globe = context.plateOutlines;
    let waiting = false;

    /**
     * A second reconstruction's continents, outlined or only as land: what to say. Playing at
     * `maPerSecond`, the masks ahead load before they are needed (#1149).
     */
    function showPlates(ma: number, outlined: boolean, maPerSecond: number | null): string | null {
      const index = context.plateMasks.loaded();
      if (index === null) {
        if (!waiting) {
          waiting = true;
          context.plateMasks.ask().then(
            () => {
              waiting = false;
              context.refresh();
            },
            (error: unknown) => {
              waiting = false;
              context.notify(`Could not load the continent outlines: ${errorMessage(error)}`);
            },
          );
        }
        return null;
      }
      const reach = index.frames.at(-1)?.ma ?? 0;
      if (ma > reach) {
        globe.setPlates(null);
        return platesBeyondText(reach);
      }
      if (maPerSecond !== null) globe.prefetch(masksAhead(index, ma, maPerSecond, base));
      const { younger, older, mix } = framesAround(index.frames, ma);
      globe.setPlates({
        younger: `${base}data/plates/${younger.file}`,
        older: `${base}data/plates/${older.file}`,
        mix,
        columns: index.columns,
        rows: index.rows,
        turnYounger: younger.turn ?? 0,
        turnOlder: older.turn ?? 0,
        outlined,
      });
      return plateText(mix < 0.5 ? younger : older);
    }

    // How far the plates have moved: the file loads the first time the ice-age scale is shown.
    let plateMotion: PlateMotion | null = null;
    let plateMotionLoading: Promise<PlateMotion> | null = null;

    function plateMotionText(state: ViewState, ma: number): string | null {
      if (state.deepScale !== 'ice') return null;
      if (plateMotion === null) {
        if (plateMotionLoading === null) {
          plateMotionLoading = loadPlateMotion(`${base}data/plates-motion.json`, fetchJson);
          plateMotionLoading.then(
            (loaded) => {
              plateMotion = loaded;
              context.refresh();
            },
            (error: unknown) => {
              plateMotionLoading = null;
              context.notify(`Could not load how far the plates moved: ${errorMessage(error)}`);
            },
          );
        }
        return null;
      }
      return motionText(plateMotion, ma);
    }

    return {
      deep(state, moment) {
        const on = state.layers.has('plates');
        if (moment === null || (!on && moment.uncharted !== true)) {
          globe.setPlates(null);
          return moment === null ? null : platesChip(false, null);
        }
        const said = showPlates(moment.ma, on, moment.maPerSecond ?? null);
        return platesChip(on, on ? said : null);
      },
      deepBar: (state, moment) => ({ plateMotion: plateMotionText(state, moment.ma) }),
    };
  },
});
