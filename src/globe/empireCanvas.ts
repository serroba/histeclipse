/**
 * Paints territories, or ice-sheet outlines, onto an equirectangular map (longitude −180° at the left edge, north at
 * the top), the layout of the globe's texture, for the Earth shader to lay over the ground.
 *
 * Canvas glue, covered by the Playwright suite; the geometry it uses is tested in
 * `data/empires.ts` and `data/iceOutlines.ts`.
 */

import { territoryHue, unwrapRing, type Territory } from '../data/empires';
import type { ArrivalGrid } from '../data/dispersal';
import type { RockUnit } from '../data/rocks';
import type { Shown, WayRegion } from '../data/waysOfLife';
import type { IceOutlines } from '../data/iceOutlines';

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
  context.lineJoin = 'round';
  // Round caps, so a state smaller than a pixel (Monaco, say) still shows as a dot.
  context.lineCap = 'round';
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

/** How each of a time slice's hypotheses is drawn, in colours that stand out from white ice. */
const HYPOTHESIS_STYLES = {
  max: { stroke: 'rgba(255, 120, 100, 0.95)', width: 6, dash: [22, 12] },
  min: { stroke: 'rgba(110, 200, 255, 0.95)', width: 6, dash: [4, 10] },
  best: { stroke: 'rgba(255, 205, 90, 0.98)', width: 7, dash: [] },
} as const;

/**
 * Draws a time slice's ice-sheet outlines over what is already painted: the maximum dashed, the minimum
 * dotted, the best estimate solid.
 */
export function paintIceOutlines(canvas: HTMLCanvasElement, outlines: IceOutlines): void {
  const context = canvas.getContext('2d');
  if (context === null) return;
  const { width, height } = canvas;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  for (const hypothesis of ['max', 'min', 'best'] as const) {
    const style = HYPOTHESIS_STYLES[hypothesis];
    context.strokeStyle = style.stroke;
    context.lineWidth = style.width;
    context.setLineDash(style.dash);
    for (const offset of [-360, 0, 360]) {
      context.beginPath();
      for (const ring of outlines[hypothesis]) {
        unwrapRing(ring).forEach(([lon, lat], index) => {
          const x = ((lon + offset + 180) / 360) * width;
          const y = ((90 - lat) / 180) * height;
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.closePath();
      }
      context.stroke();
    }
  }
  context.setLineDash([]);
}

export function clearOverlay(canvas: HTMLCanvasElement): void {
  canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Shades the cells a dispersal model has people settled in `ka` thousand years ago, a run of
 * cells at a time along each row.
 */
export function paintSettled(canvas: HTMLCanvasElement, grid: ArrivalGrid, ka: number): void {
  const context = canvas.getContext('2d');
  if (context === null) return;
  const cellWidth = canvas.width / grid.columns;
  const cellHeight = canvas.height / grid.rows;
  // Magenta: apart from the sand of bared shelves and the ice, and lighter than the plates' lines.
  context.fillStyle = 'rgba(214, 70, 170, 0.36)';
  for (let row = 0; row < grid.rows; row += 1) {
    let start = -1;
    for (let column = 0; column <= grid.columns; column += 1) {
      const arrival = column < grid.columns ? (grid.arrival[row * grid.columns + column] ?? 0) : 0;
      const settled = arrival !== 0 && arrival >= ka;
      if (settled && start < 0) start = column;
      if (!settled && start >= 0) {
        context.fillRect(
          start * cellWidth,
          row * cellHeight,
          (column - start) * cellWidth,
          cellHeight,
        );
        start = -1;
      }
    }
  }
}

/** Fixed per way of life, never by rank. */
export const WAY_COLOURS: Readonly<Record<Shown, string>> = {
  foraging: '25, 158, 112',
  pastoralism: '201, 133, 0',
  extensive: '217, 89, 38',
  intensive: '57, 135, 229',
  urban: '138, 92, 214',
  // Neutral: no one way is shown where several are as widespread.
  mixed: '200, 205, 215',
};

/**
 * Shades each region by its most widespread way of life, stronger the more widespread: under
 * the states, which are drawn over it.
 */
export function paintWays(
  canvas: HTMLCanvasElement,
  regions: readonly WayRegion[],
  // Under the states' own colours, fainter, so theirs still read.
  strength = 1,
): void {
  const context = canvas.getContext('2d');
  if (context === null) return;
  const { width, height } = canvas;
  for (const region of regions) {
    const alpha = (0.12 + 0.14 * region.level) * strength;
    context.fillStyle = `rgba(${WAY_COLOURS[region.way]}, ${String(alpha)})`;
    for (const offset of [-360, 0, 360]) {
      context.beginPath();
      for (const ring of region.rings) {
        unwrapRing(ring).forEach(([lon, lat], index) => {
          const x = ((lon + offset + 180) / 360) * width;
          const y = ((90 - lat) / 180) * height;
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.closePath();
      }
      context.fill('evenodd');
    }
  }
}

/** Shades each map unit in its own colour (Macrostrat's, by age), under everything else. */
export function paintRocks(
  canvas: HTMLCanvasElement,
  units: readonly RockUnit[],
  // Under the states' own colours, fainter, so theirs still read.
  strength = 1,
): void {
  const context = canvas.getContext('2d');
  if (context === null) return;
  const { width, height } = canvas;
  context.globalAlpha = 0.55 * strength;
  for (const unit of units) {
    context.fillStyle = unit.colour;
    for (const offset of [-360, 0, 360]) {
      context.beginPath();
      for (const ring of unit.rings) {
        unwrapRing(ring).forEach(([lon, lat], index) => {
          const x = ((lon + offset + 180) / 360) * width;
          const y = ((90 - lat) / 180) * height;
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.closePath();
      }
      context.fill('evenodd');
    }
  }
  context.globalAlpha = 1;
}
