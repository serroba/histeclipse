/**
 * Placing the names written over the globe, each frame, at the least cost to the page: a name is
 * moved only when it moves by a whole pixel, and shown or hidden only when that changes. Every
 * write to an element's style or `hidden` makes the browser work out its style again, and with
 * hundreds of names on (the states, the impacts) that was most of a frame's time on a phone.
 */

import { type Camera, Vector3 } from 'three';

import type { NamesShown } from '../util/screenNames';
import type { SurfaceLabel } from './layerHost';
import { type Box, clearOf } from './spaceFrame';

/** The transform last written to each element, so the same one is not written again. */
const written = new WeakMap<HTMLElement, string>();

/** A translation to whole pixels, then `then` (how the name sits on its point). */
export function translation(x: number, y: number, then: string): string {
  return `translate(${String(Math.round(x))}px, ${String(Math.round(y))}px) ${then}`;
}

/** Show `element` with `transform`, or hide it with null, writing only what changed. */
export function placeLabel(element: HTMLElement, transform: string | null): void {
  const hide = transform === null;
  // Read the element's own state, not a copy: other code hides names too.
  if (element.hidden !== hide) element.hidden = hide;
  if (hide || written.get(element) === transform) return;
  written.set(element, transform);
  element.style.transform = transform;
}

/**
 * Where a name `width` by `height`, centred at (`x`, `centre`), can go clear of the names
 * `placed`: there, or up to two lines above or below; null where none is clear. Where it goes is
 * added to `placed`.
 */
export function roomFor(
  x: number,
  centre: number,
  width: number,
  height: number,
  placed: Box[],
): number | null {
  for (const step of [0, -1, 1, -2, 2]) {
    const y = centre + step * height;
    const box = { x: x - width / 2, y: y - height / 2, w: width, h: height };
    if (clearOf(box, placed)) {
      placed.push(box);
      return y;
    }
  }
  return null;
}

/** A layer's names on Earth's surface, given room in `priority` order (SURFACE_PRIORITY). */
export interface SurfaceSlot {
  readonly priority: number;
  labels: readonly SurfaceLabel[];
}

const projected = new Vector3();

/**
 * Lay out the names on Earth's surface as `camera` sees them, slot by slot in priority order:
 * the larger states' names first, so a crowd of small counts can't take their places, the
 * smaller after, where room is left (#163). Only names on the near side, and none unless `near`;
 * at most `most` from each slot, and none from the slots from `leftOut` on: while the globe
 * turns, each name shown costs a frame's time (#631). Returns how many it shows, of how
 * many, and how many in view were left out so: none, and nothing need be drawn again once
 * the globe stops.
 */
export function layOutSurface(
  slots: readonly SurfaceSlot[],
  camera: Camera,
  view: {
    readonly width: number;
    readonly height: number;
    readonly near: boolean;
    readonly leftOut: number;
    readonly most: number;
  },
): NamesShown & { readonly leftOut: number } {
  const eye = camera.position.clone().normalize();
  const placed: Box[] = [];
  let total = 0;
  let leftOut = 0;
  for (const { priority, labels } of [...slots].sort((a, b) => a.priority - b.priority)) {
    let left = priority < view.leftOut ? view.most : 0;
    total += labels.length;
    for (const { element, position, width, height } of labels) {
      projected.copy(position).project(camera);
      const inView =
        view.near &&
        position.dot(eye) > 0.25 &&
        Math.abs(projected.x) < 1 &&
        Math.abs(projected.y) < 1;
      if (inView && left <= 0) leftOut += 1;
      const shown = inView && left > 0;
      const x = ((projected.x + 1) / 2) * view.width;
      // A name out of view is hidden without looking for room: most are, behind Earth.
      const centre = ((1 - projected.y) / 2) * view.height;
      const y = shown ? roomFor(x, centre, width, height, placed) : null;
      if (y !== null) left -= 1;
      placeLabel(element, y === null ? null : translation(x, y, 'translate(-50%, -50%)'));
    }
  }
  // Each name shown was given room once, so `placed` counts them without asking the page.
  return { shown: placed.length, total, leftOut };
}
