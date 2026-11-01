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
  LinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TextureLoader,
  CustomBlending,
  OneFactor,
  ZeroFactor,
  type Texture,
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
  DEFAULT_CAMERA,
  type Body,
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
import {
  cameraFromPosition,
  cameraPosition,
  geoToVector,
  vectorToGeo,
  type Vector3Tuple,
} from './geo';
import {
  apparentRadiusPixels,
  attachedPose,
  blendPose,
  mergeMarkers,
  MOON_RADIUS_EARTH_RADII,
  sceneFromKm,
  toScene,
  sceneRotation,
  SUN_RADIUS_EARTH_RADII,
  type CameraPose,
  type ScreenMarker,
} from './spaceFrame';
import { EARTH_SHADOW_ENLARGEMENT } from '../astro/occultation';
import { discAverage, SOLAR_NORTH_POLE_J2000 } from './sunImage';
import { labelPoint, type Territory } from '../data/empires';
import { createEmpireCanvas, paintTerritories } from './empireCanvas';
import {
  OCCULTATION,
  SOLAR_COMMON,
  SOLAR_PATH_FRAGMENT,
  SOLAR_PATH_LAYER,
  SOLAR_SHADOW,
} from './solarShaders';

const NARROW_SIDE_FOV_DEGREES = 40;
const FLIGHT_MS = 900;
/** Flights between viewpoints cross up to 60 Earth radii: quick, but long enough to follow. */
const VIEW_FLIGHT_MS = 1600;
/** Arriving at a body, the camera stops this many of its radii from the centre. */
const FOCUS_DISTANCE = 4;
/** A press that moves less than this (pixels) is a click on a body, not a drag. */
const CLICK_SLOP_PIXELS = 6;
const BODY_RADIUS: Record<Body, number> = {
  earth: 1,
  moon: MOON_RADIUS_EARTH_RADII,
  sun: SUN_RADIUS_EARTH_RADII,
};
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

/** An SDO frame for the Sun: the limb at `diskRadius` of the width, north up, west right. */
export interface SunImageRequest {
  readonly key: string;
  readonly small: string;
  readonly large: string;
  /** Multiplies the image's colours: a warm white for the grey visible-light frame. */
  readonly tint: readonly [number, number, number];
  readonly diskRadius: number;
  /** How much the frame darkens toward the limb (u in 1 − u(1 − μ)); 0 if it does not. */
  readonly limbDarkening: number;
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
   * Centre the camera on a body and fly there; it then orbits and zooms around that body. A
   * body that has not loaded yet (the Moon, briefly) is flown to once it has.
   */
  setFocus(body: Body): void;
  /**
   * Called when someone clicks a body other than the one in focus, or grabs an attached
   * viewpoint (which hands over to orbiting the body it looks at).
   */
  onBodyClick(listener: (body: Body) => void): () => void;
  /** Called when someone taps empty space, away from every body. */
  onEmptyTap(listener: () => void): () => void;
  /** Called when someone taps a place on Earth while looking at it: where to stand. */
  onPlacePick(listener: (place: GeoPoint) => void): () => void;
  /**
   * Dress the Sun in an SDO image: a small frame at once, then the sharp one. Null returns it to
   * a plain disc.
   */
  setSunImage(image: SunImageRequest | null): void;
  /**
   * Lay past states and empires over the ground, with the names of the largest; null hides
   * the layer.
   */
  setEmpires(territories: readonly Territory[] | null): void;
  /** Pin the chosen place on the globe; null removes the pin. */
  setLocation(place: GeoPoint | null): void;
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
  /** Called while the user moves the camera, relative to the body in focus. Returns an unsubscribe function. */
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
  ${OCCULTATION}
  uniform sampler2D dayMap;
  uniform sampler2D empiresMap;
  uniform float empiresActive;
  // The Moon and Sun in the scene, for the Moon's shadow at any moment.
  uniform vec3 moonPosition;
  uniform float moonRadius;
  uniform vec3 sunPosition;
  uniform float sunRadius;
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

