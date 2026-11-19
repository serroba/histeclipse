/**
 * The ocean's currents drawn as Windy draws the wind (#927): particles carried by the month's
 * currents, each leaving a fading streak, on a transparent sphere just above Earth's surface
 * that turns with it. The streaks are drawn into a canvas a frame at a time while the layer
 * shows, and nothing runs while it does not.
 *
 * Three.js glue, covered by the Playwright suite; the particles' motion is in `particles.ts`.
 */

import { CanvasTexture, Mesh, MeshBasicMaterial, SRGBColorSpace, SphereGeometry } from 'three';

import type { Field } from '../../data/oceanCurrents';
import type { LayerFactory } from '../../globe/layerHost';
import { particles, step, valueAt, type Particles } from './particles';

/** The sphere's radius, Earth radii: just off the ground, under the labels. */
const RADIUS = 1.003;
/** A frame counts as this long at most, seconds: after a stall the streaks do not jump. */
const LONGEST_FRAME = 0.05;
/** How much of the last frame's streaks stays each frame: their fading tails, a second or two. */
const KEEP = 0.985;
/** Speed bands the streaks are drawn in, slowest first: fewer strokes than one a particle. */
const BANDS = 4;

/** Whether the page is narrow: a smaller canvas and fewer particles, for a phone. */
function narrow(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < 700;
}

/** Each particle's streak from where it was to where it is, a stroke a speed band. */
function strokeStreaks(
  context: CanvasRenderingContext2D,
  flock: Particles,
  width: number,
  height: number,
): void {
  const px = (longitude: number): number => ((longitude + 180) / 360) * width;
  const py = (latitude: number): number => ((90 - latitude) / 180) * height;
  for (let band = 0; band < BANDS; band += 1) {
    context.beginPath();
    for (let index = 0; index < flock.age.length; index += 1) {
      const speed = valueAt(flock.speed, index);
      if (speed === 0 || Math.min(BANDS - 1, Math.floor(speed * BANDS)) !== band) continue;
      const from = valueAt(flock.fromLongitude, index);
      const to = valueAt(flock.longitude, index);
      if (Math.abs(to - from) > 90) continue; // across the date line: no streak this frame
      context.moveTo(px(from), py(valueAt(flock.fromLatitude, index)));
      context.lineTo(px(to), py(valueAt(flock.latitude, index)));
    }
    // Slow water pale blue and faint, fast water white and bright, as Windy shades the wind.
    const share = (band + 1) / BANDS;
    const red = Math.round(150 + 105 * share);
    const green = Math.round(205 + 50 * share);
    context.strokeStyle = `rgba(${String(red)}, ${String(green)}, 255, ${(0.55 + 0.45 * share).toFixed(2)})`;
    context.stroke();
  }
}

export const flowLayer: LayerFactory<Field | null> = (host) => {
  const small = narrow();
  const canvas = document.createElement('canvas');
  canvas.width = small ? 1024 : 2048;
  canvas.height = canvas.width / 2;
  const context = canvas.getContext('2d');
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  // The canvas fades its streaks by their alpha: blended as premultiplied, they fade to nothing
  // rather than to grey.
  texture.premultiplyAlpha = true;
  const mesh = new Mesh(
    new SphereGeometry(RADIUS, 128, 64),
    new MeshBasicMaterial({
      map: texture,
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
    }),
  );
  mesh.visible = false;
  mesh.renderOrder = 2;
  host.onEarth.add(mesh);
  const flock = particles(small ? 4000 : 9000);
  let field: Field | null = null;
  let running = false;
  let then = 0;

  function draw(seconds: number): void {
    if (context === null || field === null) return;
    // Fade what was drawn, then move the particles and draw their streaks.
    context.globalCompositeOperation = 'destination-in';
    context.fillStyle = `rgba(0, 0, 0, ${String(KEEP)})`;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = 'source-over';
    step(field, flock, seconds);
    context.lineWidth = small ? 1.4 : 1.6;
    context.lineCap = 'round';
    strokeStreaks(context, flock, canvas.width, canvas.height);
    texture.needsUpdate = true;
    host.requestRender();
  }

  function frame(now: number): void {
    if (!running) return;
    const seconds = then === 0 ? 0 : Math.min(LONGEST_FRAME, (now - then) / 1000);
    then = now;
    draw(seconds);
    requestAnimationFrame(frame);
  }

  return {
    update(next) {
      host.container.dataset['oceanCurrents'] = next === null ? 'off' : 'on';
      if (next === field) return;
      field = next;
      mesh.visible = next !== null;
      if (next === null) {
        running = false;
        context?.clearRect(0, 0, canvas.width, canvas.height);
        texture.needsUpdate = true;
        host.requestRender();
        return;
      }
      if (!running) {
        running = true;
        then = 0;
        requestAnimationFrame(frame);
      }
    },
  };
};
