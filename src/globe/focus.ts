/**
 * What the camera can centre on and orbit (#796): a body, or a craft held by the spacecraft
 * layer, named `craft:<id>` beside the bodies. A craft is a few metres across where a body is
 * thousands of kilometres, so the camera's distance is in its own radii either way: half a
 * craft's longest side is its radius.
 */

import type { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { nearestDistance, type Body, type ViewState } from '../state/viewState';
import { BODY_RADIUS } from './bodyRadius';

export type CraftFocus = `craft:${string}`;
export type Focus = Body | CraftFocus;

/** The focus naming the craft with GCAT id `id`, in lower case as a link writes it. */
export function craftFocus(id: string): CraftFocus {
  return `craft:${id.toLowerCase()}`;
}

/** What a view centres on: the craft named, or else the body in focus. */
export function focusOf(state: Pick<ViewState, 'focus' | 'craft'>): Focus {
  return state.craft === null ? state.focus : craftFocus(state.craft);
}

export function isCraft(focus: Focus): focus is CraftFocus {
  return focus.startsWith('craft:');
}

/** The nearest the camera comes to a craft, in its radii: just clear of its longest side. */
const CRAFT_NEAREST = 1.3;

/** The nearest the camera comes to `focus`, in its radii; for Earth, nearer with `tiled`. */
export function nearest(focus: Focus, tiled: boolean): number {
  return isCraft(focus) ? CRAFT_NEAREST : nearestDistance(focus, tiled);
}

/** The scene's usual near plane (Earth radii, 638 m), which a craft close up comes inside. */
const NEAR_PLANE = 1e-4;

/**
 * The near plane, a fiftieth of the way to what the camera looks at, never beyond the scene's
 * usual: by a craft a few metres away it comes in to centimetres, where the bodies never need
 * it. The depth buffer is logarithmic, so the far plane stays where it is. Changed only when it
 * is off by more than half again, so a camera that hardly moves does not remake its projection.
 */
export function nearPlane(camera: PerspectiveCamera, distance: number): void {
  const near = Math.min(NEAR_PLANE, distance / 50);
  if (near > 0 && Math.abs(Math.log(near / camera.near)) > 0.5) {
    camera.near = near;
    camera.updateProjectionMatrix();
  }
}

/** Where something in focus is, and how its own axes turn into the scene's. */
export interface FocusFrame {
  readonly position: Vector3;
  readonly rotation: Quaternion;
}

/** A craft where it is now, as the spacecraft layer holds it for the camera. */
export interface CraftFrame extends FocusFrame {
  /** Its GCAT id, in lower case. */
  readonly id: string;
  /** The body it is about, which the view speaks of and leaving it goes back to. */
  readonly about: Body;
  /** Half its longest side, in scene units (Earth radii). */
  readonly radius: number;
}

export interface FocusFrames {
  readonly frame: (focus: Focus) => FocusFrame;
  /** Whether it can be gone to: a body loaded, a craft held. */
  readonly ready: (focus: Focus) => boolean;
  /** Its radius in scene units, the unit of the camera's distance from it. */
  readonly radius: (focus: Focus) => number;
  /** The body the view speaks of: a body itself, or the one a craft is about. */
  readonly body: (focus: Focus) => Body;
  /** Hold a craft where it is now, or none: `moved` carries what rides with it along. */
  readonly hold: (craft: CraftFrame | null) => void;
}

/** The bodies' frames as the scene has them, and the one craft held, if any. */
export function focusFrames(
  bodies: { frame(body: Body): FocusFrame; ready(body: Body): boolean },
  moved: (move: () => void) => void = (move) => {
    move();
  },
): FocusFrames {
  let held: CraftFrame | null = null;
  const craftOf = (focus: CraftFocus): CraftFrame | null =>
    held !== null && craftFocus(held.id) === focus ? held : null;
  return {
    frame: (focus) =>
      isCraft(focus) ? (craftOf(focus) ?? bodies.frame('earth')) : bodies.frame(focus),
    ready: (focus) => (isCraft(focus) ? craftOf(focus) !== null : bodies.ready(focus)),
    radius: (focus) =>
      isCraft(focus) ? (craftOf(focus)?.radius ?? BODY_RADIUS.earth) : BODY_RADIUS[focus],
    body: (focus) => (isCraft(focus) ? (craftOf(focus)?.about ?? 'earth') : focus),
    hold(craft) {
      moved(() => {
        held = craft;
      });
    },
  };
}
