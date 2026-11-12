/**
 * The WebGL globe: Earth lit by the Sun at a given moment, with orbit controls.
 * Rendering-only code. The math it relies on lives in tested modules (`geo.ts`,
 * `astro/sun.ts`); this file is exercised by the Playwright suite in a real browser.
 */

import { createImpactAnimation, type ImpactAnimation, type ImpactSpec } from './impactAnimation';
import { BODY_RADIUS } from './bodyRadius';
import { labelTexture } from './labelTexture';
import { createC14Glow } from './c14Glow';
import {
  createShowerAnimation,
  type ShowerAnimation,
  type ShowerCommand,
  type ShowerSpec,
} from './showerAnimation';
import { rayLabels } from './showerSteps';
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  CustomBlending,
  CylinderGeometry,
  DataTexture,
  Float32BufferAttribute,
  Group,
  LinearFilter,
  LineBasicMaterial,
  LineLoop,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  OneFactor,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  RedFormat,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TextureLoader,
  type Object3D,
  type Texture,
  UnsignedByteType,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
  ZeroFactor,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { apply, multiply, transpose, type Matrix3 } from '../astro/matrix';
import {
  CAMERA_DISTANCE_RANGE,
  DEFAULT_CAMERA,
  nearestDistance,
  type Body,
  type GeoPoint,
  type GlobeCamera,
  type Viewpoint,
} from '../state/viewState';
import { LAND_NOISE_GRID, landNoise, levelForShare, shareAtOrAbove } from '../deepTime/landScheme';
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
  earthFromPose,
  blendPose,
  hiddenBehind,
  mergeMarkers,
  MOON_RADIUS_EARTH_RADII,
  sceneFromKm,
  toScene,
  sceneRotation,
  SUN_RADIUS_EARTH_RADII,
  type CameraPose,
  type ScreenDisc,
  type ScreenMarker,
} from './spaceFrame';
import { EARTH_SHADOW_ENLARGEMENT } from '../astro/occultation';
import { SOLAR_NORTH_POLE_J2000 } from './sunImage';
import type { NamedBody } from '../data/planetNames';
import type { MoonName, MoonOrbits, MoonPlanet } from '../astro/moonOrbits';
import { ORBITING, PLANETS, type Orbiting, type PlanetName } from '../astro/planets';
import { PLANET_NAMES, planetRadius } from './planetLook';
import { isMoonBody, moonsInView } from './moonLook';
import {
  HISTORY_PAINT_ORDER,
  type GlobeLayer,
  DEEP_PAINT_ORDER,
  type DeepPainter,
  type HistoryPainter,
  type LayerFactory,
  type LayerHost,
  type NameLabel,
  type SurfaceLabel,
} from './layerHost';
import { createMoonMeshes } from './moonMeshes';
import { createPaintSlots } from './paintSlots';
import { assembleEarthParts, checkSamplers, type EarthPart } from './earthParts';
import { createPlanetMeshes } from './planetMeshes';
import type { ArrivalGrid } from '../data/dispersal';
import { clearOverlay, createEmpireCanvas, paintSettled } from './empireCanvas';
import { temperatureUniforms } from './temperatureShader';
import { ATMOSPHERE_FRAGMENT, ATMOSPHERE_VERTEX, MOON_FRAGMENT, MOON_VERTEX } from './bodyShaders';
import { CORONA_FRAGMENT, CORONA_VERTEX, SUN_FRAGMENT, SUN_VERTEX } from './sunShaders';
import { controlSpeeds } from './controlSpeeds';
import { createEarthTileLayer } from './earthTiles';
import { glowTexture } from './sunGlow';
import { tileLimits, type TileLimits } from './tileLimits';
import type { EarthTiles } from '../data/earthTiles';
import { EARTH_VERTEX, earthFragment } from './earthShader';
import type {
  DeepTimeSurface,
  IceSurface,
  PlateSurface,
  SeaIceSurface,
  ShelfSurface,
  SpaceBodies,
  SurfaceSketch,
  TemperatureSurface,
} from './surfaces';
import './spaceMarkers.css';

/** How far out the place pin floats, in Earth radii, so it shows above the ground. */
const PIN_HEIGHT = 1.004;
const NARROW_SIDE_FOV_DEGREES = 40;
const FLIGHT_MS = 900;
/** A zoom from one stop to another, however far: eased in log distance, so it reads as one move. */
const ZOOM_MS = 1200;
/** Flights between viewpoints cross up to 60 Earth radii: quick, but long enough to follow. */
const VIEW_FLIGHT_MS = 1600;
/** Arriving at a body, the camera stops this many of its radii from the centre. */
const FOCUS_DISTANCE = 4;

/** A press that moves less than this (pixels) is a click on a body, not a drag. */
const CLICK_SLOP_PIXELS = 6;
/** Beyond this distance (Earth radii) the view holds still in space and Earth turns in it. */
const INERTIAL_VIEW_DISTANCE = 20;
/** Bodies smaller than this on screen (radius, pixels) get a marker ring. */
const MARKER_RADIUS_PIXELS = 3;
/** Bodies larger than this on screen (radius, pixels) are plain to see and go unlabelled. */
const LABEL_MAX_RADIUS_PIXELS = 60;
/** Discs at least this large on screen (radius, pixels) hide the markers of planets behind. */
const OCCLUDING_RADIUS_PIXELS = 10;
/** Markers closer than this on screen (pixels) are shown as one. */
const MERGE_PIXELS = 40;

