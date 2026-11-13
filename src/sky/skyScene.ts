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

import { type Object3D, PerspectiveCamera, Vector2, Vector3, WebGLRenderer } from 'three';

import { Stage } from '../stage/stage';
import type { Matrix3, Vector3 as Vec3 } from '../astro/matrix';
import type { Sky } from '../data/sky';
import type { Figures, SkyLook } from '../state/viewState';
import type { JulianDay } from '../time/julianDay';
import { eclipsedLimit, sunVisible, topocentric } from './bodies';
import { aberrate, apparentDirection, horizontal, limitingMagnitude } from './horizon';
import { lookBetween, lookDirection, type Figure, roundLook } from './look';
import {
  CLIP_COS,
  pixelsPerDegree,
  project,
  projectionFrame,
  widestFov,
  type ProjectionFrame,
  toPixels,
} from './projection';
import { createSkyLabelLayer } from './skyLabels';
import { toScene } from './skyFrame';
import { SkyFigures } from './skyFigures';
import { SkyMoon } from './skyMoon';
import { SkyPlanets, type SkyPlanet } from './skyPlanets';
import { SkyNames, type SkyMark } from './skyNames';
import { SkyStars } from './skyStars';
import { pickBody, type SkyBody, type SkyTap } from './skyTap';
import { SkySun } from './skySun';
import { createSkyDome } from './skyDome';
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

export type { SkyPlanet } from './skyPlanets';

export type { SkyBody, SkyTap } from './skyTap';

export type { SkyMark } from './skyNames';

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

