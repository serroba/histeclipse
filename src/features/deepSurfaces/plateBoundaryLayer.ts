/**
 * Where the plates met at the moment shown, painted on deep time's map (#1160): a layer on the
 * globe's host (#379), under the ice-sheet outlines.
 */

import type { BoundaryFrame } from '../../data/plateBoundaries';
import { paintBoundaries } from './boundaryCanvas';
import { DEEP_PAINT_ORDER, type LayerFactory } from '../../globe/layerHost';

/** A frame's boundaries, as turned to line up with the surface, and a key naming both. */
export interface BoundariesShown {
  readonly key: string;
  readonly frame: BoundaryFrame;
}

/** The boundaries shown; null hides them. */
export const plateBoundaryLayer: LayerFactory<BoundariesShown | null> = (host) => {
  const slot = host.deepPaint(DEEP_PAINT_ORDER.plateBoundaries);
  return {
    update(shown) {
      // Painting the map is slow: not again for the frame already shown, as time plays on.
      const key = shown?.key ?? 'off';
      if (key === host.container.dataset['plateBoundaries']) return;
      host.container.dataset['plateBoundaries'] = key;
      slot.show(
        shown === null
          ? null
          : (canvas) => {
              paintBoundaries(canvas, shown.frame);
            },
      );
    },
  };
};
