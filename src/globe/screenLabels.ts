/**
 * What the globe writes over its picture (#379): a marker ring and name for each body, names
 * on Earth's surface from the layers, and the layers' names in space, each kept clear of the
 * others and of the panels.
 */

import { Vector3, type Object3D, type PerspectiveCamera } from 'three';

import { PLANETS, type PlanetName } from '../astro/planets';
import type { Body, GeoPoint } from '../state/viewState';
import { geoToVector } from './geo';
import type { LayerHost, SurfaceLabel } from './layerHost';
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

interface SurfaceSlot {
  readonly priority: number;
  labels: readonly SurfaceLabel[];
}

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

  constructor(world: ScreenLabelsWorld) {
    this.#world = world;
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
        this.placeSurfaceLabels();
        this.#world.invalidate();
      },
      move: (points) => {
        points.forEach((point, index) => {
          slot.labels[index]?.position.set(...geoToVector(point, 1.01));
        });
        this.placeSurfaceLabels();
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
        this.placeSurfaceLabels();
        this.#world.invalidate();
      },
    };
  };

  /** Show each name, in order, where it is on screen, clear of the panels and of those shown. */
  readonly layOutNames: LayerHost['layOutNames'] = (names, layer) => {
    const { container, camera } = this.#world;
    const insets = this.#world.insets();
    const viewWidth = container.clientWidth;
    const viewHeight = container.clientHeight;
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
      label.element.hidden = !visible;
      if (!visible) continue;
      placed.push(box);
      count += 1;
      label.element.style.transform = `translate(${String(x)}px, ${String(y)}px) translate(0, -50%)`;
    }
    layer.dataset['named'] = String(count);
  };

  /** Lay out the layers' names on Earth's surface, largest first, on the near side only. */
  placeSurfaceLabels(): void {
    const { container, camera } = this.#world;
    const eye = camera.position.clone().normalize();
    // Only names on the near side of Earth, and only while it fills enough of the view.
    const near = this.#world.focus() === 'earth' && camera.position.length() < 12;
    // Labels come largest first; a smaller state's name gives way where it would overlap.
    // The larger states' names go before the markers, so a crowd of small counts can't take
    // their places; the smaller names come after, where room is left (#163).
    const placed: Box[] = [];
    // Read once: read after a label is moved, the size makes the browser lay the page out
    // again, for every label.
    const viewWidth = container.clientWidth;
    const viewHeight = container.clientHeight;
    // The layers' labels (#379), each slot in its place.
    const slots = [...this.#surfaceSlots].sort((a, b) => a.priority - b.priority);
    for (const { element, position, width, height } of slots.flatMap(({ labels }) => labels)) {
      const projected = this.#projected.copy(position).project(camera);
      const shown =
        near && position.dot(eye) > 0.25 && Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1;
      const x = ((projected.x + 1) / 2) * viewWidth;
      const centre = ((1 - projected.y) / 2) * viewHeight;
      // Where it would overlap, a name may move a line up or down before it gives way.
      const y = [0, -1, 1, -2, 2]
        .map((step) => centre + step * height)
        .find((candidate) =>
          clearOf({ x: x - width / 2, y: candidate - height / 2, w: width, h: height }, placed),
        );
      element.hidden = !shown || y === undefined;
      if (y === undefined || element.hidden) continue;
      placed.push({ x: x - width / 2, y: y - height / 2, w: width, h: height });
      element.style.transform = `translate(${String(x)}px, ${String(y)}px) translate(-50%, -50%)`;
    }
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

  dispose(): void {
    this.#layer.remove();
  }

  /** Each body in view: its disc on screen, and its marker placed unless the disc is large. */
  #markersOnScreen(): {
    readonly markers: (ScreenMarker & { readonly marker: HTMLElement })[];
    readonly discs: ScreenDisc[];
  } {
    const { container, camera, meshes } = this.#world;
    const width = container.clientWidth;
    const height = container.clientHeight;
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