export interface Globe {
  /** Direction from Earth's center to the Sun, in the globe frame. */
  setSunDirection(direction: Vector3Tuple): void;
  /**
   * Place the Moon and Sun at their true sizes and distances. When the camera is far out, it
   * keeps its place among the stars as time moves, so Earth spins and the Moon orbits in view.
   */
  setSpace(bodies: SpaceBodies): void;
  /**
   * Draw the orbits of Earth and the planets around the Sun: each a loop of heliocentric J2000
   * positions in km. Null hides them.
   */
  setOrbits(paths: Readonly<Record<Orbiting, readonly (readonly number[])[]>> | null): void;
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
  /** Glow where cosmic rays make carbon-14, a rate per 5° of latitude (1 for today's over the
   * poles); null hides it. */
  setC14Glow(profile: readonly number[] | null): void;
  /** Play a cosmic-ray shower making carbon-14, reporting its state through `onState`; it
   * holds on its last picture until stopped. */
  playShower(spec: ShowerSpec): void;
  /** Play, pause, step through or replay the shower, or stop it and take it away. */
  controlShower(command: ShowerCommand | 'stop'): void;
  /**
   * Show a planet as one of its views (#239): a mission's map, fetched the first time it is
   * asked for, or null for its painted colours. Maps are kept, so switching back is instant.
   */
  showPlanetView(
    planet: PlanetName,
    view: { readonly map: string; readonly sharp: string | null } | null,
  ): void;
  /** Close up: the planet's sharper map for its view, from now on (#258). */
  sharpenPlanet(planet: PlanetName): void;
  /** Draw Saturn's rings as measured (#336): a strip of their colour and opacity, fetched once. */
  setSaturnRings(url: string): void;
  /** Show the Moon as another view than its usual map (#239), or null for its usual map. */
  showMoonView(view: { readonly map: string; readonly sharp: string | null } | null): void;
  /** Dress Earth or the Moon in a sharper map, fetched once, for close up (#258). */
  setBodyMap(body: 'earth' | 'moon', url: string): void;
  /** The widest texture the graphics can hold, pixels. */
  readonly maxTextureSize: number;
  /** What the device takes on of Earth's tiles (#578); null for none, and no nearer than 1.05. */
  readonly tileLimits: TileLimits | null;
  /** Close up, Earth's full-size map in tiles from now on, from their manifest (#568). */
  setEarthTiles(tiles: EarthTiles, folder: string): void;
  /**
   * Shade where a dispersal model has people settled `ka` thousand years ago, under any ice
   * outlines; null hides it.
   */
  setSettled(
    settled: { readonly scenario: string; readonly grid: ArrivalGrid; readonly ka: number } | null,
  ): void;
  /** Set Mars's, Jupiter's and Saturn's moons going round them (#335); null takes them away. */
  setMoonOrbits(orbits: MoonOrbits | null): void;
  /** Wrap a moon in a mission's map, fetched once: the latest asked for each moon wins. */
  setMoonMap(moon: MoonName, url: string | null): void;
  /**
   * Draw something more on the globe (#379): the layer gets the scene and the globe's services,
   * and is updated through what this returns. New things drawn are layers, not methods here.
   */
  addLayer<Input>(factory: LayerFactory<Input>): GlobeLayer<Input>;
  /** Called when someone taps a marker that has a card, with its key (such as `impact:47`). */
  onMarkerPick(listener: (key: string) => void): () => void;
  /**
   * Deep time: draw Earth's surface from two elevation maps blended by `mix` instead of
   * today's imagery; null returns to today's Earth.
   */
  setDeepTime(surface: DeepTimeSurface | null): void;
  /** Light the whole globe evenly, without night, as deep time does; for the Holocene's track. */
  setEvenLight(on: boolean): void;
  /** Start loading maps that will be wanted soon (as time plays), so they are there in time. */
  prefetch(urls: readonly string[]): void;
  /** Colour the deep-time surface by temperature; null shows relief alone. */
  setTemperature(surface: TemperatureSurface | null): void;
  /** Draw coastlines at a past sea level from today's shelves; null uses the elevation maps'. */
  setShelf(surface: ShelfSurface | null): void;
  /** Draw ice sheets over the surface; null draws none. */
  setIce(surface: IceSurface | null): void;
  /** Draw sea ice over the oceans; null draws none. */
  setSeaIce(surface: SeaIceSurface | null): void;
  /** Outline a second reconstruction's continents; null draws none. */
  setPlates(surface: PlateSurface | null): void;
  /** Before the elevation maps reach: a plain globe with a faint grid, not a made-up map. */
  setUncharted(uncharted: boolean): void;
  /** On the plain globe, sketch a hypothesis of the surface; null leaves it plain. */
  setSketch(sketch: SurfaceSketch | null): void;
  /** Pin the chosen place on the globe; null removes the pin. */
  setLocation(place: GeoPoint | null): void;
  /**
   * Fly to a viewpoint. Attached viewpoints follow the bodies as time moves and wait for the
   * Moon's position if it has not loaded yet; 'free' returns to the last orbiting camera.
   */
  setViewpoint(viewpoint: Viewpoint): void;
  /** Pixels panels cover at the top, the bottom and the right; the globe centres in the rest. */
  setInsets(insets: Partial<Readonly<{ top: number; bottom: number; right: number }>>): void;
  /** Turn the globe smoothly so `target` faces the camera, keeping the distance. */
  flyTo(target: GeoPoint): void;
  setCamera(camera: GlobeCamera): void;
  /** Glide to `distance` from the body in focus, in its radii, keeping the direction. */
  zoomTo(distance: number): void;
  /** Play an impact at its place: the approach, the flash, the ring, the crater. */
  playImpact(spec: ImpactSpec): void;
  /** Called while the user moves the camera, relative to the body in focus. Returns an unsubscribe function. */
  onCameraChange(listener: (camera: GlobeCamera) => void): () => void;
  readonly canvas: HTMLCanvasElement;
  dispose(): void;
}

/** Impacts that play at once, at most; deep time running fast can pass several in a frame. */
const MAX_IMPACTS = 8;

/** Stand-ins until the maps arrive: the Blue Marble's open ocean and the Moon's mean grey. */
const OCEAN_RGB = [11, 28, 66] as const;
const MOON_RGB = [128, 126, 122] as const;

