/**
 * The source of GW150914 (#832), in three.js: the two black holes orbiting, at their true mass
 * ratio (36 and 29 Suns), in the middle of a sheet of space, the plane of their orbit, drawn as
 * rings and spokes. Each point of the sheet is raised by the wave there (`sourceWave.ts`): the
 * h₊ it carries, as it left the source r/c before, turned by twice the point's azimuth and
 * weakened as 1/r. The vertex shader does that for every point from a table of the wave as it
 * left, so the two-armed spiral is the physics', not a drawing. Raised for h₊ above, lowered
 * below; this is the strain's pattern, not a dent in space.
 *
 * Near the black holes the wave cannot be worked out this way (the field is strong there, and
 * the wave not yet formed): the sheet fades out within `NEAR`, and the stage says so.
 *
 * Builds objects only: the view draws them.
 */

import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
  SphereGeometry,
} from 'three';

import { orbitOf, radialTable, type Orbit } from './sourceWave';
import type { Waveform } from './strain';

/** How far out the sheet reaches, and where the wave is drawn from, in sheet units. */
export const REACH = 6;
const NEAR = 0.8;
/** The wave's speed across the sheet, units per second of the wave's own time: at 100 Hz, a
 * wavelength of 1.2 units. Not to scale: light would cross 3,000 km in that time. */
const SOURCE_SPEED = 120;
/** How many distances the shader is given the wave at. */
export const BINS = 96;
/** The height of the wave's peak at `NEAR`, sheet units. */
const HEIGHT = 1.2;
const RINGS = 80;
const SPOKES = 64;
const AROUND = 160;
const ALONG = 80;
/** The black holes' masses, Suns, and the one they made (Abbott et al. 2016). */
export const MASSES = { first: 36, second: 29, final: 62 } as const;
/** How far apart the two are drawn when the wave is first heard, and a black hole's size per
 * Sun: their horizons, as their masses, though not to the sheet's scale. */
const APART = 0.6;
const PER_SUN = 0.0028;

const VERTEX = /* glsl */ `
  uniform vec2 table[BINS];
  uniform float reach;
  uniform float near;
  varying float strain;
  varying float phase;
  varying float shown;
  void main() {
    float r = length(position.xz);
    float phi = atan(position.z, position.x);
    float at = clamp(r / reach, 0.0, 1.0) * float(BINS - 1);
    int below = int(floor(at));
    int above = min(below + 1, BINS - 1);
    vec2 left = mix(table[below], table[above], fract(at));
    // In the orbit's plane, h₊ alone, at half strength; weaker as 1/r beyond the near zone.
    // The wave's phase, as it left, colours the sheet; its strength, falling, raises it.
    float turned = 0.5 * (left.x * cos(2.0 * phi) + left.y * sin(2.0 * phi));
    phase = turned;
    strain = turned * near / max(r, near);
    shown = smoothstep(near * 0.7, near * 1.3, r) * (1.0 - smoothstep(reach * 0.85, reach, r));
    vec3 moved = vec3(position.x, strain, position.z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(moved, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  varying float phase;
  varying float shown;
  void main() {
    vec3 rest = vec3(0.43, 0.53, 0.72);
    vec3 up = vec3(1.0, 0.78, 0.38);
    vec3 down = vec3(0.35, 0.7, 1.0);
    float k = clamp(abs(phase) * 2.5, 0.0, 1.0);
    vec3 colour = mix(rest, phase > 0.0 ? up : down, k);
    gl_FragColor = vec4(colour, shown * (0.3 + 0.7 * k));
  }
`;

