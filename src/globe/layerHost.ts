/**
 * What the globe offers the things drawn on it (#379). A layer gets the scene, the page element
 * around it and a few services, and draws itself; the globe does not need a method for it.
 * New things drawn on the globe are layers; the globe's own `set…` methods only shrink.
 */

import type { Group, PerspectiveCamera, Quaternion, Scene, Vector3 } from 'three';

import './nameLabels.css';

import type { MoonName, MoonPlanet } from '../astro/moonOrbits';
import type { GeoPoint } from '../core/geo';
import type { NamedBody } from '../data/planetNames';
import type { Body } from '../state/viewState';

export type Triple = readonly [number, number, number];

/** A name on screen that a tap picks, measured once. */
export interface NameLabel {
  readonly element: HTMLButtonElement;
  readonly width: number;
  readonly height: number;
}

export interface LayerHost {
  readonly scene: Scene;
  /** The camera the globe draws with; read it, the globe moves it. */
  readonly camera: PerspectiveCamera;
  /** The element the globe draws in; labels go inside it. */
  readonly container: HTMLElement;
  /** The body the view is on. */
  focus(): Body;
  /**
   * Where a named body or a planet with moons is, how it is turned, its radius (scene units), and
   * whether it is drawn.
   */
  bodyFrame(body: NamedBody | MoonPlanet): {
    readonly position: Vector3;
    readonly rotation: Quaternion;
    readonly radius: number;
    readonly shown: boolean;
  };
  /** Where the Sun is in the scene. */
  sunPosition(): Vector3;
  /** Earth's spin axis in deep time, its poles marked; what is added to it shows with it. */
  readonly spinAxis: Group;
  /** Where a planet's moon is in the scene, written into `target`. */
  moonPosition(moon: MoonName, target: Vector3): Vector3;
  /** Ask to fly to a body, as a tap on it does. */
  requestBody(body: Body): void;
  /**
   * From J2000 km from Earth's centre to scene units, for the moment shown; null until the
   * globe has one.
   */
  spaceToScene(): ((km: Triple) => Triple) | null;
  /** Draw a new frame soon. */
  requestRender(): void;
  /** Run after each frame is drawn, to lay out what follows the camera. */
  afterRender(place: () => void): void;
  /** Show each name, in order, where it is on screen, clear of the panels and of those shown. */
  layOutNames(
    names: readonly { readonly scene: Vector3; readonly label: NameLabel | undefined }[],
    layer: HTMLElement,
  ): void;
  /** Taps on `[data-pick]` elements inside `element` reach the globe's marker-pick listeners. */
  pickable(element: HTMLElement): void;
  /**
   * Pin labels inside `layer` to Earth's surface, laid out with all the others after each frame
   * and given room in `priority` order (see SURFACE_PRIORITY).
   */
  surfaceLabels(priority: number, layer: HTMLElement): SurfaceLabels;
}

/** A marker or name pinned to Earth's surface. */
export interface SurfacePin {
  readonly element: HTMLElement;
  readonly point: GeoPoint;
}

export interface SurfaceLabels {
  /** Replace this layer's pins (measured once, laid out from the next frame); null clears them. */
  show(pins: readonly SurfacePin[] | null): void;
  /**
   * Move the pins shown, in order, without making them again: laid out again they would hide
   * until the next frame, and as time plays, every frame.
   */
  move(points: readonly GeoPoint[]): void;
}

/**
 * Who claims room first where labels on Earth's surface would overlap: lower first. The larger
 * states' names before the markers, so a crowd of small counts can't take their places; the
 * smaller states' names last, where room is left (#163).
 */
export const SURFACE_PRIORITY = {
  majorStates: 0,
  humans: 10,
  genomes: 20,
  volcanoes: 30,
  impacts: 40,
  fossils: 50,
  minorStates: 60,
} as const;

export interface GlobeLayer<Input> {
  /** Draw this; each layer says what null means, usually "nothing". */
  update(input: Input): void;
  dispose?(): void;
}

export type LayerFactory<Input> = (host: LayerHost) => GlobeLayer<Input>;

/** A name to show for a thing drawn: its key, its text, what a tap picks, and where it is. */
export interface Named {
  readonly key: string;
  readonly name: string;
  readonly pick: string;
  readonly scene: Vector3;
}

export interface NameLabels {
  /** Name these, in the order they get room; null hides them all. */
  show(names: readonly Named[] | null): void;
}

/**
 * Names for the things a layer draws, each a button a tap picks, laid out after every frame.
 * Labels are made the first time a thing is named and measured once, all together.
 */
export function createNameLabels(
  host: LayerHost,
  options: { readonly className: string; readonly labelClass: string; readonly testId: string },
): NameLabels {
  const layer = document.createElement('div');
  layer.className = `empire-labels ${options.className}`;
  layer.dataset['testid'] = options.testId;
  host.container.append(layer);
  host.pickable(layer);
  const labels = new Map<string, NameLabel>();
  let shown: readonly Named[] = [];
  host.afterRender(() => {
    if (shown.length === 0) return;
    host.layOutNames(
      shown.map(({ key, scene }) => ({ scene, label: labels.get(key) })),
      layer,
    );
  });
  return {
    show(names) {
      shown = names ?? [];
      const fresh: { key: string; element: HTMLButtonElement }[] = [];
      for (const { key, name, pick } of shown) {
        if (labels.has(key)) continue;
        const element = document.createElement('button');
        element.type = 'button';
        element.className = `space-name ${options.labelClass}`;
        element.textContent = name;
        element.dataset['pick'] = pick;
        element.style.visibility = 'hidden';
        layer.append(element);
        fresh.push({ key, element });
      }
      for (const { key, element } of fresh) {
        labels.set(key, { element, width: element.offsetWidth, height: element.offsetHeight });
      }
      for (const { element } of fresh) element.style.visibility = '';
      const keys = new Set(shown.map(({ key }) => key));
      for (const [key, { element }] of labels) if (!keys.has(key)) element.hidden = true;
    },
  };
}
