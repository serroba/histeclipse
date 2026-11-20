/**
 * The journey, drawn (#833, #841): Earth, a unit across its radius, turned as it is Earth-fixed
 * (the map's 0° longitude toward +x, the north pole up), with the detectors that heard it marked
 * (Livingston and Hanford, and for GW170817 Virgo too, #993); and
 * the space about it as a sheet of free points, drawn as a grid through Earth's middle that
 * holds the wave's path. As the wave passes, every point, and every
 * point of Earth, is moved by it (`strain.ts`): stretched one way across its path and squeezed
 * the other, by the wave as it is where that point lies along the path (`journey.ts`). So its
 * flat wavefronts sweep through, a wavelength apart, and Earth is seen squashed and stretched.
 * Stretched as everything else is, 4 × 10²⁰ times; a detector lights as the merger reaches it.
 *
 * The wave along the path is a small texture, read in the vertex shaders: thousands of points
 * and Earth's own move on the GPU. Builds and moves objects only: the view draws them.
 */

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  FloatType,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  LineSegments,
  NearestFilter,
  RGBAFormat,
  ShaderMaterial,
  SphereGeometry,
  type Texture,
  Vector3,
} from 'three';

import { directionOf, type JourneyMoment, pairAt, pathTable, placeOf, reached } from './journey';
import { GW150914_TRIP, type Trip } from './trips';
import { displacement, type Triple, type Waveform, waveAxes } from './strain';
import { EXAGGERATION } from './wavePlay';

/** Earth-fixed (z to the pole) into the scene's axes (y up), as three's sphere maps a world map:
 * 0° longitude to +x, 90° W to +z. */
export function toScene([x, y, z]: Triple): Vector3 {
  return new Vector3(x, z, -y);
}

/** The colours the plot gives the two, Livingston blue and Hanford red; and Virgo green. */
const MARKS = { L1: 0x5ab0ff, H1: 0xff6b5a, V1: 0x7ddc6a } as const;
/** The stretch of path the wave is read along, Earth radii, and how finely. */
export const PATH = { from: -3, to: 3, bins: 192 } as const;
/** The sheet of space drawn about Earth: how far out it reaches, Earth radii, its lines each
 * way, and how many pieces each line is drawn in, so it can bend. */
const REACH = 2.8;
const LINES = 36;
const PIECES = 120;

/** The vertex shaders' shared part: the shift of a point at `at` by the wave along its path. */
const SHIFT = /* glsl */ `
  uniform sampler2D path;
  uniform vec3 waveP;
  uniform vec3 waveQ;
  uniform vec3 waveN;
  uniform vec2 pathSpan;
  vec2 strainAt(float along) {
    float at = clamp((along - pathSpan.x) / (pathSpan.y - pathSpan.x), 0.0, 1.0) * float(BINS - 1);
    float below = floor(at);
    vec2 a = texture2D(path, vec2((below + 0.5) / float(BINS), 0.5)).xy;
    vec2 b = texture2D(path, vec2((min(below + 1.0, float(BINS - 1)) + 0.5) / float(BINS), 0.5)).xy;
    return mix(a, b, at - below);
  }
  vec3 waveShift(vec3 at) {
    vec2 h = strainAt(dot(at, waveN));
    float xp = dot(at, waveP);
    float xq = dot(at, waveQ);
    return 0.5 * ((h.x * xp + h.y * xq) * waveP + (h.y * xp - h.x * xq) * waveQ);
  }
`;

const SHEET_VERTEX = /* glsl */ `
  ${SHIFT}
  varying float crest;
  void main() {
    crest = strainAt(dot(position, waveN)).x;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position + waveShift(position), 1.0);
  }
`;

const SHEET_FRAGMENT = /* glsl */ `
  varying float crest;
  void main() {
    vec3 rest = vec3(0.43, 0.53, 0.72);
    vec3 colour = mix(rest, crest > 0.0 ? vec3(1.0, 0.78, 0.38) : vec3(0.35, 0.7, 1.0), clamp(abs(crest) * 3.0, 0.0, 1.0));
    gl_FragColor = vec4(colour, 0.32 + 0.5 * clamp(abs(crest) * 3.0, 0.0, 1.0));
  }
`;

/**
 * The sheet of space about Earth, as line segments: a square grid through Earth's middle, in
 * the plane holding the wave's path (`along`) and the way across it (`across`), so the wave's
 * flat fronts cross it as bands. Each line is drawn in pieces, so it bends as the wave moves it.
 */
export function sheetSegments(along: Vector3, across: Vector3): Float32Array {
  const values: number[] = [];
  const at = (u: number, v: number): number[] =>
    along.clone().multiplyScalar(u).addScaledVector(across, v).toArray();
  for (let line = 0; line <= LINES; line += 1) {
    const fixed = -REACH + (2 * REACH * line) / LINES;
    for (let piece = 0; piece < PIECES; piece += 1) {
      const from = -REACH + (2 * REACH * piece) / PIECES;
      const to = -REACH + (2 * REACH * (piece + 1)) / PIECES;
      values.push(...at(from, fixed), ...at(to, fixed), ...at(fixed, from), ...at(fixed, to));
    }
  }
  return new Float32Array(values);
}

