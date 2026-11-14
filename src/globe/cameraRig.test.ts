import { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { BODY_RADIUS } from './bodyRadius';
import type { CameraWorld, OrbitLike } from './cameraPoses';
import { CameraRig } from './cameraRig';
import { verticalFov } from './projection';
import type { Matrix3 } from '../astro/matrix';
import type { Body, GlobeCamera } from '../state/viewState';

/** Stands in for OrbitControls: it reports a change on every update, as a moving camera does. */
class FakeControls implements OrbitLike {
  readonly target = new Vector3();
  enablePan = true;
  enableDamping = false;
  dampingFactor = 0;
  minDistance = 0;
  maxDistance = Infinity;
  enabled = false;
  zoomSpeed = 1;
  rotateSpeed = 1;
  disposed = false;
  readonly #listeners = new Map<string, (() => void)[]>();
  update(): boolean {
    this.emit('change');
    return true;
  }
  dispose(): void {
    this.disposed = true;
  }
  addEventListener(type: 'start' | 'change', listener: () => void): void {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener]);
  }
  emit(type: 'start' | 'change'): void {
    for (const listener of this.#listeners.get(type) ?? []) listener();
  }
}

interface Setup {
  readonly rig: CameraRig;
  readonly camera: PerspectiveCamera;
  readonly controls: FakeControls;
  readonly container: {
    dataset: Record<string, string>;
    clientWidth: number;
    clientHeight: number;
  };
  readonly positions: Map<Body, Vector3>;
  readonly loaded: Set<Body>;
  readonly state: { moonVisible: boolean; place: Vector3 | null; renders: number };
}

function setUp(
  options: { focus?: Body; start?: GlobeCamera; loaded?: readonly Body[]; tiled?: boolean } = {},
): Setup {
  const positions = new Map<Body, Vector3>([
    ['earth', new Vector3()],
    ['moon', new Vector3(60, 0, 0)],
    ['sun', new Vector3(0, 0, -23_000)],
  ]);
  const loaded = new Set<Body>(options.loaded ?? ['earth', 'moon', 'sun']);
  const state = { moonVisible: true, place: null as Vector3 | null, renders: 0 };
  const world: CameraWorld = {
    frame: (body) => ({
      position: positions.get(body) ?? new Vector3(),
      rotation: new Quaternion(),
    }),
    ready: (body) => loaded.has(body),
    place: () => state.place,
    moonVisible: () => state.moonVisible,
    invalidate: () => {
      state.renders += 1;
    },
  };
  const camera = new PerspectiveCamera(35, 1, 1e-4, 1e6);
  const controls = new FakeControls();
  const container = { dataset: {} as Record<string, string>, clientWidth: 800, clientHeight: 600 };
  const rig = new CameraRig({
    camera,
    container: container as unknown as HTMLElement,
    controls,
    world,
    focus: options.focus ?? 'earth',
    start: options.start ?? { target: { latitude: 0, longitude: 0 }, distance: 3 },
    tiled: options.tiled ?? false,
  });
  return { rig, camera, controls, container, positions, loaded, state };
}

/** Run the frames until every flight has landed. */
function settle(rig: CameraRig): void {
  const later = performance.now() + 10_000;
  rig.step(later);
  rig.step(later + 10_000);
}

