/**
 * The soft round glow an impact's flash and impactor are drawn with (#314): a radial gradient on
 * a small canvas, made into a texture.
 */

import { CanvasTexture } from 'three';

/** A soft round glow, white at the heart and orange at the edge, or pale blue for ice. */
export function glowTexture(icy: boolean): CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context !== null) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.3, icy ? 'rgba(170,215,255,0.9)' : 'rgba(255,214,140,0.9)');
    gradient.addColorStop(1, icy ? 'rgba(80,150,255,0)' : 'rgba(255,120,40,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  return new CanvasTexture(canvas);
}
