/**
 * Reads a dispersal model's arrival-time image into bytes, through a canvas.
 *
 * Browser glue, covered by the Playwright suite; what the grid means is unit-tested in
 * `data/dispersal.ts`.
 */

import type { ArrivalGrid } from '../data/dispersal';
import type { Fetch } from '../data/fetchJson';

/** Read a scenario's image into its arrival times. */
export async function loadArrivalGrid(url: string, fetchImage: Fetch): Promise<ArrivalGrid> {
  const response = await fetchImage(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${String(response.status)}`);
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('no 2D canvas');
  context.drawImage(bitmap, 0, 0);
  const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
  const arrival = new Uint8Array(bitmap.width * bitmap.height);
  for (let cell = 0; cell < arrival.length; cell += 1) arrival[cell] = pixels[cell * 4] ?? 0;
  return { columns: bitmap.width, rows: bitmap.height, arrival };
}