describe('the camera rig', () => {
  it('Given a link, When it is placed, Then the camera orbits the body at its distance', () => {
    const { rig, camera, controls, container } = setUp();
    rig.place({ target: { latitude: 0, longitude: 0 }, distance: 3 });
    expect(camera.position.length()).toBeCloseTo(3);
    expect(container.dataset['framed']).toBe('earth');
    expect(container.dataset['focus']).toBe('earth');
    expect(container.dataset['view']).toBe('free');
    expect(controls.enabled).toBe(true);
    expect(controls.enablePan).toBe(false);
    expect(controls.minDistance).toBeCloseTo(1.05);
  });

  it('Given tiles, Then the camera may come nearer to Earth than without', () => {
    const { rig, controls } = setUp({ tiled: true });
    rig.place({ target: { latitude: 0, longitude: 0 }, distance: 3 });
    expect(controls.minDistance).toBeLessThan(1.05);
  });

  it('Given a body not loaded yet, Then Earth is framed until it has, and then the body', () => {
    const { rig, camera, container, loaded } = setUp({ focus: 'moon', loaded: ['earth'] });
    rig.place({ target: { latitude: 0, longitude: 0 }, distance: 4 });
    expect(container.dataset['framed']).toBe('earth');
    loaded.add('moon');
    rig.settleFocus();
    expect(container.dataset['framed']).toBe('moon');
    const fromMoon = camera.position
      .clone()
      .sub(new Vector3(60, 0, 0))
      .length();
    expect(fromMoon).toBeCloseTo(4 * BODY_RADIUS.moon);
  });

  it('Given a zoom past the nearest, Then it glides to the nearest the device allows', () => {
    const { rig, camera } = setUp();
    rig.place({ target: { latitude: 0, longitude: 0 }, distance: 3 });
    rig.zoomTo(0.5);
    settle(rig);
    expect(camera.position.length()).toBeCloseTo(1.05);
  });

  it('Given a place, When the globe flies to it, Then it faces the camera at the same distance', () => {
    const { rig, camera } = setUp();
    rig.place({ target: { latitude: 0, longitude: 0 }, distance: 3 });
    rig.flyTo({ latitude: 0, longitude: 90 });
    settle(rig);
    expect(camera.position.length()).toBeCloseTo(3);
    const facing = camera.position.clone().normalize();
    expect(Math.abs(facing.x)).toBeLessThan(1e-6);
  });

  it('Given Back to an earlier view of Earth, Then the camera glides there and says so', () => {
    const { rig, camera, controls, container } = setUp();
    rig.place({ target: { latitude: 0, longitude: 0 }, distance: 1.5 });
    rig.glideTo({ target: { latitude: 0, longitude: 90 }, distance: 3 });
    // A glide, not a jump: the first frame has not arrived yet.
    expect(camera.position.length()).toBeCloseTo(1.5);
    settle(rig);
    expect(camera.position.length()).toBeCloseTo(3);
    expect(Math.abs(camera.position.clone().normalize().x)).toBeLessThan(1e-6);
    controls.emit('change');
    expect(container.dataset['distance']).toBe('3.00');
  });

  it('Given a camera around the Moon, When Back names another, Then it is placed at once', () => {
    const { rig, camera } = setUp({ focus: 'moon' });
    rig.place({ target: { latitude: 0, longitude: 0 }, distance: 4 });
    rig.glideTo({ target: { latitude: 0, longitude: 0 }, distance: 6 });
    const fromMoon = camera.position
      .clone()
      .sub(new Vector3(60, 0, 0))
      .length();
    expect(fromMoon).toBeCloseTo(6 * BODY_RADIUS.moon);
  });

  it('Given a grab, Then an automatic flight stops where it is', () => {
    const { rig, camera, controls } = setUp();
    rig.place({ target: { latitude: 0, longitude: 0 }, distance: 3 });
    const before = camera.position.clone();
    rig.flyTo({ latitude: 0, longitude: 90 });
    rig.zoomTo(2);
    controls.emit('start');
    settle(rig);
    expect(camera.position.distanceTo(before)).toBeLessThan(1e-9);
  });

  it('Given an attached viewpoint, Then neither a place nor a zoom moves the camera', () => {
    const { rig, camera } = setUp();
    rig.place({ target: { latitude: 0, longitude: 0 }, distance: 3 });
    rig.setViewpoint('earth-from-moon');
    settle(rig);
    const attached = camera.position.clone();
    rig.flyTo({ latitude: 0, longitude: 90 });
    rig.zoomTo(2);
    settle(rig);
    expect(camera.position.distanceTo(attached)).toBeLessThan(1e-9);
  });

  it('Given no Moon yet, Then a viewpoint waits for it, and starts once it is placed', () => {
    const { rig, state, container } = setUp();
    rig.place({ target: { latitude: 0, longitude: 0 }, distance: 3 });
    state.moonVisible = false;
    rig.setViewpoint('moon-from-earth');
    expect(container.dataset['view']).toBe('free');
    rig.beforeBodiesMove(null);
    rig.afterBodiesMove();
    expect(container.dataset['view']).toBe('free');
    state.moonVisible = true;
    rig.beforeBodiesMove(null);
    rig.afterBodiesMove();
    expect(container.dataset['view']).toBe('moon-from-earth');
    expect(rig.viewpoint).toBe('moon-from-earth');
  });

  it('Given a waiting viewpoint, When the free view is asked for, Then it no longer waits', () => {
    const { rig, state, container } = setUp();
    rig.place({ target: { latitude: 0, longitude: 0 }, distance: 3 });
    state.moonVisible = false;
    rig.setViewpoint('moon-from-earth');
    rig.setViewpoint('free');
    state.moonVisible = true;
    rig.afterBodiesMove();
    expect(container.dataset['view']).toBe('free');
  });

  it('Given an attached viewpoint, When it is released, Then the camera flies to orbit what it looked at', () => {
    const { rig, container, controls } = setUp();
    rig.place({ target: { latitude: 0, longitude: 0 }, distance: 3 });
    expect(rig.release()).toBeNull();
    rig.setViewpoint('moon-from-earth');
    expect(controls.enabled).toBe(false);
    expect(rig.release()).toBe('moon');
    expect(rig.focus).toBe('moon');
    expect(container.dataset['view']).toBe('free');
    settle(rig);
    expect(container.dataset['framed']).toBe('moon');
    expect(controls.enabled).toBe(true);
    rig.setViewpoint('earth-from-here');
    expect(rig.release()).toBe('earth');
  });

  it('Given a place picked, Then the view of the Moon from Earth stands at it', () => {
    const { rig, camera, state } = setUp();
    state.place = new Vector3(1, 0, 0);
    rig.place({ target: { latitude: 0, longitude: 0 }, distance: 3 });
    rig.setViewpoint('moon-from-earth');
    settle(rig);
    expect(camera.position.x).toBeGreaterThan(0.9);
    expect(camera.position.x).toBeLessThan(1.2);
  });

  it('Given the view back at Earth from the Moon, Then the camera stands by the Moon', () => {
    const { rig, camera } = setUp({ focus: 'moon' });
    rig.place({ target: { latitude: 0, longitude: 0 }, distance: 4 });
    rig.setViewpoint('earth-from-here');
    settle(rig);
    expect(camera.position.distanceTo(new Vector3(60, 0, 0))).toBeLessThan(2);
  });

  it('Given the view back at Earth from Earth itself, Then it is seen from the Moon', () => {
    const { rig, camera } = setUp();
    rig.place({ target: { latitude: 0, longitude: 0 }, distance: 3 });
    rig.setViewpoint('earth-from-here');
    settle(rig);
    expect(camera.position.distanceTo(new Vector3(60, 0, 0))).toBeLessThan(2);
  });

  it('Given an attached viewpoint, Then a link only takes effect once the view is free again', () => {
    const { rig, camera } = setUp();
    rig.place({ target: { latitude: 0, longitude: 0 }, distance: 3 });
    rig.setViewpoint('earth-from-moon');
    settle(rig);
    const attached = camera.position.clone();
    rig.place({ target: { latitude: 0, longitude: 0 }, distance: 6 });
    expect(camera.position.distanceTo(attached)).toBeLessThan(1e-9);
  });

  it('Given an attached viewpoint, When the bodies move, Then it rides along with them', () => {
    const { rig, camera, positions } = setUp();
    rig.place({ target: { latitude: 0, longitude: 0 }, distance: 3 });
    rig.setViewpoint('earth-from-moon');
    settle(rig);
    const before = camera.position.clone();
    rig.beforeBodiesMove(null);
    positions.set('moon', new Vector3(0, 60, 0));
    rig.afterBodiesMove();
    expect(camera.position.distanceTo(before)).toBeGreaterThan(1);
  });

  it('Given a body asked for, Then the camera flies there; the same body again changes nothing', () => {
    const { rig, camera, container } = setUp();
    rig.place({ target: { latitude: 0, longitude: 0 }, distance: 3 });
    rig.setFocus('sun');
    settle(rig);
    expect(container.dataset['framed']).toBe('sun');
    const sun = new Vector3(0, 0, -23_000);
    // Arriving from Earth's side, four of its radii out.
    expect(camera.position.distanceTo(sun)).toBeCloseTo(4 * BODY_RADIUS.sun, 3);
    expect(camera.position.z).toBeGreaterThan(sun.z);
    const there = camera.position.clone();
    rig.setFocus('sun');
    settle(rig);
    expect(camera.position.distanceTo(there)).toBeLessThan(1e-6);
  });

  it('Given a body not loaded, When it is asked for, Then the camera waits for it', () => {
    const { rig, container, loaded } = setUp({ loaded: ['earth', 'sun'] });
    rig.place({ target: { latitude: 0, longitude: 0 }, distance: 3 });
    rig.setFocus('moon');
    settle(rig);
    expect(container.dataset['framed']).toBe('earth');
    loaded.add('moon');
    rig.afterBodiesMove();
    expect(container.dataset['framed']).toBe('moon');
  });

  it('Given a far camera, When Earth turns, Then the camera holds still in space', () => {
    const { rig, camera } = setUp();
    rig.place({ target: { latitude: 0, longitude: 0 }, distance: 50 });
    // A quarter turn about the scene's y axis.
    const turn: Matrix3 = [
      [0, 0, 1],
      [0, 1, 0],
      [-1, 0, 0],
    ];
    const before = camera.position.clone();
    rig.beforeBodiesMove(turn);
    expect(camera.position.length()).toBeCloseTo(50);
    expect(camera.position.distanceTo(before)).toBeGreaterThan(1);
  });

  it('Given a near camera, When Earth turns, Then it turns with Earth', () => {
    const { rig, camera } = setUp();
    rig.place({ target: { latitude: 0, longitude: 0 }, distance: 3 });
    const before = camera.position.clone();
    rig.beforeBodiesMove([
      [0, 0, 1],
      [0, 1, 0],
      [-1, 0, 0],
    ]);
    expect(camera.position.distanceTo(before)).toBeLessThan(1e-9);
  });

  it('Given a camera orbiting the Moon, When the Moon moves, Then the camera rides along', () => {
    const { rig, camera, positions, controls } = setUp({ focus: 'moon' });
    rig.place({ target: { latitude: 0, longitude: 0 }, distance: 4 });
    const offset = camera.position.clone().sub(positions.get('moon') ?? new Vector3());
    rig.beforeBodiesMove(null);
    positions.set('moon', new Vector3(0, 60, 0));
    rig.afterBodiesMove();
    const now = camera.position.clone().sub(new Vector3(0, 60, 0));
    expect(now.distanceTo(offset)).toBeLessThan(1e-9);
    expect(controls.target.y).toBe(60);
  });

  it('Given a listener, Then it hears each move relative to the body in focus', () => {
    const { rig, controls, state } = setUp();
    rig.place({ target: { latitude: 0, longitude: 0 }, distance: 3 });
    const heard: GlobeCamera[] = [];
    const stop = rig.onChange((camera) => heard.push(camera));
    const renders = state.renders;
    controls.emit('change');
    expect(heard.at(-1)?.distance).toBeCloseTo(3);
    expect(state.renders).toBeGreaterThan(renders);
    stop();
    controls.emit('change');
    expect(heard).toHaveLength(1);
  });

  it('Given a link nearer than the device allows, Then a new listener hears where it stopped', () => {
    const { rig } = setUp({ start: { target: { latitude: 0, longitude: 0 }, distance: 1.01 } });
    rig.place({ target: { latitude: 0, longitude: 0 }, distance: 1.01 });
    const heard: GlobeCamera[] = [];
    rig.onChange((camera) => heard.push(camera));
    expect(heard).toHaveLength(1);
  });

  it('Given insets, Then they are kept, and the same insets again change nothing', () => {
    const { rig, camera, state } = setUp();
    rig.resize();
    rig.setInsets({ top: 40 });
    expect(rig.insets).toEqual({ top: 40, bottom: 0, right: 0 });
    expect(camera.view?.offsetY).toBe(-20);
    const renders = state.renders;
    rig.setInsets({ top: 40 });
    expect(state.renders).toBe(renders);
  });

  it('When it is disposed, Then so are the controls', () => {
    const { rig, controls } = setUp();
    rig.dispose();
    expect(controls.disposed).toBe(true);
  });
});

describe('the field of view', () => {
  const none = { top: 0, bottom: 0, right: 0 };

  it('Given a landscape screen, Then the narrower side, its height, gets the field of view', () => {
    expect(verticalFov(40, { width: 800, height: 600 }, none, true)).toBeCloseTo(40);
  });

  it('Given a portrait screen, Then the height gets more, so the width gets 40°', () => {
    expect(verticalFov(40, { width: 600, height: 800 }, none, true)).toBeGreaterThan(40);
  });

  it('Given panels over an attached view, Then the lens widens to frame the body in the room left', () => {
    const insets = { top: 100, bottom: 200, right: 0 };
    const free = verticalFov(40, { width: 800, height: 600 }, insets, true);
    const attached = verticalFov(40, { width: 800, height: 600 }, insets, false);
    expect(free).toBeCloseTo(40);
    expect(attached).toBeGreaterThan(free);
  });
});
