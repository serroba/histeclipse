/**
 * A packed map's bytes, read once from its image through a canvas, for "Why here?" (#893) to
 * read a place's value. Null where the page has no 2D canvas.
 */

const read = new WeakMap<object, Uint8ClampedArray>();

export function pixelsOf(
  image: CanvasImageSource & { readonly width: number; readonly height: number },
): Uint8ClampedArray | null {
  const known = read.get(image);
  if (known !== undefined) return known;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context === null) return null;
  context.drawImage(image, 0, 0);
  const bytes = context.getImageData(0, 0, image.width, image.height).data;
  read.set(image, bytes);
  return bytes;
}
