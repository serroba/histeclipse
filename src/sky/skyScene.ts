/**
 * The sky view: standing on the ground at a place and moment, looking up.
 *
 * Rendering-only code. The astronomy it relies on lives in tested modules (`horizon.ts`,
 * `look.ts`, `starColor.ts`, `astro/stars.ts`); this file is exercised by the Playwright suite.
 *
 * Everything sits on spheres around the observer, drawn back to front without depth testing:
 * the sky's glow, then stars, constellation figures and the Sun, and the ground last, which
 * hides whatever is below the horizon.
 */

import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TextureLoader,
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
  dragLook,
  figureSegments,
  lookDirection,
  type Figure,
  roundLook,
  shownConstellations,
  zoomLook,
} from './look';
import { starColor } from './starColor';

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

export interface SkyScene {
  setVisible(visible: boolean): void;
  setMoment(moment: SkyMoment): void;
  setLook(look: SkyLook): void;
  setFigures(figures: Figures): void;
  /** Draw another culture's figures; null returns to the modern constellations. */
  setCulture(figures: readonly Figure[] | null): void;
  /** Pixels covered by panels at the top and bottom; the view is centred between them. */
  setInsets(top: number, bottom: number): void;
  /** Called when someone taps the sky (a press that barely moves). */
  onTap(listener: () => void): () => void;
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
const DRAG_SLOP_PIXELS = 3;
/** A press that moves less than this (pixels) in all is a tap, not a drag. */
const TAP_SLOP_PIXELS = 6;

const STAR_VERTEX = /* glsl */ `
  attribute float magnitude;
  attribute vec3 color;
  uniform float limit;
  uniform float pixelRatio;
  uniform float zoom;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 direction = normalize(position);
    float altitude = degrees(asin(clamp(direction.y, -1.0, 1.0)));
    // Extinction: the air dims stars toward the horizon (Kasten & Young air mass).
    float h = max(altitude, 0.0);
    float airmass = 1.0 / (sin(radians(h)) + 0.50572 * pow(h + 6.07995, -1.6364));
    float seen = magnitude + 0.2 * (airmass - 1.0);
    float margin = limit - seen;
    vAlpha = altitude < -0.5 ? 0.0 : clamp(margin / 1.5, 0.0, 1.0);
    gl_PointSize = vAlpha > 0.0 ? clamp(1.5 + 1.2 * margin, 1.5, 9.0) * pixelRatio * zoom : 0.0;
    vColor = color;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const STAR_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float core = pow(clamp(1.0 - d, 0.0, 1.0), 1.6);
    gl_FragColor = vec4(vColor * vAlpha * core, 1.0);
  }
`;

const LINE_VERTEX = /* glsl */ `
  varying float vAltitude;
  void main() {
    vAltitude = normalize(position).y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const LINE_FRAGMENT = /* glsl */ `
  uniform float opacity;
  varying float vAltitude;
  void main() {
    if (vAltitude < 0.0) discard;
    gl_FragColor = vec4(0.47, 0.62, 1.0, opacity);
  }
`;

const DOME_VERTEX = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Day blue, twilight glow toward the Sun, and night: rough, but the order of things is right.
const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 sunDirection;
  uniform float sunAltitude;
  uniform float sunlight;
  varying vec3 vDirection;

  void main() {
    vec3 direction = normalize(vDirection);
    // An eclipse dims the day: little until most of the Sun is covered, then fast.
    float day = smoothstep(-18.0, 8.0, sunAltitude) * pow(sunlight, 0.4);
    vec3 night = vec3(0.006, 0.009, 0.02);
    vec3 zenith = mix(night, vec3(0.16, 0.33, 0.68), day);
    vec3 horizon = mix(vec3(0.014, 0.018, 0.032), vec3(0.62, 0.74, 0.9), day);
    float up = clamp(direction.y, 0.0, 1.0);
    vec3 color = mix(horizon, zenith, pow(up, 0.45));
    float toSun = max(dot(direction, sunDirection), 0.0);
    float twilight = smoothstep(-14.0, -2.0, sunAltitude) * (1.0 - smoothstep(4.0, 14.0, sunAltitude));
    color += vec3(0.95, 0.45, 0.18) * twilight * pow(toSun, 6.0) * (1.0 - up) * 0.9;
    color += vec3(1.0, 0.95, 0.85) * pow(toSun, 400.0) * 0.6 * step(-1.0, sunAltitude) * sunlight;
    // In totality, sunset colours all around the horizon: beyond the shadow it is still day.
    float totality = (1.0 - smoothstep(0.0, 0.02, sunlight)) * step(-1.0, sunAltitude);
    color += vec3(0.85, 0.42, 0.16) * totality * pow(1.0 - up, 8.0) * 0.5;
    gl_FragColor = vec4(color, 1.0);
  }
`;

const GROUND_FRAGMENT = /* glsl */ `
  uniform float sunAltitude;
  uniform float sunlight;
  varying vec3 vDirection;

  void main() {
    vec3 direction = normalize(vDirection);
    if (direction.y > 0.0) discard;
    float day = smoothstep(-12.0, 8.0, sunAltitude) * pow(sunlight, 0.4);
    vec3 color = mix(vec3(0.008, 0.009, 0.011), vec3(0.17, 0.15, 0.11), day);
    // A little haze along the horizon line, so the edge reads as distance.
    color += vec3(0.04, 0.05, 0.07) * (0.3 + day) * exp(direction.y * 60.0);
    gl_FragColor = vec4(color, 1.0);
  }
`;

const MOON_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

// Sunlit where the surface faces the Sun, copper-dark where Earth's shadow falls on it (Earth
// shadow is drawn from the true geometry, in km). The night side is faint earthshine at night,
// and over the Sun's disc it is black: that is the Moon's silhouette in a solar eclipse.
const MOON_FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 sunDirection;
  uniform vec3 moonCentre;
  uniform vec3 moonKm;
  uniform float kmPerUnit;
  uniform vec3 antiSun;
  uniform float umbraSlope;
  uniform float penumbraSlope;
  uniform float earthRadius;
  uniform float sunAngularRadius;
  uniform float night;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorld;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 albedo = texture2D(map, vUv).rgb;
    float lit = smoothstep(-0.02, 0.06, dot(normal, sunDirection));

