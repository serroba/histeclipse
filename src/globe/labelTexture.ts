/** Labels drawn in the scene itself, as sprites: text on a transparent canvas. */

import { CanvasTexture, SRGBColorSpace } from 'three';

/** A short label on a transparent canvas, `width` wide and 128 pixels tall. */
export function labelTexture(
  text: string,
  width = 512,
  colour = 'rgba(225, 235, 255, 0.95)',
): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context !== null) {
    context.font = '600 44px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.shadowColor = 'rgba(0, 0, 0, 0.9)';
    context.shadowBlur = 8;
    context.fillStyle = colour;
    context.fillText(text, canvas.width / 2, canvas.height / 2);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
