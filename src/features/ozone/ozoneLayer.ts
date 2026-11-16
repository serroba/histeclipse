/**
 * The ozone on the globe (#722), painted on the map over Earth's surface: the October's ozone
 * over the whole Earth where the reanalysis has the year, coloured by `ozoneColours`; else the
 * hole as a cap round the South Pole of the spring's mean area. The cap's edge is the 220
 * Dobson-unit line only in area: the real hole wanders and stretches off the pole.
 */

import { capEdgeLatitude } from '../../data/ozone';
import { ozoneColours, type OzoneMaps } from '../../data/ozoneMaps';
import { HISTORY_PAINT_ORDER, type LayerFactory } from '../../globe/layerHost';

/** Paint a cap of `areaMkm2` round the South Pole on an equirectangular map. */
export function paintHole(canvas: HTMLCanvasElement, areaMkm2: number): void {
  const context = canvas.getContext('2d');
  if (context === null) return;
  const { width, height } = canvas;
  const edge = ((90 - capEdgeLatitude(areaMkm2)) / 180) * height;
  const fade = context.createLinearGradient(0, edge, 0, height);
  fade.addColorStop(0, 'rgba(170, 110, 255, 0.35)');
  fade.addColorStop(1, 'rgba(120, 60, 220, 0.6)');
  context.fillStyle = fade;
  context.fillRect(0, edge, width, height - edge);
  context.strokeStyle = 'rgba(210, 170, 255, 0.9)';
  context.lineWidth = Math.max(2, height / 360);
  context.beginPath();
  context.moveTo(0, edge);
  context.lineTo(width, edge);
  context.stroke();
}

/** An October's map as its image, and how its greys read as ozone. */
export interface OzoneMapImage {
  readonly year: number;
  readonly image: CanvasImageSource & { readonly width: number; readonly height: number };
  readonly encoding: OzoneMaps['encoding'];
}

/** The map coloured once, at its own size, ready to stretch over Earth's. */
function colouredOzone(map: OzoneMapImage): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = map.image.width;
  canvas.height = map.image.height;
  const context = canvas.getContext('2d');
  if (context === null) return null;
  context.drawImage(map.image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  pixels.data.set(ozoneColours(pixels.data, map.encoding));
  context.putImageData(pixels, 0, 0);
  return canvas;
}

/** What is drawn: the October's map, or the spring's hole as a cap of its mean area. */
export type OzoneDrawn = { readonly map: OzoneMapImage } | { readonly capMkm2: number } | null;

function painter(drawn: OzoneDrawn): ((canvas: HTMLCanvasElement) => void) | null {
  if (drawn === null) return null;
  if ('capMkm2' in drawn) {
    return (canvas) => {
      paintHole(canvas, drawn.capMkm2);
    };
  }
  const coloured = colouredOzone(drawn.map);
  if (coloured === null) return null;
  return (canvas) => {
    canvas.getContext('2d')?.drawImage(coloured, 0, 0, canvas.width, canvas.height);
  };
}

/** What the globe says is drawn: "off", a cap's area, or "map:" and its year. */
function named(drawn: OzoneDrawn): string {
  if (drawn === null) return 'off';
  return 'capMkm2' in drawn ? drawn.capMkm2.toFixed(1) : `map:${String(drawn.map.year)}`;
}

/** The ozone on the globe; null takes it away. */
export const ozoneLayer: LayerFactory<OzoneDrawn> = (host) => {
  const slot = host.historyPaint(HISTORY_PAINT_ORDER.ozone);
  let shown = 'off';
  return {
    update(drawn) {
      const name = named(drawn);
      host.container.dataset['ozone'] = name;
      // Painting the map is slow: only when what is drawn changes.
      if (name === shown) return;
      shown = name;
      slot.show(painter(drawn));
    },
  };
};
