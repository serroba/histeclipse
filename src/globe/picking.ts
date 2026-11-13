/**
 * Picking with the pointer (#379): a click (a press that barely moves) on a body asks to fly to
 * it, on Earth in view it picks the place to stand, and on empty space it says so; dragging or
 * zooming an attached viewpoint releases it. Taps on the layers' markers are picked by key.
 */

import { Raycaster, Vector2, type Camera, type Mesh } from 'three';

import type { Body, GeoPoint, Viewpoint } from '../state/viewState';
import { vectorToGeo } from './geo';

/** A press that moves less than this (pixels) is a click on a body, not a drag. */
const CLICK_SLOP_PIXELS = 6;

/** What the pointer events need of the canvas. */
interface PickSurface extends EventTarget {
  getBoundingClientRect(): { left: number; top: number; width: number; height: number };
}

export interface PickingWorld {
  readonly canvas: PickSurface;
  readonly camera: Camera;
  readonly meshes: Readonly<Record<Body, Mesh>>;
  /** In deep time only Earth can be picked: the others are where they are today. */
  deepTime(): boolean;
  focus(): Body;
  viewpoint(): Viewpoint;
  /** Release an attached viewpoint: the body it hands over to, or null if none was attached. */
  release(): Body | null;
}

type Listeners<Argument> = Set<(argument: Argument) => void>;

function subscribe<Argument>(
  listeners: Listeners<Argument>,
  listener: (argument: Argument) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export class Picking {
  readonly #world: PickingWorld;
  readonly #bodyClick: Listeners<Body> = new Set();
  readonly #place: Listeners<GeoPoint> = new Set();
  readonly #emptyTap: Listeners<undefined> = new Set();
  readonly #markerPick: Listeners<string> = new Set();
  readonly #raycaster = new Raycaster();
  #press: { x: number; y: number } | null = null;

  constructor(world: PickingWorld) {
    this.#world = world;
    const { canvas } = world;
    canvas.addEventListener('pointerdown', (event) => {
      const { clientX, clientY } = event as PointerEvent;
      this.#press = { x: clientX, y: clientY };
    });
    // Dragging or zooming an attached viewpoint releases it: the camera flies to orbit the body
    // it was looking at, from the observer's side, so the bodies can be turned again.
    canvas.addEventListener('pointermove', (event) => {
      if (this.#movedFar(event as PointerEvent)) this.#releaseViewpoint();
    });
    canvas.addEventListener(
      'wheel',
      () => {
        this.#releaseViewpoint();
      },
      { passive: true },
    );
    canvas.addEventListener('pointerup', (event) => {
      this.#tap(event as PointerEvent);
    });
  }

  /** Called when someone clicks a body other than the one in focus, or grabs a viewpoint. */
  onBodyClick(listener: (body: Body) => void): () => void {
    return subscribe(this.#bodyClick, listener);
  }

  /** Called when someone taps empty space, away from every body. */
  onEmptyTap(listener: () => void): () => void {
    return subscribe(this.#emptyTap, listener);
  }

  /** Called when someone taps a place on Earth while looking at it: where to stand. */
  onPlacePick(listener: (place: GeoPoint) => void): () => void {
    return subscribe(this.#place, listener);
  }

  /** Called when someone taps a marker that has a card, with its key (such as `impact:47`). */
  onMarkerPick(listener: (key: string) => void): () => void {
    return subscribe(this.#markerPick, listener);
  }

  /** Ask to fly to `body`, unless the camera already orbits it. */
  requestBody(body: Body): void {
    if (body === this.#world.focus() && this.#world.viewpoint() === 'free') return;
    for (const listener of this.#bodyClick) listener(body);
  }

  /** Taps on `[data-pick]` inside `layer` reach the marker-pick listeners. */
  pickable(layer: HTMLElement): void {
    layer.addEventListener('click', (event) => {
      const marker = event.target instanceof Element ? event.target.closest('[data-pick]') : null;
      const key = marker?.getAttribute('data-pick');
      if (key === null || key === undefined) return;
      for (const listener of this.#markerPick) listener(key);
    });
  }

  #movedFar(event: PointerEvent): boolean {
    if (this.#press === null) return false;
    const moved = Math.hypot(event.clientX - this.#press.x, event.clientY - this.#press.y);
    return moved > CLICK_SLOP_PIXELS;
  }

  #releaseViewpoint(): void {
    const body = this.#world.release();
    if (body !== null) for (const listener of this.#bodyClick) listener(body);
  }

  #tap(event: PointerEvent): void {
    if (this.#press === null) return;
    const far = this.#movedFar(event);
    this.#press = null;
    if (far) return;
    const { canvas, camera, meshes } = this.#world;
    const bounds = canvas.getBoundingClientRect();
    this.#raycaster.setFromCamera(
      new Vector2(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      ),
      camera,
    );
    const deepTime = this.#world.deepTime();
    const visible = Object.values(meshes).filter(
      (mesh) => mesh.visible && !(deepTime && mesh !== meshes.earth),
    );
    const hit = this.#raycaster.intersectObjects(visible, false)[0];
    const body = (Object.keys(meshes) as Body[]).find((key) => meshes[key] === hit?.object);
    if (
      body === 'earth' &&
      hit !== undefined &&
      this.#world.focus() === 'earth' &&
      this.#world.viewpoint() === 'free'
    ) {
      // On the Earth already in view, a tap picks the place to stand.
      const { x, y, z } = meshes.earth.worldToLocal(hit.point.clone());
      const place = vectorToGeo([x, y, z]);
      for (const listener of this.#place) listener(place);
      return;
    }
    if (body !== undefined) {
      this.requestBody(body);
      return;
    }
    // Markers are HTML on top of the canvas, so a tap here missed them too.
    for (const listener of this.#emptyTap) listener(undefined);
  }
}
