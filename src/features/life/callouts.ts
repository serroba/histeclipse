/**
 * Where the kinds' pictures stand round the globe: each on a ring just outside the globe's edge,
 * towards its dot, pushed apart from its neighbours so none covers another, and kept on the
 * page where the globe fills it. Where a picture stands says nothing: its line to its dot does.
 */

import { Vector3, type PerspectiveCamera } from 'three';

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** The globe as it lies on screen, and the page it lies in, pixels. */
export interface GlobeOnScreen extends Point {
  readonly radius: number;
  readonly width: number;
  readonly height: number;
}

/** A picture's box, and how far outside the globe's edge its middle stands, pixels. */
export const CALLOUT = { width: 76, height: 58, out: 52 } as const;
const MARGIN = 4;
const PASSES = 12;

/** Where a unit globe at the scene's middle lies on a page `width` by `height`, as `camera` sees it. */
export function globeOnScreen(
  camera: PerspectiveCamera,
  width: number,
  height: number,
): GlobeOnScreen {
  const distance = Math.max(1.0001, camera.position.length());
  const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  // The globe's edge as the camera sees it: where its line of sight touches the sphere, upward.
  const edge = camera.position
    .clone()
    .normalize()
    .multiplyScalar(1 / distance)
    .addScaledVector(up, Math.sqrt(1 - 1 / (distance * distance)))
    .project(camera);
  const middle = new Vector3(0, 0, 0).project(camera);
  const onPage = (point: Vector3): Point => ({
    x: ((point.x + 1) / 2) * width,
    y: ((1 - point.y) / 2) * height,
  });
  const [at, rim] = [onPage(middle), onPage(edge)];
  return { ...at, radius: Math.hypot(rim.x - at.x, rim.y - at.y), width, height };
}

/** One pass round the circle, pushing apart each pair too close; whether any moved. */
function pushApart(angles: number[], least: number): boolean {
  let moved = false;
  for (let at = 0; at < angles.length; at++) {
    const next = (at + 1) % angles.length;
    const angle = angles[at] ?? 0;
    const after = angles[next] ?? 0;
    // The last and the first are neighbours too, a whole turn apart.
    const short = least - (after + (next === 0 ? 2 * Math.PI : 0) - angle);
    if (short <= 1e-6) continue;
    angles[at] = angle - short / 2;
    angles[next] = after + short / 2;
    moved = true;
  }
  return moved;
}

/** Spread angles (radians, in order round the circle) so neighbours are at least `least` apart. */
export function spread(angles: readonly number[], least: number): number[] {
  const out = [...angles];
  if (out.length < 2) return out;
  for (let pass = 0; pass < PASSES; pass++) {
    if (!pushApart(out, least)) break;
  }
  return out;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/**
 * Where each picture stands, given where its dot is: in the order the dots are given. Each
 * stands on the ring towards its dot, then neighbours are pushed apart, and all are kept on
 * the page.
 */
export function ringPlaces(globe: GlobeOnScreen, dots: readonly Point[]): Point[] {
  const ring = globe.radius + CALLOUT.out;
  const order = dots
    .map((dot, at) => ({ at, angle: Math.atan2(dot.y - globe.y, dot.x - globe.x) }))
    .sort((a, b) => a.angle - b.angle);
  const angles = spread(
    order.map((each) => each.angle),
    (CALLOUT.width + 6) / ring,
  );
  const places: Point[] = dots.map(() => ({ x: 0, y: 0 }));
  order.forEach(({ at }, turn) => {
    const angle = angles[turn] ?? 0;
    places[at] = {
      x: clamp(
        globe.x + Math.cos(angle) * ring,
        CALLOUT.width / 2 + MARGIN,
        globe.width - CALLOUT.width / 2 - MARGIN,
      ),
      y: clamp(
        globe.y + Math.sin(angle) * ring,
        CALLOUT.height / 2 + MARGIN,
        globe.height - CALLOUT.height / 2 - MARGIN,
      ),
    };
  });
  return places;
}
