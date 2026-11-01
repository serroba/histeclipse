/**
 * Paints territories onto an equirectangular map (longitude −180° at the left edge, north at
 * the top), the layout of the globe's texture, for the Earth shader to lay over the ground.
 *
 * Canvas glue, covered by the Playwright suite; the geometry it uses is tested in
 * `data/empires.ts`.
 */

import { territoryHue, unwrapRing, type Territory } from '../data/empires';

export const EMPIRE_MAP_WIDTH = 4096;

export function createEmpireCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = EMPIRE_MAP_WIDTH;
  canvas.height = EMPIRE_MAP_WIDTH / 2;
  return canvas;
}

export function paintTerritories(
  canvas: HTMLCanvasElement,
  territories: readonly Territory[],
): void {
  const context = canvas.getContext('2d');
  if (context === null) return;
  const { width, height } = canvas;
  context.clearRect(0, 0, width, height);
  context.lineJoin = 'round';
  context.lineWidth = 2;
  for (const territory of territories) {
    const hue = territoryHue(territory.name);
    context.fillStyle = `hsla(${String(hue)}, 70%, 55%, 0.42)`;
    context.strokeStyle = `hsla(${String(hue)}, 85%, 78%, 0.95)`;
    for (const ring of territory.rings) {
      const points = unwrapRing(ring);
      // A ring that runs past ±180° is drawn again a world away, so both sides get it.
      for (const offset of [-360, 0, 360]) {
        context.beginPath();
        points.forEach(([lon, lat], index) => {
          const x = ((lon + offset + 180) / 360) * width;
          const y = ((90 - lat) / 180) * height;
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.closePath();
        context.fill();
        context.stroke();
      }
    }
  }
}

/**
 * Draws border lines over what is already painted: OpenHistoricalMap's view, in white, so
 * where it differs from the coloured areas shows at a glance.
 */
export function paintBorders(
  canvas: HTMLCanvasElement,
  borders: readonly (readonly (readonly [number, number])[])[],
): void {
  const context = canvas.getContext('2d');
  if (context === null) return;
  const { width, height } = canvas;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.lineWidth = 2.5;
  context.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  for (const line of borders) {
    const points = unwrapRing(line);
    for (const offset of [-360, 0, 360]) {
      context.beginPath();
      points.forEach(([lon, lat], index) => {
        const x = ((lon + offset + 180) / 360) * width;
        const y = ((90 - lat) / 180) * height;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.stroke();
    }
  }
}
