/**
 * Where the camera stands for each way of looking (#379): orbiting a body, or attached to a
 * viewpoint that the bodies place. The scene says where the bodies are through a `CameraWorld`.
 */

import { type Quaternion, Vector3 } from 'three';
import { BODY_RADIUS } from './bodyRadius';
import { cameraPosition } from './geo';
import { attachedPose, earthFromPose, type CameraPose } from './spaceFrame';
import type { Body, GlobeCamera, Viewpoint } from '../state/viewState';
import type { Matrix3 } from '../astro/matrix';

const NARROW_SIDE_FOV_DEGREES = 40;

/** What the camera needs to know of the bodies, which the scene owns. */
export interface CameraWorld {
  /** Where a body is and how its surface coordinates turn into the scene's axes. */
  frame(body: Body): { position: Vector3; rotation: Quaternion };
  /** Whether a body has loaded, so the camera can go there. */
  ready(body: Body): boolean;
  /** Where the place picked is, on the ground, or null with none picked. */
  place(): Vector3 | null;
  /** Whether the Moon is placed, which the attached viewpoints look at. */
  moonVisible(): boolean;
  /** Something moved: draw the next frame. */
  invalidate(): void;
}

/** The parts of three's OrbitControls the rig uses, so tests can stand in for them. */
export interface OrbitLike {
  readonly target: Vector3;
  enablePan: boolean;
  enableDamping: boolean;
  dampingFactor: number;
  minDistance: number;
  maxDistance: number;
  enabled: boolean;
  zoomSpeed: number;
  rotateSpeed: number;
  update(): boolean;
  dispose(): void;
  addEventListener(type: 'start' | 'change', listener: () => void): void;
}

/** Rotation along the sphere (a slerp), which also handles flying to the opposite side. */
export interface TurnFlight {
  readonly from: Vector3;
  readonly rotation: Quaternion;
  readonly start: number;
}
/** A flight between viewpoints runs from a fixed pose to a live one, as the bodies keep moving. */
export interface ViewFlight {
  readonly from: CameraPose;
  readonly start: number;
}
/**
 * Distances from the body in focus, in scene units; it starts on the first frame, timed by the
 * frames' own clock (which can run apart from performance.now()).
 */
export interface ZoomFlight {
  readonly from: number;
  readonly to: number;
  start: number | null;
}

/** Ease in and out: a gentle start and landing, fast through the long middle. */
export function easeInOut(progress: number): number {
  return progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
}

/** The pose orbiting `body` from `state`, which is in its radii and its surface's axes. */
export function focusPose(world: CameraWorld, body: Body, state: GlobeCamera): CameraPose {
  const { position, rotation } = world.frame(body);
  const eye = new Vector3(
    ...cameraPosition({ ...state, distance: state.distance * BODY_RADIUS[body] }),
  )
    .applyQuaternion(rotation)
    .add(position);
  return {
    eye: [eye.x, eye.y, eye.z],
    target: [position.x, position.y, position.z],
    fovDegrees: NARROW_SIDE_FOV_DEGREES,
  };
}

/** Where an attached viewpoint stands, as the bodies are now. */
export function attachedLivePose(
  world: CameraWorld,
  viewpoint: Exclude<Viewpoint, 'free'>,
  focus: Body,
): CameraPose {
  // Away from Earth: stand on the body in focus and look back at Earth (from Earth itself,
  // the Moon is the nearest place to look back from).
  if (viewpoint === 'earth-from-here') {
    const body = focus === 'earth' ? 'moon' : focus;
    const { position } = world.frame(body);
    return earthFromPose([position.x, position.y, position.z], BODY_RADIUS[body]);
  }
  // From Earth, stand where the place picked sees the Moon from.
  const moon = world.frame('moon').position;
  const place = world.place();
  return attachedPose(
    viewpoint,
    [moon.x, moon.y, moon.z],
    place === null ? null : [place.x, place.y, place.z],
  );
}

/** `position` turned by `turn`, a rotation in the scene's axes. */
export function turned(turn: Matrix3, position: Vector3): Vector3 {
  const [row0, row1, row2] = turn;
  const { x, y, z } = position;
  return new Vector3(
    row0[0] * x + row0[1] * y + row0[2] * z,
    row1[0] * x + row1[1] * y + row1[2] * z,
    row2[0] * x + row2[1] * y + row2[2] * z,
  );
}
