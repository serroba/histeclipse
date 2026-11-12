/**
 * How the sky is handled: dragging turns the view, a wheel or a pinch zooms, and a press that
 * barely moves is a tap. Touch and mouse share pointer events.
 */

import type { SkyLook } from '../state/viewState';
import { dragLook, zoomLook } from './look';

/** A pointer moves at least this far (pixels) before the view follows it. */
const DRAG_SLOP_PIXELS = 3;
/** A press that moves less than this (pixels) in all is a tap, not a drag. */
const TAP_SLOP_PIXELS = 6;

/** What the gestures read and move. */
export interface SkyGestureTarget<Tapped> {
  look(): SkyLook;
  /** The reader turned or zoomed the view. */
  setLook(next: SkyLook): void;
  /** Pixels per degree at the centre of the view, as it is now. */
  pixelsPerDegree(): number;
  /** What is under a point of the page, if anything a tap goes to. */
  bodyAt(clientX: number, clientY: number): Tapped | null;
  /** A tap ended: on what is under it, or null for the sky itself. */
  tapped(tapped: Tapped | null): void;
}

/** Turn, zoom and tap the sky drawn in `element`. */
export function attachSkyGestures<Tapped>(
  element: HTMLElement,
  target: SkyGestureTarget<Tapped>,
): void {
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch: number | null = null;
  // A single press that has not moved far yet: a tap if it ends here.
  let tap: { id: number; x: number; y: number } | null = null;
  element.addEventListener('pointerdown', (event) => {
    element.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    pinch = null;
    tap = pointers.size === 1 ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
  });
  element.addEventListener('pointermove', (event) => {
    const last = pointers.get(event.pointerId);
    if (last === undefined) {
      // Hovering with a mouse: a hand over a body says a click goes to it.
      if (event.pointerType === 'mouse') {
        element.style.cursor =
          target.bodyAt(event.clientX, event.clientY) === null ? '' : 'pointer';
      }
      return;
    }
    const current = { x: event.clientX, y: event.clientY };
    if (tap !== null && Math.hypot(current.x - tap.x, current.y - tap.y) > TAP_SLOP_PIXELS) {
      tap = null;
    }
    if (pointers.size === 2) {
      pointers.set(event.pointerId, current);
      const [a, b] = [...pointers.values()];
      if (a === undefined || b === undefined) return;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch !== null && distance > 0) target.setLook(zoomLook(target.look(), pinch / distance));
      pinch = distance;
      return;
    }
    const dx = current.x - last.x;
    const dy = current.y - last.y;
    if (Math.hypot(dx, dy) < DRAG_SLOP_PIXELS) return;
    pointers.set(event.pointerId, current);
    // The sky follows the pointer at the centre's scale: dragLook turns by fov per `height`.
    const look = target.look();
    target.setLook(dragLook(look, dx, dy, look.fov * target.pixelsPerDegree()));
  });
  const release = (event: PointerEvent): void => {
    pointers.delete(event.pointerId);
    pinch = null;
  };
  element.addEventListener('pointerup', (event) => {
    release(event);
    if (tap?.id !== event.pointerId) return;
    tap = null;
    target.tapped(target.bodyAt(event.clientX, event.clientY));
  });
  element.addEventListener('pointercancel', (event) => {
    release(event);
    tap = null;
  });
  element.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      target.setLook(zoomLook(target.look(), Math.exp(event.deltaY * 0.0015)));
    },
    { passive: false },
  );
}
