/**
 * Where the camera stands for each way of looking (#379): orbiting a body, or attached to a
 * viewpoint that the bodies place. The scene says where the bodies are through a `CameraWorld`.
 */

import { type Quaternion, Vector3 } from 'three';
import type { Focus, FocusFrame } from './focus';
import { cameraPosition } from './geo';
import { attachedPose, earthFromPose, type CameraPose } from './spaceFrame';
import {
  CAMERA_DISTANCE_RANGE,
  type Body,
  type GlobeCamera,
  type Viewpoint,
} from '../state/viewState';
import type { Matrix3 } from '../astro/matrix';

const NARROW_SIDE_FOV_DEGREES = 40;

/** What the camera needs to know of the bodies and the craft, which the scene owns. */
export interface CameraWorld {
  /** Where a body or craft is and how its own coordinates turn into the scene's axes. */
  frame(focus: Focus): FocusFrame;
  /** Whether a body has loaded, or a craft is held, so the camera can go there. */
  ready(focus: Focus): boolean;
  /** Its radius in scene units: the camera's distance from it is in these. */
  radius(focus: Focus): number;
  /** The body the view speaks of: a body itself, or the one a craft is about. */
  body(focus: Focus): Body;
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

/** The orbit controls as the rig starts them: no panning, damped, out to the scene's reach. */
export function orbitSettings(controls: OrbitLike, nearest: number): void {
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.5;
  controls.zoomSpeed = 0.8;
  controls.minDistance = nearest;
  controls.maxDistance = CAMERA_DISTANCE_RANGE.max;
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

/** The pose orbiting `focus` from `state`, which is in its radii and its own axes. */
export function focusPose(world: CameraWorld, focus: Focus, state: GlobeCamera): CameraPose {
  const { position, rotation } = world.frame(focus);
  const eye = new Vector3(
    ...cameraPosition({ ...state, distance: state.distance * world.radius(focus) }),
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
    return earthFromPose([position.x, position.y, position.z], world.radius(body));
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
