/**
 * Deep time's plates as a feature (#380, #444, #909): a second reconstruction's continents
 * outlined, by its chip in the bar, with where its plates met (#1160), and how far the plates
 * have moved since the moment shown.
 * Before the elevation maps, where they reach, their continents are the sketch's land too,
 * Plates on or not (#1149). Each file loads the first time it is asked for.
 */

import { framesAhead, framesAround } from '../../data/paleoDem';
import { prefetchFrames } from '../../deepTime/playSpeed';
import {
  plateBrief,
  platesBeyondText,
  plateText,
  type PlateMaskIndex,
} from '../../data/plateMasks';
import type { Brief } from '../../state/activeLayers';
import { errorMessage } from '../../util/errors';
import { feature } from '../feature';
import { createPlateBoundaries } from './plateBoundaries';
import { plateBoundaryLayer } from './plateBoundaryLayer';
import { createPlateMotionNote } from './plateMotionNote';
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
    // Where the plates met, at the frame outlined (#1160).
    const boundaries = createPlateBoundaries({
      base,
      fetchJson,
      layer: context.globe.addLayer(plateBoundaryLayer),
      page: context,
    });
    // How well the two agree at the frame outlined now, beside the chip's name (#1159).
    let brief: Brief | null = null;

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
        boundaries.show(null);
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
      const frame = mix < 0.5 ? younger : older;
      brief = plateBrief(frame);
      boundaries.show(outlined ? { ma: frame.ma, turn: frame.turn ?? 0 } : null);
      return plateText(frame);
    }

    const plateMotionText = createPlateMotionNote({ base, fetchJson, page: context });

    return {
      deep(state, moment) {
        const on = state.layers.has('plates');
        brief = null;
        if (moment === null || (!on && moment.uncharted !== true)) {
          globe.setPlates(null);
          boundaries.show(null);
          return moment === null ? null : platesChip(false, null);
        }
        const said = showPlates(moment.ma, on, moment.maPerSecond ?? null);
        return platesChip(on, on ? said : null, boundaries.drawn());
      },
      brief: () => brief,
      deepBar: (state, moment) => ({ plateMotion: plateMotionText(state, moment.ma) }),
    };
  },
});