/** A one-pixel texture of one colour (sRGB bytes). */
function plainTexture([red, green, blue]: readonly [number, number, number]): DataTexture {
  const texture = new DataTexture(new Uint8Array([red, green, blue, 255]), 1, 1);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** The sketch's noise field as a texture, made once, wrapping east–west. */
function sketchTexture(): { readonly texture: DataTexture; readonly shares: Float64Array } {
  const { columns, rows } = LAND_NOISE_GRID;
  const field = landNoise(columns, rows);
  const texture = new DataTexture(field, columns, rows, RedFormat, UnsignedByteType);
  texture.wrapS = RepeatWrapping;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return { texture, shares: shareAtOrAbove(field, columns, rows) };
}

export function createGlobe(
  container: HTMLElement,
  options: {
    readonly camera: GlobeCamera;
    readonly textureUrl: string;
    readonly moonTextureUrl: string;
    readonly focus: Body;
    /** The features' parts of the Earth shader (#379), built into it once. */
    readonly earthParts?: readonly EarthPart[];
  },
): Globe {
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

  // The maps are the largest downloads; the globe draws at once in plain colours and takes
  // each map as it arrives, so nothing else waits on them. Both load side by side.
  const loader = new TextureLoader();
  const earthMap = loader.loadAsync(options.textureUrl);
  const moonMap = loader.loadAsync(options.moonTextureUrl);
  const texture = plainTexture(OCEAN_RGB);
  const moonTexture = plainTexture(MOON_RGB);
  // `rendered` waits for the Earth's map, so it still means "the globe is drawn as it looks".
  let earthMapped = false;

  const sunDirection = new Vector3(1, 0, 0);
  // 1 in deep time: the globe lit evenly, with no day and night.
  const evenLight = { value: 0 };
  // Shared by the Earth and Moon shaders; set with the bodies each moment.
  const moonPosition = new Vector3();
  const sunPosition = new Vector3(1e5, 0, 0);
  // The eclipse path, painted once per eclipse into a map-shaped texture the Earth samples.
  const empiresCanvas = createEmpireCanvas();
  const empiresTexture = new CanvasTexture(empiresCanvas);
  empiresTexture.colorSpace = SRGBColorSpace;
  const earthUniforms = {
    dayMap: { value: texture },
    dayRect: { value: new Vector4(0, 0, 1, 1) },
    dayAlpha: { value: 1 },
    paleoYounger: { value: null as Texture | null },
    paleoOlder: { value: null as Texture | null },
    paleoMix: { value: 0 },
    paleoActive: { value: 0 },
    ...temperatureUniforms(),
    shelfMap: { value: null as Texture | null },
    shelfActive: { value: 0 },
    shelfGrid: { value: new Vector2(3601, 1801) },
    shelfRange: { value: new Vector2(-200, 55) },
    seaLevel: { value: 0 },
    seaIceTodayMost: { value: null as Texture | null },
    seaIceTodayYearRound: { value: null as Texture | null },
    seaIcePastMost: { value: null as Texture | null },
    seaIcePastYearRound: { value: null as Texture | null },
    seaIceMix: { value: 0 },
    seaIceActive: { value: 0 },
    seaIceSeason: { value: -1 },
    seaIceGrid: { value: new Vector2(361, 181) },
    iceYounger: { value: null as Texture | null },
    iceOlder: { value: null as Texture | null },
    iceMix: { value: 0 },
    iceActive: { value: 0 },
    iceGrid: { value: new Vector2(1441, 721) },
    iceStep: { value: 16 },
    plateYounger: { value: null as Texture | null },
    plateOlder: { value: null as Texture | null },
    plateMix: { value: 0 },
    plateActive: { value: 0 },
    plateGrid: { value: new Vector2(1441, 721) },
    plateTurn: { value: new Vector2(0, 0) },
    uncharted: { value: 0 },
    sketchKind: { value: 0 },
    sketchLevel: { value: 2 },
    sketchIceEdge: { value: 90 },
    evenLight,
    paleoGrid: { value: new Vector2(361, 181) },
    seaDepth: { value: 11_000 },
    landHeight: { value: 6_500 },
    overlayMap: { value: empiresTexture as Texture },
    empiresActive: { value: 0 },
    iceOutlinesActive: { value: 0 },
    sunDirection: { value: sunDirection },
    moonPosition: { value: moonPosition },
    moonRadius: { value: 0 },
    sunPosition: { value: sunPosition },
    sunRadius: { value: SUN_RADIUS_EARTH_RADII },
  };
  // The features' parts of the shader (#379), built in once: the shader is not made again.
  const parts = assembleEarthParts(options.earthParts ?? [], new Set(Object.keys(earthUniforms)));
  const earthShader = earthFragment(parts);
  checkSamplers(earthShader);
  const earth = new Mesh(
    new SphereGeometry(1, 128, 64),
    new ShaderMaterial({
      uniforms: { ...earthUniforms, ...parts.uniforms },
      vertexShader: EARTH_VERTEX,
      fragmentShader: earthShader,
    }),
  );
  const atmosphere = new Mesh(
    new SphereGeometry(1.04, 96, 48),
    new ShaderMaterial({
      uniforms: { sunDirection: { value: sunDirection }, evenLight },
      vertexShader: ATMOSPHERE_VERTEX,
      fragmentShader: ATMOSPHERE_FRAGMENT,
      side: BackSide,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
    }),
  );
  scene.add(earth, atmosphere);
  // Close up, Earth's full-size map in tiles over its own (#568), as many as the device takes on
  // (#578); how many are drawn, were fetched and are kept, for tests.
  const { maxTextureSize } = renderer.capabilities;
  const limits = tileLimits(maxTextureSize, matchMedia('(pointer: coarse)').matches);
  const earthTiles = createEarthTileLayer(earth, {
    anisotropy: renderer.capabilities.getMaxAnisotropy(),
    limits,
    pixels: () => renderer.domElement.height,
    requestRender: () => (needsRender = true),
    report: (...counts) => (container.dataset['earthTiles'] = counts.join('/')),
  });

  // Deep time: Earth's spin axis, its ends marked as the poles of the time shown. The maps
  // put the poles of their time at the top and bottom, so the axis is the globe's own.
  const spinAxis = new Group();
  spinAxis.add(
    new Mesh(
      new CylinderGeometry(0.004, 0.004, 2.6, 8),
      new MeshBasicMaterial({ color: new Color(0.85, 0.9, 1), transparent: true, opacity: 0.7 }),
    ),
  );
  // The spin axis's poles: fixed by the reconstruction, the continents moving beneath them.
  for (const [text, y] of [
    ['North pole (spin axis)', 1.42],
    ['South pole (spin axis)', -1.42],
  ] as const) {
    const label = new Sprite(
      new SpriteMaterial({ map: labelTexture(text, 768), transparent: true, depthWrite: false }),
    );
    label.scale.set(1.35, 1.35 / 6, 1);
    label.position.set(0, y, 0);
    spinAxis.add(label);
  }
  spinAxis.visible = false;
  scene.add(spinAxis);

  // The chosen place: a small pin standing on the ground.
  const pin = new Mesh(
    new SphereGeometry(0.012, 16, 8),
    new MeshBasicMaterial({ color: new Color(1, 0.72, 0.3) }),
  );
  pin.visible = false;
  earth.add(pin);

  // Where cosmic rays make carbon-14, when asked.
  const c14Glow = createC14Glow();
  earth.add(c14Glow.mesh);

  // The Moon, tidally locked: turn the map's longitude 0 (at +X) to +Z, which lookAt() aims at
  // Earth. Libration (a few degrees of wobble) is left out.
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
    // The map of the whole surface, and the newest frame, for the corona.
    surface: { value: null as Texture | null },
    map: { value: null as Texture | null },
    hasMap: { value: 0 },
    toEarth: { value: new Vector3(1, 0, 0) },
    north: { value: new Vector3(0, 1, 0) },
    diskRadius: { value: 0.4 },
    tint: { value: new Vector3(1, 1, 1) },
    // Visible light's limb-darkening coefficient.
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
  const planets = createPlanetMeshes(scene);
  const moonSystems = createMoonMeshes(scene);
  // Maps asked for, by address; the planets wearing their sharp map; and the bodies sharpened,
  // for whoever needs to know (#258).
  // Each planet's view (#239), its maps by address once fetched, and those close up enough for
  // their sharper map.
  const planetViews = new Map<
    PlanetName,
    { readonly map: string; readonly sharp: string | null } | null
  >();
  const planetTextures = new Map<string, Promise<Texture>>();
  const sharpWanted = new Set<PlanetName>();
  function planetTexture(url: string): Promise<Texture> {
    let texture = planetTextures.get(url);
    if (texture === undefined) {
      texture = new TextureLoader().loadAsync(url).then((map) => {
        map.colorSpace = SRGBColorSpace;
        map.anisotropy = renderer.capabilities.getMaxAnisotropy();
        return map;
      });
      // Asked again the next time, if it failed; what the planet wears stays meanwhile.
      texture.catch(() => planetTextures.delete(url));
      planetTextures.set(url, texture);
    }
    return texture;
  }
  // The Moon's usual map (the plain grey, then its first map, then the sharp one), and the
  // view it is shown as instead, if any (#239).
  let moonStandard: Texture = moonTexture;
  let moonView: { readonly map: string; readonly sharp: string | null } | null = null;
  function setMoonStandard(map: Texture): void {
    moonStandard.dispose();
    moonStandard = map;
    if (moonView === null) moon.material.uniforms['map'] = { value: map };
    needsRender = true;
  }
  function showMoonView(
    view: { readonly map: string; readonly sharp: string | null } | null,
  ): void {
    moonView = view;
    if (view === null) {
      moon.material.uniforms['map'] = { value: moonStandard };
      // Which the Moon wears, for whoever needs to know a view took.
      container.dataset['moonMap'] = 'usual';
      needsRender = true;
      return;
    }
    planetTexture(sharpened.has('moon') && view.sharp !== null ? view.sharp : view.map).then(
      (map) => {
        if (moonView !== view) return;
        moon.material.uniforms['map'] = { value: map };
        container.dataset['moonMap'] = 'view';
        needsRender = true;
      },
      () => undefined,
    );
  }
  /** Dress a planet as its view asks: the sharp map close up, else the first, else its colours. */
  function applyPlanetView(planet: PlanetName): void {
    const view = planetViews.get(planet) ?? null;
    if (view === null) {
      planets.setMap(planet, null);
      needsRender = true;
      return;
    }
    const sharpUrl = sharpWanted.has(planet) ? view.sharp : null;
    const sharp = sharpUrl !== null;
    const url = sharpUrl ?? view.map;
    planetTexture(url).then(
      (map) => {
        // Only if the planet still wants this view.
        if (planetViews.get(planet) !== view) return;
        planets.setMap(planet, map);
        container.dataset['planetMap'] = planet;
        if (sharp) markSharp(planet);
        needsRender = true;
      },
      () => undefined,
    );
  }
  const bodyMapsAsked = new Set<string>();
  const moonMapsWanted = new Map<MoonName, string | null>();
  const sharpened = new Set<string>();
  function markSharp(body: string): void {
    sharpened.add(body);
    container.dataset['sharp'] = [...sharpened].sort().join(' ');
  }
  // The planets' orbits, and Earth's: drawn about the Sun in J2000 axes, turned with them.
  const orbits = new Group();
  orbits.visible = false;
  scene.add(orbits);
  let orbitLoops: LineLoop<BufferGeometry, LineBasicMaterial>[] = [];
  const ORBIT_COLOURS: Readonly<Record<Orbiting, string>> = {
    mercury: '#b8b2a8',
    venus: '#e3c98f',
    earth: '#6fa8ff',
    mars: '#d9774b',
    jupiter: '#d8b48a',
    saturn: '#e6d29a',
  };

  // Deep time's elevation maps, loaded once each. They hold data, not colour: no colour space,
  // and linear filtering so the coast falls between the sea's last byte and the land's first.
  const paleoTextures = new Map<string, Promise<Texture>>();
  /**
   * Maps loaded in the order they were asked for: a newer one is shown as soon as it arrives,
   * even if a later one is still loading (as time plays, the latest is often not there yet);
   * an older one arriving late is not. Turning a layer off drops what is still loading.
   */
  function inOrder(): { ask(): number; show(ticket: number): boolean; drop(): void } {
    let asked = 0;
    let shown = 0;
    return {
      ask: () => ++asked,
      show(ticket) {
        if (ticket <= shown) return false;
        shown = ticket;
        return true;
      },
      drop() {
        shown = ++asked;
      },
    };
  }
  const deepTimeOrder = inOrder();
  let deepTime = false;
  // Lit evenly outside deep time too, while the Holocene's track is open.
  let evenLit = false;
  function showLight(): void {
    const even = deepTime || evenLit;
    evenLight.value = even ? 1 : 0;
    container.dataset['light'] = even ? 'even' : 'sun';
    needsRender = true;
  }
  const temperatureOrder = inOrder();
  const iceOrder = inOrder();
  const seaIceOrder = inOrder();
  const platesOrder = inOrder();
  let sketchField: { readonly texture: DataTexture; readonly shares: Float64Array } | null = null;
  function hiddenInDeepTime(): Object3D[] {
    return [sun, corona, moon, orbits, ...Object.values(planets.meshes)];
  }
  function paleoTexture(url: string): Promise<Texture> {
    let pending = paleoTextures.get(url);
    if (pending === undefined) {
      pending = new TextureLoader().loadAsync(url).then((loaded) => {
        loaded.minFilter = LinearFilter;
        loaded.magFilter = LinearFilter;
        loaded.generateMipmaps = false;
        return loaded;
      });
      paleoTextures.set(url, pending);
    }
    return pending;
  }

  const markerLayer = document.createElement('div');
  markerLayer.className = 'space-markers';
  container.append(markerLayer);
  // The history map: the layers' parts (rocks, ways, dates, #379) in order, the states over them.
  const historySlots = createPaintSlots<HistoryPainter>(paintHistoryOverlay);
  function paintHistoryOverlay(): void {
    const uniforms = earth.material.uniforms;
    const painters = historySlots.painters();
    const on = painters.length > 0;
    uniforms['empiresActive'] = { value: on ? 1 : 0 };
    needsRender = true;
    if (!on) return;
    clearOverlay(empiresCanvas);
    const statesOver = historySlots.shows(HISTORY_PAINT_ORDER.states);
    for (const paint of painters) paint(empiresCanvas, statesOver);
    empiresTexture.needsUpdate = true;
    uniforms['overlayMap'] = { value: empiresTexture };
  }
  const markerPickListeners = new Set<(key: string) => void>();
  // The layers added (#379), and what they lay out after each frame: declared before the first.
  const afterRenders: (() => void)[] = [];
  /** Labels on Earth's surface from the layers, each slot laid out in its priority's place. */
  const surfaceSlots: { readonly priority: number; labels: readonly SurfaceLabel[] }[] = [];
  const layers: GlobeLayer<never>[] = [];
  /** Taps on `[data-pick]` inside `layer` reach the marker-pick listeners. */
  function pickable(layer: HTMLElement): void {
    layer.addEventListener('click', (event) => {
      const marker = event.target instanceof Element ? event.target.closest('[data-pick]') : null;
      const key = marker?.getAttribute('data-pick');
      if (key === null || key === undefined) return;
      for (const listener of markerPickListeners) listener(key);
    });
  }
  // Deep time's overlay, on the states' map (never shown then): a dispersal model's settled
  // land, and the ice-sheet outlines over it.
  // The deep-time map: the land people had reached, and the layers' parts (#379), in order.
  const deepSlots = createPaintSlots<DeepPainter>(paintDeepOverlay);
  const settledPaint = deepSlots.add(DEEP_PAINT_ORDER.settled);
  function paintDeepOverlay(): void {
    const uniforms = earth.material.uniforms;
    const painters = deepSlots.painters();
    const on = painters.length > 0;
    uniforms['iceOutlinesActive'] = { value: on ? 1 : 0 };
    needsRender = true;
    if (!on) return;
    clearOverlay(empiresCanvas);
    for (const paint of painters) paint(empiresCanvas);
    empiresTexture.needsUpdate = true;
    uniforms['overlayMap'] = { value: empiresTexture };
  }

  /** Labels laid out once, unseen, so their real sizes are known for keeping them apart. */
  function measured(
    layer: HTMLElement,
    entries: readonly { readonly element: HTMLElement; readonly point: GeoPoint }[],
  ): SurfaceLabel[] {
    const labels = entries.map(({ element, point }) => {
      element.style.visibility = 'hidden';
      layer.append(element);
      return { element, position: new Vector3(...geoToVector(point, 1.01)), width: 0, height: 0 };
    });
    settleSizes(labels);
    return labels;
  }

  /**
   * Read every label's size, then hide them all: one layout for the lot. Hiding one between
   * reads would make the browser lay the page out again for the next, label after label.
   */
  function settleSizes(labels: readonly SurfaceLabel[]): void {
    for (const entry of labels) {
      entry.width = entry.element.offsetWidth;
      entry.height = entry.element.offsetHeight;
    }
    for (const entry of labels) {
      entry.element.hidden = true;
      entry.element.style.visibility = '';
    }
  }
  const markers = {
    earth: spaceMarker(markerLayer, 'Earth', 'earth'),
    moon: spaceMarker(markerLayer, 'Moon', 'moon'),
    sun: spaceMarker(markerLayer, 'Sun', 'sun'),
    mercury: spaceMarker(markerLayer, PLANET_NAMES.mercury, 'mercury'),
    venus: spaceMarker(markerLayer, PLANET_NAMES.venus, 'venus'),
    mars: spaceMarker(markerLayer, PLANET_NAMES.mars, 'mars'),
    jupiter: spaceMarker(markerLayer, PLANET_NAMES.jupiter, 'jupiter'),
    saturn: spaceMarker(markerLayer, PLANET_NAMES.saturn, 'saturn'),
  };
  let earthFixedToJ2000: Matrix3 | null = null;
  // The Sun's frame is J2000, so a camera orbiting the Sun does not spin with Earth.
  const sunFrame = new Quaternion();
  // The Moon's map has longitude 0 at the mesh's +Z (see above); geoToVector puts it at +X.
  const moonMapTurn = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -Math.PI / 2);
  const bodyMeshes: Record<Body, Mesh> = {
    earth,
    moon,
    sun,
    ...planets.meshes,
    ...moonSystems.meshes,
  };
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
    const visible = Object.values(bodyMeshes).filter(
      (mesh) => mesh.visible && !(deepTime && mesh !== earth),
    );
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
    // Planets, like the Sun, are orbited in J2000 axes, so the camera does not spin with Earth.
    // The planets' moons ride with their planet: where they are in the scene is their world's.
    if (isMoonBody(body)) {
      return { position: bodyMeshes[body].getWorldPosition(new Vector3()), rotation: sunFrame };
    }
    if (body !== 'earth') return { position: bodyMeshes[body].position, rotation: sunFrame };
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

  function bodyReady(body: Body): boolean {
    if (isMoonBody(body)) return moonSystems.ready();
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
    controls.minDistance = nearestDistance(focus, limits !== null) * radius;
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
  controls.minDistance = nearestDistance('earth', limits !== null);
  controls.maxDistance = CAMERA_DISTANCE_RANGE.max;

  const listeners = new Set<(camera: GlobeCamera) => void>();
  let needsRender = true;
  let frame = 0;

  // A map that fails to load leaves its plain colour: the globe still works, only plainer.
  earthMap.then(
    (map) => {
      // A sharp map that came first (a link opened close up) stays.
      if (sharpened.has('earth')) {
        map.dispose();
        earthMapped = true;
        return;
      }
      map.colorSpace = SRGBColorSpace;
      map.anisotropy = renderer.capabilities.getMaxAnisotropy();
      earth.material.uniforms['dayMap'] = { value: map };
      texture.dispose();
      earthMapped = true;
      needsRender = true;
    },
    (error: unknown) => {
      console.warn("Could not load the Earth's map:", error);
      earthMapped = true;
      needsRender = true;
    },
  );
  moonMap.then(
    (map) => {
      if (sharpened.has('moon')) {
        map.dispose();
        return;
      }
      map.colorSpace = SRGBColorSpace;
      setMoonStandard(map);
    },
    (error: unknown) => {
      console.warn("Could not load the Moon's map:", error);
    },
  );
  // Rotation along the sphere (a slerp), which also handles flying to the opposite side.
  let flight: { from: Vector3; rotation: Quaternion; start: number } | null = null;
  // The impacts playing, oldest first, several at once as deep time runs (#314), and how many
  // have played out.
  const impacts = new Set<ImpactAnimation>();
  let impactsPlayed = 0;
  let shower: ShowerAnimation | null = null;
  let showersPlayed = 0;
  // Distances from the body in focus, in scene units; it starts on the first frame, timed by the
  // frames' own clock (which can run apart from performance.now()).
  let zoomFlight: { from: number; to: number; start: number | null } | null = null;

  function placeCamera(state: GlobeCamera): void {
    focusCamera = state;
    if (viewpoint !== 'free') return;
    if (!bodyReady(focus)) {
      // Hold the usual view of Earth until the body arrives.
      applyPose(focusPose('earth', DEFAULT_CAMERA));
      container.dataset['framed'] = 'earth';
      return;
    }
    applyPose(focusPose(focus, state));
    container.dataset['framed'] = focus;
    orbitFocus();
  }

  /** Once the body a link centres on has arrived, go straight there, as the link describes. */
  function settleFocus(): void {
    if (!pendingFocus || !bodyReady(focus)) return;
    pendingFocus = false;
    if (viewpoint === 'free') placeCamera(focusCamera);
  }

  let insets = { top: 0, bottom: 0, right: 0 };
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
    // Away from Earth: stand on the body in focus and look back at Earth (from Earth itself,
    // the Moon is the nearest place to look back from).
    if (viewpoint === 'earth-from-here') {
      const body = focus === 'earth' ? 'moon' : focus;
      const { position } = bodyFrame(body);
      return earthFromPose([position.x, position.y, position.z], BODY_RADIUS[body]);
    }
    // From Earth, stand where the place picked sees the Moon from.
    const place = pin.visible ? pin.getWorldPosition(new Vector3()) : null;
    return attachedPose(
      viewpoint,
      [moon.position.x, moon.position.y, moon.position.z],
      // The pin floats a little above the ground; the place is on it.
      place === null ? null : [place.x / PIN_HEIGHT, place.y / PIN_HEIGHT, place.z / PIN_HEIGHT],
    );
  }

  function applyPose(pose: CameraPose): void {
    camera.position.set(...pose.eye);
    lookTarget.set(...pose.target);
    camera.lookAt(lookTarget);
    narrowFov = pose.fovDegrees;
    applyFov();
    needsRender = true;
  }

  /**
   * Centre on a body and fly there, arriving a few radii out on the side facing the camera, or
   * for the Sun on the side facing Earth: the side SDO saw last, with the corona around it.
   */
  function flyToFocus(body: Body): void {
    const from = currentPose();
    const { position, rotation } = bodyFrame(body);
    const toward = (body === 'sun' ? new Vector3() : camera.position.clone())
      .sub(position)
      .applyQuaternion(rotation.clone().invert());
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
    const [x, y] = [insets.right / 2, (insets.bottom - insets.top) / 2];
    camera.setViewOffset(clientWidth, clientHeight, x, y, clientWidth, clientHeight);
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / Math.max(clientHeight, 1);
    // Fix the field of view on the narrower side, so a camera distance frames the globe the
    // same way on a portrait phone as on a landscape laptop (and shared links look alike).
    applyFov();
  }

  function applyFov(): void {
    // Attached views frame their body in the space the panels leave, not the whole screen, so
    // the card doesn't cut across the Sun and Moon: widen the lens by how much smaller that is.
    const { clientWidth, clientHeight } = container;
    const narrow = Math.max(Math.min(clientWidth, clientHeight), 1);
    const free = Math.max(
      Math.min(clientWidth, clientHeight - insets.top - insets.bottom),
      narrow / 4,
    );
    const widen = viewpoint === 'free' ? 1 : Math.max(1, narrow / free);
    const halfAngle = Math.atan(Math.tan((narrowFov / 2) * (Math.PI / 180)) * widen);
    camera.fov =
      camera.aspect >= 1
        ? (2 * halfAngle * 180) / Math.PI
        : (2 * Math.atan(Math.tan(halfAngle) / camera.aspect) * 180) / Math.PI;
    camera.updateProjectionMatrix();
    needsRender = true;
  }

  // Grabbing the globe cancels an automatic flight.
  controls.addEventListener('start', () => {
    flight = null;
    zoomFlight = null;
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
        if (viewpoint === 'free') {
          container.dataset['framed'] = focus;
          orbitFocus();
        }
      }
    } else if (flight !== null) {
      const progress = Math.min(1, (now - flight.start) / FLIGHT_MS);
      const eased = 1 - (1 - progress) ** 3;
      const distance = camera.position.length();
      const step = new Quaternion().slerp(flight.rotation, eased);
      camera.position.copy(flight.from).applyQuaternion(step).setLength(distance);
      if (progress === 1) flight = null;
    }
    for (const impact of impacts) {
      needsRender = true;
      if (impact.update(now)) continue;
      impact.dispose();
      impacts.delete(impact);
      // How many have played out, for whoever needs to know one did, however briefly it showed.
      impactsPlayed += 1;
      container.dataset['impactsPlayed'] = String(impactsPlayed);
      container.dataset['impactPlaying'] = String(impacts.size > 0);
    }
    if (shower !== null) {
      const size = renderer.getSize(new Vector2());
      shower.setResolution(size.x, size.y);
      // Only while it plays, or just after a control: paused or held, it draws nothing new.
      if (shower.update(now)) needsRender = true;
    }
    if (zoomFlight !== null && viewFlight === null) {
      zoomFlight.start ??= now;
      const progress = Math.min(1, (now - zoomFlight.start) / ZOOM_MS);
      const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      const length = zoomFlight.from * (zoomFlight.to / zoomFlight.from) ** eased;
      const offset = camera.position.clone().sub(controls.target).setLength(length);
      // The controls report the move, which puts the camera in the link.
      camera.position.copy(controls.target).add(offset);
      needsRender = true;
      if (progress === 1) zoomFlight = null;
    }
    const speeds = controlSpeeds(camera.position.distanceTo(controls.target), BODY_RADIUS[focus]);
    controls.zoomSpeed = speeds.zoom;
    controls.rotateSpeed = speeds.rotate;
    // update() keeps damping going after the pointer is released; it reports movement via 'change'.
    if (controls.enabled) controls.update();
    if (needsRender) {
      needsRender = false;
      if (earthTiles.update(camera, !deepTime && earth.visible, now)) needsRender = true;
      shadeSun();
      // In deep time the Sun, Moon and planets are where they are today, which says nothing
      // about then: they are left out, markers too.
      const hidden = deepTime ? hiddenInDeepTime().filter((object) => object.visible) : [];
      for (const object of hidden) object.visible = false;
      renderer.render(scene, camera);
      placeMarkers();
      for (const object of hidden) object.visible = true;
      placeSurfaceLabels();
      showMoonPaths();
      for (const place of afterRenders) place();
      if (earthMapped) container.dataset['rendered'] = 'true';
    }
    frame = requestAnimationFrame(loop);
  }

  function placeSurfaceLabels(): void {
    const eye = camera.position.clone().normalize();
    // Only names on the near side of Earth, and only while it fills enough of the view.
    const near = focus === 'earth' && camera.position.length() < 12;
    // Labels come largest first; a smaller state's name gives way where it would overlap.
    // The larger states' names go before the markers, so a crowd of small counts can't take
    // their places; the smaller names come after, where room is left (#163).
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    // Read once: read after a label is moved, the size makes the browser lay the page out
    // again, for every label.
    const viewWidth = container.clientWidth;
    const viewHeight = container.clientHeight;
    // The layers' labels (#379), each slot in its place.
    const slots = [...surfaceSlots].sort((a, b) => a.priority - b.priority);
    for (const { element, position, width, height } of slots.flatMap(({ labels }) => labels)) {
      projected.copy(position).project(camera);
      const shown =
        near && position.dot(eye) > 0.25 && Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1;
      const x = ((projected.x + 1) / 2) * viewWidth;
      const centre = ((1 - projected.y) / 2) * viewHeight;
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

  /** Where a named body is, how it is turned, and its radius, in the scene's units. */
  function namedFrame(body: NamedBody | MoonPlanet): {
    position: Vector3;
    rotation: Quaternion;
    radius: number;
    shown: boolean;
  } {
    if (body === 'moon') {
      return { ...bodyFrame('moon'), radius: MOON_RADIUS_EARTH_RADII, shown: moon.visible };
    }
    const mesh = bodyMeshes[body];
    return {
      position: mesh.position,
      rotation: mesh.quaternion,
      radius: planetRadius(body),
      shown: mesh.visible,
    };
  }

  /** Show each name, in order, where it is on screen, clear of the panels and of those shown. */
  function layOutNames(
    names: readonly { readonly scene: Vector3; readonly label: NameLabel | undefined }[],
    layer: HTMLElement,
  ): void {
    const viewWidth = container.clientWidth;
    const viewHeight = container.clientHeight;
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    let count = 0;
    for (const { scene: at, label } of names) {
      if (label === undefined) continue;
      projected.copy(at).project(camera);
      const x = ((projected.x + 1) / 2) * viewWidth;
      const y = ((1 - projected.y) / 2) * viewHeight;
      const box = { x, y: y - label.height / 2, w: label.width, h: label.height };
      const visible =
        projected.z < 1 &&
        box.x >= 0 &&
        box.x + box.w <= viewWidth &&
        // Clear of the panels above and below the view, where a name could not be tapped.
        box.y >= insets.top &&
        box.y + box.h <= viewHeight - insets.bottom &&
        placed.every(
          (other) =>
            box.x > other.x + other.w ||
            other.x > box.x + box.w ||
            box.y > other.y + other.h ||
            other.y > box.y + box.h,
        );
      label.element.hidden = !visible;
      if (!visible) continue;
      placed.push(box);
      count += 1;
      label.element.style.transform = `translate(${String(x)}px, ${String(y)}px) translate(0, -50%)`;
    }
    layer.dataset['named'] = String(count);
  }

  /** Draw the paths of the moons of the planet in view, or of the moon in view's planet. */
  function showMoonPaths(): void {
    moonSystems.showPaths(moonsInView(focus));
    container.dataset['moonPaths'] = String(moonSystems.pathsShown());
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
      ...PLANETS.map((planet) => ({
        marker: markers[planet],
        mesh: bodyMeshes[planet],
        radius: planetRadius(planet),
        shown: bodyMeshes[planet].visible,
        name: PLANET_NAMES[planet],
      })),
    ];
    const onScreen: (ScreenMarker & { readonly marker: HTMLElement })[] = [];
    const discs: ScreenDisc[] = [];
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
      const x = ((projected.x + 1) / 2) * width;
      const y = ((1 - projected.y) / 2) * height;
      discs.push({ name, x, y, distance, radius: pixels });
      // A body that fills much of the view needs no label.
      if (pixels > LABEL_MAX_RADIUS_PIXELS) {
        marker.hidden = true;
        continue;
      }
      marker.classList.toggle('is-tiny', pixels < MARKER_RADIUS_PIXELS);
      marker.style.setProperty('--radius', `${String(Math.max(pixels, MARKER_RADIUS_PIXELS))}px`);
      marker.style.transform = `translate(${String(x)}px, ${String(y)}px)`;
      onScreen.push({ marker, name, x, y });
    }
    // Planets behind a nearer body's disc get no marker. Earth, Moon and Sun always keep
    // theirs: they are how you click your way back. From far out bodies line up on screen,
    // and one marker for them reads better than several.
    const planetNames = new Set<string>(Object.values(PLANET_NAMES));
    const behind = new Set(
      [...hiddenBehind(discs, OCCLUDING_RADIUS_PIXELS)].filter((name) => planetNames.has(name)),
    );
    const labels = mergeMarkers(
      onScreen.filter(({ name }) => !behind.has(name)),
      MERGE_PIXELS,
    );
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

  // What layers get (#379): the scene, the container and a few services.
  const host: LayerHost = {
    scene,
    camera,
    container,
    focus: () => focus,
    bodyFrame: namedFrame,
    sunPosition: () => sun.position,
    spinAxis,
    moonPosition: (moon, target) => moonSystems.meshes[moon].getWorldPosition(target),
    requestBody,
    spaceToScene() {
      if (earthFixedToJ2000 === null) return null;
      const toScene = transpose(earthFixedToJ2000);
      return (km) => sceneFromKm(apply(toScene, [km[0], km[1], km[2]]));
    },
    requestRender() {
      needsRender = true;
    },
    afterRender(place) {
      afterRenders.push(place);
    },
    layOutNames,
    pickable,
    deepPaint: (order) => deepSlots.add(order),
    historyPaint: (order) => historySlots.add(order),
    surfaceLabels(priority, layer) {
      const slot: (typeof surfaceSlots)[number] = { priority, labels: [] };
      surfaceSlots.push(slot);
      return {
        show(pins) {
          layer.replaceChildren();
          slot.labels = pins === null ? [] : measured(layer, pins);
          // Placed now, not at the next frame: as time plays, that frame may lay them out again.
          placeSurfaceLabels();
          needsRender = true;
        },
        move(points) {
          points.forEach((point, index) => {
            slot.labels[index]?.position.set(...geoToVector(point, 1.01));
          });
          placeSurfaceLabels();
          needsRender = true;
        },
      };
    },
    surfaceSlot(priority) {
      const slot: (typeof surfaceSlots)[number] = { priority, labels: [] };
      surfaceSlots.push(slot);
      return {
        set(labels) {
          slot.labels = labels;
          placeSurfaceLabels();
          needsRender = true;
        },
      };
    },
    measure: settleSizes,
    maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
    showSunImage(image) {
      sunUniforms.hasMap.value = image === null ? 0 : 1;
      if (image !== null) {
        sunUniforms.surface.value = image.surface;
        sunUniforms.map.value = image.disc;
        sunUniforms.tint.value.set(...image.tint);
        sunUniforms.diskRadius.value = image.diskRadius;
        sunUniforms.limbDarkening.value = image.limbDarkening;
        placeCorona();
      }
      needsRender = true;
    },
    renderToTexture(target, drawn, seenBy) {
      renderer.setRenderTarget(target);
      renderer.render(drawn, seenBy);
      renderer.setRenderTarget(null);
    },
    earthPart(part) {
      const uniforms = parts.byPart.get(part);
      if (uniforms === undefined) {
        throw new Error(`The Earth part "${part.name}" was not given to the globe`);
      }
      return uniforms as ReturnType<typeof part.uniforms>;
    },
  };

  return {
    canvas: renderer.domElement,
    maxTextureSize,
    tileLimits: limits,
    setEarthTiles: (tiles, folder) => {
      earthTiles.enable(tiles, folder);
    },
    setSunDirection([x, y, z]) {
      sunDirection.set(x, y, z).normalize();
      needsRender = true;
    },
    setOrbits(paths) {
      for (const loop of orbitLoops) {
        orbits.remove(loop);
        loop.geometry.dispose();
        loop.material.dispose();
      }
      orbitLoops = [];
      orbits.visible = paths !== null;
      // The moons' orbits go with the planets' (#335).
      moonSystems.showAllPaths(paths !== null);
      container.dataset['orbits'] = paths === null ? 'off' : String(ORBITING.length);
      if (paths === null) {
        needsRender = true;
        return;
      }
      for (const body of ORBITING) {
        const points = paths[body].flatMap(([x = 0, y = 0, z = 0]) => sceneFromKm([x, y, z]));
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
        const loop = new LineLoop(
          geometry,
          new LineBasicMaterial({
            color: ORBIT_COLOURS[body],
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
          }),
        );
        orbitLoops.push(loop);
        orbits.add(loop);
      }
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
      orbits.position.copy(sun.position);
      orbits.quaternion.copy(sunFrame);
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
      const planetsKm = bodies.planetsKm;
      planets.place(
        planetsKm === null
          ? null
          : (Object.fromEntries(
              PLANETS.map((planet) => [
                planet,
                new Vector3(...sceneFromKm(apply(toEarthFixed, planetsKm[planet]))),
              ]),
            ) as Record<PlanetName, Vector3>),
        sun.position,
        sunFrame,
        planetsKm === null ? undefined : { jdTT: bodies.jdTT, km: planetsKm },
      );
      moonSystems.place(
        bodies.jdTT,
        planetsKm === null
          ? null
          : {
              mars: bodyMeshes.mars.position,
              jupiter: bodyMeshes.jupiter.position,
              saturn: bodyMeshes.saturn.position,
            },
        sun.position,
        sunFrame,
      );
      container.dataset['planets'] = planetsKm === null ? 'off' : 'on';
      container.dataset['space'] = moon.visible ? 'moon' : 'sun';
      if (relative !== null) {
        // The next frame's controls.update() reports the move (see the inertial view above).
        applyPose(focusPose(focus, relative));
        controls.target.copy(bodyFrame(focus).position);
      }
      settleFocus();
      if (pendingViewpoint !== null && moon.visible) {
        startViewFlight(pendingViewpoint);
        pendingViewpoint = null;
      } else if (viewpoint !== 'free' && viewFlight === null) {
        // Attached viewpoints ride along with the bodies.
        applyPose(livePose());
      }
      needsRender = true;
    },
    setInsets(next) {
      const was = JSON.stringify(insets);
      insets = { ...insets, ...next };
      if (JSON.stringify(insets) !== was) resize();
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
    showPlanetView(planet, view) {
      planetViews.set(planet, view);
      applyPlanetView(planet);
    },
    showMoonView,
    setSaturnRings(url) {
      if (bodyMapsAsked.has(url)) return;
      bodyMapsAsked.add(url);
      planetTexture(url).then(
        (strip) => {
          planets.setRings(strip);
          container.dataset['rings'] = 'measured';
          needsRender = true;
        },
        () => undefined,
      );
    },
    sharpenPlanet(planet) {
      if (sharpWanted.has(planet)) return;
      sharpWanted.add(planet);
      applyPlanetView(planet);
    },
    setBodyMap(body, url) {
      if (bodyMapsAsked.has(url)) return;
      bodyMapsAsked.add(url);
      new TextureLoader()
        .loadAsync(url)
        .then((map) => {
          map.colorSpace = SRGBColorSpace;
          map.anisotropy = renderer.capabilities.getMaxAnisotropy();
          if (body === 'moon') {
            setMoonStandard(map);
            markSharp(body);
            // A view shown instead takes its own sharper map too.
            if (moonView !== null) showMoonView(moonView);
            return;
          }
          const uniforms = earth.material.uniforms;
          const previous = uniforms['dayMap']?.value as Texture | undefined;
          uniforms['dayMap'] = { value: map };
          previous?.dispose();
          markSharp(body);
          needsRender = true;
        })
        .catch(() => {
          bodyMapsAsked.delete(url);
        });
    },
    setC14Glow(profile) {
      c14Glow.set(profile);
      container.dataset['c14Glow'] =
        profile === null ? 'off' : profile.map((value) => value.toFixed(2)).join(' ');
      needsRender = true;
    },
    prefetch(urls) {
      for (const url of urls) {
        paleoTexture(url).catch(() => {
          // Tried again when it is wanted.
          paleoTextures.delete(url);
        });
      }
    },
    setEvenLight(on) {
      evenLit = on;
      showLight();
    },
    setDeepTime(surface) {
      deepTime = surface !== null;
      showLight();
      spinAxis.visible = deepTime;
      needsRender = true;
      const uniforms = earth.material.uniforms;
      if (surface === null) {
        deepTimeOrder.drop();
        uniforms['paleoActive'] = { value: 0 };
        container.dataset['deepTime'] = 'off';
        needsRender = true;
        return;
      }
      const ticket = deepTimeOrder.ask();
      Promise.all([paleoTexture(surface.younger), paleoTexture(surface.older)]).then(
        ([younger, older]) => {
          // Newer than the map shown: shown, though a later one may still be loading.
          if (!deepTimeOrder.show(ticket)) return;
          uniforms['paleoYounger'] = { value: younger };
          uniforms['paleoOlder'] = { value: older };
          uniforms['paleoMix'] = { value: surface.mix };
          uniforms['paleoGrid'] = { value: new Vector2(surface.columns, surface.rows) };
          uniforms['seaDepth'] = { value: surface.seaDepth };
          uniforms['landHeight'] = { value: surface.landHeight };
          uniforms['paleoActive'] = { value: 1 };
          container.dataset['deepTime'] = `${surface.younger} ${surface.older}`;
          needsRender = true;
        },
        () => {
          // Leave the last map shown; the next move tries again.
          paleoTextures.delete(surface.younger);
          paleoTextures.delete(surface.older);
        },
      );
    },
    setTemperature(surface) {
      const uniforms = earth.material.uniforms;
      if (surface === null) {
        temperatureOrder.drop();
        uniforms['tempActive'] = { value: 0 };
        container.dataset['temperature'] = 'off';
        needsRender = true;
        return;
      }
      const ticket = temperatureOrder.ask();
      Promise.all([paleoTexture(surface.younger), paleoTexture(surface.older)]).then(
        ([younger, older]) => {
          // Newer than the map shown: shown, though a later one may still be loading.
          if (!temperatureOrder.show(ticket)) return;
          uniforms['tempYounger'] = { value: younger };
          uniforms['tempOlder'] = { value: older };
          uniforms['tempMix'] = { value: surface.mix };
          uniforms['tempGrid'] = { value: new Vector2(surface.columns, surface.rows) };
          uniforms['tempRange'] = { value: new Vector2(surface.coldest, surface.warmest) };
          uniforms['tempChange'] = { value: surface.change ? 1 : 0 };
          uniforms['tempActive'] = { value: 1 };
          container.dataset['temperature'] = `${surface.younger} ${surface.older}`;
          container.dataset['temperatureChange'] = String(surface.change);
          needsRender = true;
        },
        () => {
          paleoTextures.delete(surface.younger);
          paleoTextures.delete(surface.older);
        },
      );
    },
    setShelf(surface) {
      const uniforms = earth.material.uniforms;
      if (surface === null) {
        uniforms['shelfActive'] = { value: 0 };
        container.dataset['shelf'] = 'off';
        needsRender = true;
        return;
      }
      uniforms['seaLevel'] = { value: surface.seaLevel };
      container.dataset['seaLevel'] = surface.seaLevel.toFixed(1);
      paleoTexture(surface.url).then(
        (map) => {
          uniforms['shelfMap'] = { value: map };
          uniforms['shelfGrid'] = { value: new Vector2(surface.columns, surface.rows) };
          uniforms['shelfRange'] = { value: new Vector2(surface.lowest, surface.highest) };
          uniforms['shelfActive'] = { value: 1 };
          container.dataset['shelf'] = surface.url;
          needsRender = true;
        },
        () => {
          paleoTextures.delete(surface.url);
        },
      );
      needsRender = true;
    },
    setIce(surface) {
      const uniforms = earth.material.uniforms;
      if (surface === null) {
        iceOrder.drop();
        uniforms['iceActive'] = { value: 0 };
        container.dataset['ice'] = 'off';
        needsRender = true;
        return;
      }
      const ticket = iceOrder.ask();
      Promise.all([paleoTexture(surface.younger), paleoTexture(surface.older)]).then(
        ([younger, older]) => {
          // Newer than the map shown: shown, though a later one may still be loading.
          if (!iceOrder.show(ticket)) return;
          uniforms['iceYounger'] = { value: younger };
          uniforms['iceOlder'] = { value: older };
          uniforms['iceMix'] = { value: surface.mix };
          uniforms['iceGrid'] = { value: new Vector2(surface.columns, surface.rows) };
          uniforms['iceStep'] = { value: surface.metresPerStep };
          uniforms['iceActive'] = { value: 1 };
          container.dataset['ice'] = `${surface.younger} ${surface.older}`;
          needsRender = true;
        },
        () => {
          paleoTextures.delete(surface.younger);
          paleoTextures.delete(surface.older);
        },
      );
    },
    setSeaIce(surface) {
      const uniforms = earth.material.uniforms;
      if (surface === null) {
        seaIceOrder.drop();
        uniforms['seaIceActive'] = { value: 0 };
        container.dataset['seaIce'] = 'off';
        needsRender = true;
        return;
      }
      const urls = [
        surface.todayMost,
        surface.todayYearRound,
        surface.pastMost,
        surface.pastYearRound,
      ] as const;
      const ticket = seaIceOrder.ask();
      Promise.all(urls.map((url) => paleoTexture(url))).then(
        ([todayMost, todayYearRound, pastMost, pastYearRound]) => {
          // Newer than the map shown: shown, though a later one may still be loading.
          if (!seaIceOrder.show(ticket)) return;
          uniforms['seaIceTodayMost'] = { value: todayMost };
          uniforms['seaIceTodayYearRound'] = { value: todayYearRound };
          uniforms['seaIcePastMost'] = { value: pastMost };
          uniforms['seaIcePastYearRound'] = { value: pastYearRound };
          uniforms['seaIceMix'] = { value: surface.mix };
          uniforms['seaIceSeason'] = { value: surface.season ?? -1 };
          uniforms['seaIceGrid'] = { value: new Vector2(surface.columns, surface.rows) };
          uniforms['seaIceActive'] = { value: 1 };
          const season = surface.season === null ? 'ice-age' : surface.season.toFixed(2);
          container.dataset['seaIce'] = `${season} ${surface.pastMost} ${surface.mix.toFixed(2)}`;
          needsRender = true;
        },
        () => {
          for (const url of urls) paleoTextures.delete(url);
        },
      );
    },
    setPlates(surface) {
      const uniforms = earth.material.uniforms;
      if (surface === null) {
        platesOrder.drop();
        uniforms['plateActive'] = { value: 0 };
        container.dataset['plates'] = 'off';
        needsRender = true;
        return;
      }
      const ticket = platesOrder.ask();
      Promise.all([paleoTexture(surface.younger), paleoTexture(surface.older)]).then(
        ([younger, older]) => {
          // Newer than the map shown: shown, though a later one may still be loading.
          if (!platesOrder.show(ticket)) return;
          uniforms['plateYounger'] = { value: younger };
          uniforms['plateOlder'] = { value: older };
          uniforms['plateMix'] = { value: surface.mix };
          uniforms['plateGrid'] = { value: new Vector2(surface.columns, surface.rows) };
          uniforms['plateTurn'] = { value: new Vector2(surface.turnYounger, surface.turnOlder) };
          uniforms['plateActive'] = { value: 1 };
          container.dataset['plates'] = `${surface.younger} ${surface.older}`;
          needsRender = true;
        },
        () => {
          paleoTextures.delete(surface.younger);
          paleoTextures.delete(surface.older);
        },
      );
    },
    setUncharted(blank) {
      earth.material.uniforms['uncharted'] = { value: blank ? 1 : 0 };
      container.dataset['uncharted'] = String(blank);
      needsRender = true;
    },
    setSketch(sketch) {
      const uniforms = earth.material.uniforms;
      container.dataset['sketch'] =
        sketch === null
          ? 'off'
          : `${sketch.kind} ${sketch.land.toFixed(3)} ${String(sketch.iceEdge)}`;
      needsRender = true;
      if (sketch === null) {
        uniforms['sketchKind'] = { value: 0 };
        return;
      }
      sketchField ??= sketchTexture();
      uniforms['overlayMap'] = { value: sketchField.texture };
      uniforms['sketchKind'] = { value: sketch.kind === 'magma' ? 1 : 2 };
      uniforms['sketchLevel'] = { value: levelForShare(sketchField.shares, sketch.land) };
      uniforms['sketchIceEdge'] = { value: sketch.iceEdge };
    },
    setSettled(settled) {
      // Whole thousands of years only: the model's own step.
      const ka = settled === null ? null : Math.round(settled.ka);
      const key = settled === null ? 'off' : `${settled.scenario} ${String(ka)}`;
      if (key === container.dataset['settled']) return;
      container.dataset['settled'] = key;
      settledPaint.show(
        settled === null || ka === null
          ? null
          : (canvas) => {
              paintSettled(canvas, settled.grid, ka);
            },
      );
    },
    addLayer(factory) {
      const layer = factory(host);
      layers.push(layer);
      return layer;
    },
    setMoonMap(moon, url) {
      if (moonMapsWanted.get(moon) === url) return;
      moonMapsWanted.set(moon, url);
      if (url === null) {
        // Its painted colour: as Titan looks, all haze.
        moonSystems.setMap(moon, null);
        container.dataset['moonMap'] = `${moon} painted`;
        needsRender = true;
        return;
      }
      planetTexture(url).then(
        (map) => {
          // Only if the moon still wants this map: a sharper one may have been asked since.
          if (moonMapsWanted.get(moon) !== url) return;
          moonSystems.setMap(moon, map);
          container.dataset['moonMap'] = moon;
          needsRender = true;
        },
        () => undefined,
      );
    },
    setMoonOrbits(orbits) {
      moonSystems.setOrbits(orbits);
      // A link to a moon waits for its orbit; the bodies may not be placed again, time at rest.
      settleFocus();
      needsRender = true;
    },
    onMarkerPick(listener) {
      markerPickListeners.add(listener);
      return () => markerPickListeners.delete(listener);
    },
    onPlacePick(listener) {
      placeListeners.add(listener);
      return () => placeListeners.delete(listener);
    },
    setLocation(place) {
      pin.visible = place !== null;
      if (place !== null) pin.position.set(...geoToVector(place, PIN_HEIGHT));
      container.dataset['location'] =
        place === null ? '' : `${place.latitude.toFixed(2)},${place.longitude.toFixed(2)}`;
      needsRender = true;
    },
    setViewpoint(next) {
      if (next === 'free') pendingViewpoint = null;
      if (next === viewpoint) return;
      if (next !== 'free' && (!moon.visible || !bodyReady(focus))) {
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
    playImpact(spec) {
      // Beyond a handful at once, the oldest makes way.
      const [oldest] = impacts;
      if (oldest !== undefined && impacts.size >= MAX_IMPACTS) {
        oldest.dispose();
        impacts.delete(oldest);
      }
      const impact = createImpactAnimation(spec);
      impacts.add(impact);
      earth.add(impact.group);
      container.dataset['impactPlaying'] = 'true';
      needsRender = true;
    },
    playShower(spec) {
      shower?.dispose();
      // Every step it has shown, in order: a slow frame can pass a step's start, never a step.
      const shown: string[] = [];
      let counted = false;
      shower = createShowerAnimation({
        ...spec,
        onState(state) {
          container.dataset['showerStep'] = state.step;
          container.dataset['showerPlaying'] = String(state.playing);
          if (shown.at(-1) !== state.step) shown.push(state.step);
          container.dataset['showerSteps'] = shown.join(' ');
          // How many have played to their end, for whoever needs to know one did.
          if (state.ended && !counted) {
            counted = true;
            showersPlayed += 1;
            container.dataset['showersPlayed'] = String(showersPlayed);
          }
          spec.onState(state);
        },
      });
      earth.add(shower.group);
      // The place's pin, a big ball close up, would hide the plant: it rests while the shower
      // plays. Its material only, so the place still counts for the attached viewpoints.
      pin.material.visible = false;
      container.dataset['pinShown'] = 'false';
      // What the rays' labels say, for whoever needs to read them.
      const words = rayLabels(spec.dipole);
      container.dataset['showerLabels'] = `${words.polar} | ${words.equator}`;
      container.dataset['showerGround'] = spec.water ? 'water' : 'land';
      needsRender = true;
    },
    controlShower(command) {
      if (shower === null) return;
      if (command !== 'stop') {
        shower.command(command);
        // Said at once, not at the next frame, which a busy device may be slow to draw.
        if (command === 'pause' || command === 'settle')
          container.dataset['showerPlaying'] = 'false';
        if (command === 'play' || command === 'replay') container.dataset['showerPlaying'] = 'true';
        needsRender = true;
        return;
      }
      shower.dispose();
      shower = null;
      // The place's pin comes back once the shower is taken away.
      pin.material.visible = true;
      container.dataset['pinShown'] = 'true';
      container.dataset['showerStep'] = 'done';
      needsRender = true;
    },
    zoomTo(distance) {
      if (viewpoint !== 'free') return;
      const radius = BODY_RADIUS[focus];
      const to = Math.min(Math.max(distance * radius, controls.minDistance), controls.maxDistance);
      zoomFlight = {
        from: camera.position.distanceTo(controls.target),
        to,
        start: null,
      };
      needsRender = true;
    },
    onCameraChange(listener) {
      listeners.add(listener);
      // A link nearer than this device lets the camera come (#578): say where it stopped.
      const held = focusCamera.distance < nearestDistance(focus, limits !== null);
      if (held && viewpoint === 'free' && bodyReady(focus)) listener(relativeCamera());
      return () => listeners.delete(listener);
    },
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      texture.dispose();
      moonTexture.dispose();
      c14Glow.dispose();
      shower?.dispose();
      for (const impact of impacts) impact.dispose();
      for (const layer of layers) layer.dispose?.();
      markerLayer.remove();
      renderer.domElement.remove();
    },
  };
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
