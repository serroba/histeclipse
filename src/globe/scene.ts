/**
 * The WebGL globe: Earth lit by the Sun at a given moment, with orbit controls.
 *
 * Rendering-only code. The math it relies on lives in tested modules (`geo.ts`,
 * `astro/sun.ts`); this file is exercised by the Playwright suite in a real browser.
 */

import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  Color,
  DirectionalLight,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { apply, multiply, transpose, type Matrix3 } from '../astro/matrix';
import {
  CAMERA_DISTANCE_RANGE,
  type GeoPoint,
  type GlobeCamera,
  type Viewpoint,
} from '../state/viewState';
import type { BesselianElements } from '../data/solarCatalog';
import {
  ELEMENTS_HALF_SPAN_HOURS,
  SIDEREAL_DEGREES_PER_SECOND,
  type ShadowGeometry,
} from '../eclipses/solar';
import { cameraFromPosition, cameraPosition, geoToVector, type Vector3Tuple } from './geo';
import {
  apparentRadiusPixels,
  attachedPose,
  blendPose,
  mergeMarkers,
  MOON_RADIUS_EARTH_RADII,
  sceneFromKm,
  sceneRotation,
  SUN_RADIUS_EARTH_RADII,
  type CameraPose,
  type ScreenMarker,
} from './spaceFrame';
import { SOLAR_COMMON, SOLAR_PATH_FRAGMENT, SOLAR_PATH_LAYER, SOLAR_SHADOW } from './solarShaders';

const NARROW_SIDE_FOV_DEGREES = 40;
const FLIGHT_MS = 900;
/** Flights between viewpoints cross up to 60 Earth radii: quick, but long enough to follow. */
const VIEW_FLIGHT_MS = 1600;
/** Beyond this distance (Earth radii) the view holds still in space and Earth turns in it. */
const INERTIAL_VIEW_DISTANCE = 20;
/** Bodies smaller than this on screen (radius, pixels) get a marker ring. */
const MARKER_RADIUS_PIXELS = 3;
/** Bodies larger than this on screen (radius, pixels) are plain to see and go unlabelled. */
const LABEL_MAX_RADIUS_PIXELS = 60;
/** Markers closer than this on screen (pixels) are shown as one. */
const MERGE_PIXELS = 40;

/** Where an eclipsed Moon was overhead, nominally and at ±1σ of ΔT. */
export interface LunarOverlay {
  readonly sublunar: Vector3Tuple;
  readonly west: Vector3Tuple;
  readonly east: Vector3Tuple;
  /** 0 to 1: fainter during the barely visible penumbral phase. */
  readonly strength: number;
}

/** A solar eclipse's path: its elements, the ΔT to draw it for, and ΔT's uncertainty. */
export interface SolarPath {
  readonly elements: BesselianElements;
  readonly deltaTSeconds: number;
  readonly uncertaintySeconds: number;
}

/** Where the Moon and Sun are at the current moment, from Earth's centre. */
export interface SpaceBodies {
  /** Rotation from Earth-fixed axes to J2000 equatorial axes. */
  readonly earthFixedToJ2000: Matrix3;
  /** Geocentric J2000 positions in km; the Moon is null until its ephemeris loads. */
  readonly sunKm: readonly [number, number, number];
  readonly moonKm: readonly [number, number, number] | null;
}

export interface Globe {
  /** Direction from Earth's center to the Sun, in the globe frame. */
  setSunDirection(direction: Vector3Tuple): void;
  /** Draw where the umbra passed (computed once per eclipse); null hides it. */
  setSolarPath(path: SolarPath | null): void;
  /** Darken the ground under the Moon's shadow at the current moment; null hides it. */
  setSolarShadow(shadow: ShadowGeometry | null): void;
  /** Shade where the eclipsed Moon was above the horizon; null hides the overlay. */
  setLunarOverlay(overlay: LunarOverlay | null): void;
  /**
   * Place the Moon and Sun at their true sizes and distances. When the camera is far out, it
   * keeps its place among the stars as time moves, so Earth spins and the Moon orbits in view.
   */
  setSpace(bodies: SpaceBodies): void;
  /**
   * Fly to a viewpoint. Attached viewpoints follow the bodies as time moves and wait for the
   * Moon's position if it has not loaded yet; 'free' returns to the last orbiting camera.
   */
  setViewpoint(viewpoint: Viewpoint): void;
  /** Pixels covered by panels at the top and bottom; the globe is centred between them. */
  setInsets(top: number, bottom: number): void;
  /** Turn the globe smoothly so `target` faces the camera, keeping the distance. */
  flyTo(target: GeoPoint): void;
  setCamera(camera: GlobeCamera): void;
  /** Called while the user moves the camera. Returns an unsubscribe function. */
  onCameraChange(listener: (camera: GlobeCamera) => void): () => void;
  readonly canvas: HTMLCanvasElement;
  dispose(): void;
}

