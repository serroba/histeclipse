/**
 * Where the globe's camera is (#379): the body it orbits, the viewpoint it may be attached to,
 * the orbit controls and the flights between all of these. The scene owns the bodies and says
 * where each one is through a `CameraWorld`; the rig only moves the camera.
 */

import { type PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { BODY_RADIUS } from './bodyRadius';
import {
  attachedLivePose,
  easeInOut,
  focusPose,
  turned,
  type CameraWorld,
  type OrbitLike,
  type TurnFlight,
  type ViewFlight,
  type ZoomFlight,
} from './cameraPoses';
import { controlSpeeds } from './controlSpeeds';
import { cameraFromPosition, geoToVector } from './geo';
import { createProjection, type Insets, type Projection } from './projection';
import { blendPose, type CameraPose } from './spaceFrame';
import {
  CAMERA_DISTANCE_RANGE,
  DEFAULT_CAMERA,
  nearestDistance,
  type Body,
  type GeoPoint,
  type GlobeCamera,
  type Viewpoint,
} from '../state/viewState';
import type { Matrix3 } from '../astro/matrix';
import type { StagePart } from '../stage/stage';

const FLIGHT_MS = 900;
/** A zoom from one stop to another, however far: eased in log distance, so it reads as one move. */
const ZOOM_MS = 1200;
/** Flights between viewpoints cross up to 60 Earth radii: quick, but long enough to follow. */
const VIEW_FLIGHT_MS = 1600;
/** Arriving at a body, the camera stops this many of its radii from the centre. */
const FOCUS_DISTANCE = 4;
/** Beyond this distance (Earth radii) the view holds still in space and Earth turns in it. */
const INERTIAL_VIEW_DISTANCE = 20;

export interface CameraRigOptions {
  readonly camera: PerspectiveCamera;
  readonly container: HTMLElement;
  readonly controls: OrbitLike;
  readonly world: CameraWorld;
  readonly focus: Body;
  /** Where the camera starts, relative to `focus`. */
  readonly start: GlobeCamera;
  /** Whether Earth's tiles let the camera come closest (#578). */
  readonly tiled: boolean;
}

export class CameraRig implements StagePart {
  #viewpoint: Viewpoint = 'free';
  #pendingViewpoint: Viewpoint | null = null;
  #focus: Body;
  /** A focus asked for before its body loaded; the camera is placed there once it has. */
  #pendingFocus: boolean;
  /** Where the camera orbits, relative to the body in focus; kept while a viewpoint is attached. */
  #focusCamera: GlobeCamera;
  /** Noted before the bodies move, for a camera that rides along with its body. */
  #riding: GlobeCamera | null = null;
  #turn: TurnFlight | null = null;
  #view: ViewFlight | null = null;
  #zoom: ZoomFlight | null = null;
  readonly #lookTarget = new Vector3();
  readonly #listeners = new Set<(camera: GlobeCamera) => void>();
  readonly #camera: PerspectiveCamera;
  readonly #container: HTMLElement;
  readonly #controls: OrbitLike;
  readonly #world: CameraWorld;
  readonly #tiled: boolean;
  readonly #projection: Projection;

  constructor(options: CameraRigOptions) {
    this.#camera = options.camera;
    this.#container = options.container;
    this.#controls = options.controls;
    this.#world = options.world;
    this.#tiled = options.tiled;
    this.#focus = options.focus;
    this.#focusCamera = options.start;
    this.#pendingFocus = !options.world.ready(options.focus);
    this.#projection = createProjection(options.camera, options.container, () => {
      options.world.invalidate();
    });
    this.#container.dataset['view'] = this.#viewpoint;
    this.#container.dataset['focus'] = this.#focus;
    this.#setUpControls();
  }

  get focus(): Body {
    return this.#focus;
  }

  get viewpoint(): Viewpoint {
    return this.#viewpoint;
  }

  get insets(): Insets {
    return this.#projection.insets;
  }

  /** Advance the flights and the controls by a frame; it asks for drawings itself, so false. */
  step(now: number): boolean {
    if (this.#view !== null) this.#stepView(now, this.#view);
    else if (this.#turn !== null) this.#stepTurn(now, this.#turn);
    if (this.#zoom !== null && this.#view === null) this.#stepZoom(now, this.#zoom);
    const controls = this.#controls;
    const distance = this.#camera.position.distanceTo(controls.target);
    const speeds = controlSpeeds(distance, BODY_RADIUS[this.#focus]);
    controls.zoomSpeed = speeds.zoom;
    controls.rotateSpeed = speeds.rotate;
    // update() keeps damping going after the pointer is released; it reports movement via 'change'.
    if (controls.enabled) controls.update();
    return false;
  }

  setFocus(body: Body): void {
    if (body === this.#focus && this.#viewpoint === 'free') return;
    this.#flyToFocus(body);
  }

  setViewpoint(next: Viewpoint): void {
    if (next === 'free') this.#pendingViewpoint = null;
    if (next === this.#viewpoint) return;
    if (next !== 'free' && (!this.#world.moonVisible() || !this.#world.ready(this.#focus))) {
      this.#pendingViewpoint = next;
      return;
    }
    this.#startViewFlight(next);
  }

  /** Turn the globe smoothly so `target` faces the camera, keeping the distance. */
  flyTo(target: GeoPoint): void {
    // Attached viewpoints are placed by the bodies, not by places on the ground.
    if (this.#viewpoint !== 'free' || this.#focus !== 'earth') return;
    const from = this.#camera.position.clone().normalize();
    const to = new Vector3(...geoToVector(target)).normalize();
    const rotation = new Quaternion().setFromUnitVectors(from, to);
    this.#turn = { from, rotation, start: performance.now() };
  }

  /** Glide to `distance` from the body in focus, in its radii, keeping the direction. */
  zoomTo(distance: number): void {
    if (this.#viewpoint !== 'free') return;
    const { minDistance, maxDistance, target } = this.#controls;
    const to = Math.min(Math.max(distance * BODY_RADIUS[this.#focus], minDistance), maxDistance);
    this.#zoom = { from: this.#camera.position.distanceTo(target), to, start: null };
    this.#world.invalidate();
  }

  /** Glide to `state` (#581): on Earth a turn and a zoom together; elsewhere, placed at once. */
  glideTo(state: GlobeCamera): void {
    if (this.#viewpoint !== 'free') return;
    if (this.#focus !== 'earth' || this.#pendingFocus) {
      this.place(state);
      return;
    }
    this.flyTo(state.target);
    this.zoomTo(state.distance);
  }

  /** Put the camera where a link says, relative to the body in focus. */
  place(state: GlobeCamera): void {
    this.#focusCamera = state;
    if (this.#viewpoint !== 'free') return;
    if (!this.#world.ready(this.#focus)) {
      // Hold the usual view of Earth until the body arrives.
      this.#applyPose(focusPose(this.#world, 'earth', DEFAULT_CAMERA));
      this.#container.dataset['framed'] = 'earth';
      return;
    }
    this.#applyPose(focusPose(this.#world, this.#focus, state));
    this.#container.dataset['framed'] = this.#focus;
    this.#orbitFocus();
  }

  /** A drag or a wheel on an attached viewpoint: fly to orbit the body it looked at. */
  release(): Body | null {
    // Also mid-flight: a grab on the way in is a change of mind.
    if (this.#viewpoint === 'free') return null;
    const body: Body = this.#viewpoint === 'moon-from-earth' ? 'moon' : 'earth';
    this.#flyToFocus(body);
    return body;
  }

  setInsets(next: Partial<Insets>): void {
    this.#projection.setInsets(next, this.#viewpoint === 'free');
  }

  resize(): void {
    this.#projection.resize(this.#viewpoint === 'free');
  }

  /**
   * Before the bodies move: turn a far camera by `turn` (Earth's turn since the last moment, in
   * the scene's axes) so it keeps its place in space, and note where a camera orbiting the Moon
   * or Sun is relative to it. Once they have moved, `afterBodiesMove` carries it along.
   */
  beforeBodiesMove(turn: Matrix3 | null): void {
    const free = this.#viewpoint === 'free' && this.#view === null;
    const far = this.#camera.position.length() > INERTIAL_VIEW_DISTANCE;
    if (turn !== null && this.#focus === 'earth' && free && far && this.#turn === null) {
      this.#camera.position.copy(turned(turn, this.#camera.position));
      // The next frame's controls.update() reports the move. Reporting it here would reach the
      // app while it is still rendering this moment, and the stale camera would win.
      this.#camera.lookAt(0, 0, 0);
    }
    const riding = this.#focus !== 'earth' && free && !this.#pendingFocus;
    this.#riding = riding ? this.#relativeCamera() : null;
  }

  afterBodiesMove(): void {
    if (this.#riding !== null) {
      // The next frame's controls.update() reports the move (see beforeBodiesMove).
      this.#applyPose(focusPose(this.#world, this.#focus, this.#riding));
      this.#controls.target.copy(this.#world.frame(this.#focus).position);
      this.#riding = null;
    }
    this.settleFocus();
    if (this.#pendingViewpoint !== null && this.#world.moonVisible()) {
      this.#startViewFlight(this.#pendingViewpoint);
      this.#pendingViewpoint = null;
    } else if (this.#viewpoint !== 'free' && this.#view === null) {
      // Attached viewpoints ride along with the bodies.
      this.#applyPose(this.#livePose());
    }
  }

  /** Once the body a link centres on has arrived, go straight there, as the link describes. */
  settleFocus(): void {
    if (!this.#pendingFocus || !this.#world.ready(this.#focus)) return;
    this.#pendingFocus = false;
    if (this.#viewpoint === 'free') this.place(this.#focusCamera);
  }

  /** Called while the user moves the camera, relative to the body in focus. */
  onChange(listener: (camera: GlobeCamera) => void): () => void {
    this.#listeners.add(listener);
    // A link nearer than this device lets the camera come (#578): say where it stopped.
    const held = this.#focusCamera.distance < nearestDistance(this.#focus, this.#tiled);
    if (held && this.#viewpoint === 'free' && this.#world.ready(this.#focus)) {
      listener(this.#relativeCamera());
    }
    return () => this.#listeners.delete(listener);
  }

  dispose(): void {
    this.#controls.dispose();
  }

  #setUpControls(): void {
    const controls = this.#controls;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 0.8;
    controls.minDistance = nearestDistance('earth', this.#tiled);
    controls.maxDistance = CAMERA_DISTANCE_RANGE.max;
    // Grabbing the globe cancels an automatic flight.
    controls.addEventListener('start', () => {
      this.#turn = null;
      this.#zoom = null;
    });
    controls.addEventListener('change', () => {
      this.#world.invalidate();
      const state = this.#relativeCamera();
      // Where the camera really is (#581); a link's cam= says where it should be.
      this.#container.dataset['distance'] = state.distance.toPrecision(3);
      for (const listener of this.#listeners) listener(state);
    });
  }

  /** The camera relative to the body in focus. */
  #relativeCamera(): GlobeCamera {
    const { position, rotation } = this.#world.frame(this.#focus);
    const local = this.#camera.position
      .clone()
      .sub(position)
      .applyQuaternion(rotation.clone().invert())
      .divideScalar(BODY_RADIUS[this.#focus]);
    return cameraFromPosition([local.x, local.y, local.z]);
  }

  #currentPose(): CameraPose {
    const { x, y, z } = this.#camera.position;
    const look = this.#lookTarget;
    return {
      eye: [x, y, z],
      target: [look.x, look.y, look.z],
      fovDegrees: this.#projection.narrowFov,
    };
  }

  #livePose(): CameraPose {
    const viewpoint = this.#viewpoint;
    if (viewpoint === 'free') return focusPose(this.#world, this.#focus, this.#focusCamera);
    return attachedLivePose(this.#world, viewpoint, this.#focus);
  }

  #applyPose(pose: CameraPose): void {
    this.#camera.position.set(...pose.eye);
    this.#lookTarget.set(...pose.target);
    this.#camera.lookAt(this.#lookTarget);
    this.#projection.setFov(pose.fovDegrees, this.#viewpoint === 'free');
  }

  /** Hand the camera to the orbit controls, centred on the body in focus. */
  #orbitFocus(): void {
    const controls = this.#controls;
    const radius = BODY_RADIUS[this.#focus];
    controls.target.copy(this.#world.frame(this.#focus).position);
    controls.minDistance = nearestDistance(this.#focus, this.#tiled) * radius;
    controls.maxDistance = Math.min(CAMERA_DISTANCE_RANGE.max * radius, CAMERA_DISTANCE_RANGE.max);
    controls.enabled = true;
    controls.update();
  }

  /**
   * Centre on a body and fly there, arriving a few radii out on the side facing the camera, or
   * for the Sun on the side facing Earth: the side SDO saw last, with the corona around it.
   */
  #flyToFocus(body: Body): void {
    const from = this.#currentPose();
    const { position, rotation } = this.#world.frame(body);
    const toward = (body === 'sun' ? new Vector3() : this.#camera.position.clone())
      .sub(position)
      .applyQuaternion(rotation.clone().invert());
    this.#focus = body;
    this.#pendingFocus = !this.#world.ready(body);
    this.#focusCamera = {
      target: cameraFromPosition([toward.x, toward.y, toward.z]).target,
      distance: body === 'earth' ? DEFAULT_CAMERA.distance : FOCUS_DISTANCE,
    };
    this.#container.dataset['focus'] = body;
    this.#viewpoint = 'free';
    this.#container.dataset['view'] = 'free';
    this.#pendingViewpoint = null;
    this.#turn = null;
    this.#controls.enabled = false;
    if (this.#pendingFocus) return;
    this.#view = { from, start: performance.now() };
  }

  #startViewFlight(next: Viewpoint): void {
    const from = this.#currentPose();
    if (this.#viewpoint === 'free' && this.#view === null) {
      this.#focusCamera = this.#relativeCamera();
    }
    this.#viewpoint = next;
    this.#turn = null;
    this.#view = { from, start: performance.now() };
    // Orbiting resumes once a flight back to the free view lands.
    this.#controls.enabled = false;
    this.#container.dataset['view'] = next;
  }

  #stepView(now: number, flight: ViewFlight): void {
    const progress = Math.min(1, (now - flight.start) / VIEW_FLIGHT_MS);
    this.#applyPose(blendPose(flight.from, this.#livePose(), easeInOut(progress)));
    if (progress < 1) return;
    this.#view = null;
    // Orbit controls report the landing, which puts the camera in the link.
    if (this.#viewpoint === 'free') {
      this.#container.dataset['framed'] = this.#focus;
      this.#orbitFocus();
    }
  }

  #stepTurn(now: number, flight: TurnFlight): void {
    const progress = Math.min(1, (now - flight.start) / FLIGHT_MS);
    const eased = 1 - (1 - progress) ** 3;
    const distance = this.#camera.position.length();
    const step = new Quaternion().slerp(flight.rotation, eased);
    this.#camera.position.copy(flight.from).applyQuaternion(step).setLength(distance);
    if (progress === 1) this.#turn = null;
  }

  #stepZoom(now: number, flight: ZoomFlight): void {
    flight.start ??= now;
    const progress = Math.min(1, (now - flight.start) / ZOOM_MS);
    const length = flight.from * (flight.to / flight.from) ** easeInOut(progress);
    const { target } = this.#controls;
    const offset = this.#camera.position.clone().sub(target).setLength(length);
    // The controls report the move, which puts the camera in the link.
    this.#camera.position.copy(target).add(offset);
    this.#world.invalidate();
    if (progress === 1) this.#zoom = null;
  }
}
