/**
 * The names over the sky view (#603): the compass along the horizon, marks the app points out,
 * and, after each drawing, every name placed where its thing is on screen: the compass, the
 * marks, the planets (sharing one name when close), then the constellations clear of them.
 */

import { Vector3 } from 'three';
import { COMPASS } from './look';
import { toPixels } from './projection';
import type { SkyFigures } from './skyFigures';
import { lookDirectionAt, toScene } from './skyFrame';
import { skyLabel } from './skyLabels';
import type { SkyPlanets } from './skyPlanets';

/** Where names sit: inside everything they name. */
const NAME_RADIUS = 40;

/** A body to point out, by name, where it stands. */
export interface SkyMark {
  readonly name: string;
  /** Degrees from north through east, and above the horizon. */
  readonly azimuth: number;
  readonly altitude: number;
}

interface Placed {
  readonly label: HTMLElement;
  readonly position: Vector3;
}

/** Where a scene position lands on screen, in NDC, as the shaders put it; null if behind. */
type ScreenPoint = (position: Vector3) => readonly [number, number] | null;

/** What the names are placed among after each drawing. */
export interface NamedSky {
  readonly width: number;
  readonly height: number;
  /** The Sun's disc, if it is up: where it is on screen is reported for the tests. */
  readonly sun: Vector3 | null;
  readonly planets: SkyPlanets;
  readonly figures: SkyFigures;
}

export class SkyNames {
  readonly #layer: HTMLElement;
  readonly #screenPoint: ScreenPoint;
  readonly #dataset: DOMStringMap;
  readonly #compass: readonly Placed[];
  #marks: readonly Placed[] = [];

  constructor(world: {
    readonly layer: HTMLElement;
    readonly screenPoint: ScreenPoint;
    readonly dataset: DOMStringMap;
  }) {
    this.#layer = world.layer;
    this.#screenPoint = world.screenPoint;
    this.#dataset = world.dataset;
    this.#compass = COMPASS.map(([name, azimuth]) => ({
      label: skyLabel(world.layer, name, 'is-compass'),
      position: new Vector3(...toScene(lookDirectionAt(azimuth, 0))).multiplyScalar(NAME_RADIUS),
    }));
  }

  /** Point these out by name, in place of those pointed out before. */
  setMarks(marks: readonly SkyMark[]): void {
    for (const { label } of this.#marks) label.remove();
    this.#marks = marks.map(({ name, azimuth, altitude }) => ({
      label: skyLabel(this.#layer, name, 'is-mark'),
      position: new Vector3(...toScene(lookDirectionAt(azimuth, altitude))).multiplyScalar(
        NAME_RADIUS,
      ),
    }));
  }

  /** Place every name after a drawing. */
  place({ width, height, sun, planets, figures }: NamedSky): void {
    // Writes, then one read pass, then writes: the browser lays the page out once a frame.
    const place = (label: HTMLElement, position: Vector3, show: boolean): void => {
      this.#placeLabel(label, position, show, width, height);
    };
    for (const { label, position } of this.#compass) place(label, position, true);
    // Where the Sun's disc is on screen, in pixels, for whoever needs to find it.
    const sunAt = sun === null ? null : this.#screenPoint(sun);
    this.#dataset['sunAt'] =
      sunAt === null
        ? 'off'
        : toPixels(sunAt, width, height)
            .map((v) => v.toFixed(0))
            .join(',');
    for (const { label, position } of this.#marks) place(label, position, true);
    for (const { label, position, shown } of planets.labels) place(label, position, shown);
    planets.shareNames(this.#screenPoint, width, height);
    figures.placeNames(place, () =>
      // Planets keep their names: a figure's name that would overlap one is left out.
      planets.labels
        .filter(({ label }) => label.hidden === false)
        .map(({ label }) => label.getBoundingClientRect()),
    );
  }

  /** Show a label where its position lands on screen, or hide it when off screen or not shown. */
  #placeLabel(
    label: HTMLElement,
    position: Vector3,
    show: boolean,
    width: number,
    height: number,
  ): void {
    const ndc = show ? this.#screenPoint(position) : null;
    const onScreen = ndc !== null && Math.abs(ndc[0]) < 1.1 && Math.abs(ndc[1]) < 1.1;
    label.hidden = !onScreen;
    if (!onScreen) return;
    const [x, y] = toPixels(ndc, width, height);
    label.style.transform = `translate(${String(x)}px, ${String(y)}px)`;
  }
}
