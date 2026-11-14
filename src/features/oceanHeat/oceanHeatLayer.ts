/**
 * Where the ocean gained heat (#589), painted on the map over Earth's surface: the chosen IAP
 * trend map, coloured by `heatColours` once when it loads, then stretched over the map at each
 * repaint. Its image is the 1° grid, 90°N to 90°S and 180°W to 180°E, as the map is.
 */

import { heatColours } from '../../data/oceanHeat';
import { HISTORY_PAINT_ORDER, type LayerFactory } from '../../globe/layerHost';

/** A map's packed image and its bound; null takes it away. */
export interface PackedMap {
  readonly image: CanvasImageSource & { readonly width: number; readonly height: number };
  readonly bound: number;
}

/** The map coloured once, at its own size, ready to stretch over Earth's. */
export function colouredMap(packed: PackedMap): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = packed.image.width;
  canvas.height = packed.image.height;
  const context = canvas.getContext('2d');
  if (context === null) return null;
  context.drawImage(packed.image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  pixels.data.set(heatColours(pixels.data, packed.bound));
  context.putImageData(pixels, 0, 0);
  return canvas;
}

export const oceanHeatLayer: LayerFactory<PackedMap | null> = (host) => {
  const slot = host.historyPaint(HISTORY_PAINT_ORDER.oceanHeat);
  let shown: PackedMap | null = null;
  return {
    update(packed) {
      host.container.dataset['oceanHeat'] = packed === null ? 'off' : 'on';
      if (packed === shown) return;
      shown = packed;
      const coloured = packed === null ? null : colouredMap(packed);
      slot.show(
        coloured === null
          ? null
          : (canvas) => {
              canvas.getContext('2d')?.drawImage(coloured, 0, 0, canvas.width, canvas.height);
            },
      );
    },
  };
};