    // This point of the Moon in km from Earth's centre, and where it sits in Earth's shadow.
    vec3 point = moonKm + (vWorld - moonCentre) * kmPerUnit;
    float along = dot(point, antiSun);
    float across = length(point - along * antiSun);
    float umbra = earthRadius - along * umbraSlope;
    float penumbra = earthRadius + along * penumbraSlope;
    float light = along > 0.0 ? smoothstep(umbra, penumbra, across) : 1.0;
    // Red light bent through Earth's atmosphere still reaches the umbra.
    vec3 sunlit = albedo * mix(vec3(0.5, 0.17, 0.07), vec3(1.0), light);

    vec3 view = normalize(vWorld);
    // Only where it covers the bright disc: elsewhere the dark side is lost in the glare.
    float toSun = atan(length(cross(view, sunDirection)), dot(view, sunDirection));
    float nearSun = 1.0 - smoothstep(sunAngularRadius * 0.98, sunAngularRadius * 1.04, toSun);
    vec3 dark = albedo * 0.02 * night;
    float alpha = max(lit, max(nearSun, night * 0.9));
    gl_FragColor = vec4(mix(dark, sunlit * 1.15, lit), alpha);
  }
`;

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
  const labelLayer = document.createElement('div');
  labelLayer.className = 'sky-labels';
  container.append(labelLayer);

  const scene = new Scene();
  const camera = new PerspectiveCamera(60, 1, 0.1, 1000);

  const sunDirection = { value: new Vector3(0, -1, 0) };
  const sunAltitude = { value: -90 };
  const sunlight = { value: 1 };
  const dome = new Mesh(
    new SphereGeometry(500, 64, 32),
    new ShaderMaterial({
      uniforms: { sunDirection, sunAltitude, sunlight },
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
      uniforms: { opacity: lineOpacity },
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
    new SphereGeometry(sunRadius, 32, 16),
    new MeshBasicMaterial({ color: 0xfff6e0, depthTest: false, depthWrite: false }),
  );
  sun.renderOrder = 3;
  const sunGlow = new Sprite(
    new SpriteMaterial({
      map: glowTexture(),
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    }),
  );
  sunGlow.scale.setScalar(sunRadius * 14);
  sunGlow.renderOrder = 3;
  // The corona: only seen when the Moon hides the whole bright disc.
  const corona = new Sprite(
    new SpriteMaterial({
      map: coronaTexture(),
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    }),
  );
  corona.scale.setScalar(sunRadius * 9);
  corona.renderOrder = 3;
  corona.visible = false;

  const moonTexture = new TextureLoader().load(options.moonTextureUrl, () => {
    needsRender = true;
  });
  moonTexture.colorSpace = SRGBColorSpace;
  const moonUniforms = {
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
  const moonGeometry = new SphereGeometry(1, 48, 24);
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
      uniforms: { sunAltitude, sunlight },
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
  scene.add(dome, stars, lines, planetPoints, sun, sunGlow, corona, moon, ground);

  // Labels: the compass along the horizon, and the names of the figures drawn.
  const planetLabels = PLANET_NAMES.map((name) => ({
    name,
    label: skyLabel(labelLayer, name, 'is-planet'),
    position: new Vector3(),
    shown: false,
  }));
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
      new BufferAttribute(new Float32Array(segments.length * 6), 3),
    );
    placeFigures();
  }

  function placeFigures(): void {
    const attribute = lineGeometry.getAttribute('position');
    if (!(attribute instanceof BufferAttribute)) return;
    const target = attribute.array;
    segments.forEach(([from, to], index) => {
      for (const [offset, star] of [
        [0, from],
        [3, to],
      ] as const) {
        target[index * 6 + offset] = starPositions[star * 3] ?? 0;
        target[index * 6 + offset + 1] = starPositions[star * 3 + 1] ?? 0;
        target[index * 6 + offset + 2] = starPositions[star * 3 + 2] ?? 0;
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
    resize();
    starUniforms.zoom.value = Math.min(2, Math.max(1, Math.sqrt(60 / look.fov)));
    container.dataset['look'] =
      `${look.azimuth.toFixed(1)},${look.altitude.toFixed(1)},${look.fov.toFixed(1)}`;
    needsRender = true;
  }

  function resize(): void {
    const { clientWidth, clientHeight } = container;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / Math.max(clientHeight, 1);
    // The field of view is on the narrower side, as on the globe.
    const half = (look.fov / 2) * (Math.PI / 180);
    camera.fov =
      camera.aspect >= 1
        ? look.fov
        : (2 * Math.atan(Math.tan(half) / camera.aspect) * 180) / Math.PI;
    // Shift the picture so what we look at sits in the middle of the space the panels leave.
    const height = Math.max(clientHeight, 1);
    camera.setViewOffset(
      clientWidth,
      height,
      0,
      -(insets.top - insets.bottom) / 2,
      clientWidth,
      height,
    );
    camera.updateProjectionMatrix();
    needsRender = true;
  }

  const projected = new Vector3();
  function placeLabel(
    label: HTMLElement,
    position: Vector3,
    show: boolean,
    width: number,
    height: number,
  ): void {
    projected.copy(position).project(camera);
    const onScreen =
      show && projected.z < 1 && Math.abs(projected.x) < 1.1 && Math.abs(projected.y) < 1.1;
    label.hidden = !onScreen;
    if (!onScreen) return;
    const x = ((projected.x + 1) / 2) * width;
    const y = ((1 - projected.y) / 2) * height;
    label.style.transform = `translate(${String(x)}px, ${String(y)}px)`;
  }

  function placeLabels(): void {
    // Writes, then one read pass, then writes: the browser lays the page out once a frame.
    const width = container.clientWidth;
    const height = container.clientHeight;
    for (const { label, position } of compassLabels) {
      placeLabel(label, position, true, width, height);
    }
    for (const { label, position, shown } of planetLabels) {
      placeLabel(label, position, shown, width, height);
    }
    // Planets close together on screen (a conjunction) share one label: "Jupiter & Saturn".
    const named: { label: HTMLElement; x: number; y: number; names: string[] }[] = [];
    for (const { name, label, position } of planetLabels) {
      if (label.hidden !== false) continue;
      projected.copy(position).project(camera);
      const x = ((projected.x + 1) / 2) * width;
      const y = ((1 - projected.y) / 2) * height;
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

  function loop(): void {
    frame = requestAnimationFrame(loop);
    if (!needsRender) return;
    needsRender = false;
    renderer.render(scene, camera);
    placeLabels();
    container.dataset['rendered'] = 'true';
  }

  // Dragging turns the view; a wheel or a pinch zooms. Touch and mouse share pointer events.
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch: number | null = null;
  // A single press that has not moved far yet: a tap if it ends here.
  let tap: { id: number; x: number; y: number } | null = null;
  const tapListeners = new Set<() => void>();
  function setLookFromInput(next: SkyLook): void {
    look = next;
    applyLook();
    const rounded = roundLook(look);
    for (const listener of listeners) listener(rounded);
  }
  renderer.domElement.addEventListener('pointerdown', (event) => {
    renderer.domElement.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    pinch = null;
    tap = pointers.size === 1 ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
  });
  renderer.domElement.addEventListener('pointermove', (event) => {
    const last = pointers.get(event.pointerId);
    if (last === undefined) return;
    const current = { x: event.clientX, y: event.clientY };
    if (tap !== null && Math.hypot(current.x - tap.x, current.y - tap.y) > TAP_SLOP_PIXELS) {
      tap = null;
    }
    if (pointers.size === 2) {
      pointers.set(event.pointerId, current);
      const [a, b] = [...pointers.values()];
      if (a === undefined || b === undefined) return;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch !== null && distance > 0) setLookFromInput(zoomLook(look, pinch / distance));
      pinch = distance;
      return;
    }
    const dx = current.x - last.x;
    const dy = current.y - last.y;
    if (Math.hypot(dx, dy) < DRAG_SLOP_PIXELS) return;
    pointers.set(event.pointerId, current);
    setLookFromInput(dragLook(look, dx, dy, container.clientHeight));
  });
  const release = (event: PointerEvent): void => {
    pointers.delete(event.pointerId);
    pinch = null;
  };
  renderer.domElement.addEventListener('pointerup', (event) => {
    release(event);
    if (tap?.id !== event.pointerId) return;
    tap = null;
    for (const listener of tapListeners) listener();
  });
  renderer.domElement.addEventListener('pointercancel', (event) => {
    release(event);
    tap = null;
  });
  renderer.domElement.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      setLookFromInput(zoomLook(look, Math.exp(event.deltaY * 0.0015)));
    },
    { passive: false },
  );

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
      sunGlow.material.opacity = Math.min(1, sunShare * 4);
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
      const current = roundLook(look);
      if (
        current.azimuth === next.azimuth &&
        current.altitude === next.altitude &&
        current.fov === next.fov
      ) {
        return;
      }
      look = next;
      applyLook();
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

function overlaps(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function skyLabel(layer: HTMLElement, text: string, kind: string): HTMLElement {
  const label = document.createElement('span');
  label.className = `sky-label ${kind}`;
  label.textContent = text;
  label.hidden = true;
  layer.append(label);
  return label;
}

/** A soft radial glow for the Sun. */
function glowTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context !== null) {
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 244, 214, 0.9)');
    gradient.addColorStop(0.15, 'rgba(255, 220, 160, 0.35)');
    gradient.addColorStop(1, 'rgba(255, 200, 120, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  }
  return new CanvasTexture(canvas);
}

function unit(vector: Vec3): Vec3 {
  const length = Math.hypot(...vector);
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

/** The corona: pearly streamers fading over a few solar radii. */
function coronaTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (context !== null) {
    const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
    // The sprite is 4.5 solar radii across each way: the Moon's edge is at 0.22.
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.22, 'rgba(240, 244, 255, 0.95)');
    gradient.addColorStop(0.32, 'rgba(210, 222, 255, 0.4)');
    gradient.addColorStop(0.6, 'rgba(180, 200, 255, 0.08)');
    gradient.addColorStop(1, 'rgba(160, 180, 255, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
  }
  return new CanvasTexture(canvas);
}
