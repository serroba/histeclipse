/**
 * The sky view: standing on the ground at a place and moment, looking up.
 *
 * Rendering-only code. The astronomy it relies on lives in tested modules (`horizon.ts`,
 * `look.ts`, `starColor.ts`, `astro/stars.ts`); this file is exercised by the Playwright suite.
 *
 * Everything sits on spheres around the observer, drawn back to front without depth testing:
 * the sky's glow, then stars, constellation figures and the Sun, and the ground last, which
 * hides whatever is below the horizon.
 *
 * The view is stereographic, not a pinhole camera's (see `projection.ts`): every material
 * projects its vertices with `skyProject`, and the camera only supplies the view matrix.
 */

import type { CanvasTexture } from 'three';
import {
  AdditiveBlending,
  BackSide,
  DoubleSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  LineSegments,
  Mesh,
  type Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';

import { apply, type Matrix3, type Vector3 as Vec3 } from '../astro/matrix';
import { starDirection } from '../astro/stars';
import type { Sky } from '../data/sky';
import type { Figures, SkyLook } from '../state/viewState';
import type { JulianDay } from '../time/julianDay';
import { EARTH_SHADOW_ENLARGEMENT } from '../astro/occultation';
import {
  angleBetween,
  angularRadius,
  EARTH_RADIUS_KM,
  eclipsedLimit,
  illuminatedFraction,
  MOON_RADIUS_KM,
  moonSunlight,
  SUN_RADIUS_KM,
  sunVisible,
  topocentric,
} from './bodies';
import {
  aberrate,
  apparentDirection,
  apparentMagnitude,
  horizontal,
  limitingMagnitude,
} from './horizon';
import {
  COMPASS,
  figureSegments,
  lookBetween,
  lookDirection,
  type Figure,
  roundLook,
  shownConstellations,
} from './look';
import {
  CLIP_COS,
  pixelsPerDegree,
  project,
  projectionFrame,
  widestFov,
  type ProjectionFrame,
  toPixels,
} from './projection';
import { createSkyLabelLayer, overlaps, skyLabel } from './skyLabels';
import { starColor } from './starColor';
import {
  DOME_VERTEX,
  GLOW_FRAGMENT,
  GLOW_VERTEX,
  GROUND_FRAGMENT,
  LINE_FRAGMENT,
  LINE_VERTEX,
  MOON_FRAGMENT,
  MOON_VERTEX,
  SKY_FRAGMENT,
  STAR_FRAGMENT,
  STAR_VERTEX,
  SUN_FRAGMENT,
  SUN_VERTEX,
} from './skyShaders';
import { coronaTexture, glowTexture } from './skyTextures';
import { attachSkyGestures } from './skyGestures';

export interface SkyMoment {
  /** J2000 → horizon frame (x east, y north, z up) for the observer at this moment. */
  readonly horizon: Matrix3;
  readonly jdTT: JulianDay;
  /** The Sun's position from Earth's centre, km, J2000 equatorial. */
  readonly sun: Vec3;
  /** The Moon's position from Earth's centre, km, J2000; null until its theory has loaded. */
  readonly moon: Vec3 | null;
  /** The observer's position from Earth's centre, km, J2000. */
  readonly observer: Vec3;
  /** The planets as seen from the observer; empty until their theory has loaded. */
  readonly planets: readonly SkyPlanet[];
  /** Earth's velocity, km/s, J2000: everything in the sky is shifted by annual aberration. */
  readonly velocity: Vec3;
}

export interface SkyPlanet {
  readonly name: string;
  /** Direction from the observer, J2000 equatorial (any length). */
  readonly direction: Vec3;
  readonly magnitude: number;
}

/** Planet colours as the eye sees them: Mars ruddy, Saturn pale gold, the rest near white. */
const PLANET_COLOURS: Readonly<Record<string, readonly [number, number, number]>> = {
  Mercury: [1, 0.95, 0.88],
  Venus: [1, 0.98, 0.9],
  Mars: [1, 0.62, 0.42],
  Jupiter: [1, 0.96, 0.86],
  Saturn: [1, 0.9, 0.68],
};
const PLANET_NAMES = Object.keys(PLANET_COLOURS);

/** The bodies a tap can pick out of the sky. */
export type SkyBody = 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn';

/** A body tapped, where it stands, and how large it looks (radius, degrees; 0 for a point). */
export interface SkyTap {
  readonly body: SkyBody;
  readonly azimuth: number;
  readonly altitude: number;
  readonly radius: number;
}

/** A tap this near a body picks it, pixels from its centre (or its disc's edge): a fingertip. */
const BODY_TAP_PIXELS = 24;

/** A body to point out, by name, where it stands. */
export interface SkyMark {
  readonly name: string;
  /** Degrees from north through east, and above the horizon. */
  readonly azimuth: number;
  readonly altitude: number;
}

export interface SkyScene {
  setVisible(visible: boolean): void;
  setMoment(moment: SkyMoment): void;
  setLook(look: SkyLook): void;
  /** Turn and close in on a look over `ms`, then resolve; input or a new look cuts it short. */
  glideTo(look: SkyLook, ms: number): Promise<void>;
  setFigures(figures: Figures): void;
  /** Draw another culture's figures; null returns to the modern constellations. */
  setCulture(figures: readonly Figure[] | null): void;
  /** Pixels covered by panels at the top and bottom; the view is centred between them. */
  setInsets(top: number, bottom: number): void;
  /** Point out named bodies, as a record being checked names them; empty clears them. */
  setMarks(marks: readonly SkyMark[]): void;
  /**
   * Called when someone taps the sky (a press that barely moves): with the Sun, the Moon or the
   * planet under the tap, where it stands, or null for the sky itself.
   */
  onTap(listener: (tapped: SkyTap | null) => void): () => void;
  /** Called with the rounded look as the observer drags or zooms. */
  onLookChange(listener: (look: SkyLook) => void): () => void;
}

const STAR_RADIUS = 100;
const SUN_DISTANCE = 80;
// The Moon sits in front of the Sun, so it is drawn nearer; only its angular size matters.
const MOON_DISTANCE = 70;
const EARTH_SHADOW_RADIUS_KM = EARTH_RADIUS_KM * EARTH_SHADOW_ENLARGEMENT;
const SUN_ANGULAR_RADIUS = (0.2666 * Math.PI) / 180;
/** The proper-motion positions only need recomputing after this many days. */
const MOTION_STEP_DAYS = 365.25;
/** Each figure line is drawn in this many pieces, so it can follow its curve on screen. */
const LINE_PIECES = 8;

/** From the horizon frame (x east, y north, z up) to scene axes (x east, y up, z south). */
function toScene([east, north, up]: Vec3): [number, number, number] {
  return [east, up, -north];
}

export function createSkyScene(
  container: HTMLElement,
  options: { sky: Sky; look: SkyLook; figures: Figures; moonTextureUrl: string },
): SkyScene {
  const { sky } = options;
  const count = sky.stars.hr.length;

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.append(renderer.domElement);
  const labelLayer = createSkyLabelLayer(container);

  const scene = new Scene();
  // Only its position and turn are used: the projection is the shaders' (see projection.ts).
  const camera = new PerspectiveCamera(60, 1, 0.1, 1000);
  let view: ProjectionFrame = projectionFrame(90, 1, 1);
  // Shared by every material in the sky: one update moves them all.
  const projection = {
    skyScale: { value: new Vector2(1, 1) },
    skyShift: { value: new Vector2(0, 0) },
    skyClip: { value: CLIP_COS },
    skyViewport: { value: new Vector2(1, 1) },
  };

  const sunDirection = { value: new Vector3(0, -1, 0) };
  const sunAltitude = { value: -90 };
  const sunlight = { value: 1 };
  const dome = new Mesh(
    new SphereGeometry(500, 64, 32),
    new ShaderMaterial({
      uniforms: { ...projection, sunDirection, sunAltitude, sunlight },
      vertexShader: DOME_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      side: BackSide,
      depthTest: false,
      depthWrite: false,
    }),
  );
  dome.renderOrder = 0;

  // Stars: positions change with time; magnitudes and colours are fixed.
  const starPositions = new Float32Array(count * 3);
  const starColors = new Float32Array(count * 3);
  const magnitudes = new Float32Array(count);
  sky.stars.vmag.forEach((vmag, index) => {
    magnitudes[index] = vmag;
    const [r, g, b] = starColor(sky.stars.bv[index] ?? null);
    starColors.set([r, g, b], index * 3);
  });
  const starGeometry = new BufferGeometry();
  const starPositionAttribute = new BufferAttribute(starPositions, 3);
  starGeometry.setAttribute('position', starPositionAttribute);
  starGeometry.setAttribute('color', new BufferAttribute(starColors, 3));
  starGeometry.setAttribute('magnitude', new BufferAttribute(magnitudes, 1));
  const starUniforms = {
    ...projection,
    limit: { value: 6.5 },
    pixelRatio: { value: renderer.getPixelRatio() },
    zoom: { value: 1 },
  };
  const stars = new Points(
    starGeometry,
    new ShaderMaterial({
      uniforms: starUniforms,
      vertexShader: STAR_VERTEX,
      fragmentShader: STAR_FRAGMENT,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    }),
  );
  stars.frustumCulled = false;
  stars.renderOrder = 1;

  const lineOpacity = { value: 0.35 };
  const lineGeometry = new BufferGeometry();
  const lines = new LineSegments(
    lineGeometry,
    new ShaderMaterial({
      uniforms: { ...projection, opacity: lineOpacity },
      vertexShader: LINE_VERTEX,
      fragmentShader: LINE_FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  lines.frustumCulled = false;
  lines.renderOrder = 2;

  const sunRadius = SUN_DISTANCE * Math.tan(SUN_ANGULAR_RADIUS);
  const sun = new Mesh(
    // Fine enough to stay round when the view closes in on it.
    new SphereGeometry(sunRadius, 96, 48),
    new ShaderMaterial({
      uniforms: { ...projection, color: { value: new Color(0xfff6e0) } },
      vertexShader: SUN_VERTEX,
      fragmentShader: SUN_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    }),
  );
  sun.renderOrder = 3;
  const sunGlowOpacity = { value: 1 };
  let sunGlowShare = 1;
  /**
   * The glare round the Sun, by how much of it is showing; and faded as the view closes in, as
   * it spans some 4° and would cover a narrow view, hiding the disc it surrounds.
   */
  function showSunGlow(): void {
    const close = Math.min(1, Math.max(0.1, (look.fov - 2) / 10));
    sunGlowOpacity.value = Math.min(1, sunGlowShare * 4) * close;
  }
  const sunGlow = glowDisc(glowTexture(), (sunRadius * 14) / SUN_DISTANCE, sunGlowOpacity);
  sunGlow.renderOrder = 3;
  // The corona: only seen when the Moon hides the whole bright disc.
  const corona = glowDisc(coronaTexture(), (sunRadius * 9) / SUN_DISTANCE, { value: 1 });
  corona.renderOrder = 3;
  corona.visible = false;
  function glowDisc(map: CanvasTexture, extent: number, opacity: { value: number }): Mesh {
    return new Mesh(
      new PlaneGeometry(1, 1),
      new ShaderMaterial({
        uniforms: { ...projection, map: { value: map }, extent: { value: extent }, opacity },
        vertexShader: GLOW_VERTEX,
        fragmentShader: GLOW_FRAGMENT,
        blending: AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        side: DoubleSide,
      }),
    );
  }

  const moonTexture = new TextureLoader().load(options.moonTextureUrl, () => {
    needsRender = true;
  });
  moonTexture.colorSpace = SRGBColorSpace;
  const moonUniforms = {
    ...projection,
    map: { value: moonTexture },
    sunDirection,
    moonCentre: { value: new Vector3() },
    moonKm: { value: new Vector3() },
    kmPerUnit: { value: 1 },
    antiSun: { value: new Vector3() },
    umbraSlope: { value: 0 },
    penumbraSlope: { value: 0 },
    earthRadius: { value: EARTH_SHADOW_RADIUS_KM },
    sunAngularRadius: { value: SUN_ANGULAR_RADIUS },
    night: { value: 1 },
  };
  // As on the globe: turn the map's longitude 0 (at +X) to +Z, which lookAt() aims at us.
  const moonGeometry = new SphereGeometry(1, 96, 48);
  moonGeometry.rotateY(-Math.PI / 2);
  const moon = new Mesh(
    moonGeometry,
    new ShaderMaterial({
      uniforms: moonUniforms,
      vertexShader: MOON_VERTEX,
      fragmentShader: MOON_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      // Drawn after the Sun and its glow, which it covers in an eclipse.
      transparent: true,
    }),
  );
  moon.renderOrder = 3.5;
  moon.visible = false;

  const ground = new Mesh(
    new SphereGeometry(50, 64, 32),
    new ShaderMaterial({
      uniforms: { ...projection, sunAltitude, sunlight },
      vertexShader: DOME_VERTEX,
      fragmentShader: GROUND_FRAGMENT,
      side: BackSide,
      depthTest: false,
      depthWrite: false,
      // three.js draws transparent objects after opaque ones whatever their renderOrder, so the
      // ground must be "transparent" to be drawn last, over the Sun's glow below the horizon.
      transparent: true,
    }),
  );
  ground.renderOrder = 4;
  // The planets: drawn like stars (the same shader), one point each, in front of the stars
  // and behind the Moon, which can pass in front of them.
  const planetPositions = new Float32Array(PLANET_NAMES.length * 3);
  const planetMagnitudes = new Float32Array(PLANET_NAMES.length).fill(99);
  const planetColours = new Float32Array(
    PLANET_NAMES.flatMap((name) => [...(PLANET_COLOURS[name] ?? [1, 1, 1])]),
  );
  const planetGeometry = new BufferGeometry();
  const planetPositionAttribute = new BufferAttribute(planetPositions, 3);
  const planetMagnitudeAttribute = new BufferAttribute(planetMagnitudes, 1);
  planetGeometry.setAttribute('position', planetPositionAttribute);
  planetGeometry.setAttribute('color', new BufferAttribute(planetColours, 3));
  planetGeometry.setAttribute('magnitude', planetMagnitudeAttribute);
  const planetPoints = new Points(
    planetGeometry,
    new ShaderMaterial({
      uniforms: starUniforms,
      vertexShader: STAR_VERTEX,
      fragmentShader: STAR_FRAGMENT,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    }),
  );
  planetPoints.frustumCulled = false;
  planetPoints.renderOrder = 2.5;
  const everything: Object3D[] = [
    dome,
    stars,
    lines,
    planetPoints,
    sun,
    sunGlow,
    corona,
    moon,
    ground,
  ];
  // The camera's frustum is a pinhole's and does not match what the shaders put on screen.
  for (const object of everything) object.frustumCulled = false;
  scene.add(...everything);

  // Labels: the compass along the horizon, and the names of the figures drawn.
  const planetLabels = PLANET_NAMES.map((name) => ({
    name,
    label: skyLabel(labelLayer, name, 'is-planet'),
    position: new Vector3(),
    shown: false,
  }));
  let markLabels: { label: HTMLElement; position: Vector3 }[] = [];
  const compassLabels = COMPASS.map(([name, azimuth]) => {
    const label = skyLabel(labelLayer, name, 'is-compass');
    const position = new Vector3(...toScene(lookDirectionAt(azimuth, 0))).multiplyScalar(40);
    return { label, position };
  });
  // The figures in use: the modern constellations, or another culture's.
  let catalogue: readonly Figure[] = sky.constellations;
  let nameLabels = makeNameLabels();
  let namesBySize = bySize();
  function bySize(): { label: HTMLElement; position: Vector3 }[] {
    return [...nameLabels.values()].sort(
      (a, b) => b.figure.lines.flat().length - a.figure.lines.flat().length,
    );
  }
  function makeNameLabels(): Map<
    number,
    { figure: Figure; label: HTMLElement; position: Vector3 }
  > {
    return new Map(
      catalogue.map((figure, index) => [
        // Serpens is named twice under one id, so key by position in the list.
        index,
        {
          figure,
          label: skyLabel(
            labelLayer,
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

  let look = options.look;
  let figures = options.figures;
  let shown: readonly Figure[] = [];
  let segments: [number, number][] = [];
  let visible = false;
  // Earth's velocity at the moment shown, for annual aberration.
  let motion: Vec3 = [0, 0, 0];
  let insets = { top: 0, bottom: 0 };
  let needsRender = true;
  let frame = 0;
  // A glide under way: from where, to where, over how long, and when it started (by the frames'
  // own clock, from the first frame it is drawn in).
  let glide: {
    readonly from: SkyLook;
    readonly to: SkyLook;
    readonly ms: number;
    start: number | null;
    readonly done: () => void;
  } | null = null;
  const sameLook = (a: SkyLook, b: SkyLook): boolean => {
    const [x, y] = [roundLook(a), roundLook(b)];
    return x.azimuth === y.azimuth && x.altitude === y.altitude && x.fov === y.fov;
  };
  function endGlide(): void {
    const ended = glide;
    glide = null;
    ended?.done();
  }
  // J2000 directions after proper motion, recomputed when time has moved far enough.
  const starJ2000 = new Float64Array(count * 3);
  let motionEpoch: number | null = null;
  const listeners = new Set<(look: SkyLook) => void>();

  function updateMotion(jdTT: JulianDay): void {
    if (motionEpoch !== null && Math.abs(jdTT - motionEpoch) < MOTION_STEP_DAYS) return;
    motionEpoch = jdTT;
    const { ra, dec, pmRa, pmDec, parallax, radialVelocity } = sky.stars;
    for (let index = 0; index < count; index++) {
      const direction = starDirection(
        {
          ra: ra[index] ?? 0,
          dec: dec[index] ?? 0,
          pmRa: pmRa[index] ?? 0,
          pmDec: pmDec[index] ?? 0,
          parallax: parallax[index] ?? null,
          radialVelocity: radialVelocity[index] ?? null,
        },
        jdTT,
      );
      starJ2000.set(direction, index * 3);
    }
  }

  function rebuildFigures(): void {
    shown = shownConstellations(catalogue, figures);
    segments = figureSegments(shown);
    lineGeometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(segments.length * LINE_PIECES * 6), 3),
    );
    placeFigures();
  }

  function placeFigures(): void {
    const attribute = lineGeometry.getAttribute('position');
    if (!(attribute instanceof BufferAttribute)) return;
    const target = attribute.array;
    // Straight lines between stars curve on a stereographic view, so each is drawn in pieces
    // along its chord; the shader puts every point back on the sphere.
    segments.forEach(([from, to], index) => {
      for (let piece = 0; piece < LINE_PIECES; piece++) {
        const base = (index * LINE_PIECES + piece) * 6;
        for (const [offset, t] of [
          [0, piece / LINE_PIECES],
          [3, (piece + 1) / LINE_PIECES],
        ] as const) {
          for (let axis = 0; axis < 3; axis++) {
            const a = starPositions[from * 3 + axis] ?? 0;
            const b = starPositions[to * 3 + axis] ?? 0;
            target[base + offset + axis] = a + (b - a) * t;
          }
        }
      }
    });
    attribute.needsUpdate = true;
    // Names sit at the middle of their figure's stars, so they travel with them.
    for (const { figure, position } of nameLabels.values()) {
      position.set(0, 0, 0);
      for (const star of figure.lines.flat()) {
        position.x += starPositions[star * 3] ?? 0;
        position.y += starPositions[star * 3 + 1] ?? 0;
        position.z += starPositions[star * 3 + 2] ?? 0;
      }
      if (position.lengthSq() > 0) position.setLength(40);
    }
    for (const entry of nameLabels.values()) {
      entry.label.dataset['shown'] = String(
        shown.includes(entry.figure) && entry.figure.lines.length > 0,
      );
    }
    needsRender = true;
  }

  function applyLook(): void {
    const [x, y, z] = toScene(lookDirection({ ...look, altitude: Math.min(look.altitude, 89.9) }));
    camera.up.set(0, 1, 0);
    camera.lookAt(x, y, z);
    // Labels are placed from the view matrix, so keep it current between renders.
    camera.updateMatrixWorld();
    resize();
    starUniforms.zoom.value = Math.min(2, Math.max(1, Math.sqrt(60 / look.fov)));
    showSunGlow();
    needsRender = true;
  }

  function resize(): void {
    const { clientWidth, clientHeight } = container;
    renderer.setSize(clientWidth, clientHeight, false);
    // The field of view is on the narrower side, as on the globe, and what we look at sits in
    // the middle of the space the panels leave. A tall phone shows no more than it can without
    // bending the sky like a fisheye (#253).
    const widest = widestFov(clientWidth, clientHeight);
    if (look.fov > widest) look = { ...look, fov: widest };
    container.dataset['look'] =
      `${look.azimuth.toFixed(1)},${look.altitude.toFixed(1)},${look.fov.toFixed(1)}`;
    view = projectionFrame(look.fov, clientWidth, clientHeight, insets.top, insets.bottom);
    projection.skyScale.value.set(view.scaleX, view.scaleY);
    projection.skyShift.value.set(0, view.shiftY);
    renderer.getDrawingBufferSize(projection.skyViewport.value);
    needsRender = true;
  }

  const inView = new Vector3();
  /** Where a scene position lands on screen, in NDC, as the shaders put it; null if behind. */
  function screenPoint(position: Vector3): readonly [number, number] | null {
    inView.copy(position).applyMatrix4(camera.matrixWorldInverse);
    return project(view, [inView.x, inView.y, inView.z]);
  }
  function placeLabel(
    label: HTMLElement,
    position: Vector3,
    show: boolean,
    width: number,
    height: number,
  ): void {
    const ndc = show ? screenPoint(position) : null;
    const onScreen = ndc !== null && Math.abs(ndc[0]) < 1.1 && Math.abs(ndc[1]) < 1.1;
    label.hidden = !onScreen;
    if (!onScreen) return;
    const [x, y] = toPixels(ndc, width, height);
    label.style.transform = `translate(${String(x)}px, ${String(y)}px)`;
  }

  function placeLabels(): void {
    // Writes, then one read pass, then writes: the browser lays the page out once a frame.
    const width = container.clientWidth;
    const height = container.clientHeight;
    for (const { label, position } of compassLabels) {
      placeLabel(label, position, true, width, height);
    }
    // Where the Sun's disc is on screen, in pixels, for whoever needs to find it.
    const sunAt = sun.visible ? screenPoint(sun.position) : null;
    container.dataset['sunAt'] =
      sunAt === null
        ? 'off'
        : toPixels(sunAt, width, height)
            .map((v) => v.toFixed(0))
            .join(',');
    for (const { label, position } of markLabels) {
      placeLabel(label, position, true, width, height);
    }
    for (const { label, position, shown } of planetLabels) {
      placeLabel(label, position, shown, width, height);
    }
    // Planets close together on screen (a conjunction) share one label: "Jupiter & Saturn".
    const named: { label: HTMLElement; x: number; y: number; names: string[] }[] = [];
    for (const { name, label, position } of planetLabels) {
      if (label.hidden !== false) continue;
      const ndc = screenPoint(position);
      if (ndc === null) continue;
      const [x, y] = toPixels(ndc, width, height);
      const near = named.find((other) => Math.hypot(other.x - x, other.y - y) < 24);
      if (near === undefined) {
        named.push({ label, x, y, names: [name] });
      } else {
        near.names.push(name);
        label.hidden = true;
      }
    }
    for (const { label, names } of named) label.textContent = names.join(' & ');
    for (const { label, position } of namesBySize) {
      // Names of figures low in the haze or below the horizon are left out.
      const show = label.dataset['shown'] === 'true' && position.y > 40 * 0.03;
      placeLabel(label, position, show, width, height);
    }
    const candidates = namesBySize.filter(({ label }) => label.hidden === false);
    const boxes = candidates.map(({ label }) => label.getBoundingClientRect());
    // Planets keep their names; then bigger figures first. A name that would overlap one
    // already placed is left out.
    const placed: DOMRect[] = planetLabels
      .filter(({ label }) => label.hidden === false)
      .map(({ label }) => label.getBoundingClientRect());
    candidates.forEach(({ label }, index) => {
      const box = boxes[index];
      if (box === undefined) return;
      if (placed.some((other) => overlaps(box, other))) {
        label.hidden = true;
      } else {
        placed.push(box);
      }
    });
  }

  function placeMoon(
    horizon: Matrix3,
    sunJ2000: Vec3,
    moonJ2000: Vec3 | null,
    sunHere: Vec3,
    moonHere: Vec3 | null,
    sunHigh: number,
  ): void {
    if (moonJ2000 === null || moonHere === null) {
      moon.visible = false;
      return;
    }
    const seen = apparentDirection(horizon, aberrate(moonHere, motion));
    const high = horizontal(seen).altitude;
    moon.visible = high > -1;
    const [mx, my, mz] = toScene(seen);
    const radius = MOON_DISTANCE * Math.tan(angularRadius(MOON_RADIUS_KM, moonHere));
    moon.position.set(mx, my, mz).multiplyScalar(MOON_DISTANCE);
    moon.scale.setScalar(radius);
    // The near side faces us (the map's longitude 0 is the mesh's +Z), north toward the pole.
    moon.up.set(...toScene(apply(horizon, [0, 0, 1])));
    moon.lookAt(0, 0, 0);

    // Earth's shadow, in the scene's axes but in km: the horizon frame is a turn of J2000.
    const inScene = (vector: Vec3): Vector3 => new Vector3(...toScene(apply(horizon, vector)));
    const sunDistance = Math.hypot(...sunJ2000);
    moonUniforms.moonCentre.value.copy(moon.position);
    moonUniforms.moonKm.value.copy(inScene(moonJ2000));
    moonUniforms.kmPerUnit.value = MOON_RADIUS_KM / radius;
    moonUniforms.antiSun.value.copy(inScene(unit(sunJ2000))).negate();
    moonUniforms.umbraSlope.value = (SUN_RADIUS_KM - EARTH_SHADOW_RADIUS_KM) / sunDistance;
    moonUniforms.penumbraSlope.value = (SUN_RADIUS_KM + EARTH_SHADOW_RADIUS_KM) / sunDistance;
    moonUniforms.night.value = 1 - Math.min(1, Math.max(0, (sunHigh + 12) / 12));

    container.dataset['moonAltitude'] = high.toFixed(2);
    container.dataset['moonPhase'] = illuminatedFraction(moonHere, sunHere).toFixed(3);
    container.dataset['moonSunlight'] = moonSunlight(moonJ2000, sunJ2000).toFixed(3);
  }

  function placePlanets(
    horizon: Matrix3,
    planets: readonly SkyPlanet[],
    limit: number,
    sunHere: Vec3 | null,
    moonHere: Vec3 | null,
  ): void {
    const report: string[] = [];
    // A planet behind the Moon's or the Sun's disc is hidden, point and name.
    const covers = (body: Vec3 | null, radiusKm: number, direction: Vec3): boolean =>
      body !== null && angleBetween(body, direction) < angularRadius(radiusKm, body);
    PLANET_NAMES.forEach((name, index) => {
      const planet = planets.find((entry) => entry.name === name);
      const entry = planetLabels[index];
      if (entry === undefined) return;
      if (planet === undefined) {
        planetMagnitudes[index] = 99;
        entry.shown = false;
        return;
      }
      const seen = apparentDirection(horizon, aberrate(planet.direction, motion));
      const [x, y, z] = toScene(seen);
      const radius = STAR_RADIUS * 0.99;
      planetPositions.set([x * radius, y * radius, z * radius], index * 3);
      const hidden =
        covers(moonHere, MOON_RADIUS_KM, planet.direction) ||
        covers(sunHere, SUN_RADIUS_KM, planet.direction);
      planetMagnitudes[index] = hidden ? 99 : planet.magnitude;
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
    planetPositionAttribute.needsUpdate = true;
    planetMagnitudeAttribute.needsUpdate = true;
    container.dataset['planets'] = report.join(' ');
  }

  function loop(now: number): void {
    frame = requestAnimationFrame(loop);
    if (glide !== null) {
      glide.start ??= now;
      const progress = Math.min(1, (now - glide.start) / glide.ms);
      look = lookBetween(glide.from, glide.to, 1 - (1 - progress) ** 3);
      applyLook();
      if (progress === 1) endGlide();
    }
    if (!needsRender) return;
    needsRender = false;
    renderer.render(scene, camera);
    placeLabels();
    container.dataset['rendered'] = 'true';
  }

  const tapListeners = new Set<(tapped: SkyTap | null) => void>();
  /** The body under a point of the page, nearest first, or null. */
  function bodyAt(clientX: number, clientY: number): SkyTap | null {
    const box = renderer.domElement.getBoundingClientRect();
    const width = container.clientWidth;
    const height = container.clientHeight;
    const perDegree = pixelsPerDegree(view, width);
    const moonRadius = (Math.atan(moon.scale.x / MOON_DISTANCE) * 180) / Math.PI;
    const candidates: { body: SkyBody; position: Vector3; radius: number }[] = [
      ...(sun.visible ? [{ body: 'sun' as const, position: sun.position, radius: 0.27 }] : []),
      ...(moon.visible
        ? [{ body: 'moon' as const, position: moon.position, radius: moonRadius }]
        : []),
      ...planetLabels
        .filter(({ shown }) => shown)
        .map(({ name, position }) => ({
          body: name.toLowerCase() as SkyBody,
          position,
          radius: 0,
        })),
    ];
    let best: { tapped: SkyTap; share: number } | null = null;
    for (const { body, position, radius } of candidates) {
      const ndc = screenPoint(position);
      if (ndc === null) continue;
      const [x, y] = toPixels(ndc, width, height);
      const reach = Math.max(BODY_TAP_PIXELS, radius * perDegree + BODY_TAP_PIXELS / 3);
      const share = Math.hypot(clientX - box.left - x, clientY - box.top - y) / reach;
      if (share >= 1 || (best !== null && share >= best.share)) continue;
      // Scene axes back to the horizon's: east, north, up.
      const { azimuth, altitude } = horizontal([position.x, -position.z, position.y]);
      best = { tapped: { body, azimuth, altitude, radius }, share };
    }
    return best?.tapped ?? null;
  }
  function setLookFromInput(next: SkyLook): void {
    endGlide();
    look = next;
    applyLook();
    const rounded = roundLook(look);
    for (const listener of listeners) listener(rounded);
  }
  attachSkyGestures(renderer.domElement, {
    look: () => look,
    setLook: setLookFromInput,
    pixelsPerDegree: () => pixelsPerDegree(view, container.clientWidth),
    bodyAt,
    tapped(tapped) {
      for (const listener of tapListeners) listener(tapped);
    },
  });

  new ResizeObserver(resize).observe(container);
  rebuildFigures();
  applyLook();

  return {
    setVisible(next) {
      if (next === visible) return;
      visible = next;
      container.hidden = !next;
      if (next) {
        resize();
        needsRender = true;
        frame = requestAnimationFrame(loop);
      } else {
        cancelAnimationFrame(frame);
        endGlide();
      }
    },
    setMoment({ horizon, jdTT, sun: sunJ2000, moon: moonJ2000, observer, planets, velocity }) {
      updateMotion(jdTT);
      motion = velocity;
      const sunHere = topocentric(sunJ2000, observer);
      const sunSeen = apparentDirection(horizon, aberrate(sunHere, motion));
      const sunHigh = horizontal(sunSeen).altitude;
      const moonHere = moonJ2000 === null ? null : topocentric(moonJ2000, observer);
      // How much of the Sun the Moon leaves, if the Sun is up to be seen.
      const sunShare = moonHere === null || sunHigh < -1 ? 1 : sunVisible(sunHere, moonHere);
      const limit = eclipsedLimit(limitingMagnitude(sunHigh), sunShare);
      let seen = 0;
      for (let index = 0; index < count; index++) {
        const direction = apparentDirection(
          horizon,
          aberrate(
            [
              starJ2000[index * 3] ?? 0,
              starJ2000[index * 3 + 1] ?? 0,
              starJ2000[index * 3 + 2] ?? 0,
            ],
            motion,
          ),
        );
        const [x, y, z] = toScene(direction);
        starPositions[index * 3] = x * STAR_RADIUS;
        starPositions[index * 3 + 1] = y * STAR_RADIUS;
        starPositions[index * 3 + 2] = z * STAR_RADIUS;
        const altitude = (Math.asin(Math.max(-1, Math.min(1, direction[2]))) * 180) / Math.PI;
        if (altitude > 0 && apparentMagnitude(sky.stars.vmag[index] ?? 99, altitude) < limit)
          seen++;
      }
      starPositionAttribute.needsUpdate = true;
      placeFigures();

      const [sx, sy, sz] = toScene(sunSeen);
      sunDirection.value.set(sx, sy, sz);
      sunAltitude.value = sunHigh;
      sun.position.set(sx, sy, sz).multiplyScalar(SUN_DISTANCE);
      sunGlow.position.copy(sun.position);
      sun.visible = sunHigh > -1;
      sunGlow.visible = sun.visible && sunShare > 0;
      sunGlowShare = sunShare;
      showSunGlow();
      sunlight.value = sunShare;
      corona.position.copy(sun.position);
      corona.visible = sun.visible && sunShare < 0.002;
      placeMoon(horizon, sunJ2000, moonJ2000, sunHere, moonHere, sunHigh);
      container.dataset['sunVisible'] = sunShare.toFixed(4);
      starUniforms.limit.value = limit;
      // Figures stay faintly visible by day, as a guide to where things are.
      lineOpacity.value = 0.12 + 0.28 * (1 - Math.min(1, Math.max(0, (sunHigh + 18) / 18)));
      container.dataset['sunAltitude'] = sunHigh.toFixed(2);
      container.dataset['starsSeen'] = String(seen);
      placePlanets(horizon, planets, limit, sunHigh > -1 ? sunHere : null, moonHere);
      needsRender = true;
    },
    setLook(next) {
      // While gliding, the look the link held when it began, or the one it ends on, is the
      // glide's own: let it run.
      if (glide !== null && (sameLook(next, glide.from) || sameLook(next, glide.to))) return;
      if (sameLook(next, look)) return;
      endGlide();
      look = next;
      applyLook();
    },
    glideTo(next, ms) {
      endGlide();
      return new Promise((resolve) => {
        glide = { from: look, to: next, ms, start: null, done: resolve };
        needsRender = true;
      });
    },
    setFigures(next) {
      if (next === figures) return;
      figures = next;
      rebuildFigures();
    },
    setCulture(next) {
      const wanted = next ?? sky.constellations;
      if (wanted === catalogue) return;
      catalogue = wanted;
      for (const { label } of nameLabels.values()) label.remove();
      nameLabels = makeNameLabels();
      namesBySize = bySize();
      rebuildFigures();
    },
    setMarks(marks) {
      for (const { label } of markLabels) label.remove();
      markLabels = marks.map(({ name, azimuth, altitude }) => ({
        label: skyLabel(labelLayer, name, 'is-mark'),
        position: new Vector3(...toScene(lookDirectionAt(azimuth, altitude))).multiplyScalar(40),
      }));
      placeLabels();
    },
    setInsets(top, bottom) {
      if (top === insets.top && bottom === insets.bottom) return;
      insets = { top, bottom };
      resize();
    },
    onTap(listener) {
      tapListeners.add(listener);
      return () => tapListeners.delete(listener);
    },
    onLookChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function lookDirectionAt(azimuth: number, altitude: number): Vec3 {
  return lookDirection({ azimuth, altitude, fov: 60 });
}

function unit(vector: Vec3): Vec3 {
  const length = Math.hypot(...vector);
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}
