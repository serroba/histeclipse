/**
 * The ozone hole on the globe (#722): a cap round the South Pole of the spring's mean area,
 * painted on the map over Earth's surface. Its edge is the 220 Dobson-unit line only in area:
 * the real hole wanders and stretches off the pole, which the record's numbers do not say.
 */

import { capEdgeLatitude } from '../../data/ozone';
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

/** The spring's hole, by its mean area in million km²; null takes it away. */
export const ozoneLayer: LayerFactory<number | null> = (host) => {
  const slot = host.historyPaint(HISTORY_PAINT_ORDER.ozone);
  let shown: number | null = null;
  return {
    update(areaMkm2) {
      host.container.dataset['ozone'] = areaMkm2 === null ? 'off' : areaMkm2.toFixed(1);
      // Painting the map is slow: only when the area changes.
      if (areaMkm2 === shown) return;
      shown = areaMkm2;
      slot.show(
        areaMkm2 === null
          ? null
          : (canvas) => {
              paintHole(canvas, areaMkm2);
            },
      );
    },
  };
};