export function createSkyScene(
  container: HTMLElement,
  options: { sky: Sky; look: SkyLook; figures: Figures; moonTextureUrl: string },
): SkyScene {
  const { sky } = options;

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const stage = new Stage(container, {
    renderer,
    // Only its position and turn are used: the projection is the shaders' (see projection.ts).
    camera: new PerspectiveCamera(60, 1, 0.1, 1000),
    styleSize: false,
  });
  const labelLayer = createSkyLabelLayer(container);
  const { scene, camera } = stage;
  let view: ProjectionFrame = projectionFrame(90, 1, 1);
  // Shared by every material in the sky: one update moves them all.
  const projection = {
    skyScale: { value: new Vector2(1, 1) },
    skyShift: { value: new Vector2(0, 0) },
    skyClip: { value: CLIP_COS },
    skyViewport: { value: new Vector2(1, 1) },
  };

  const sun = new SkySun(projection, () => look.fov);
  const { dome, ground } = createSkyDome(projection, sun.light);

  const stars = new SkyStars({
    stars: sky.stars,
    projection,
    pixelRatio: renderer.getPixelRatio(),
  });

  const moon = new SkyMoon({
    projection,
    sunDirection: sun.light.sunDirection,
    textureUrl: options.moonTextureUrl,
    dataset: container.dataset,
    invalidate: () => {
      stage.invalidate();
    },
  });

  const planets = new SkyPlanets({
    uniforms: stars.uniforms,
    labelLayer,
    dataset: container.dataset,
  });
  const names = new SkyNames({ layer: labelLayer, screenPoint, dataset: container.dataset });
  const figures = new SkyFigures({
    projection,
    labelLayer,
    stars: stars.positions,
    modern: sky.constellations,
    figures: options.figures,
    invalidate: () => {
      stage.invalidate();
    },
  });
  const everything: Object3D[] = [
    dome,
    stars.points,
    figures.lines,
    planets.points,
    sun.disc,
    sun.glow,
    sun.corona,
    moon.mesh,
    ground,
  ];
  // The camera's frustum is a pinhole's and does not match what the shaders put on screen.
  for (const object of everything) object.frustumCulled = false;
  scene.add(...everything);

  let look = options.look;
  let visible = false;
  // Earth's velocity at the moment shown, for annual aberration.
  let motion: Vec3 = [0, 0, 0];
  let insets = { top: 0, bottom: 0 };
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
  const listeners = new Set<(look: SkyLook) => void>();

  function applyLook(): void {
    const [x, y, z] = toScene(lookDirection({ ...look, altitude: Math.min(look.altitude, 89.9) }));
    camera.up.set(0, 1, 0);
    camera.lookAt(x, y, z);
    // Labels are placed from the view matrix, so keep it current between renders.
    camera.updateMatrixWorld();
    stage.resize();
    stars.setFieldOfView(look.fov);
    sun.showGlow();
    stage.invalidate();
  }

  /** The projection for the container's size, the panels' insets and the field of view. */
  function fitView(clientWidth: number, clientHeight: number): void {
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
  }

  const inView = new Vector3();
  /** Where a scene position lands on screen, in NDC, as the shaders put it; null if behind. */
  function screenPoint(position: Vector3): readonly [number, number] | null {
    inView.copy(position).applyMatrix4(camera.matrixWorldInverse);
    return project(view, [inView.x, inView.y, inView.z]);
  }
  function placeLabels(): void {
    names.place({
      width: container.clientWidth,
      height: container.clientHeight,
      sun: sun.disc.visible ? sun.disc.position : null,
      planets,
      figures,
    });
  }

  stage.add({
    step(now) {
      if (glide !== null) {
        glide.start ??= now;
        const progress = Math.min(1, (now - glide.start) / glide.ms);
        look = lookBetween(glide.from, glide.to, 1 - (1 - progress) ** 3);
        applyLook();
        if (progress === 1) endGlide();
      }
      return false;
    },
    afterRender() {
      placeLabels();
      container.dataset['rendered'] = 'true';
    },
    resize: fitView,
  });

  const tapListeners = new Set<(tapped: SkyTap | null) => void>();
  /** The body under a point of the page, nearest first, or null. */
  function bodyAt(clientX: number, clientY: number): SkyTap | null {
    const box = renderer.domElement.getBoundingClientRect();
    const width = container.clientWidth;
    const height = container.clientHeight;
    const bodies: { body: SkyBody; position: Vector3; radius: number }[] = [
      ...(sun.disc.visible
        ? [{ body: 'sun' as const, position: sun.disc.position, radius: 0.27 }]
        : []),
      ...(moon.mesh.visible
        ? [{ body: 'moon' as const, position: moon.mesh.position, radius: moon.angularRadius }]
        : []),
      ...planets.labels
        .filter(({ shown }) => shown)
        .map(({ name, position }) => ({
          body: name.toLowerCase() as SkyBody,
          position,
          radius: 0,
        })),
    ];
    const targets = bodies.flatMap(({ body, position, radius }) => {
      const ndc = screenPoint(position);
      if (ndc === null) return [];
      const [x, y] = toPixels(ndc, width, height);
      return [{ body, x, y, radius, scene: position }];
    });
    return pickBody(targets, clientX - box.left, clientY - box.top, pixelsPerDegree(view, width));
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

  stage.observeResize();
  applyLook();

  return {
    setVisible(next) {
      if (next === visible) return;
      visible = next;
      container.hidden = !next;
      if (next) {
        stage.resize();
        stage.invalidate();
        stage.start();
      } else {
        stage.stop();
        endGlide();
      }
    },
    setMoment({
      horizon,
      jdTT,
      sun: sunJ2000,
      moon: moonJ2000,
      observer,
      planets: seenPlanets,
      velocity,
    }) {
      motion = velocity;
      const sunHere = topocentric(sunJ2000, observer);
      const sunSeen = apparentDirection(horizon, aberrate(sunHere, motion));
      const sunHigh = horizontal(sunSeen).altitude;
      const moonHere = moonJ2000 === null ? null : topocentric(moonJ2000, observer);
      // How much of the Sun the Moon leaves, if the Sun is up to be seen.
      const sunShare = moonHere === null || sunHigh < -1 ? 1 : sunVisible(sunHere, moonHere);
      const limit = eclipsedLimit(limitingMagnitude(sunHigh), sunShare);
      const seen = stars.place({ jdTT, horizon, motion, limit });
      figures.place();

      sun.place({ seen: sunSeen, altitude: sunHigh, share: sunShare });
      moon.place({ horizon, sunJ2000, moonJ2000, sunHere, moonHere, sunHigh, motion });
      container.dataset['sunVisible'] = sunShare.toFixed(4);
      figures.setSunAltitude(sunHigh);
      container.dataset['sunAltitude'] = sunHigh.toFixed(2);
      container.dataset['starsSeen'] = String(seen);
      planets.place({
        horizon,
        planets: seenPlanets,
        limit,
        sunHere: sunHigh > -1 ? sunHere : null,
        moonHere,
        motion,
      });
      stage.invalidate();
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
        stage.invalidate();
      });
    },
    setFigures(next) {
      figures.setFigures(next);
    },
    setCulture(next) {
      figures.setCulture(next);
    },
    setMarks(marks) {
      names.setMarks(marks);
      placeLabels();
    },
    setInsets(top, bottom) {
      if (top === insets.top && bottom === insets.bottom) return;
      insets = { top, bottom };
      stage.resize();
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