// Custom shaders include three.js's logarithmic-depth chunks: the scene spans from metres above
// the ground to beyond the Sun, which a linear depth buffer cannot resolve.
const EARTH_VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

// A full-screen quad: position is already in clip space.
const PATH_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Day side lit by the Sun, a twilight band down to about −6° (civil twilight), a dim blue night
// side (no city lights: they would be anachronistic for most of history), and a faint warm glow
// along the terminator.
const EARTH_FRAGMENT = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  ${SOLAR_COMMON}
  ${SOLAR_SHADOW}
  ${SOLAR_PATH_LAYER}
  uniform sampler2D dayMap;
  uniform vec3 sunDirection;
  uniform float lunarActive;
  uniform vec3 moonCenter;
  uniform vec3 moonWest;
  uniform vec3 moonEast;
  varying vec2 vUv;
  varying vec3 vNormal;

  // Copper, the colour of a totally eclipsed Moon.
  const vec3 ECLIPSE_TINT = vec3(1.0, 0.42, 0.22);

  // The map stays readable: where the eclipsed Moon was up, the ground is shown as if lit by
  // a copper Moon; the uncertain band is hatched; a ring marks where it stood overhead.
  vec3 lunarLayer(vec3 color, vec3 surface, vec3 normal) {
    float upCenter = step(0.0, dot(normal, moonCenter));
    float upWest = step(0.0, dot(normal, moonWest));
    float upEast = step(0.0, dot(normal, moonEast));
    float certain = upWest * upEast * upCenter;
    float uncertain = max(max(upWest, upEast), upCenter) - certain;
    vec3 moonlit = surface * vec3(0.62, 0.42, 0.34) + ECLIPSE_TINT * 0.035;
    vec3 tinted = mix(color, max(color, moonlit), certain);
    float hatch = step(0.55, fract((gl_FragCoord.x + gl_FragCoord.y) / 10.0));
    tinted = mix(tinted, max(color, moonlit * 0.8), uncertain * hatch);
    float edge = 1.0 - smoothstep(0.0, 0.004, abs(dot(normal, moonCenter)));
    tinted += ECLIPSE_TINT * edge * 0.35;
    float angle = dot(normal, moonCenter);
    float ring = smoothstep(0.99925, 0.9994, angle) * (1.0 - smoothstep(0.99955, 0.9997, angle));
    float dot_ = smoothstep(0.99985, 0.99992, angle);
    tinted = mix(tinted, vec3(1.0, 0.72, 0.52), max(ring, dot_));
    return mix(color, tinted, lunarActive);
  }

  void main() {
    #include <logdepthbuf_fragment>
    vec3 normal = normalize(vNormal);
    float sunAltitude = dot(normal, sunDirection);
    vec3 surface = texture2D(dayMap, vUv).rgb;
    float daylight = smoothstep(-0.105, 0.035, sunAltitude);
    vec3 lit = surface * (0.45 + 0.75 * clamp(sunAltitude, 0.0, 1.0));
    vec3 night = surface * vec3(0.035, 0.05, 0.09) + vec3(0.004, 0.008, 0.02);
    vec3 color = mix(night, lit, daylight);
    float terminator = exp(-pow(sunAltitude / 0.05, 2.0));
    color += vec3(1.0, 0.5, 0.18) * terminator * 0.12;
    color = lunarLayer(color, surface, normal);
    float latitude = asin(clamp(normal.y, -1.0, 1.0));
    float longitude = atan(-normal.z, normal.x);
    color = solarPathLayer(color, vUv);
    color = solarShadowLayer(color, night, latitude, longitude);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

const ATMOSPHERE_VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vViewNormal;
  varying vec3 vWorldNormal;
  void main() {
    vViewNormal = normalize(normalMatrix * normal);
    vWorldNormal = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

const ATMOSPHERE_FRAGMENT = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform vec3 sunDirection;
  varying vec3 vViewNormal;
  varying vec3 vWorldNormal;
  void main() {
    #include <logdepthbuf_fragment>
    float rim = pow(clamp(0.92 + dot(vViewNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 4.0);
    float sunlit = smoothstep(-0.35, 0.35, dot(normalize(vWorldNormal), sunDirection));
    vec3 color = vec3(0.3, 0.55, 1.0) * rim * (0.08 + 0.62 * sunlit);
    gl_FragColor = vec4(color, 1.0);
  }
`;

export async function createGlobe(
  container: HTMLElement,
  options: {
    readonly camera: GlobeCamera;
    readonly textureUrl: string;
    readonly moonTextureUrl: string;
  },
): Promise<Globe> {
  // preserveDrawingBuffer lets the page (and tests) read the rendered image back.
  // Transparent, so the page's space gradient shows behind the globe. No preserveDrawingBuffer:
  // it forces a buffer copy every frame, which stalls slow and mobile GPUs.
  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: true,
    logarithmicDepthBuffer: true,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.append(renderer.domElement);

  const scene = new Scene();
  // With a logarithmic depth buffer one camera spans metres above the ground to past the Sun.
  const camera = new PerspectiveCamera(35, 1, 1e-4, 1e6);

  const texture = await new TextureLoader().loadAsync(options.textureUrl);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const sunDirection = new Vector3(1, 0, 0);
  const lunarActive = { value: 0 };
  const moonCenter = new Vector3(1, 0, 0);
  const moonWest = new Vector3(1, 0, 0);
  const moonEast = new Vector3(1, 0, 0);
  // The eclipse path, painted once per eclipse into a map-shaped texture the Earth samples.
  const pathTarget = new WebGLRenderTarget(1024, 512, {
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: false,
  });
  const pathMaterial = new ShaderMaterial({
    uniforms: {
      coefficientsX: { value: new Vector4() },
      coefficientsY: { value: new Vector4() },
      coefficientsD: { value: new Vector4() },
      coefficientsMu: { value: new Vector4() },
      coefficientsL1: { value: new Vector4() },
      coefficientsL2: { value: new Vector4() },
      tangents: { value: new Vector2() },
      muShifts: { value: new Vector3() },
      halfSpanHours: { value: ELEMENTS_HALF_SPAN_HOURS },
    },
    vertexShader: PATH_VERTEX,
    fragmentShader: `${SOLAR_COMMON}${SOLAR_PATH_FRAGMENT}`,
    depthTest: false,
  });
  const pathScene = new Scene();
  pathScene.add(new Mesh(new PlaneGeometry(2, 2), pathMaterial));
  const pathCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const earth = new Mesh(
    new SphereGeometry(1, 128, 64),
    new ShaderMaterial({
      uniforms: {
        dayMap: { value: texture },
        sunDirection: { value: sunDirection },
        lunarActive: lunarActive,
        moonCenter: { value: moonCenter },
        moonWest: { value: moonWest },
        moonEast: { value: moonEast },
        solarActive: { value: 0 },
        shadowAxis: { value: new Vector4() },
        shadowCones: { value: new Vector4() },
        solarPath: { value: pathTarget.texture },
        solarPathActive: { value: 0 },
      },
      vertexShader: EARTH_VERTEX,
      fragmentShader: EARTH_FRAGMENT,
    }),
  );
  const atmosphere = new Mesh(
    new SphereGeometry(1.04, 96, 48),
    new ShaderMaterial({
      uniforms: { sunDirection: { value: sunDirection } },
      vertexShader: ATMOSPHERE_VERTEX,
      fragmentShader: ATMOSPHERE_FRAGMENT,
      side: BackSide,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
    }),
  );
  scene.add(earth, atmosphere);

  // The Moon, tidally locked: turn the map's longitude 0 (at +X) to +Z, which lookAt() aims at
  // Earth. Libration (a few degrees of wobble) is left out.
  const moonTexture = await new TextureLoader().loadAsync(options.moonTextureUrl);
  moonTexture.colorSpace = SRGBColorSpace;
  const moonGeometry = new SphereGeometry(MOON_RADIUS_EARTH_RADII, 64, 32);
  moonGeometry.rotateY(-Math.PI / 2);
  const moon = new Mesh(moonGeometry, new MeshStandardMaterial({ map: moonTexture, roughness: 1 }));
  moon.visible = false;
  const sunlight = new DirectionalLight(0xffffff, 3);
  scene.add(moon, sunlight, sunlight.target);

  const sun = new Mesh(
    new SphereGeometry(SUN_RADIUS_EARTH_RADII, 48, 24),
    new MeshBasicMaterial({ color: new Color(1, 0.96, 0.86) }),
  );
  const glow = new Sprite(
    new SpriteMaterial({
      map: glowTexture(),
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
    }),
  );
  glow.scale.setScalar(SUN_RADIUS_EARTH_RADII * 8);
  sun.add(glow);
  sun.visible = false;
  scene.add(sun);

  const markerLayer = document.createElement('div');
  markerLayer.className = 'space-markers';
  container.append(markerLayer);
  const markers = {
    earth: spaceMarker(markerLayer, 'Earth', 'earth'),
    moon: spaceMarker(markerLayer, 'Moon', 'moon'),
    sun: spaceMarker(markerLayer, 'Sun', 'sun'),
  };
  let earthFixedToJ2000: Matrix3 | null = null;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.5;
  controls.zoomSpeed = 0.8;
  controls.minDistance = CAMERA_DISTANCE_RANGE.min;
  controls.maxDistance = CAMERA_DISTANCE_RANGE.max;

  const listeners = new Set<(camera: GlobeCamera) => void>();
  let needsRender = true;
  let frame = 0;
  // Rotation along the sphere (a slerp), which also handles flying to the opposite side.
  let flight: { from: Vector3; rotation: Quaternion; start: number } | null = null;

  function placeCamera(state: GlobeCamera): void {
    freeCamera = state;
    if (viewpoint !== 'free') return;
    camera.position.set(...cameraPosition(state));
    camera.lookAt(0, 0, 0);
    controls.update();
    needsRender = true;
  }

  let insets = { top: 0, bottom: 0 };
  // Field of view on the narrower side; attached viewpoints narrow it to frame a body.
  let narrowFov = NARROW_SIDE_FOV_DEGREES;
  let viewpoint: Viewpoint = 'free';
  let pendingViewpoint: Viewpoint | null = null;
  // A flight between viewpoints runs from a fixed pose to a live one, as the bodies keep moving.
  let viewFlight: { from: CameraPose; start: number } | null = null;
  // Where the camera orbited before an attached viewpoint, to return there.
  let freeCamera: GlobeCamera = options.camera;
  container.dataset['view'] = viewpoint;
  const lookTarget = new Vector3();

  function currentPose(): CameraPose {
    return {
      eye: [camera.position.x, camera.position.y, camera.position.z],
      target: [lookTarget.x, lookTarget.y, lookTarget.z],
      fovDegrees: narrowFov,
    };
  }

  function livePose(): CameraPose {
    if (viewpoint === 'free') {
      return {
        eye: cameraPosition(freeCamera),
        target: [0, 0, 0],
        fovDegrees: NARROW_SIDE_FOV_DEGREES,
      };
    }
    return attachedPose(viewpoint, [moon.position.x, moon.position.y, moon.position.z]);
  }

  function applyPose(pose: CameraPose): void {
    camera.position.set(...pose.eye);
    lookTarget.set(...pose.target);
    camera.lookAt(lookTarget);
    narrowFov = pose.fovDegrees;
    applyFov();
    needsRender = true;
  }

  function startViewFlight(next: Viewpoint): void {
    const from = currentPose();
    if (viewpoint === 'free') {
      freeCamera = cameraFromPosition([camera.position.x, camera.position.y, camera.position.z]);
    }
    viewpoint = next;
    flight = null;
    viewFlight = { from, start: performance.now() };
    // Orbiting resumes once a flight back to the free view lands.
    controls.enabled = false;
    container.dataset['view'] = next;
  }

  function resize(): void {
    const { clientWidth, clientHeight } = container;
    // Shift the projection so the globe sits centred in the space the panels leave free.
    const shift = (insets.bottom - insets.top) / 2;
    camera.setViewOffset(clientWidth, clientHeight, 0, shift, clientWidth, clientHeight);
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / Math.max(clientHeight, 1);
    // Fix the field of view on the narrower side, so a camera distance frames the globe the
    // same way on a portrait phone as on a landscape laptop (and shared links look alike).
    applyFov();
  }

  function applyFov(): void {
    const halfAngle = (narrowFov / 2) * (Math.PI / 180);
    camera.fov =
      camera.aspect >= 1
        ? narrowFov
        : (2 * Math.atan(Math.tan(halfAngle) / camera.aspect) * 180) / Math.PI;
    camera.updateProjectionMatrix();
    needsRender = true;
  }

  // Grabbing the globe cancels an automatic flight.
  controls.addEventListener('start', () => {
    flight = null;
  });

  controls.addEventListener('change', () => {
    needsRender = true;
    const state = cameraFromPosition([camera.position.x, camera.position.y, camera.position.z]);
    for (const listener of listeners) listener(state);
  });

  function loop(now: number): void {
    if (viewFlight !== null) {
      const progress = Math.min(1, (now - viewFlight.start) / VIEW_FLIGHT_MS);
      // Ease in and out: a gentle start and landing, fast through the long middle.
      const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      applyPose(blendPose(viewFlight.from, livePose(), eased));
      if (progress === 1) {
        viewFlight = null;
        if (viewpoint === 'free') controls.enabled = true;
      }
    } else if (flight !== null) {
      const progress = Math.min(1, (now - flight.start) / FLIGHT_MS);
      const eased = 1 - (1 - progress) ** 3;
      const distance = camera.position.length();
      const step = new Quaternion().slerp(flight.rotation, eased);
      camera.position.copy(flight.from).applyQuaternion(step).setLength(distance);
      if (progress === 1) flight = null;
    }
    // Wheel steps scale the distance; take bigger steps far out so the Sun is a few spins away.
    controls.zoomSpeed = camera.position.length() < 10 ? 0.8 : 2.5;
    // update() keeps damping going after the pointer is released; it reports movement via 'change'.
    if (controls.enabled) controls.update();
    if (needsRender) {
      needsRender = false;
      renderer.render(scene, camera);
      placeMarkers();
      container.dataset['rendered'] = 'true';
    }
    frame = requestAnimationFrame(loop);
  }

  const projected = new Vector3();
  function placeMarkers(): void {
    const width = container.clientWidth;
    const height = container.clientHeight;
    const cameraDistance = camera.position.length();
    const bodies = [
      { marker: markers.earth, mesh: earth, radius: 1, shown: true, name: 'Earth' },
      {
        marker: markers.moon,
        mesh: moon,
        radius: MOON_RADIUS_EARTH_RADII,
        shown: moon.visible,
        name: 'Moon',
      },
      {
        marker: markers.sun,
        mesh: sun,
        radius: SUN_RADIUS_EARTH_RADII,
        shown: sun.visible,
        name: 'Sun',
      },
    ];
    const onScreen: (ScreenMarker & { readonly marker: HTMLElement })[] = [];
    for (const { marker, mesh, radius, shown, name } of bodies) {
      projected.copy(mesh.position).project(camera);
      const distance = camera.position.distanceTo(mesh.position);
      // Labels appear once the camera leaves Earth's neighbourhood, and only for bodies in front.
      const visible =
        shown &&
        cameraDistance > 4 &&
        projected.z < 1 &&
        Math.abs(projected.x) < 1.2 &&
        Math.abs(projected.y) < 1.2;
      marker.hidden = !visible;
      if (!visible) continue;
      const pixels = apparentRadiusPixels({
        radius,
        distance,
        verticalFovDegrees: camera.fov,
        viewportHeight: height,
      });
      // A body that fills much of the view needs no label.
      if (pixels > LABEL_MAX_RADIUS_PIXELS) {
        marker.hidden = true;
        continue;
      }
      marker.classList.toggle('is-tiny', pixels < MARKER_RADIUS_PIXELS);
      marker.style.setProperty('--radius', `${String(Math.max(pixels, MARKER_RADIUS_PIXELS))}px`);
      const x = ((projected.x + 1) / 2) * width;
      const y = ((1 - projected.y) / 2) * height;
      marker.style.transform = `translate(${String(x)}px, ${String(y)}px)`;
      onScreen.push({ marker, name, x, y });
    }
    // From far out bodies line up on screen: one marker for them reads better than several.
    const labels = mergeMarkers(onScreen, MERGE_PIXELS);
    for (const { marker, name } of onScreen) {
      const label = labels.get(name) ?? null;
      marker.hidden = label === null;
      if (label !== null) setLabel(marker, label);
    }
  }

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  placeCamera(options.camera);
  loop(performance.now());

  return {
    canvas: renderer.domElement,
    setSunDirection([x, y, z]) {
      sunDirection.set(x, y, z).normalize();
      needsRender = true;
    },
    setSpace(bodies) {
      // Keep a far camera still among the stars: carry it along by the rotation Earth made
      // since the last moment (old Earth-fixed -> J2000 -> new Earth-fixed).
      if (
        earthFixedToJ2000 !== null &&
        viewpoint === 'free' &&
        viewFlight === null &&
        camera.position.length() > INERTIAL_VIEW_DISTANCE &&
        flight === null
      ) {
        const [row0, row1, row2] = sceneRotation(
          multiply(transpose(bodies.earthFixedToJ2000), earthFixedToJ2000),
        );
        const { x, y, z } = camera.position;
        camera.position.set(
          row0[0] * x + row0[1] * y + row0[2] * z,
          row1[0] * x + row1[1] * y + row1[2] * z,
          row2[0] * x + row2[1] * y + row2[2] * z,
        );
        // The next frame's controls.update() reports the move. Reporting it here would reach the
        // app while it is still rendering this moment, and the stale camera would win.
        camera.lookAt(0, 0, 0);
      }
      earthFixedToJ2000 = bodies.earthFixedToJ2000;
      const toEarthFixed = transpose(bodies.earthFixedToJ2000);
      sun.position.set(...sceneFromKm(apply(toEarthFixed, bodies.sunKm)));
      sun.visible = true;
      sunlight.position.copy(sun.position);
      if (bodies.moonKm === null) {
        moon.visible = false;
      } else {
        moon.position.set(...sceneFromKm(apply(toEarthFixed, bodies.moonKm)));
        moon.lookAt(0, 0, 0);
        moon.visible = true;
        sunlight.target.position.copy(moon.position);
      }
      container.dataset['space'] = moon.visible ? 'moon' : 'sun';
      if (pendingViewpoint !== null && moon.visible) {
        startViewFlight(pendingViewpoint);
        pendingViewpoint = null;
      } else if (viewpoint !== 'free' && viewFlight === null) {
        // Attached viewpoints ride along with the bodies.
        applyPose(livePose());
      }
      needsRender = true;
    },
    setInsets(top, bottom) {
      if (top === insets.top && bottom === insets.bottom) return;
      insets = { top, bottom };
      resize();
    },
    setSolarPath(path) {
      const uniforms = earth.material.uniforms;
      if (path === null) {
        uniforms['solarPathActive'] = { value: 0 };
        container.dataset['solarPath'] = 'off';
        needsRender = true;
        return;
      }
      const vector = (values: readonly number[], scale = 1): Vector4 =>
        new Vector4(
          (values[0] ?? 0) * scale,
          (values[1] ?? 0) * scale,
          (values[2] ?? 0) * scale,
          (values[3] ?? 0) * scale,
        );
      const toRadians = Math.PI / 180;
      const { elements } = path;
      const u = pathMaterial.uniforms;
      u['coefficientsX'] = { value: vector(elements.x) };
      u['coefficientsY'] = { value: vector(elements.y) };
      u['coefficientsD'] = { value: vector(elements.d, toRadians) };
      u['coefficientsMu'] = { value: vector(elements.mu, toRadians) };
      u['coefficientsL1'] = { value: vector(elements.l1) };
      u['coefficientsL2'] = { value: vector(elements.l2) };
      u['tangents'] = { value: new Vector2(elements.tanF1, elements.tanF2) };
      const shift = (seconds: number): number => seconds * SIDEREAL_DEGREES_PER_SECOND * toRadians;
      u['muShifts'] = {
        value: new Vector3(
          shift(path.deltaTSeconds),
          shift(path.deltaTSeconds - path.uncertaintySeconds),
          shift(path.deltaTSeconds + path.uncertaintySeconds),
        ),
      };
      renderer.setRenderTarget(pathTarget);
      renderer.render(pathScene, pathCamera);
      renderer.setRenderTarget(null);
      uniforms['solarPathActive'] = { value: 1 };
      container.dataset['solarPath'] = 'on';
      needsRender = true;
    },
    setSolarShadow(shadow) {
      const uniforms = earth.material.uniforms;
      if (shadow === null) {
        uniforms['solarActive'] = { value: 0 };
      } else {
        const toRadians = Math.PI / 180;
        uniforms['solarActive'] = { value: 1 };
        uniforms['shadowAxis'] = {
          value: new Vector4(shadow.x, shadow.y, shadow.d * toRadians, shadow.mu * toRadians),
        };
        uniforms['shadowCones'] = {
          value: new Vector4(shadow.l1, shadow.l2, shadow.tanF1, shadow.tanF2),
        };
      }
      container.dataset['solarShadow'] = shadow === null ? 'off' : 'on';
      needsRender = true;
    },
    setLunarOverlay(overlay) {
      lunarActive.value = overlay === null ? 0 : overlay.strength;
      if (overlay !== null) {
        moonCenter.set(...overlay.sublunar).normalize();
        moonWest.set(...overlay.west).normalize();
        moonEast.set(...overlay.east).normalize();
      }
      container.dataset['lunarOverlay'] = overlay === null ? 'off' : 'on';
      needsRender = true;
    },
    setViewpoint(next) {
      if (next === 'free') pendingViewpoint = null;
      if (next === viewpoint) return;
      if (next !== 'free' && !moon.visible) {
        pendingViewpoint = next;
        return;
      }
      startViewFlight(next);
    },
    flyTo(target) {
      // Attached viewpoints are placed by the bodies, not by places on the ground.
      if (viewpoint !== 'free') return;
      const from = camera.position.clone().normalize();
      const to = new Vector3(...geoToVector(target)).normalize();
      flight = {
        from,
        rotation: new Quaternion().setFromUnitVectors(from, to),
        start: performance.now(),
      };
    },
    setCamera: placeCamera,
    onCameraChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      pathTarget.dispose();
      pathMaterial.dispose();
      texture.dispose();
      moonTexture.dispose();
      markerLayer.remove();
      renderer.domElement.remove();
    },
  };
}

/** A soft radial glow for the Sun, drawn once into a small canvas. */
function glowTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context !== null) {
    const gradient = context.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    gradient.addColorStop(0, 'rgba(255, 244, 214, 1)');
    gradient.addColorStop(0.15, 'rgba(255, 220, 150, 0.6)');
    gradient.addColorStop(1, 'rgba(255, 200, 120, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  return new CanvasTexture(canvas);
}

function setLabel(marker: HTMLElement, name: string): void {
  const label = marker.querySelector('span');
  if (label !== null && label.textContent !== name) label.textContent = name;
}

/** A ring and name marking where a body is; sized to the body, never smaller than a dot. */
function spaceMarker(layer: HTMLElement, name: string, body: string): HTMLElement {
  const marker = document.createElement('div');
  marker.className = `space-marker is-${body}`;
  marker.dataset['body'] = body;
  marker.hidden = true;
  const label = document.createElement('span');
  label.textContent = name;
  marker.append(label);
  layer.append(marker);
  return marker;
}
