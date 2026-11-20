/**
 * The source of a gravitational wave (#832, #991), in three.js: the two bodies that made it
 * orbiting at their true mass ratio in the middle of a sheet of space, the plane of their orbit,
 * drawn as rings and spokes. GW150914's are black holes (36 and 29 Suns): dark spheres, faintly
 * ringed. GW170817's are neutron stars (about 1.5 and 1.3 Suns, some 24 km across): small, white
 * hot and glowing, drawn at their true size against their distance apart, and pulled out of round
 * toward each other by their tides as they close in. Each point of the sheet is raised by the wave
 * there (`sourceWave.ts`): the h₊ it carries, as it left the source r/c before, turned by twice the
 * point's azimuth and weakened as 1/r. The vertex shader does that for every point from a table of
 * the wave as it left, so the two-armed spiral is the physics', not a drawing. Raised for h₊
 * above, lowered below; this is the strain's pattern, not a dent in space.
 *
 * Near the bodies the wave cannot be worked out this way (the field is strong there, and the wave
 * not yet formed): the sheet fades out within `NEAR`, and the stage says so.
 *
 * Builds objects only: the view draws them.
 */

import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  AdditiveBlending,
  Group,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
  SphereGeometry,
} from 'three';

import type { Bodies } from './events';
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
/** How far apart the two are drawn when the wave is first played, sheet units: their sizes are
 * shares of it (`events.ts`). */
const APART = 0.6;
/** How far a neutron star is drawn pulled out of round by the other's tide: as (R/a)³, the
 * tide's strength, at most a third longer. Its shape is not measured: this shows the pull. */
const TIDE = 1.5;
const MOST_STRETCHED = 1.35;

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
  masses: Bodies['masses'],
  angle: number,
  apart: number,
): { first: [number, number]; second: [number, number] } {
  const total = masses.first + masses.second;
  const out = (share: number, turn: number): [number, number] => [
    share * apart * Math.cos(angle + turn),
    share * apart * Math.sin(angle + turn),
  ];
  return { first: out(masses.second / total, 0), second: out(masses.first / total, Math.PI) };
}

/** How much longer than wide a neutron star of `radius` is drawn, `apart` from the other. */
export function tidalStretch(radius: number, apart: number): number {
  if (apart <= 0) return MOST_STRETCHED;
  return Math.min(MOST_STRETCHED, 1 + TIDE * (radius / apart) ** 3);
}

export interface SourceSheet {
  readonly group: Group;
  /** Move the sheet and the bodies for the wave at `t`, s from the merger. */
  set(wave: Waveform, t: number): void;
  dispose(): void;
}

type Own = <T extends { dispose(): void }>(item: T) => T;

/** A black hole: a dark sphere its horizon's size, ringed faintly so it shows on the night. */
function blackHole(size: number, own: Own): Group {
  const hole = new Group();
  hole.name = 'black hole';
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
  hole.scale.setScalar(size);
  return hole;
}

/**
 * A neutron star: a small sphere, white hot (its surface is near a million degrees, and glows in
 * X-rays more than in light), in a soft blue halo so it shows at its true small size. `hot` is
 * the merged remnant's, hotter still, drawn yellower.
 */
function neutronStar(size: number, own: Own, hot = false): Group {
  const star = new Group();
  star.name = hot ? 'merged remnant' : 'neutron star';
  const geometry = own(new SphereGeometry(1, 32, 20));
  const body = new Mesh(
    geometry,
    own(new MeshBasicMaterial({ color: new Color(hot ? 0xfff1d6 : 0xeef4ff) })),
  );
  const halo = (scale: number, opacity: number): Mesh => {
    const glow = new Mesh(
      geometry,
      own(
        new MeshBasicMaterial({
          color: new Color(hot ? 0xffb35c : 0x7fb2ff),
          side: BackSide,
          transparent: true,
          opacity,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      ),
    );
    glow.scale.setScalar(scale);
    return glow;
  };
  star.add(body, halo(1.5, 0.35), halo(2.4, 0.12));
  star.scale.setScalar(size);
  return star;
}

/** The two bodies and the one they make, drawn as what they are. */
function bodiesOf(bodies: Bodies, own: Own): readonly [Group, Group, Group] {
  const { first, second, final } = bodies.sizes;
  if (bodies.kind === 'black holes') {
    return [
      blackHole(first * APART, own),
      blackHole(second * APART, own),
      blackHole(final * APART, own),
    ];
  }
  return [
    neutronStar(first * APART, own),
    neutronStar(second * APART, own),
    neutronStar(final * APART, own, true),
  ];
}

/** Turn and stretch a neutron star toward the other, `apart` away at orbital `angle`. */
function pull(star: Group, size: number, angle: number, apart: number): void {
  const stretch = tidalStretch(size, apart);
  // Its local x along the line between the two: a turn of −angle about y takes x to it.
  star.rotation.set(0, -angle, 0);
  star.scale.set(size * stretch, size / Math.sqrt(stretch), size / Math.sqrt(stretch));
}

export function createSourceSheet(bodies: Bodies): SourceSheet {
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
  const [first, second, final] = bodiesOf(bodies, own);
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
      const angle = orbit.of.angle(t);
      const apart = APART * orbit.of.separation(t);
      const places = placesOf(bodies.masses, angle, apart);
      first.position.set(places.first[0], 0, places.first[1]);
      second.position.set(places.second[0], 0, places.second[1]);
      if (bodies.kind === 'neutron stars') {
        pull(first, bodies.sizes.first * APART, angle, apart);
        pull(second, bodies.sizes.second * APART, angle, apart);
      }
    },
    dispose() {
      for (const item of owned) item.dispose();
    },
  };
}
