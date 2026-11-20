/**
 * A month's packed image of currents read back into a field (#927), once per image: its bytes
 * through a canvas. Null where the page has no 2D canvas.
 */

import { fieldOf, type Field } from '../../data/oceanCurrents';

const read = new WeakMap<object, Field>();

export function fieldFromImage(
  image: CanvasImageSource & { readonly width: number; readonly height: number },
  bound: number,
): Field | null {
  const known = read.get(image);
  if (known !== undefined) return known;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context === null) return null;
  context.drawImage(image, 0, 0);
  const bytes = context.getImageData(0, 0, image.width, image.height).data;
  const field = fieldOf(bytes, image.width, image.height, bound);
  read.set(image, field);
  return field;
}
