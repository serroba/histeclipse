/**
 * The constellation figures in the sky view (#603): their lines between the stars, and their
 * names at the middle of each figure's stars, bigger figures first where names would overlap.
 * The figures are the modern constellations, or another culture's.
 */

import { BufferAttribute, BufferGeometry, LineSegments, ShaderMaterial, Vector3 } from 'three';
import type { Figures } from '../state/viewState';
import { figureSegments, type Figure, shownConstellations } from './look';
import type { ProjectionUniforms } from './skyFrame';
import { overlaps, skyLabel } from './skyLabels';
import { LINE_FRAGMENT, LINE_VERTEX } from './skyShaders';

/** Each figure line is drawn in this many pieces, so it can follow its curve on screen. */
const LINE_PIECES = 8;
/** Where names sit: inside the stars' sphere. */
const NAME_RADIUS = 40;

interface FigureName {
  readonly figure: Figure;
  readonly label: HTMLElement;
  readonly position: Vector3;
}

/** Shows a label at a scene position, or hides it: the sky's own projection places it. */
export type PlaceLabel = (label: HTMLElement, position: Vector3, show: boolean) => void;

export class SkyFigures {
  readonly lines: LineSegments;
  readonly #geometry = new BufferGeometry();
  #positions = new BufferAttribute(new Float32Array(0), 3);
  readonly #opacity = { value: 0.35 };
  readonly #labelLayer: HTMLElement;
  /** The stars' positions in the scene, which the lines and names follow. */
  readonly #stars: Float32Array;
  readonly #modern: readonly Figure[];
  readonly #invalidate: () => void;
  #catalogue: readonly Figure[];
  #figures: Figures;
  #shown: readonly Figure[] = [];
  #segments: [number, number][] = [];
  #names: Map<number, FigureName>;
  #bySize: FigureName[];

  constructor(world: {
    readonly projection: ProjectionUniforms;
    readonly labelLayer: HTMLElement;
    readonly stars: Float32Array;
    /** The modern constellations, the figures until another culture's are asked for. */
    readonly modern: readonly Figure[];
    readonly figures: Figures;
    readonly invalidate: () => void;
  }) {
    this.#labelLayer = world.labelLayer;
    this.#stars = world.stars;
    this.#modern = world.modern;
    this.#catalogue = world.modern;
    this.#figures = world.figures;
    this.#invalidate = world.invalidate;
    this.lines = new LineSegments(
      this.#geometry,
      new ShaderMaterial({
        uniforms: { ...world.projection, opacity: this.#opacity },
        vertexShader: LINE_VERTEX,
        fragmentShader: LINE_FRAGMENT,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 2;
    this.#names = this.#makeNames();
    this.#bySize = this.#sortBySize();
    this.#rebuild();
  }

  /** Which figures to draw: all, the zodiac, or none. */
  setFigures(next: Figures): void {
    if (next === this.#figures) return;
    this.#figures = next;
    this.#rebuild();
  }

  /** Draw another culture's figures; null returns to the modern constellations. */
  setCulture(next: readonly Figure[] | null): void {
    const wanted = next ?? this.#modern;
    if (wanted === this.#catalogue) return;
    this.#catalogue = wanted;
    for (const { label } of this.#names.values()) label.remove();
    this.#names = this.#makeNames();
    this.#bySize = this.#sortBySize();
    this.#rebuild();
  }

  /** Figures stay faintly visible by day, as a guide to where things are. */
  setSunAltitude(degrees: number): void {
    this.#opacity.value = 0.12 + 0.28 * (1 - Math.min(1, Math.max(0, (degrees + 18) / 18)));
  }

  /** Follow the stars, which moved: the lines, and the names at the middle of their stars. */
  place(): void {
    const target = this.#positions.array;
    const stars = this.#stars;
    // Straight lines between stars curve on a stereographic view, so each is drawn in pieces
    // along its chord; the shader puts every point back on the sphere.
    this.#segments.forEach(([from, to], index) => {
      for (let piece = 0; piece < LINE_PIECES; piece++) {
        const base = (index * LINE_PIECES + piece) * 6;
        for (const [offset, t] of [
          [0, piece / LINE_PIECES],
          [3, (piece + 1) / LINE_PIECES],
        ] as const) {
          for (let axis = 0; axis < 3; axis++) {
            const a = stars[from * 3 + axis] ?? 0;
            const b = stars[to * 3 + axis] ?? 0;
            target[base + offset + axis] = a + (b - a) * t;
          }
        }
      }
    });
    this.#positions.needsUpdate = true;
    // Names sit at the middle of their figure's stars, so they travel with them.
    for (const { figure, position } of this.#names.values()) {
      position.set(0, 0, 0);
      for (const star of figure.lines.flat()) {
        position.x += stars[star * 3] ?? 0;
        position.y += stars[star * 3 + 1] ?? 0;
        position.z += stars[star * 3 + 2] ?? 0;
      }
      if (position.lengthSq() > 0) position.setLength(NAME_RADIUS);
    }
    for (const entry of this.#names.values()) {
      entry.label.dataset['shown'] = String(
        this.#shown.includes(entry.figure) && entry.figure.lines.length > 0,
      );
    }
    this.#invalidate();
  }

  /**
   * Place the names after a drawing: bigger figures first, each left out where it would overlap
   * a name already placed, or one of `kept` (the planets', which keep theirs). `kept` is read
   * after the names are written, so the page is laid out once.
   */
  placeNames(placeLabel: PlaceLabel, kept: () => DOMRect[]): void {
    for (const { label, position } of this.#bySize) {
      // Names of figures low in the haze or below the horizon are left out.
      const show = label.dataset['shown'] === 'true' && position.y > NAME_RADIUS * 0.03;
      placeLabel(label, position, show);
    }
    const candidates = this.#bySize
      .filter(({ label }) => label.hidden === false)
      .map(({ label }) => ({ label, box: label.getBoundingClientRect() }));
    const placed = kept();
    for (const { label, box } of candidates) {
      if (placed.some((other) => overlaps(box, other))) {
        label.hidden = true;
      } else {
        placed.push(box);
      }
    }
  }

  #rebuild(): void {
    this.#shown = shownConstellations(this.#catalogue, this.#figures);
    this.#segments = figureSegments(this.#shown);
    this.#positions = new BufferAttribute(
      new Float32Array(this.#segments.length * LINE_PIECES * 6),
      3,
    );
    this.#geometry.setAttribute('position', this.#positions);
    this.place();
  }

  #makeNames(): Map<number, FigureName> {
    return new Map(
      this.#catalogue.map((figure, index) => [
        // Serpens is named twice under one id, so key by position in the list.
        index,
        {
          figure,
          label: skyLabel(
            this.#labelLayer,
            figure.native === undefined || figure.native === ''
              ? figure.name
              : `${figure.name} · ${figure.native}`,
            'is-constellation',
          ),
          position: new Vector3(),
        },
      ]),
    );
  }

  #sortBySize(): FigureName[] {
    return [...this.#names.values()].sort(
      (a, b) => b.figure.lines.flat().length - a.figure.lines.flat().length,
    );
  }
}
