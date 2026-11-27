/**
 * The camera guided through an event's own time (#1266): each view says where to look from a
 * moment on, and the globe turns there as the clock reaches it. The reader may still turn the
 * globe: the guide then waits, and once they have left it alone for a while it turns back to the
 * view of the moment. With reduced motion it only turns to the first view, as the clock opens,
 * and leaves the rest to the reader.
 */

import type { GeoPoint } from '../../core/geo';

/** Where to look from `from`, seconds since the event, and from how far, in Earth radii. */
export interface GuideView {
  readonly from: number;
  readonly place: GeoPoint;
  readonly distance: number;
}

/** How long the reader leaves the globe alone before the guide turns it back, ms. */
export const IDLE_MS = 8000;

/** What the guide turns: the globe's camera. */
interface Camera {
  flyTo(place: GeoPoint): void;
  zoomTo(distance: number): void;
}

export interface GuideOptions {
  readonly camera: Camera;
  /** Where the reader turns the globe: their touches and wheel there pause the guide. */
  readonly input: EventTarget;
  readonly now?: () => number;
  readonly reduced?: () => boolean;
}

export interface Guide {
  /** The clock is at `seconds`: turn to its view, unless the reader has the globe. */
  at(seconds: number): void;
  end(): void;
}

/** The view at `seconds`: the last to have begun by then, or the first before any has. */
export function viewAt(views: readonly GuideView[], seconds: number): GuideView | undefined {
  let found = views[0];
  for (const view of views) if (view.from <= seconds) found = view;
  return found;
}

const lessMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A guide through `views`, turning `camera` and paused by the reader's hand on `input`. */
export function createGuide(views: readonly GuideView[], options: GuideOptions): Guide {
  const { camera, input, now = () => performance.now(), reduced = lessMotion } = options;
  let shown: GuideView | undefined;
  let touched = -Infinity;
  const hand = (): void => {
    touched = now();
    // Once left alone, turn back to the view of the moment, even if it has not changed.
    shown = undefined;
  };
  const events = ['pointerdown', 'wheel', 'keydown'] as const;
  for (const name of events) input.addEventListener(name, hand, { passive: true });
  let moved = false;
  return {
    at(seconds) {
      if (moved && reduced()) return;
      if (now() - touched < IDLE_MS) return;
      const view = viewAt(views, seconds);
      if (view === undefined || view === shown) return;
      shown = view;
      moved = true;
      camera.flyTo(view.place);
      camera.zoomTo(view.distance);
    },
    end() {
      for (const name of events) input.removeEventListener(name, hand);
    },
  };
}