  // Past states and empires, painted on a map in the ground texture's layout. Each keeps its
  // colour by night too, a little dimmer, so borders read on both sides.
  vec3 empiresLayer(vec3 color, float daylight) {
    vec4 painted = texture2D(empiresMap, vUv);
    vec3 tinted = mix(color, painted.rgb * (0.45 + 0.55 * daylight), painted.a * 0.85);
    return mix(color, tinted, empiresActive);
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
    color = empiresLayer(color, daylight);
    color = lunarLayer(color, surface, normal);
    float latitude = asin(clamp(normal.y, -1.0, 1.0));
    float longitude = atan(-normal.z, normal.x);
    color = solarPathLayer(color, vUv);
    // A selected solar eclipse draws its shadow from the catalog's Besselian elements, which
    // match its path exactly; otherwise the Moon's shadow comes straight from the geometry.
    if (solarActive < 0.5 && moonRadius > 0.0) {
      // On the unit sphere, the surface point is its normal.
      float sunlight = sunlightAt(normal, sunPosition, sunRadius, moonPosition, moonRadius);
      float perceived = 1.0 - 0.9 * pow(1.0 - sunlight, 0.6);
      vec3 shaded = max(color * pow(perceived, 2.2), night);
      color = mix(shaded, night, step(sunlight, 0.0));
    }
    color = solarShadowLayer(color, night, latitude, longitude);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

const MOON_VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
    #include <logdepthbuf_vertex>
  }
`;

// The Moon lit by the Sun, darkened by Earth's shadow where Earth covers part or all of the
// Sun (Earth at the scene's origin). In the umbra, sunlight bent through Earth's atmosphere
// still reaches the Moon and turns it copper; its brightness here is chosen to be visible.
const MOON_FRAGMENT = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  ${OCCULTATION}
  uniform sampler2D map;
  uniform vec3 sunPosition;
  uniform float sunRadius;
  uniform float earthRadius;
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  void main() {
    #include <logdepthbuf_fragment>
    vec3 albedo = texture2D(map, vUv).rgb;
    float facing = max(dot(normalize(vWorldNormal), normalize(sunPosition - vWorldPosition)), 0.0);
    float sunlight = sunlightAt(vWorldPosition, sunPosition, sunRadius, vec3(0.0), earthRadius);
    vec3 copper = vec3(0.55, 0.16, 0.06) * 0.22 * pow(1.0 - sunlight, 3.0);
    gl_FragColor = vec4(albedo * facing * (sunlight + copper), 1.0);
    #include <colorspace_fragment>
  }
`;

const SUN_VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vNormal = normal;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

// The side facing Earth wears SDO's image, as an orthographic view from Earth (sunImage.ts is
// the tested reference). The side no one saw that day is a plain surface at the image's average
// colour, with a faint mottle so it reads as a surface. Toward the image's limb its pixels are
// squeezed, so seen from the side they smear; there the image fades into the plain surface.
// Visible light darkens toward the limb as the camera sees it, so the disc looks round from
// any side.
const SUN_FRAGMENT = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D map;
  uniform float hasMap;
  uniform vec3 toEarth;
  uniform vec3 north;
  uniform float diskRadius;
  uniform vec3 tint;
  uniform vec3 quiet;
  uniform float limbDarkening;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float valueNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
          mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
          mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z);
  }

  float darkening(float mu) {
    return 1.0 - limbDarkening * (1.0 - clamp(mu, 0.0, 1.0));
  }

  void main() {
    #include <logdepthbuf_fragment>
    vec3 plain = vec3(1.0, 0.96, 0.86);
    vec3 n = normalize(vNormal);
    float towardEarth = dot(n, toEarth);
    float towardCamera = dot(n, normalize(cameraPosition - vWorldPosition));
    vec3 up = normalize(north - dot(north, toEarth) * toEarth);
    vec3 right = cross(-toEarth, up);
    vec2 uv = vec2(0.5 + diskRadius * dot(n, right), 0.5 + diskRadius * dot(n, up));
    // Take out the limb darkening SDO saw and put in the camera's.
    vec3 seen = texture2D(map, uv).rgb * tint * darkening(towardCamera) / darkening(towardEarth);
    float mottle = 0.55 * valueNoise(n * 90.0) + 0.3 * valueNoise(n * 31.0)
      + 0.15 * valueNoise(n * 9.0);
    vec3 unseen = quiet * darkening(towardCamera) * (0.9 + 0.2 * mottle);
    // The image where it is not squeezed: well inside its limb, or where the camera looks from
    // about Earth's side and sees it squeezed just as SDO did.
    float squeeze = towardEarth / max(towardCamera, 1e-3);
    float trusted = max(
      smoothstep(0.05, 0.45, towardEarth),
      smoothstep(0.6, 0.95, squeeze) * smoothstep(0.0, 0.03, towardEarth)
    );
    vec3 imaged = mix(unseen, seen, trusted);
    gl_FragColor = vec4(mix(plain, imaged, hasMap), 1.0);
    #include <colorspace_fragment>
  }
