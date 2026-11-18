/**
 * The month's sea surface temperature anomaly (#886), painted on the map over Earth's surface:
 * the packed image coloured by `sstColours` once when it is shown, then stretched over the map at
 * each repaint. Its image is the 1° grid, 90°N to 90°S and 180°W to 180°E, as the map is.
 */

import { sstColours } from '../../data/ensoSst';
import { HISTORY_PAINT_ORDER, type LayerFactory } from '../../globe/layerHost';

/** A month's packed image and the bound of its scale; null takes it away. */
export interface PackedMonth {
  readonly image: CanvasImageSource & { readonly width: number; readonly height: number };
  readonly bound: number;
}

/** The month coloured once, at its own size, ready to stretch over Earth's. */
export function coloured(packed: PackedMonth): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = packed.image.width;
  canvas.height = packed.image.height;
  const context = canvas.getContext('2d');
  if (context === null) return null;
  context.drawImage(packed.image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  pixels.data.set(sstColours(pixels.data, packed.bound));
  context.putImageData(pixels, 0, 0);
  return canvas;
}

export const ensoMapLayer: LayerFactory<PackedMonth | null> = (host) => {
  const slot = host.historyPaint(HISTORY_PAINT_ORDER.enso);
  let shown: PackedMonth | null = null;
  return {
    update(packed) {
      host.container.dataset['ensoSst'] = packed === null ? 'off' : 'on';
      if (packed === shown) return;
      shown = packed;
      const map = packed === null ? null : coloured(packed);
      slot.show(
        map === null
          ? null
          : (canvas) => {
              canvas.getContext('2d')?.drawImage(map, 0, 0, canvas.width, canvas.height);
            },
      );
    },
  };
};