/** The sheet's rings and spokes, as segments in its plane (y = 0). */
export function sheetSegments(): Float32Array {
  const values: number[] = [];
  const point = (r: number, angle: number): number[] => [
    r * Math.cos(angle),
    0,
    r * Math.sin(angle),
  ];
  for (let ring = 1; ring <= RINGS; ring += 1) {
    const r = (REACH * ring) / RINGS;
    for (let step = 0; step < AROUND; step += 1) {
      values.push(
        ...point(r, (2 * Math.PI * step) / AROUND),
        ...point(r, (2 * Math.PI * (step + 1)) / AROUND),
      );
    }
  }
  for (let spoke = 0; spoke < SPOKES; spoke += 1) {
    const angle = (2 * Math.PI * spoke) / SPOKES;
    for (let step = 0; step < ALONG; step += 1) {
      values.push(
        ...point((REACH * step) / ALONG, angle),
        ...point((REACH * (step + 1)) / ALONG, angle),
      );
    }
  }
  return new Float32Array(values);
}

/** Where the two are about their centre of mass, `apart` from each other at orbital `angle`. */
export function placesOf(
  angle: number,
  apart: number,
): { first: [number, number]; second: [number, number] } {
  const total = MASSES.first + MASSES.second;
  const out = (share: number, turn: number): [number, number] => [
    share * apart * Math.cos(angle + turn),
    share * apart * Math.sin(angle + turn),
  ];
  return { first: out(MASSES.second / total, 0), second: out(MASSES.first / total, Math.PI) };
}

export interface SourceSheet {
  readonly group: Group;
  /** Move the sheet and the black holes for the wave at `t`, s from the merger. */
  set(wave: Waveform, t: number): void;
  dispose(): void;
}

/** A black hole: a dark sphere its horizon's size, ringed faintly so it shows on the night. */
function blackHole(suns: number, own: <T extends { dispose(): void }>(item: T) => T): Group {
  const hole = new Group();
  const geometry = own(new SphereGeometry(1, 32, 20));
  const dark = new Mesh(geometry, own(new MeshBasicMaterial({ color: 0x000000 })));
  const rim = new Mesh(
    geometry,
    own(
      new MeshBasicMaterial({
        color: new Color(0x8fa6d8),
        side: BackSide,
        transparent: true,
        opacity: 0.5,
      }),
    ),
  );
  rim.scale.setScalar(1.12);
  hole.add(dark, rim);
  hole.scale.setScalar(suns * PER_SUN);
  return hole;
}

export function createSourceSheet(): SourceSheet {
  const group = new Group();
  const owned: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(item: T): T => {
    owned.push(item);
    return item;
  };
  const geometry = own(new BufferGeometry());
  geometry.setAttribute('position', new BufferAttribute(sheetSegments(), 3));
  const material = own(
    new ShaderMaterial({
      defines: { BINS },
      uniforms: {
        table: { value: new Float32Array(BINS * 2) },
        reach: { value: REACH },
        near: { value: NEAR },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
    }),
  );
  const sheet = new LineSegments(geometry, material);
  sheet.frustumCulled = false;
  const first = blackHole(MASSES.first, own);
  const second = blackHole(MASSES.second, own);
  const final = blackHole(MASSES.final, own);
  group.add(sheet, first, second, final);

  let orbit: { readonly wave: Waveform; readonly of: Orbit } | null = null;
  const pairs = material.uniforms['table']?.value as Float32Array;
  return {
    group,
    set(wave, t) {
      if (orbit?.wave !== wave) orbit = { wave, of: orbitOf(wave) };
      const table = radialTable(wave, t, SOURCE_SPEED, REACH, BINS);
      const scale = wave.peak > 0 ? HEIGHT / wave.peak : 0;
      table.forEach((value, index) => {
        pairs[index] = value * scale;
      });
      const two = orbit.of.two(t);
      first.visible = two;
      second.visible = two;
      final.visible = !two;
      if (!two) return;
      const places = placesOf(orbit.of.angle(t), APART * orbit.of.separation(t));
      first.position.set(places.first[0], 0, places.first[1]);
      second.position.set(places.second[0], 0, places.second[1]);
    },
    dispose() {
      for (const item of owned) item.dispose();
    },
  };
}