`;

const CORONA_VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

// What the image shows beyond the limb (the corona, prominences), on a plane across the line of
// sight. It is only right seen from near Earth's side, so it fades as the camera swings away.
const CORONA_FRAGMENT = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D map;
  uniform float diskRadius;
  uniform float opacity;
  uniform vec3 tint;
  varying vec2 vUv;

  void main() {
    #include <logdepthbuf_fragment>
    float r = length(vUv - 0.5);
    if (r < diskRadius * 0.995) discard;
    // Fade out before the frame's square edge.
    float edge = 1.0 - smoothstep(0.38, 0.49, r);
    gl_FragColor = vec4(texture2D(map, vUv).rgb * tint * opacity * edge, 1.0);
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
    readonly focus: Body;
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
  // Shared by the Earth and Moon shaders; set with the bodies each moment.
  const moonPosition = new Vector3();
  const sunPosition = new Vector3(1e5, 0, 0);
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

  const empiresCanvas = createEmpireCanvas();
  const empiresTexture = new CanvasTexture(empiresCanvas);
  empiresTexture.colorSpace = SRGBColorSpace;
  const earth = new Mesh(
    new SphereGeometry(1, 128, 64),
    new ShaderMaterial({
      uniforms: {
        dayMap: { value: texture },
        empiresMap: { value: empiresTexture },
        empiresActive: { value: 0 },
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
        moonPosition: { value: moonPosition },
        moonRadius: { value: 0 },
        sunPosition: { value: sunPosition },
        sunRadius: { value: SUN_RADIUS_EARTH_RADII },
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

  // The chosen place: a small pin standing on the ground.
  const pin = new Mesh(
    new SphereGeometry(0.012, 16, 8),
    new MeshBasicMaterial({ color: new Color(1, 0.72, 0.3) }),
  );
  pin.visible = false;
  earth.add(pin);

  // The Moon, tidally locked: turn the map's longitude 0 (at +X) to +Z, which lookAt() aims at
  // Earth. Libration (a few degrees of wobble) is left out.
  const moonTexture = await new TextureLoader().loadAsync(options.moonTextureUrl);
  moonTexture.colorSpace = SRGBColorSpace;
  const moonGeometry = new SphereGeometry(MOON_RADIUS_EARTH_RADII, 64, 32);
  moonGeometry.rotateY(-Math.PI / 2);
  const moon = new Mesh(
    moonGeometry,
    new ShaderMaterial({
      uniforms: {
        map: { value: moonTexture },
        sunPosition: { value: sunPosition },
        sunRadius: { value: SUN_RADIUS_EARTH_RADII },
        earthRadius: { value: EARTH_SHADOW_ENLARGEMENT },
      },
      vertexShader: MOON_VERTEX,
      fragmentShader: MOON_FRAGMENT,
    }),
  );
  moon.visible = false;
  scene.add(moon);

  const sunUniforms = {
    map: { value: null as Texture | null },
    hasMap: { value: 0 },
    toEarth: { value: new Vector3(1, 0, 0) },
    north: { value: new Vector3(0, 1, 0) },
    diskRadius: { value: 0.4 },
    tint: { value: new Vector3(1, 1, 1) },
    // The far side's colour, in linear light, and visible light's limb-darkening coefficient.
    quiet: { value: new Vector3(1, 0.96, 0.86) },
    limbDarkening: { value: 0 },
  };
  const sun = new Mesh(
    new SphereGeometry(SUN_RADIUS_EARTH_RADII, 128, 64),
    new ShaderMaterial({
      uniforms: sunUniforms,
      vertexShader: SUN_VERTEX,
      fragmentShader: SUN_FRAGMENT,
    }),
  );
  const coronaUniforms = {
    map: sunUniforms.map,
    diskRadius: sunUniforms.diskRadius,
    tint: sunUniforms.tint,
    opacity: { value: 0 },
  };
  const corona = new Mesh(
    new PlaneGeometry(1, 1),
    new ShaderMaterial({
      uniforms: coronaUniforms,
      vertexShader: CORONA_VERTEX,
      fragmentShader: CORONA_FRAGMENT,
      // Add light without touching the canvas's alpha, which lets the page's sky show through.
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneFactor,
      blendSrcAlpha: ZeroFactor,
      blendDstAlpha: OneFactor,
      transparent: true,
      depthWrite: false,
    }),
  );
  corona.visible = false;
  scene.add(corona);
  // Frames of the Sun already loaded, by URL, and the one asked for last.
  const sunTextures = new Map<string, Texture>();
  // Each channel's average disc colour, from its small frame.
  const sunQuiet = new Map<string, Vector3>();
  let sunImageWanted: SunImageRequest | null = null;
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
  // Names of the largest territories shown, placed on the globe each frame.
  const empireLabelLayer = document.createElement('div');
  empireLabelLayer.className = 'empire-labels';
  container.append(empireLabelLayer);
  let empireLabels: {
    element: HTMLElement;
    position: Vector3;
    /** Approximate size on screen, pixels, for keeping names apart. */
    width: number;
    height: number;
  }[] = [];
  const markers = {
    earth: spaceMarker(markerLayer, 'Earth', 'earth'),
    moon: spaceMarker(markerLayer, 'Moon', 'moon'),
    sun: spaceMarker(markerLayer, 'Sun', 'sun'),
  };
  let earthFixedToJ2000: Matrix3 | null = null;
  // The Sun's frame is J2000, so a camera orbiting the Sun does not spin with Earth.
  const sunFrame = new Quaternion();
  // The Moon's map has longitude 0 at the mesh's +Z (see above); geoToVector puts it at +X.
  const moonMapTurn = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -Math.PI / 2);
  const bodyMeshes: Record<Body, Mesh> = { earth, moon, sun };
  const bodyClickListeners = new Set<(body: Body) => void>();
  const placeListeners = new Set<(place: GeoPoint) => void>();
  const emptyTapListeners = new Set<() => void>();
  for (const [body, marker] of Object.entries(markers)) {
    marker.addEventListener('click', () => {
      requestBody(body as Body);
    });
  }

  // A click (a press that barely moves) on a body asks to fly to it.
  const raycaster = new Raycaster();
  let press: { x: number; y: number } | null = null;
  renderer.domElement.addEventListener('pointerdown', (event) => {
    press = { x: event.clientX, y: event.clientY };
  });
  // Dragging or zooming an attached viewpoint releases it: the camera flies to orbit the body
  // it was looking at, from the observer's side, so the bodies can be turned again.
  renderer.domElement.addEventListener('pointermove', (event) => {
    if (press === null) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > CLICK_SLOP_PIXELS) {
      releaseViewpoint();
    }
  });
  renderer.domElement.addEventListener('wheel', releaseViewpoint, { passive: true });
  renderer.domElement.addEventListener('pointerup', (event) => {
    if (press === null) return;
    const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y);
    press = null;
    if (moved > CLICK_SLOP_PIXELS) return;
    const bounds = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(
      new Vector2(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      ),
      camera,
    );
    const visible = Object.values(bodyMeshes).filter((mesh) => mesh.visible);
    const hit = raycaster.intersectObjects(visible, false)[0];
    const body = (Object.keys(bodyMeshes) as Body[]).find((key) => bodyMeshes[key] === hit?.object);
    if (body === 'earth' && hit !== undefined && focus === 'earth' && viewpoint === 'free') {
      // On the Earth already in view, a tap picks the place to stand.
      const { x, y, z } = earth.worldToLocal(hit.point.clone());
      const place = vectorToGeo([x, y, z]);
      for (const listener of placeListeners) listener(place);
      return;
    }
    if (body !== undefined) {
      requestBody(body);
      return;
    }
    // Markers are HTML on top of the canvas, so a tap here missed them too.
    for (const listener of emptyTapListeners) listener();
  });

  function releaseViewpoint(): void {
    // Also mid-flight: a grab on the way in is a change of mind.
    if (viewpoint === 'free') return;
    const body: Body = viewpoint === 'moon-from-earth' ? 'moon' : 'earth';
    flyToFocus(body);
    for (const listener of bodyClickListeners) listener(body);
  }

  function requestBody(body: Body): void {
    if (body === focus && viewpoint === 'free') return;
    for (const listener of bodyClickListeners) listener(body);
  }

  /** Where a body is and how its surface coordinates turn into the scene's axes. */
  function bodyFrame(body: Body): { position: Vector3; rotation: Quaternion } {
    if (body === 'moon') {
      return { position: moon.position, rotation: moon.quaternion.clone().multiply(moonMapTurn) };
    }
    if (body === 'sun') return { position: sun.position, rotation: sunFrame };
    return { position: new Vector3(), rotation: new Quaternion() };
  }

  /** Stand the corona's plane across the line from Earth, north up, sized to the frame. */
  function placeCorona(): void {
    const toEarth = sunUniforms.toEarth.value;
    const north = sunUniforms.north.value;
    const up = north.clone().addScaledVector(toEarth, -north.dot(toEarth)).normalize();
    const right = new Vector3().crossVectors(toEarth.clone().negate(), up);
    corona.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(right, up, toEarth));
    corona.position.copy(sun.position);
    // The limb is diskRadius of the frame's width.
    const width = SUN_RADIUS_EARTH_RADII / sunUniforms.diskRadius.value;
    corona.scale.set(width, width, 1);
  }

  /** Close to the Sun its glow would wash out the image; the corona shows from Earth's side. */
  function shadeSun(): void {
    const imaged = sunUniforms.hasMap.value > 0 && sun.visible;
    const toCamera = camera.position.clone().sub(sun.position);
    const radii = toCamera.length() / SUN_RADIUS_EARTH_RADII;
    glow.material.opacity = imaged ? Math.min(1, Math.max(0, (radii - 12) / 40)) : 1;
    const facing = toCamera.normalize().dot(sunUniforms.toEarth.value);
    // 1 when the camera looks at the Sun from Earth's side, as SDO did; −1 from behind.
    container.dataset['sunFacing'] = facing.toFixed(3);
    const opacity = imaged ? Math.min(1, Math.max(0, (facing - 0.75) / 0.2)) : 0;
    coronaUniforms.opacity.value = opacity;
    corona.visible = opacity > 0;
  }

  function loadSunTexture(url: string): Promise<Texture> {
    const cached = sunTextures.get(url);
    if (cached !== undefined) return Promise.resolve(cached);
    return new TextureLoader().loadAsync(url).then((texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      sunTextures.set(url, texture);
      return texture;
    });
  }

  function bodyReady(body: Body): boolean {
    return body === 'earth' || bodyMeshes[body].visible;
  }

  /** The camera relative to the body in focus. */
  function relativeCamera(): GlobeCamera {
    const { position, rotation } = bodyFrame(focus);
    const local = camera.position
      .clone()
      .sub(position)
      .applyQuaternion(rotation.clone().invert())
      .divideScalar(BODY_RADIUS[focus]);
    return cameraFromPosition([local.x, local.y, local.z]);
  }

  function focusPose(body: Body, state: GlobeCamera): CameraPose {
    const { position, rotation } = bodyFrame(body);
    const eye = new Vector3(
      ...cameraPosition({ ...state, distance: state.distance * BODY_RADIUS[body] }),
    )
      .applyQuaternion(rotation)
      .add(position);
    return {
      eye: [eye.x, eye.y, eye.z],
      target: [position.x, position.y, position.z],
      fovDegrees: NARROW_SIDE_FOV_DEGREES,
    };
  }

  /** Hand the camera to the orbit controls, centred on the body in focus. */
  function orbitFocus(): void {
    const radius = BODY_RADIUS[focus];
    controls.target.copy(bodyFrame(focus).position);
    controls.minDistance = CAMERA_DISTANCE_RANGE.min * radius;
    controls.maxDistance = Math.min(CAMERA_DISTANCE_RANGE.max * radius, CAMERA_DISTANCE_RANGE.max);
    controls.enabled = true;
    controls.update();
  }

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
    focusCamera = state;
    if (viewpoint !== 'free') return;
    if (!bodyReady(focus)) {
      // Hold the usual view of Earth until the body arrives.
      applyPose(focusPose('earth', DEFAULT_CAMERA));
      return;
    }
    applyPose(focusPose(focus, state));
    orbitFocus();
  }

  let insets = { top: 0, bottom: 0 };
  // Field of view on the narrower side; attached viewpoints narrow it to frame a body.
  let narrowFov = NARROW_SIDE_FOV_DEGREES;
  let viewpoint: Viewpoint = 'free';
  let pendingViewpoint: Viewpoint | null = null;
  // A flight between viewpoints runs from a fixed pose to a live one, as the bodies keep moving.
  let viewFlight: { from: CameraPose; start: number } | null = null;
  let focus: Body = options.focus;
  // A focus asked for before its body loaded; the camera is placed there once it has.
  let pendingFocus = !bodyReady(focus);
  // Where the camera orbits, relative to the body in focus; kept while a viewpoint is attached.
  let focusCamera: GlobeCamera = options.camera;
  container.dataset['view'] = viewpoint;
  container.dataset['focus'] = focus;
  const lookTarget = new Vector3();

  function currentPose(): CameraPose {
    return {
      eye: [camera.position.x, camera.position.y, camera.position.z],
      target: [lookTarget.x, lookTarget.y, lookTarget.z],
      fovDegrees: narrowFov,
    };
  }

  function livePose(): CameraPose {
    if (viewpoint === 'free') return focusPose(focus, focusCamera);
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

  /** Centre on a body and fly there, arriving on the side facing the camera. */
  function flyToFocus(body: Body): void {
    const from = currentPose();
    // Arrive on the side facing the camera, a few radii out.
    const { position, rotation } = bodyFrame(body);
    const toward = camera.position.clone().sub(position).applyQuaternion(rotation.clone().invert());
    focus = body;
    pendingFocus = !bodyReady(body);
    focusCamera = {
      target: cameraFromPosition([toward.x, toward.y, toward.z]).target,
      distance: body === 'earth' ? DEFAULT_CAMERA.distance : FOCUS_DISTANCE,
    };
    container.dataset['focus'] = body;
    viewpoint = 'free';
    container.dataset['view'] = 'free';
    pendingViewpoint = null;
    flight = null;
    controls.enabled = false;
    if (pendingFocus) return;
    viewFlight = { from, start: performance.now() };
  }

  function startViewFlight(next: Viewpoint): void {
    const from = currentPose();
    if (viewpoint === 'free' && viewFlight === null) focusCamera = relativeCamera();
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
    const state = relativeCamera();
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
        // Orbit controls report the landing, which puts the camera in the link.
        if (viewpoint === 'free') orbitFocus();
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
    controls.zoomSpeed =
      camera.position.distanceTo(controls.target) < 10 * BODY_RADIUS[focus] ? 0.8 : 2.5;
    // update() keeps damping going after the pointer is released; it reports movement via 'change'.
    if (controls.enabled) controls.update();
    if (needsRender) {
      needsRender = false;
      shadeSun();
      renderer.render(scene, camera);
      placeMarkers();
      placeEmpireLabels();
      container.dataset['rendered'] = 'true';
    }
    frame = requestAnimationFrame(loop);
  }

  function placeEmpireLabels(): void {
    const eye = camera.position.clone().normalize();
    // Only names on the near side of Earth, and only while it fills enough of the view.
    const near = focus === 'earth' && camera.position.length() < 12;
    // Labels come largest first; a smaller state's name gives way where it would overlap.
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    for (const { element, position, width, height } of empireLabels) {
      projected.copy(position).project(camera);
      const shown =
        near && position.dot(eye) > 0.25 && Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1;
      const x = ((projected.x + 1) / 2) * container.clientWidth;
      const centre = ((1 - projected.y) / 2) * container.clientHeight;
      // Where it would overlap, a name may move a line up or down before it gives way.
      const y = [0, -1, 1, -2, 2]
        .map((step) => centre + step * height)
        .find((candidate) => {
          const box = { x: x - width / 2, y: candidate - height / 2, w: width, h: height };
          return placed.every(
            (other) =>
              box.x > other.x + other.w ||
              other.x > box.x + box.w ||
              box.y > other.y + other.h ||
              other.y > box.y + box.h,
          );
        });
      element.hidden = !shown || y === undefined;
      if (y === undefined || element.hidden) continue;
      placed.push({ x: x - width / 2, y: y - height / 2, w: width, h: height });
      element.style.transform = `translate(${String(x)}px, ${String(y)}px) translate(-50%, -50%)`;
    }
  }

  const projected = new Vector3();
  function placeMarkers(): void {
    const width = container.clientWidth;
    const height = container.clientHeight;
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
      // Only bodies in front of the camera get a marker.
      const visible =
        shown && projected.z < 1 && Math.abs(projected.x) < 1.2 && Math.abs(projected.y) < 1.2;
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
        focus === 'earth' &&
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
      // A camera orbiting the Moon or Sun keeps its place relative to it as the bodies move.
      const riding =
        focus !== 'earth' && viewpoint === 'free' && viewFlight === null && !pendingFocus;
      const relative = riding ? relativeCamera() : null;
      earthFixedToJ2000 = bodies.earthFixedToJ2000;
      const toEarthFixed = transpose(bodies.earthFixedToJ2000);
      const [r0, r1, r2] = sceneRotation(toEarthFixed);
      sunFrame.setFromRotationMatrix(new Matrix4().set(...r0, 0, ...r1, 0, ...r2, 0, 0, 0, 0, 1));
      sun.position.set(...sceneFromKm(apply(toEarthFixed, bodies.sunKm)));
      sun.visible = true;
      sunPosition.copy(sun.position);
      // The image's frame: toward Earth, and the Sun's rotation axis, in scene axes.
      sunUniforms.toEarth.value.copy(sun.position).negate().normalize();
      // sunFrame turns J2000 vectors written in scene axes, like every position here.
      sunUniforms.north.value.set(...toScene(SOLAR_NORTH_POLE_J2000)).applyQuaternion(sunFrame);
      placeCorona();
      if (bodies.moonKm === null) {
        moon.visible = false;
      } else {
        moon.position.set(...sceneFromKm(apply(toEarthFixed, bodies.moonKm)));
        moon.lookAt(0, 0, 0);
        moon.visible = true;
        moonPosition.copy(moon.position);
        earth.material.uniforms['moonRadius'] = { value: MOON_RADIUS_EARTH_RADII };
      }
      container.dataset['space'] = moon.visible ? 'moon' : 'sun';
      if (relative !== null) {
        // The next frame's controls.update() reports the move (see the inertial view above).
        applyPose(focusPose(focus, relative));
        controls.target.copy(bodyFrame(focus).position);
      }
      if (pendingFocus && bodyReady(focus)) {
        // A link that centres on the Moon: go straight there, as the link describes.
        pendingFocus = false;
        if (viewpoint === 'free') placeCamera(focusCamera);
      }
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
    setFocus(body) {
      if (body === focus && viewpoint === 'free') return;
      flyToFocus(body);
    },
    onBodyClick(listener) {
      bodyClickListeners.add(listener);
      return () => bodyClickListeners.delete(listener);
    },
    onEmptyTap(listener) {
      emptyTapListeners.add(listener);
      return () => emptyTapListeners.delete(listener);
    },
    setSunImage(image) {
      sunImageWanted = image;
      if (image === null) {
        sunUniforms.hasMap.value = 0;
        container.dataset['sunImage'] = 'none';
        needsRender = true;
        return;
      }
      const show = (url: string, size: string): void => {
        // A later request (another channel) wins over a slow one.
        if (sunImageWanted !== image) return;
        sunUniforms.map.value = sunTextures.get(url) ?? null;
        sunUniforms.hasMap.value = 1;
        sunUniforms.tint.value.set(...image.tint);
        sunUniforms.diskRadius.value = image.diskRadius;
        sunUniforms.limbDarkening.value = image.limbDarkening;
        let quiet = sunQuiet.get(image.key);
        if (quiet === undefined) {
          quiet = new Vector3(...quietSun(sunTextures.get(url), image));
          sunQuiet.set(image.key, quiet);
        }
        sunUniforms.quiet.value.copy(quiet);
        placeCorona();
        container.dataset['sunImage'] = size;
        container.dataset['sunLayer'] = image.key;
        needsRender = true;
      };
      if (sunTextures.has(image.large)) {
        show(image.large, 'large');
        return;
      }
      loadSunTexture(image.small)
        .then(() => {
          show(image.small, 'small');
          return loadSunTexture(image.large);
        })
        .then(() => {
          show(image.large, 'large');
        })
        .catch(() => {
          if (sunImageWanted === image) container.dataset['sunImage'] = 'error';
        });
    },
    setEmpires(territories) {
      const uniforms = earth.material.uniforms;
      uniforms['empiresActive'] = { value: territories === null ? 0 : 1 };
      empireLabelLayer.replaceChildren();
      empireLabels = [];
      if (territories !== null) {
        paintTerritories(empiresCanvas, territories);
        empiresTexture.needsUpdate = true;
        // Name the 30 largest, in proportion to their size.
        const ranked = territories
          .map((territory) => ({ territory, label: labelPoint(territory) }))
          .sort((a, b) => b.label.area - a.label.area)
          .slice(0, 30);
        empireLabels = ranked.map(({ territory, label }) => {
          const element = document.createElement('span');
          element.className = 'empire-label';
          element.textContent = territory.name;
          const size = Math.round(10 + Math.min(6, Math.sqrt(label.area) / 4));
          element.style.fontSize = `${String(size)}px`;
          // Laid out once, unseen, so its real size is known for keeping names apart.
          element.style.visibility = 'hidden';
          empireLabelLayer.append(element);
          return {
            element,
            position: new Vector3(...geoToVector(label, 1.01)),
            width: 0,
            height: 0,
          };
        });
        for (const entry of empireLabels) {
          entry.width = entry.element.offsetWidth;
          entry.height = entry.element.offsetHeight;
          entry.element.hidden = true;
          entry.element.style.visibility = '';
        }
      }
      container.dataset['empires'] = territories === null ? 'off' : String(territories.length);
      needsRender = true;
    },
    onPlacePick(listener) {
      placeListeners.add(listener);
      return () => placeListeners.delete(listener);
    },
    setLocation(place) {
      pin.visible = place !== null;
      if (place !== null) pin.position.set(...geoToVector(place, 1.004));
      container.dataset['location'] =
        place === null ? '' : `${place.latitude.toFixed(2)},${place.longitude.toFixed(2)}`;
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
      if (viewpoint !== 'free' || focus !== 'earth') return;
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

/**
 * The far side's colour for an SDO frame, in linear light: the disc's average, tinted, at the
 * level of the disc's centre. A warm white if the frame cannot be read.
 */
function quietSun(texture: Texture | undefined, image: SunImageRequest): Vector3Tuple {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const source: unknown = texture?.image;
  if (context === null || !(source instanceof HTMLImageElement || source instanceof ImageBitmap)) {
    return [1, 0.96, 0.86];
  }
  context.drawImage(source, 0, 0, size, size);
  const { data } = context.getImageData(0, 0, size, size);
  const [r, g, b] = discAverage(data, size, size, image.diskRadius, image.limbDarkening);
  return [r * image.tint[0], g * image.tint[1], b * image.tint[2]];
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
