/** The sky's canvas-drawn textures: the Sun's glow and the corona. */

import { CanvasTexture } from 'three';

/** A soft radial glow for the Sun. */
export function glowTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context !== null) {
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 244, 214, 0.9)');
    gradient.addColorStop(0.15, 'rgba(255, 220, 160, 0.35)');
    gradient.addColorStop(1, 'rgba(255, 200, 120, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  }
  return new CanvasTexture(canvas);
}

/** The corona: pearly streamers fading over a few solar radii. */
export function coronaTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (context !== null) {
    const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
    // The sprite is 4.5 solar radii across each way: the Moon's edge is at 0.22.
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.22, 'rgba(240, 244, 255, 0.95)');
    gradient.addColorStop(0.32, 'rgba(210, 222, 255, 0.4)');
    gradient.addColorStop(0.6, 'rgba(180, 200, 255, 0.08)');
    gradient.addColorStop(1, 'rgba(160, 180, 255, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
  }
  return new CanvasTexture(canvas);
}
