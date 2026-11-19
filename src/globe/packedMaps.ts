/**
 * Maps packed into images, painted on the map over Earth's surface (#886, #590): each image
 * coloured once when it is shown (by `sstColours`, a blue-to-red anomaly, unless it brings its
 * own colours), then stretched over the map at each repaint. Its image covers 90°N to 90°S and
 * 180°W to 180°E, as the map does. The sea's anomaly each month (El Niño and La Niña) and the
 * ocean's temperature at depth paint this way.
 */

import { sstColours } from '../data/ensoSst';
import type { LayerFactory } from './layerHost';

/** A packed image, the bound of its scale and how to colour it; null takes it away. */
export interface PackedMonth {
  readonly image: CanvasImageSource & { readonly width: number; readonly height: number };
  readonly bound: number;
  /** Colours packed bytes; the sea's anomaly by default. */
  readonly colours?: (packed: Uint8ClampedArray, bound: number) => Uint8ClampedArray;
}

/** The image coloured once, at its own size, ready to stretch over Earth's. */
export function coloured(packed: PackedMonth): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = packed.image.width;
  canvas.height = packed.image.height;
  const context = canvas.getContext('2d');
  if (context === null) return null;
  context.drawImage(packed.image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  pixels.data.set((packed.colours ?? sstColours)(pixels.data, packed.bound));
  context.putImageData(pixels, 0, 0);
  return canvas;
}

/**
 * A layer that paints packed maps at `order` among the history's paintings, and says on the
 * globe's container (`data-<flag>`) whether one is painted, for the browser tests.
 */
export function packedMapLayer(order: number, flag: string): LayerFactory<PackedMonth | null> {
  return (host) => {
    const slot = host.historyPaint(order);
    let shown: PackedMonth | null = null;
    return {
      update(packed) {
        host.container.dataset[flag] = packed === null ? 'off' : 'on';
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
}
