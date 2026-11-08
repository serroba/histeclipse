/**
 * Today's coasts and shelves as an elevation grid the page can read: the shelf image decoded
 * once, its first channel kept (the image is greyscale). Browser glue, covered by the Playwright
 * suite; the reading is in `data/landSea.ts`.
 */

import type { ElevationGrid } from '../data/landSea';
import type { ShelfIndex } from '../data/shelf';

export async function loadElevationGrid(url: string, index: ShelfIndex): Promise<ElevationGrid> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${String(response.status)}`);
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context === null) throw new Error('no 2D canvas to read the shelf image');
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const values = new Uint8Array(rgba.length / 4);
  for (let i = 0; i < values.length; i += 1) values[i] = rgba[i * 4] ?? 0;
  return { values, columns: index.columns, rows: index.rows, lowest: index.lowest };
}
