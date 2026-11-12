/**
 * The camera's lens: the field of view, fixed on the screen's narrower side, and the shift that
 * centres the globe in the space the panels leave free.
 */

import type { PerspectiveCamera } from 'three';

export interface Insets {
  readonly top: number;
  readonly bottom: number;
  readonly right: number;
}

export interface Projection {
  readonly insets: Insets;
  /** The field of view on the narrower side, before widening for an attached view. */
  readonly narrowFov: number;
  setFov(narrowFov: number, free: boolean): void;
  setInsets(next: Partial<Insets>, free: boolean): void;
  resize(free: boolean): void;
}

/**
 * The vertical field of view, in degrees, for `narrowFov` on the narrower side. Attached views
 * (`free` false) frame their body in the space the panels leave, not the whole screen, so the
 * card doesn't cut across the Sun and Moon: the lens widens by how much smaller that is.
 */
export function verticalFov(
  narrowFov: number,
  size: { readonly width: number; readonly height: number },
  insets: Insets,
  free: boolean,
): number {
  const narrow = Math.max(Math.min(size.width, size.height), 1);
  const room = Math.max(Math.min(size.width, size.height - insets.top - insets.bottom), narrow / 4);
  const widen = free ? 1 : Math.max(1, narrow / room);
  const halfAngle = Math.atan(Math.tan((narrowFov / 2) * (Math.PI / 180)) * widen);
  const aspect = size.width / Math.max(size.height, 1);
  return aspect >= 1
    ? (2 * halfAngle * 180) / Math.PI
    : (2 * Math.atan(Math.tan(halfAngle) / aspect) * 180) / Math.PI;
}

export function createProjection(
  camera: PerspectiveCamera,
  container: HTMLElement,
  invalidate: () => void,
): Projection {
  let insets: Insets = { top: 0, bottom: 0, right: 0 };
  let narrowFov = 40;

  function applyFov(free: boolean): void {
    const size = { width: container.clientWidth, height: container.clientHeight };
    camera.fov = verticalFov(narrowFov, size, insets, free);
    camera.updateProjectionMatrix();
    invalidate();
  }

  function resize(free: boolean): void {
    const { clientWidth, clientHeight } = container;
    // Shift the projection so the globe sits centred in the space the panels leave free.
    const [x, y] = [insets.right / 2, (insets.bottom - insets.top) / 2];
    camera.setViewOffset(clientWidth, clientHeight, x, y, clientWidth, clientHeight);
    camera.aspect = clientWidth / Math.max(clientHeight, 1);
    // Fix the field of view on the narrower side, so a camera distance frames the globe the
    // same way on a portrait phone as on a landscape laptop (and shared links look alike).
    applyFov(free);
  }

  return {
    get insets() {
      return insets;
    },
    get narrowFov() {
      return narrowFov;
    },
    setFov(next, free) {
      narrowFov = next;
      applyFov(free);
    },
    setInsets(next, free) {
      const was = JSON.stringify(insets);
      insets = { ...insets, ...next };
      if (JSON.stringify(insets) !== was) resize(free);
    },
    resize,
  };
}
