/**
 * One time slice's ice sheets outlined in deep time (Batchelor et al. 2019): a layer on the
 * globe's host (#379), its part of the deep-time map painted over the land people had reached.
 */

import type { IceOutlines } from '../data/iceOutlines';
import { paintIceOutlines } from './empireCanvas';
import { DEEP_PAINT_ORDER, type LayerFactory } from './layerHost';

/** The outlines of the slice shown; null hides them. */
export const iceOutlineLayer: LayerFactory<IceOutlines | null> = (host) => {
  const slot = host.deepPaint(DEEP_PAINT_ORDER.iceOutlines);
  return {
    update(outlines) {
      // Painting the map is slow: not again for the slice already shown, as time plays on.
      if ((outlines?.name ?? 'off') === host.container.dataset['iceOutlines']) return;
      host.container.dataset['iceOutlines'] = outlines === null ? 'off' : outlines.name;
      slot.show(
        outlines === null
          ? null
          : (canvas) => {
              paintIceOutlines(canvas, outlines);
            },
      );
    },
  };
};
