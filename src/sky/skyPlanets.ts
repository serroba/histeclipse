/**
 * The naked-eye planets in the sky view (#603): one point each, drawn like the stars, and their
 * names; a planet behind the Moon's or the Sun's disc is hidden, point and name. Planets close
 * together on screen share one name.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  type IUniform,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';
import type { Matrix3, Vector3 as Vec3 } from '../astro/matrix';
import { angleBetween, angularRadius, MOON_RADIUS_KM, SUN_RADIUS_KM } from './bodies';
import { aberrate, apparentDirection, apparentMagnitude, horizontal } from './horizon';
import { toPixels } from './projection';
import { STAR_RADIUS, toScene } from './skyFrame';
import { skyLabel } from './skyLabels';
import { STAR_FRAGMENT, STAR_VERTEX } from './skyShaders';

/** Planet colours as the eye sees them: Mars ruddy, Saturn pale gold, the rest near white. */
const PLANET_COLOURS: Readonly<Record<string, readonly [number, number, number]>> = {
  Mercury: [1, 0.95, 0.88],
  Venus: [1, 0.98, 0.9],
  Mars: [1, 0.62, 0.42],
  Jupiter: [1, 0.96, 0.86],
  Saturn: [1, 0.9, 0.68],
};
const PLANET_NAMES = Object.keys(PLANET_COLOURS);
/** Planets nearer than this on screen, in pixels, share a name. */
const SHARED_NAME_PIXELS = 24;

export interface SkyPlanet {
  readonly name: string;
  /** Direction from the observer, J2000 equatorial (any length). */
  readonly direction: Vec3;
  readonly magnitude: number;
}

/** A planet's name in the sky, where it goes, and whether it is seen. */
export interface PlanetLabel {
  readonly name: string;
  readonly label: HTMLElement;
  readonly position: Vector3;
  shown: boolean;
}

/** Where the planets are at a moment, and what can hide them. */
export interface PlanetsMoment {
  readonly horizon: Matrix3;
  readonly planets: readonly SkyPlanet[];
  /** The faintest magnitude seen now. */
  readonly limit: number;
  /** The Sun and the Moon from the place, in km; null when they cannot hide a planet. */
  readonly sunHere: Vec3 | null;
  readonly moonHere: Vec3 | null;
  /** Earth's velocity, for annual aberration. */
  readonly motion: Vec3;
}

export class SkyPlanets {
  readonly points: Points;
  readonly labels: readonly PlanetLabel[];
  readonly #positions = new Float32Array(PLANET_NAMES.length * 3);
  readonly #magnitudes = new Float32Array(PLANET_NAMES.length).fill(99);
  readonly #positionAttribute = new BufferAttribute(this.#positions, 3);
  readonly #magnitudeAttribute = new BufferAttribute(this.#magnitudes, 1);
  readonly #dataset: DOMStringMap;

  /** `uniforms` are the stars': the planets are drawn by the same shader. */
  constructor(world: {
    readonly uniforms: Record<string, IUniform>;
    readonly labelLayer: HTMLElement;
    readonly dataset: DOMStringMap;
  }) {
    this.#dataset = world.dataset;
    const colours = new Float32Array(
      PLANET_NAMES.flatMap((name) => [...(PLANET_COLOURS[name] ?? [1, 1, 1])]),
    );
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', this.#positionAttribute);
    geometry.setAttribute('color', new BufferAttribute(colours, 3));
    geometry.setAttribute('magnitude', this.#magnitudeAttribute);
    // In front of the stars and behind the Moon, which can pass in front of them.
    this.points = new Points(
      geometry,
      new ShaderMaterial({
        uniforms: world.uniforms,
        vertexShader: STAR_VERTEX,
        fragmentShader: STAR_FRAGMENT,
        blending: AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        transparent: true,
      }),
    );
    this.points.frustumCulled = false;
    this.points.renderOrder = 2.5;
    this.labels = PLANET_NAMES.map((name) => ({
      name,
      label: skyLabel(world.labelLayer, name, 'is-planet'),
      position: new Vector3(),
      shown: false,
    }));
  }

  /** Place the planets for a moment, and report where each is for the tests. */
  place({ horizon, planets, limit, sunHere, moonHere, motion }: PlanetsMoment): void {
    const report: string[] = [];
    // A planet behind the Moon's or the Sun's disc is hidden, point and name.
    const covers = (body: Vec3 | null, radiusKm: number, direction: Vec3): boolean =>
      body !== null && angleBetween(body, direction) < angularRadius(radiusKm, body);
    PLANET_NAMES.forEach((name, index) => {
      const planet = planets.find((entry) => entry.name === name);
      const entry = this.labels[index];
      if (entry === undefined) return;
      if (planet === undefined) {
        this.#magnitudes[index] = 99;
        entry.shown = false;
        return;
      }
      const seen = apparentDirection(horizon, aberrate(planet.direction, motion));
      const [x, y, z] = toScene(seen);
      const radius = STAR_RADIUS * 0.99;
      this.#positions.set([x * radius, y * radius, z * radius], index * 3);
      const hidden =
        covers(moonHere, MOON_RADIUS_KM, planet.direction) ||
        covers(sunHere, SUN_RADIUS_KM, planet.direction);
      this.#magnitudes[index] = hidden ? 99 : planet.magnitude;
      const { altitude, azimuth } = horizontal(seen);
      entry.shown =
        !hidden && altitude > 0 && apparentMagnitude(planet.magnitude, altitude) < limit;
      entry.position.set(x, y, z).multiplyScalar(40);
      report.push(
        [
          name,
          altitude.toFixed(2),
          azimuth.toFixed(2),
          planet.magnitude.toFixed(1),
          hidden ? 'covered' : entry.shown ? 'seen' : 'unseen',
        ].join(':'),
      );
    });
    this.#positionAttribute.needsUpdate = true;
    this.#magnitudeAttribute.needsUpdate = true;
    this.#dataset['planets'] = report.join(' ');
  }

  /**
   * Planets close together on screen (a conjunction) share one name, "Jupiter & Saturn": the
   * first keeps its label, the others' are hidden. `screenPoint` is where a scene position
   * lands, in NDC, or null if behind.
   */
  shareNames(
    screenPoint: (position: Vector3) => readonly [number, number] | null,
    width: number,
    height: number,
  ): void {
    const named: { label: HTMLElement; x: number; y: number; names: string[] }[] = [];
    for (const { name, label, position } of this.labels) {
      if (label.hidden !== false) continue;
      const ndc = screenPoint(position);
      if (ndc === null) continue;
      const [x, y] = toPixels(ndc, width, height);
      const near = named.find((other) => Math.hypot(other.x - x, other.y - y) < SHARED_NAME_PIXELS);
      if (near === undefined) {
        named.push({ label, x, y, names: [name] });
      } else {
        near.names.push(name);
        label.hidden = true;
      }
    }
    for (const { label, names } of named) label.textContent = names.join(' & ');
  }
}
