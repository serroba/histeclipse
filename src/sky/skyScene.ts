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
  Vector3,
  WebGLRenderer,
} from 'three';

import type { Matrix3, Vector3 as Vec3 } from '../astro/matrix';
import { starDirection } from '../astro/stars';
import type { Constellation, Sky } from '../data/sky';
import type { Figures, SkyLook } from '../state/viewState';
import type { JulianDay } from '../time/julianDay';
import { apparentDirection, apparentMagnitude, horizontal, limitingMagnitude } from './horizon';
import {
  COMPASS,
  dragLook,
  figureSegments,
  lookDirection,
  roundLook,
  shownConstellations,
  zoomLook,
} from './look';
import { starColor } from './starColor';

export interface SkyMoment {
  /** J2000 → horizon frame (x east, y north, z up) for the observer at this moment. */
  readonly horizon: Matrix3;
  readonly jdTT: JulianDay;
  /** The Sun's direction or position, J2000 equatorial. */
  readonly sun: Vec3;
}

export interface SkyScene {
  setVisible(visible: boolean): void;
  setMoment(moment: SkyMoment): void;
  setLook(look: SkyLook): void;
  setFigures(figures: Figures): void;
  /** Called with the rounded look as the observer drags or zooms. */
  onLookChange(listener: (look: SkyLook) => void): () => void;
}

const STAR_RADIUS = 100;
const SUN_DISTANCE = 80;
const SUN_ANGULAR_RADIUS = (0.2666 * Math.PI) / 180;
/** The proper-motion positions only need recomputing after this many days. */
const MOTION_STEP_DAYS = 365.25;
const DRAG_SLOP_PIXELS = 3;

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
  varying vec3 vDirection;

  void main() {
    vec3 direction = normalize(vDirection);
    float day = smoothstep(-18.0, 8.0, sunAltitude);
    vec3 night = vec3(0.006, 0.009, 0.02);
    vec3 zenith = mix(night, vec3(0.16, 0.33, 0.68), day);
    vec3 horizon = mix(vec3(0.014, 0.018, 0.032), vec3(0.62, 0.74, 0.9), day);
    float up = clamp(direction.y, 0.0, 1.0);
    vec3 color = mix(horizon, zenith, pow(up, 0.45));
    float toSun = max(dot(direction, sunDirection), 0.0);
    float twilight = smoothstep(-14.0, -2.0, sunAltitude) * (1.0 - smoothstep(4.0, 14.0, sunAltitude));
    color += vec3(0.95, 0.45, 0.18) * twilight * pow(toSun, 6.0) * (1.0 - up) * 0.9;
    color += vec3(1.0, 0.95, 0.85) * pow(toSun, 400.0) * 0.6 * step(-1.0, sunAltitude);
    gl_FragColor = vec4(color, 1.0);
  }
`;

const GROUND_FRAGMENT = /* glsl */ `
  uniform float sunAltitude;
  varying vec3 vDirection;

  void main() {
    vec3 direction = normalize(vDirection);
    if (direction.y > 0.0) discard;
    float day = smoothstep(-12.0, 8.0, sunAltitude);
    vec3 color = mix(vec3(0.008, 0.009, 0.011), vec3(0.17, 0.15, 0.11), day);
    // A little haze along the horizon line, so the edge reads as distance.
    color += vec3(0.04, 0.05, 0.07) * (0.3 + day) * exp(direction.y * 60.0);
    gl_FragColor = vec4(color, 1.0);
  }
`;

/** From the horizon frame (x east, y north, z up) to scene axes (x east, y up, z south). */
function toScene([east, north, up]: Vec3): [number, number, number] {
  return [east, up, -north];
}

export function createSkyScene(
  container: HTMLElement,
  options: { sky: Sky; look: SkyLook; figures: Figures },
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
  const dome = new Mesh(
    new SphereGeometry(500, 64, 32),
    new ShaderMaterial({
      uniforms: { sunDirection, sunAltitude },
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

  const ground = new Mesh(
    new SphereGeometry(50, 64, 32),
    new ShaderMaterial({
      uniforms: { sunAltitude },
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
  scene.add(dome, stars, lines, sun, sunGlow, ground);

  // Labels: the compass along the horizon, and the names of the figures drawn.
  const compassLabels = COMPASS.map(([name, azimuth]) => {
    const label = skyLabel(labelLayer, name, 'is-compass');
    const position = new Vector3(...toScene(lookDirectionAt(azimuth, 0))).multiplyScalar(40);
    return { label, position };
  });
  const nameLabels = new Map(
    sky.constellations.map((figure, index) => [
      // Serpens is named twice under one id, so key by position in the list.
      index,
      {
        figure,
        label: skyLabel(labelLayer, figure.name, 'is-constellation'),
        position: new Vector3(),
      },
    ]),
  );

  let look = options.look;
  let figures = options.figures;
  let shown: readonly Constellation[] = [];
  let segments: [number, number][] = [];
  let visible = false;
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
    shown = shownConstellations(sky.constellations, figures);
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
    camera.updateProjectionMatrix();
    needsRender = true;
  }

  const projected = new Vector3();
  function placeLabel(label: HTMLElement, position: Vector3, show: boolean): void {
    projected.copy(position).project(camera);
    const onScreen =
      show && projected.z < 1 && Math.abs(projected.x) < 1.1 && Math.abs(projected.y) < 1.1;
    label.hidden = !onScreen;
    if (!onScreen) return;
    const x = ((projected.x + 1) / 2) * container.clientWidth;
    const y = ((1 - projected.y) / 2) * container.clientHeight;
    label.style.transform = `translate(${String(x)}px, ${String(y)}px)`;
  }

  function placeLabels(): void {
    for (const { label, position } of compassLabels) placeLabel(label, position, true);
    for (const { label, position } of nameLabels.values()) {
      // Names of figures low in the haze or below the horizon are left out.
      placeLabel(label, position, label.dataset['shown'] === 'true' && position.y > 40 * 0.03);
    }
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
  });
  renderer.domElement.addEventListener('pointermove', (event) => {
    const last = pointers.get(event.pointerId);
    if (last === undefined) return;
    const current = { x: event.clientX, y: event.clientY };
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
  renderer.domElement.addEventListener('pointerup', release);
  renderer.domElement.addEventListener('pointercancel', release);
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
    setMoment({ horizon, jdTT, sun: sunJ2000 }) {
      updateMotion(jdTT);
      const sunLength = Math.hypot(...sunJ2000);
      const sunSeen = apparentDirection(horizon, [
        sunJ2000[0] / sunLength,
        sunJ2000[1] / sunLength,
        sunJ2000[2] / sunLength,
      ]);
      const sunHigh = horizontal(sunSeen).altitude;
      const limit = limitingMagnitude(sunHigh);
      let seen = 0;
      for (let index = 0; index < count; index++) {
        const direction = apparentDirection(horizon, [
          starJ2000[index * 3] ?? 0,
          starJ2000[index * 3 + 1] ?? 0,
          starJ2000[index * 3 + 2] ?? 0,
        ]);
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
      sunGlow.visible = sun.visible;
      starUniforms.limit.value = limit;
      // Figures stay faintly visible by day, as a guide to where things are.
      lineOpacity.value = 0.12 + 0.28 * (1 - Math.min(1, Math.max(0, (sunHigh + 18) / 18)));
      container.dataset['sunAltitude'] = sunHigh.toFixed(2);
      container.dataset['starsSeen'] = String(seen);
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
    onLookChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function lookDirectionAt(azimuth: number, altitude: number): Vec3 {
  return lookDirection({ azimuth, altitude, fov: 60 });
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
