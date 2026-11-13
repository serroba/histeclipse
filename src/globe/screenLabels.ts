/**
 * What the globe writes over its picture (#379): a marker ring and name for each body, names
 * on Earth's surface from the layers, and the layers' names in space, each kept clear of the
 * others and of the panels.
 */

import { Vector3, type Object3D, type PerspectiveCamera } from 'three';

import { PLANETS, type PlanetName } from '../astro/planets';
import type { Body, GeoPoint } from '../state/viewState';
import { CameraMotion } from './cameraMotion';
import { geoToVector } from './geo';
import { layOutSurface, placeLabel, type SurfaceSlot, translation } from './labelWrites';
import { type LayerHost, SURFACE_PRIORITY, type SurfaceLabel } from './layerHost';
import { PLANET_NAMES, planetRadius } from './planetLook';
import {
  apparentRadiusPixels,
  clearOf,
  type Box,
  hiddenBehind,
  mergeMarkers,
  MOON_RADIUS_EARTH_RADII,
  SUN_RADIUS_EARTH_RADII,
  type ScreenDisc,
  type ScreenMarker,
} from './spaceFrame';

/** Bodies smaller than this on screen (radius, pixels) get a marker ring. */
const MARKER_RADIUS_PIXELS = 3;
/** Bodies larger than this on screen (radius, pixels) are plain to see and go unlabelled. */
const LABEL_MAX_RADIUS_PIXELS = 60;
/** Discs at least this large on screen (radius, pixels) hide the markers of planets behind. */
const OCCLUDING_RADIUS_PIXELS = 10;
/** Markers closer than this on screen (pixels) are shown as one. */
const MERGE_PIXELS = 40;
/** At most this many names from each layer on Earth's surface while the globe turns (#631). */
const TURNING_NAMES = 30;

/** The bodies that get a marker. */
type Marked = 'earth' | 'moon' | 'sun' | PlanetName;

export interface ScreenLabelsWorld {
  readonly container: HTMLElement;
  readonly camera: PerspectiveCamera;
  readonly meshes: Readonly<Record<Marked, Object3D>>;
  /** The body the camera orbits. */
  focus(): Body;
  /** Pixels the panels cover at the top and bottom. */
  insets(): { readonly top: number; readonly bottom: number };
  /** A marker was tapped. */
  requestBody(body: Body): void;
  invalidate(): void;
}

/** A ring and name marking where a body is; sized to the body, never smaller than a dot. */
function spaceMarker(layer: HTMLElement, name: string, body: string): HTMLElement {
  const marker = document.createElement('div');
  marker.className = `space-marker is-${body}`;
  marker.dataset['body'] = body;
  marker.hidden = true;
  const label = document.createElement('span');
  label.textContent = name;
  marker.append(label);
  layer.append(marker);
  return marker;
}

function setLabel(marker: HTMLElement, name: string): void {
  const label = marker.querySelector('span');
  if (label !== null && label.textContent !== name) label.textContent = name;
}

/**
 * Read every label's size, then hide them all: one layout for the lot. Hiding one between
 * reads would make the browser lay the page out again for the next, label after label.
 */
export function settleSizes(labels: readonly SurfaceLabel[]): void {
  for (const entry of labels) {
    entry.width = entry.element.offsetWidth;
    entry.height = entry.element.offsetHeight;
  }
  for (const entry of labels) {
    entry.element.hidden = true;
    entry.element.style.visibility = '';
  }
}

/** Labels laid out once, unseen, so their real sizes are known for keeping them apart. */
function measured(
  layer: HTMLElement,
  entries: readonly { readonly element: HTMLElement; readonly point: GeoPoint }[],
): SurfaceLabel[] {
  const labels = entries.map(({ element, point }) => {
    element.style.visibility = 'hidden';
    layer.append(element);
    return { element, position: new Vector3(...geoToVector(point, 1.01)), width: 0, height: 0 };
  });
  settleSizes(labels);
  return labels;
}