export interface JourneyScene {
  readonly group: Group;
  /** The way the wave goes, in the scene's axes. */
  readonly heading: Vector3;
  /** Midway between the two detectors, in the scene's axes. */
  readonly detectors: Vector3;
  set(wave: Waveform, moment: JourneyMoment): void;
  /** Dress Earth in its map, once it has loaded. */
  dressEarth(map: Texture): void;
  dispose(): void;
}

/** The uniforms both shaders read: the wave along its path, and the axes it moves things by. */
function pathUniforms(k: Triple): {
  readonly texture: DataTexture;
  readonly data: Float32Array;
  readonly uniforms: Record<string, { value: unknown }>;
} {
  const data = new Float32Array(PATH.bins * 4);
  const texture = new DataTexture(data, PATH.bins, 1, RGBAFormat, FloatType);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.needsUpdate = true;
  const { p, q } = waveAxes(k);
  return {
    texture,
    data,
    uniforms: {
      path: { value: texture },
      waveP: { value: toScene(p) },
      waveQ: { value: toScene(q) },
      waveN: { value: toScene(k).normalize() },
      pathSpan: { value: [PATH.from, PATH.to] },
    },
  };
}

/** The sheet of space, facing the detectors' side of Earth, where the story's camera looks from. */
function sheetOf(
  heading: Vector3,
  detectors: Vector3,
  uniforms: Record<string, { value: unknown }>,
  own: <T extends { dispose(): void }>(item: T) => T,
): LineSegments {
  const facing = detectors.clone().addScaledVector(heading, -detectors.dot(heading)).normalize();
  const across = new Vector3().crossVectors(heading, facing).normalize();
  const geometry = own(new BufferGeometry());
  geometry.setAttribute('position', new BufferAttribute(sheetSegments(heading, across), 3));
  const material = own(
    new ShaderMaterial({
      defines: { BINS: PATH.bins },
      uniforms,
      vertexShader: SHEET_VERTEX,
      fragmentShader: SHEET_FRAGMENT,
      transparent: true,
      depthWrite: false,
    }),
  );
  const sheet = new LineSegments(geometry, material);
  sheet.frustumCulled = false;
  return sheet;
}

export function createJourneyScene(trip: Trip = GW150914_TRIP): JourneyScene {
  const owned: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(item: T): T => {
    owned.push(item);
    return item;
  };
  const group = new Group();
  const k = directionOf(trip);
  const heading = toScene(k).normalize();
  const shared = pathUniforms(k);
  own(shared.texture);

  const earthMaterial = own(new MeshStandardMaterial({ color: 0x2c5a8a, roughness: 0.9 }));
  earthMaterial.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared.uniforms);
    shader.defines = { ...shader.defines, BINS: PATH.bins };
    shader.vertexShader = `${SHIFT}\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n  transformed += waveShift(position);',
    );
  };
  const earth = new Mesh(own(new SphereGeometry(1, 96, 64)), earthMaterial);
  group.add(earth);

  const detectors = trip.heard
    .reduce((sum, detector) => sum.add(toScene(placeOf(detector))), new Vector3())
    .normalize();
  group.add(sheetOf(heading, detectors, shared.uniforms, own));

  const marks = trip.heard.map((detector) => {
    const material = own(
      new MeshBasicMaterial({ color: new Color(MARKS[detector]).multiplyScalar(0.35) }),
    );
    const mark = new Mesh(own(new SphereGeometry(0.035, 16, 10)), material);
    const place = placeOf(detector);
    group.add(mark);
    return { detector, material, place, mark };
  });

  return {
    group,
    heading,
    detectors,
    set(wave, moment) {
      shared.data.set(
        pathTable(wave, moment.waveTime, PATH, k, { stride: 4, scale: EXAGGERATION }),
      );
      shared.texture.needsUpdate = true;
      for (const { detector, material, place, mark } of marks) {
        // Each mark rides on Earth's surface, moved as the point of Earth under it is.
        const along = (toScene(place).dot(heading) - PATH.from) / (PATH.to - PATH.from);
        const index = Math.round(along * (PATH.bins - 1));
        const h = pairAt(shared.data, index, 4);
        const surface: Triple = [place[0] * 1.01, place[1] * 1.01, place[2] * 1.01];
        const shift = displacement(h, k, surface);
        mark.position.copy(
          toScene([surface[0] + shift[0], surface[1] + shift[1], surface[2] + shift[2]]),
        );
        const lit = reached(moment, place, k);
        material.color.set(MARKS[detector]).multiplyScalar(lit ? 1.6 : 0.35);
      }
    },
    dressEarth(map) {
      earthMaterial.map = map;
      earthMaterial.color.set(0xffffff);
      earthMaterial.needsUpdate = true;
      owned.push(map);
    },
    dispose() {
      for (const item of owned) item.dispose();
    },
  };
}