export class ScreenLabels {
  readonly #world: ScreenLabelsWorld;
  readonly #layer: HTMLElement;
  readonly #markers: Readonly<Record<Marked, HTMLElement>>;
  /** Labels on Earth's surface from the layers, each slot laid out in its priority's place. */
  readonly #surfaceSlots: SurfaceSlot[] = [];
  readonly #projected = new Vector3();
  /** The view's size, told on resize: read each frame, it forced style and layout (#631). */
  #width: number;
  #height: number;
  readonly #motion: CameraMotion;
  /** Whether the camera moved lately: then fewer names are shown (#631). */
  #turning = false;

  constructor(world: ScreenLabelsWorld) {
    this.#world = world;
    // Once the view settles, a frame to show every name again.
    this.#motion = new CameraMotion(() => {
      world.invalidate();
    });
    this.#width = world.container.clientWidth;
    this.#height = world.container.clientHeight;
    const layer = document.createElement('div');
    layer.className = 'space-markers';
    world.container.append(layer);
    this.#layer = layer;
    this.#markers = {
      earth: spaceMarker(layer, 'Earth', 'earth'),
      moon: spaceMarker(layer, 'Moon', 'moon'),
      sun: spaceMarker(layer, 'Sun', 'sun'),
      mercury: spaceMarker(layer, PLANET_NAMES.mercury, 'mercury'),
      venus: spaceMarker(layer, PLANET_NAMES.venus, 'venus'),
      mars: spaceMarker(layer, PLANET_NAMES.mars, 'mars'),
      jupiter: spaceMarker(layer, PLANET_NAMES.jupiter, 'jupiter'),
      saturn: spaceMarker(layer, PLANET_NAMES.saturn, 'saturn'),
    };
    for (const [body, marker] of Object.entries(this.#markers)) {
      marker.addEventListener('click', () => {
        world.requestBody(body as Body);
      });
    }
  }

  /** A layer's pins on Earth's surface, measured once and laid out with the others. */
  readonly surfaceLabels: LayerHost['surfaceLabels'] = (priority, layer) => {
    const slot: SurfaceSlot = { priority, labels: [] };
    this.#surfaceSlots.push(slot);
    return {
      show: (pins) => {
        layer.replaceChildren();
        slot.labels = pins === null ? [] : measured(layer, pins);
        // Placed now, not at the next frame: as time plays, that frame may lay them out again.
        this.#layOutSurface();
        this.#world.invalidate();
      },
      move: (points) => {
        points.forEach((point, index) => {
          slot.labels[index]?.position.set(...geoToVector(point, 1.01));
        });
        this.#layOutSurface();
        this.#world.invalidate();
      },
    };
  };

  /** A place for labels a layer makes and keeps itself, laid out with the others. */
  readonly surfaceSlot: LayerHost['surfaceSlot'] = (priority) => {
    const slot: SurfaceSlot = { priority, labels: [] };
    this.#surfaceSlots.push(slot);
    return {
      set: (labels) => {
        slot.labels = labels;
        this.#layOutSurface();
        this.#world.invalidate();
      },
    };
  };

  /** Show each name, in order, where it is on screen, clear of the panels and of those shown. */
  readonly layOutNames: LayerHost['layOutNames'] = (names, layer) => {
    const { camera } = this.#world;
    const insets = this.#world.insets();
    const viewWidth = this.#width;
    const viewHeight = this.#height;
    const placed: Box[] = [];
    let count = 0;
    for (const { scene: at, label } of names) {
      if (label === undefined) continue;
      const projected = this.#projected.copy(at).project(camera);
      const x = ((projected.x + 1) / 2) * viewWidth;
      const y = ((1 - projected.y) / 2) * viewHeight;
      const box = { x, y: y - label.height / 2, w: label.width, h: label.height };
      const visible =
        projected.z < 1 &&
        box.x >= 0 &&
        box.x + box.w <= viewWidth &&
        // Clear of the panels above and below the view, where a name could not be tapped.
        box.y >= insets.top &&
        box.y + box.h <= viewHeight - insets.bottom &&
        clearOf(box, placed);
      placeLabel(label.element, visible ? translation(x, y, 'translate(0, -50%)') : null);
      if (!visible) continue;
      placed.push(box);
      count += 1;
    }
    layer.dataset['named'] = String(count);
  };

  /** Each frame: the names on Earth's surface; while the camera moves, fewer of them. */
  placeSurfaceLabels(): void {
    this.#turning = this.#motion.turning(this.#world.camera, performance.now());
    this.#layOutSurface();
  }

  /** Lay out the layers' names on Earth's surface, on the near side only. */
  #layOutSurface(): void {
    const { camera } = this.#world;
    // Only while Earth is in focus and fills enough of the view.
    const near = this.#world.focus() === 'earth' && camera.position.length() < 12;
    // While it turns, only the larger states' names, and a few of each layer's (#631).
    const leftOut = this.#turning ? SURFACE_PRIORITY.minorStates : Infinity;
    const most = this.#turning ? TURNING_NAMES : Infinity;
    const view = { width: this.#width, height: this.#height, near, leftOut, most };
    layOutSurface(this.#surfaceSlots, camera, view);
  }

  /** Ring and name each body small on screen; one name for those that line up. */
  placeMarkers(): void {
    const onScreen = this.#markersOnScreen();
    // Planets behind a nearer body's disc get no marker. Earth, Moon and Sun always keep
    // theirs: they are how you click your way back. From far out bodies line up on screen,
    // and one marker for them reads better than several.
    const planetNames = new Set<string>(Object.values(PLANET_NAMES));
    const behind = new Set(
      [...hiddenBehind(onScreen.discs, OCCLUDING_RADIUS_PIXELS)].filter((name) =>
        planetNames.has(name),
      ),
    );
    const labels = mergeMarkers(
      onScreen.markers.filter(({ name }) => !behind.has(name)),
      MERGE_PIXELS,
    );
    for (const { marker, name } of onScreen.markers) {
      const label = labels.get(name) ?? null;
      marker.hidden = label === null;
      if (label !== null) setLabel(marker, label);
    }
  }

  /** The view's new size, CSS pixels. */
  readonly resize = (width: number, height: number): void => {
    this.#width = width;
    this.#height = height;
  };

  dispose(): void {
    this.#motion.dispose();
    this.#layer.remove();
  }

  /** Each body in view: its disc on screen, and its marker placed unless the disc is large. */
  #markersOnScreen(): {
    readonly markers: (ScreenMarker & { readonly marker: HTMLElement })[];
    readonly discs: ScreenDisc[];
  } {
    const { camera, meshes } = this.#world;
    const width = this.#width;
    const height = this.#height;
    const bodies = [
      { body: 'earth', radius: 1, shown: true, name: 'Earth' },
      { body: 'moon', radius: MOON_RADIUS_EARTH_RADII, shown: meshes.moon.visible, name: 'Moon' },
      { body: 'sun', radius: SUN_RADIUS_EARTH_RADII, shown: meshes.sun.visible, name: 'Sun' },
      ...PLANETS.map((planet) => ({
        body: planet,
        radius: planetRadius(planet),
        shown: meshes[planet].visible,
        name: PLANET_NAMES[planet],
      })),
    ] as const;
    const markers: (ScreenMarker & { readonly marker: HTMLElement })[] = [];
    const discs: ScreenDisc[] = [];
    for (const { body, radius, shown, name } of bodies) {
      const marker = this.#markers[body];
      const { position } = meshes[body];
      const projected = this.#projected.copy(position).project(camera);
      const distance = camera.position.distanceTo(position);
      // Only bodies in front of the camera get a marker.
      const visible =
        shown && projected.z < 1 && Math.abs(projected.x) < 1.2 && Math.abs(projected.y) < 1.2;
      marker.hidden = !visible;
      if (!visible) continue;
      const pixels = apparentRadiusPixels({
        radius,
        distance,
        verticalFovDegrees: camera.fov,
        viewportHeight: height,
      });
      const x = ((projected.x + 1) / 2) * width;
      const y = ((1 - projected.y) / 2) * height;
      discs.push({ name, x, y, distance, radius: pixels });
      // A body that fills much of the view needs no label.
      if (pixels > LABEL_MAX_RADIUS_PIXELS) {
        marker.hidden = true;
        continue;
      }
      marker.classList.toggle('is-tiny', pixels < MARKER_RADIUS_PIXELS);
      marker.style.setProperty('--radius', `${String(Math.max(pixels, MARKER_RADIUS_PIXELS))}px`);
      marker.style.transform = `translate(${String(x)}px, ${String(y)}px)`;
      markers.push({ marker, name, x, y });
    }
    return { markers, discs };
  }
}
