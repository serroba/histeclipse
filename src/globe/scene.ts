/**
 * The WebGL globe: Earth lit by the Sun at a given moment, with orbit controls.
 *
 * Rendering-only code. The math it relies on lives in tested modules (`geo.ts`,
 * `astro/sun.ts`); this file is exercised by the Playwright suite in a real browser.
 */

import { createImpactAnimation, type ImpactAnimation, type ImpactSpec } from './impactAnimation';
import { BODY_RADIUS } from './bodyRadius';
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
  OrthographicCamera,
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
  WebGLRenderTarget,
  ZeroFactor,
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
import { LAND_NOISE_GRID, landNoise, levelForShare, shareAtOrAbove } from '../deepTime/landScheme';
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
import { labelPoint, type Territory } from '../data/empires';
import { ORBITING, PLANETS, type Orbiting, type PlanetName } from '../astro/planets';
import { PLANET_NAMES, planetRadius } from './planetLook';
import { createPlanetMeshes } from './planetMeshes';
import type { GenomeCell } from '../data/ancientGenomes';
import type { FossilCell } from '../data/fossils';
import type { ImpactMark } from '../data/impacts';
import type { VolcanoMark } from '../data/volcanoes';
import type { ArrivalGrid } from '../data/dispersal';
import type { HumanSite } from '../data/humanClaims';
import type { RockUnit } from '../data/rocks';
import type { WayRegion } from '../data/waysOfLife';
import type { IceOutlines } from '../data/iceOutlines';
import type { DateCell } from '../data/radiocarbonDates';
import type { OhmYear } from '../data/ohmBorders';
import {
  clearOverlay,
  createEmpireCanvas,
  paintBorders,
  paintDateCells,
  paintIceOutlines,
  paintRocks,
  paintSettled,
  paintWays,
  paintTerritories,
} from './empireCanvas';
import {
  OCCULTATION,
  SOLAR_COMMON,
  SOLAR_PATH_FRAGMENT,
  SOLAR_PATH_LAYER,
  SOLAR_SHADOW,
} from './solarShaders';

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
  /** Geocentric J2000 positions of the planets in km; null until their theory loads. */
  readonly planetsKm: Readonly<Record<PlanetName, readonly [number, number, number]>> | null;
  /** The moment, Julian Day (TT): how far each planet has turned. */
  readonly jdTT: number;
}

/** A small image to show at once and a sharp one to follow. */
export interface ImagePair {
  readonly small: string;
  readonly large: string;
}

/**
 * SDO's view of the Sun in one channel: a map of the whole surface (see `data/sunImages.ts`),
 * and the newest frame, whose limb is at `diskRadius` of its width, north up, west right.
 */
export interface SunImageRequest {
  readonly key: string;
  readonly map: ImagePair;
  readonly disc: ImagePair;
  /** Multiplies the images' colours: a warm white for the grey visible-light ones. */
  readonly tint: readonly [number, number, number];
  readonly diskRadius: number;
  /** How much the Sun darkens toward the limb as the camera sees it (u in 1 − u(1 − μ)). */
  readonly limbDarkening: number;
}

/** Past states to draw: Cliopatria's filled territories, OpenHistoricalMap's border lines, or both. */
export interface EmpireLayer {
  readonly territories: readonly Territory[];
  readonly ohm: OhmYear | null;
  /** States that appeared or went since the year drawn before, to name on the map a while. */
  readonly changes?: readonly StateChange[];
}

/** A state that appeared or went, and where its name goes. */
export interface StateChange {
  readonly name: string;
  readonly kind: 'new' | 'gone';
  readonly point: { readonly latitude: number; readonly longitude: number };
  /** How large it is drawn: the larger ones are named first. */
  readonly area: number;
}

/**
 * How many states are named as new or gone at once, the largest first: as the years fly by in
 * a busy century, more would light up most of the map and read as flicker.
 */
const STATE_CHANGES_SHOWN = 4;
/** A state's name at this size or larger (its larger states) is placed before the markers. */
const MAJOR_STATE_SIZE = 14;
/** Regions with this many genomes or fewer are a small dot, without a number. */
const FEW_GENOMES = 2;

/** How long a state that appeared or went stays named as such, ms (its CSS animation's too). */
const STATE_CHANGE_MS = 4000;

/** Two elevation maps (URLs of greyscale images, see `data/paleoDem.ts`) and the blend between. */
export interface DeepTimeSurface {
  readonly younger: string;
  readonly older: string;
  /** 0 shows `younger`, 1 `older`. */
  readonly mix: number;
  readonly columns: number;
  readonly rows: number;
  readonly seaDepth: number;
  readonly landHeight: number;
}

/** Surface temperature in deep time: two maps either side of the moment, blended. */
export interface TemperatureSurface {
  readonly younger: string;
  readonly older: string;
  /** 0 shows `younger`, 1 `older`. */
  readonly mix: number;
  readonly columns: number;
  readonly rows: number;
  /** °C that bytes 0 and 255 stand for. */
  readonly coldest: number;
  readonly warmest: number;
}

/** On the ice-age scale: today's coasts and shelves, cut at the sea level of the moment. */
export interface ShelfSurface {
  readonly url: string;
  readonly columns: number;
  readonly rows: number;
  /** Metres that bytes 0 and 255 stand for, from today's sea level. */
  readonly lowest: number;
  readonly highest: number;
  /** The sea level to cut at, metres from today's. */
  readonly seaLevel: number;
}

/** On the ice-age scale: ice thickness, two maps either side of the moment, blended. */
export interface IceSurface {
  readonly younger: string;
  readonly older: string;
  /** 0 shows `younger`, 1 `older`. */
  readonly mix: number;
  readonly columns: number;
  readonly rows: number;
  readonly metresPerStep: number;
}

/**
 * Sea ice: today's and an ice-age model's, each as the most ice in the year and the ice that
 * lasts all year, blended `mix` of the way from today's to the ice age's.
 */
export interface SeaIceSurface {
  readonly todayMost: string;
  readonly todayYearRound: string;
  readonly pastMost: string;
  readonly pastYearRound: string;
  readonly mix: number;
  readonly columns: number;
  readonly rows: number;
}

/** A second reconstruction's continents: two masks either side of the moment, blended. */
export interface PlateSurface {
  readonly younger: string;
  readonly older: string;
  /** 0 shows `younger`, 1 `older`. */
  readonly mix: number;
  readonly columns: number;
  readonly rows: number;
  /** How far each mask is turned east about the axis, degrees, to line up with the surface. */
  readonly turnYounger: number;
  readonly turnOlder: number;
}

/**
 * Before any reconstruction: what a hypothesis says the surface was like, drawn as a sketch.
 * Land, if any, has invented shapes and places; only its share of the surface is the source's.
 */
export interface SurfaceSketch {
  /** A molten surface, or an ocean with that share of the surface as land. */
  readonly kind: 'magma' | 'ocean';
  /** Share of the whole surface that is land, 0..1. */
  readonly land: number;
  /** Ice covers everything poleward of this latitude, degrees; 90 or more draws none. */
  readonly iceEdge: number;
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
  /**
   * Dress the Sun in an SDO image: a small frame at once, then the sharp one. Null returns it to
   * a plain disc.
   */
  setSunImage(image: SunImageRequest | null): void;
  /** Mark the pole a compass pointed to in deep time; null when it is not known. */
  setMagneticNorth(where: 'north' | 'south' | 'either' | null): void;
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
  /** Show the Moon as another view than its usual map (#239), or null for its usual map. */
  showMoonView(view: { readonly map: string; readonly sharp: string | null } | null): void;
  /** Dress Earth or the Moon in a sharper map, fetched once, for close up (#258). */
  setBodyMap(body: 'earth' | 'moon', url: string): void;
  /** The widest texture the graphics can hold, pixels. */
  readonly maxTextureSize: number;
  /**
   * Lay past states and empires over the ground, with the names of the largest; null hides
   * the layer.
   */
  setEmpires(layer: EmpireLayer | null): void;
  /** Mark regions with ancient genomes near the year shown, by count; null hides them. */
  setGenomeCells(cells: readonly GenomeCell[] | null): void;
  /**
   * Shade where a dispersal model has people settled `ka` thousand years ago, under any ice
   * outlines; null hides it.
   */
  setSettled(
    settled: { readonly scenario: string; readonly grid: ArrivalGrid; readonly ka: number } | null,
  ): void;
  /** Shade the rocks at the surface by age, under everything else; null hides them. */
  setRocks(units: readonly RockUnit[] | null): void;
  /** Shade cells by how many radiocarbon dates fall in the step shown; null hides them. */
  setDateCells(
    dates: { readonly cells: readonly DateCell[]; readonly cellDegrees: number } | null,
  ): void;
  /** Shade regions by their most widespread way of life, under any states; null hides them. */
  setWays(regions: readonly WayRegion[] | null): void;
  /** Mark cells with fossils of the moment, by group and count; null hides them. */
  setFossilCells(cells: readonly FossilCell[] | null): void;
  /** Mark dated finds of humans and their relatives in deep time; null hides them. */
  setHumanSites(sites: readonly HumanSite[] | null): void;
  /** Mark impact craters and deposits, sized by diameter, each to tap for its card; null hides them. */
  setImpacts(marks: readonly ImpactMark[] | null): void;
  /** Mark volcanoes erupting near the year shown, sized by VEI, each to tap; null hides them. */
  setVolcanoes(marks: readonly VolcanoMark[] | null): void;
  /** Called when someone taps a marker that has a card, with its key (such as `impact:47`). */
  onMarkerPick(listener: (key: string) => void): () => void;
  /** Outline one time slice's ice sheets (Batchelor et al. 2019) in deep time; null hides them. */
  setIceOutlines(outlines: IceOutlines | null): void;
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
  /** Pixels covered by panels at the top and bottom; the globe is centred between them. */
  setInsets(top: number, bottom: number): void;
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
export const EARTH_FRAGMENT = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  ${SOLAR_COMMON}
  ${SOLAR_SHADOW}
  ${SOLAR_PATH_LAYER}
  ${OCCULTATION}
  uniform sampler2D dayMap;
  // Deep time: two elevation maps (bytes 0–127 sea floor, 128–255 land) and the blend between.
  uniform sampler2D paleoYounger;
  uniform sampler2D paleoOlder;
  uniform float paleoMix;
  uniform float paleoActive;
  uniform float evenLight;
  uniform sampler2D tempYounger;
  uniform sampler2D tempOlder;
  uniform float tempMix;
  uniform float tempActive;
  uniform vec2 tempGrid;
  uniform vec2 tempRange;
  uniform sampler2D shelfMap;
  uniform float shelfActive;
  uniform vec2 shelfGrid;
  uniform vec2 shelfRange;
  uniform float seaLevel;
  uniform sampler2D seaIceTodayMost;
  uniform sampler2D seaIceTodayYearRound;
  uniform sampler2D seaIcePastMost;
  uniform sampler2D seaIcePastYearRound;
  uniform float seaIceMix;
  uniform float seaIceActive;
  uniform vec2 seaIceGrid;
  uniform sampler2D iceYounger;
  uniform sampler2D iceOlder;
  uniform float iceMix;
  uniform float iceActive;
  uniform vec2 iceGrid;
  uniform float iceStep;
  uniform sampler2D plateYounger;
  uniform sampler2D plateOlder;
  uniform float plateMix;
  uniform float plateActive;
  uniform vec2 plateGrid;
  uniform vec2 plateTurn;
  uniform float uncharted;
  uniform float sketchKind;
  uniform float sketchLevel;
  uniform float sketchIceEdge;
  uniform vec2 paleoGrid;
  uniform float seaDepth;
  uniform float landHeight;
  // Shared by the empires map (historical time) and the sketch's noise (deep time), which never
  // show together: a seventeenth texture would pass the 16 that many GPUs allow a shader.
  uniform sampler2D overlayMap;
  uniform float empiresActive;
  uniform float iceOutlinesActive;
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

  // The elevation maps are node-registered (the first and last columns are both 180°), so a
  // texture coordinate is moved half a pixel to land on the nodes.
  float paleoElevation(sampler2D map, vec2 uv) {
    vec2 at = (uv * (paleoGrid - 1.0) + 0.5) / paleoGrid;
    float byte = texture2D(map, at).r * 255.0;
    // Sea level falls between bytes 127 and 128, so blended bytes cross it smoothly there.
    return byte >= 127.5
      ? (byte - 127.5) / 127.5 * landHeight
      : -(127.5 - byte) / 127.5 * seaDepth;
  }

  vec3 srgb(vec3 c) { return pow(c, vec3(2.2)); }

  const float PI = 3.141592653589793;
  const float EARTH_RADIUS_M = 6371000.0;

  float paleoHeight(vec2 uv) {
    return mix(paleoElevation(paleoYounger, uv), paleoElevation(paleoOlder, uv), paleoMix);
  }

  // Hypsometric colours: deep blue sea floor to pale shallows; green lowlands, ochre uplands,
  // brown mountains, white peaks. No ice or vegetation: the maps give only height.
  vec3 seaColour(float height) {
    float depth = clamp(-height / 6000.0, 0.0, 1.0);
    vec3 shelf = mix(srgb(vec3(0.36, 0.64, 0.78)), srgb(vec3(0.13, 0.34, 0.58)), smoothstep(0.0, 0.08, depth));
    return mix(shelf, srgb(vec3(0.04, 0.12, 0.30)), smoothstep(0.08, 1.0, depth));
  }

  vec3 landColour(float height) {
    vec3 color = mix(srgb(vec3(0.33, 0.50, 0.26)), srgb(vec3(0.66, 0.60, 0.40)), smoothstep(0.0, 1200.0, height));
    color = mix(color, srgb(vec3(0.52, 0.40, 0.29)), smoothstep(1200.0, 2800.0, height));
    return mix(color, srgb(vec3(0.92, 0.92, 0.90)), smoothstep(3500.0, 5000.0, height));
  }

  // Node-registered like the elevation maps, so the same half-pixel shift applies.
  float paleoTemperatureFrom(sampler2D map, vec2 uv) {
    vec2 at = (uv * (tempGrid - 1.0) + 0.5) / tempGrid;
    return mix(tempRange.x, tempRange.y, texture2D(map, at).r);
  }

  float paleoTemperature(vec2 uv) {
    return mix(paleoTemperatureFrom(tempYounger, uv), paleoTemperatureFrom(tempOlder, uv), tempMix);
  }

  // A diverging scale, blue through pale yellow to red (ColorBrewer RdYlBu), °C. The legend in
  // the deep-time bar draws the same stops.
  vec3 temperatureColour(float celsius) {
    vec3 c = srgb(vec3(0.192, 0.212, 0.584));
    c = mix(c, srgb(vec3(0.271, 0.459, 0.706)), smoothstep(-40.0, -20.0, celsius));
    c = mix(c, srgb(vec3(0.569, 0.749, 0.859)), smoothstep(-20.0, -5.0, celsius));
    c = mix(c, srgb(vec3(0.878, 0.953, 0.973)), smoothstep(-5.0, 5.0, celsius));
    c = mix(c, srgb(vec3(0.996, 0.878, 0.565)), smoothstep(5.0, 15.0, celsius));
    c = mix(c, srgb(vec3(0.992, 0.682, 0.380)), smoothstep(15.0, 22.0, celsius));
    c = mix(c, srgb(vec3(0.957, 0.427, 0.263)), smoothstep(22.0, 28.0, celsius));
    c = mix(c, srgb(vec3(0.843, 0.188, 0.153)), smoothstep(28.0, 35.0, celsius));
    return mix(c, srgb(vec3(0.647, 0.0, 0.149)), smoothstep(35.0, 45.0, celsius));
  }

  // Node-registered like the other deep-time maps; a byte per iceStep metres, 0 for no ice.
  float iceFrom(sampler2D map, vec2 uv) {
    vec2 at = (uv * (iceGrid - 1.0) + 0.5) / iceGrid;
    return texture2D(map, at).r * 255.0 * iceStep;
  }

  // No map before the elevation maps reach: a plain globe, with a graticule every 30 degrees so
  // it still reads as a sphere turning.
  float gridLine(vec2 uv) {
    vec2 degrees = vec2(uv.x * 360.0, uv.y * 180.0);
    vec2 toLine = abs(fract(degrees / 30.0 + 0.5) - 0.5) * 30.0;
    vec2 width = fwidth(degrees) * 0.8;
    return 1.0 - min(smoothstep(0.0, width.x, toLine.x), smoothstep(0.0, width.y, toLine.y));
  }

  vec3 unchartedSurface(vec2 uv) {
    return mix(srgb(vec3(0.20, 0.25, 0.33)), srgb(vec3(0.42, 0.50, 0.62)), gridLine(uv) * 0.6);
  }

  // A second reconstruction's continents as a thin magenta line, a pixel or two wide at any
  // zoom, where its mask crosses one half. On the blank globe, before the elevation maps reach,
  // they are filled in too: the only continents drawn there.
  vec3 withPlates(vec3 color, vec2 uv, float filled) {
    if (plateActive < 0.5) return color;
    // Each mask turned east by its own amount: sampled that far west.
    vec2 atYounger = (vec2(fract(uv.x - plateTurn.x / 360.0), uv.y) * (plateGrid - 1.0) + 0.5) / plateGrid;
    vec2 atOlder = (vec2(fract(uv.x - plateTurn.y / 360.0), uv.y) * (plateGrid - 1.0) + 0.5) / plateGrid;
    float inside = mix(texture2D(plateYounger, atYounger).r, texture2D(plateOlder, atOlder).r, plateMix);
    float blur = 1.5 * max(fwidth(inside), 1e-4);
    color = mix(color, srgb(vec3(0.55, 0.45, 0.58)), filled * 0.55 * smoothstep(0.5 - blur, 0.5 + blur, inside));
    float edge = 1.0 - smoothstep(0.0, blur, abs(inside - 0.5));
    return mix(color, srgb(vec3(1.0, 0.42, 0.84)), edge * 0.9);
  }

  // A hypothesis sketched on the plain globe: a molten surface with glowing seams, or an ocean
  // with land of invented shape cut from a noise field, and ice poleward of an edge. The grid
  // stays on top, faintly, so it reads as a sketch and not a map.
  float sketchIce(vec2 uv) {
    if (sketchKind < 0.5) return 0.0;
    float latitude = abs(uv.y - 0.5) * 180.0;
    float blur = max(fwidth(latitude), 0.3);
    return smoothstep(sketchIceEdge - blur, sketchIceEdge + blur, latitude);
  }

  vec3 sketchSurface(vec2 uv) {
    if (sketchKind < 0.5) return unchartedSurface(uv);
    float noise = texture2D(overlayMap, uv).r;
    vec3 color;
    if (sketchKind < 1.5) {
      // Chilled crust, darker where thicker, split by thin seams of glowing melt.
      // Held below 1, so the highest values don't wrap to a dark patch.
      float band = fract(min(noise, 0.99) * 4.0);
      float seam = abs(band - 0.5);
      float glow = 1.0 - smoothstep(0.0, 0.035 + fwidth(noise) * 4.0, seam);
      vec3 crust = mix(srgb(vec3(0.16, 0.05, 0.03)), srgb(vec3(0.42, 0.12, 0.04)), band);
      color = mix(crust, srgb(vec3(1.0, 0.62, 0.2)), glow);
    } else {
      float blur = max(fwidth(noise), 1e-3);
      float land = smoothstep(sketchLevel - blur, sketchLevel + blur, noise);
      // Bare rock: there were no plants on land.
      color = mix(srgb(vec3(0.12, 0.25, 0.36)), srgb(vec3(0.50, 0.45, 0.38)), land);
    }
    color = mix(color, srgb(vec3(0.92, 0.95, 0.99)), sketchIce(uv));
    return mix(color, srgb(vec3(0.42, 0.50, 0.62)), 0.35 * gridLine(uv));
  }

  vec3 paleoSurface(vec2 uv) {
    // Under a sketch's ice, a reconstruction's continents keep only their outline.
    if (uncharted > 0.5) return withPlates(sketchSurface(uv), uv, 1.0 - sketchIce(uv));
    float height = paleoHeight(uv);
    // Where the coast runs comes from heights averaged over about half a degree (a tent of
    // nine samples): some source grids draw coasts in 0.5–1° steps, and this rounds them off.
    // Colours and shading keep the full detail.
    vec2 reach = 2.5 / (paleoGrid - 1.0);
    float coast = 0.0;
    for (int i = -1; i <= 1; i++) {
      for (int j = -1; j <= 1; j++) {
        float weight = (2.0 - abs(float(i))) * (2.0 - abs(float(j)));
        coast += weight * paleoHeight(uv + vec2(float(i), float(j)) * reach);
      }
    }
    coast = mix(height, coast / 16.0, 0.85);
    // The coast blends over about a screen pixel, so it is smooth at any zoom.
    float blur = max(fwidth(coast), 1.0);
    vec3 color = mix(seaColour(min(height, -1.0)), landColour(max(height, 0.0)), smoothstep(-blur, blur, coast));
    if (shelfActive > 0.5) {
      // Ice ages: today's land and sea floor, cut at the sea level of the moment. Within the
      // shelf map's band (-200 to +55 m) its finer 0.1° heights decide; beyond, the map's.
      vec2 at = (uv * (shelfGrid - 1.0) + 0.5) / shelfGrid;
      float shelf = mix(shelfRange.x, shelfRange.y, texture2D(shelfMap, at).r);
      float inBand = step(shelfRange.x + 0.5, shelf) * step(shelf, shelfRange.y - 0.5);
      coast = mix(height, shelf, inBand) - seaLevel;
      blur = max(fwidth(coast), 1.0);
      // Shelf below today's sea level, laid bare: land, in a sandier tint so it stands out.
      float bared = (1.0 - step(0.0, shelf)) * inBand;
      vec3 land = mix(landColour(max(height, 0.0)), srgb(vec3(0.72, 0.68, 0.46)), bared);
      float depth = min(mix(height, shelf, inBand) - seaLevel, -1.0);
      color = mix(seaColour(depth), land, smoothstep(-blur, blur, coast));
    }
    // Hill shading, lit from the north-west as maps are: slopes from the neighbouring nodes,
    // ten times steeper than they are so ranges show from orbit.
    vec2 step_ = 1.0 / (paleoGrid - 1.0);
    float east = paleoHeight(uv + vec2(step_.x, 0.0)) - paleoHeight(uv - vec2(step_.x, 0.0));
    float north = paleoHeight(uv + vec2(0.0, step_.y)) - paleoHeight(uv - vec2(0.0, step_.y));
    // Two nodes apart, in metres: rows span half a circumference, columns a whole one,
    // narrowing with latitude.
    float latitude = (uv.y - 0.5) * PI;
    float southNorth = 2.0 * PI * EARTH_RADIUS_M * step_.y;
    float westEast = 2.0 * 2.0 * PI * EARTH_RADIUS_M * step_.x * max(cos(latitude), 0.05);
    vec3 normal = normalize(vec3(-10.0 * east / westEast, -10.0 * north / southNorth, 1.0));
    vec3 light = normalize(vec3(-1.0, 1.0, 1.4));
    float shade = dot(normal, light) / light.z;
    if (tempActive > 0.5) {
      // Temperature over the relief: the sea darker and the coast drawn as a thin dark line,
      // so the continents still read where land and sea are the same temperature.
      float sea = 1.0 - smoothstep(-blur, blur, coast);
      float shore = 1.0 - smoothstep(blur, 3.0 * blur, abs(coast));
      color = temperatureColour(paleoTemperature(uv)) * (1.0 - 0.3 * sea) * (1.0 - 0.55 * shore);
    }
    if (seaIceActive > 0.5) {
      // Sea ice over the sea only: solid white where it lasts all year, a fainter white where
      // it forms only in winter. Bytes hold 0.4% steps (250 is full cover).
      vec2 at = (uv * (seaIceGrid - 1.0) + 0.5) / seaIceGrid;
      float most = mix(texture2D(seaIceTodayMost, at).r, texture2D(seaIcePastMost, at).r, seaIceMix) * 255.0 / 250.0;
      float lasting = mix(texture2D(seaIceTodayYearRound, at).r, texture2D(seaIcePastYearRound, at).r, seaIceMix) * 255.0 / 250.0;
      float sea = 1.0 - smoothstep(-blur, blur, coast);
      float cover = max(0.45 * smoothstep(0.15, 0.4, most), 0.92 * smoothstep(0.15, 0.4, lasting));
      color = mix(color, srgb(vec3(0.92, 0.95, 0.99)), sea * cover);
    }
    if (iceActive > 0.5) {
      // Ice sheets: white, a little blue where thin; the edge blends over about a pixel.
      float thickness = mix(iceFrom(iceYounger, uv), iceFrom(iceOlder, uv), iceMix);
      float iceBlur = max(fwidth(thickness), 1.0);
      float covered = smoothstep(8.0 - iceBlur, 8.0 + iceBlur, thickness);
      vec3 ice = mix(srgb(vec3(0.78, 0.87, 0.95)), srgb(vec3(0.97, 0.98, 1.0)), smoothstep(0.0, 2000.0, thickness));
      color = mix(color, ice, covered);
    }
    color *= clamp(mix(1.0, shade, 0.7), 0.45, 1.35);
    return withPlates(color, uv, 0.0);
  }

  // Travelling through the Holocene: today's Earth, with the shelf a lower sea left bare (in
  // the sand tint the ice ages use) and the ice sheets that still lay on the land.
  vec3 holoceneSurface(vec2 uv) {
    vec3 color = texture2D(dayMap, uv).rgb;
    if (shelfActive > 0.5) {
      vec2 at = (uv * (shelfGrid - 1.0) + 0.5) / shelfGrid;
      float shelf = mix(shelfRange.x, shelfRange.y, texture2D(shelfMap, at).r);
      // Above the sea of the year and below today's: land then, sea now.
      float coast = shelf - seaLevel;
      float blur = max(fwidth(coast), 1.0);
      float bared = smoothstep(-blur, blur, coast) * (1.0 - smoothstep(-blur, blur, shelf));
      color = mix(color, srgb(vec3(0.72, 0.68, 0.46)), bared);
    }
    if (iceActive > 0.5) {
      float thickness = mix(iceFrom(iceYounger, uv), iceFrom(iceOlder, uv), iceMix);
      float iceBlur = max(fwidth(thickness), 1.0);
      float covered = smoothstep(8.0 - iceBlur, 8.0 + iceBlur, thickness);
      vec3 ice = mix(srgb(vec3(0.78, 0.87, 0.95)), srgb(vec3(0.97, 0.98, 1.0)), smoothstep(0.0, 2000.0, thickness));
      color = mix(color, ice, covered);
    }
    return color;
  }

  // Past states and empires, painted on a map in the ground texture's layout. Each keeps its
  // colour by night too, a little dimmer, so borders read on both sides.
  vec3 empiresLayer(vec3 color, float daylight) {
    vec4 painted = texture2D(overlayMap, vUv);
    vec3 tinted = mix(color, painted.rgb * (0.45 + 0.55 * daylight), painted.a * 0.85);
    return mix(color, tinted, empiresActive);
  }

  // Deep time's ice-sheet outlines, on the same map as the states (never shown together), drawn
  // over deep time's even light.
  vec3 iceOutlinesLayer(vec3 color) {
    vec4 painted = texture2D(overlayMap, vUv);
    return mix(color, mix(color, painted.rgb, painted.a), iceOutlinesActive);
  }

  void main() {
    #include <logdepthbuf_fragment>
    vec3 normal = normalize(vNormal);
    float sunAltitude = dot(normal, sunDirection);
    vec3 surface = paleoActive > 0.5 ? paleoSurface(vUv) : holoceneSurface(vUv);
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
    // Deep time: no one can say what hour it was, and days were shorter, so there is no night
    // side. A soft light from the viewer keeps the globe round.
    float facing = max(dot(normal, normalize(cameraPosition)), 0.0);
    color = mix(color, surface * (0.6 + 0.45 * facing), evenLight);
    // The Holocene's track lights evenly too: its states, ways of life and rocks go back over
    // the evenly lit ground (in deep time none of them is on).
    color = mix(color, empiresLayer(color, 1.0), evenLight);
    color = iceOutlinesLayer(color);
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

// The whole surface wears SDO's map, stitched from frames days apart, turned so the side facing
// Earth is the newest frame's (sunImage.ts is the tested reference). The map is the surface
// seen face-on; visible light darkens toward the limb as the camera sees it, so the disc looks
// round from any side.
const SUN_FRAGMENT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D surface;
  uniform float hasMap;
  uniform vec3 toEarth;
  uniform vec3 north;
  uniform vec3 tint;
  uniform float limbDarkening;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    #include <logdepthbuf_fragment>
    vec3 plain = vec3(1.0, 0.96, 0.86);
    vec3 n = normalize(vNormal);
    vec3 meridian = normalize(toEarth - dot(toEarth, north) * north);
    vec3 west = cross(north, meridian);
    float latitude = asin(clamp(dot(n, north), -1.0, 1.0));
    float longitude = atan(dot(n, west), dot(n, meridian));
    vec2 uv = vec2(0.5 + longitude / PI2, 0.5 + latitude / PI);
    // On the far side's meridian u jumps from 1 back to 0, which would pick the coarsest
    // mipmap along a seam. A copy of u that jumps on the near side instead gives the right
    // footprint there; use whichever changes less across the pixel.
    float shifted = fract(uv.x + 0.5);
    vec2 dx = dFdx(uv);
    vec2 dy = dFdy(uv);
    float dxShifted = dFdx(shifted);
    float dyShifted = dFdy(shifted);
    if (abs(dxShifted) < abs(dx.x)) dx.x = dxShifted;
    if (abs(dyShifted) < abs(dy.x)) dy.x = dyShifted;
    float towardCamera = clamp(dot(n, normalize(cameraPosition - vWorldPosition)), 0.0, 1.0);
    float darkening = 1.0 - limbDarkening * (1.0 - towardCamera);
    vec3 seen = textureGrad(surface, uv, dx, dy).rgb * tint * darkening;
    gl_FragColor = vec4(mix(plain, seen, hasMap), 1.0);
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
  uniform float evenLight;
  varying vec3 vViewNormal;
  varying vec3 vWorldNormal;
  void main() {
    #include <logdepthbuf_fragment>
    float rim = pow(clamp(0.92 + dot(vViewNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 4.0);
    float sunlit = smoothstep(-0.35, 0.35, dot(normalize(vWorldNormal), sunDirection));
    sunlit = mix(sunlit, 0.75, evenLight);
    vec3 color = vec3(0.3, 0.55, 1.0) * rim * (0.08 + 0.62 * sunlit);
    gl_FragColor = vec4(color, 1.0);
  }
`;

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
        paleoYounger: { value: null as Texture | null },
        paleoOlder: { value: null as Texture | null },
        paleoMix: { value: 0 },
        paleoActive: { value: 0 },
        tempYounger: { value: null as Texture | null },
        tempOlder: { value: null as Texture | null },
        tempMix: { value: 0 },
        tempActive: { value: 0 },
        tempGrid: { value: new Vector2(361, 181) },
        tempRange: { value: new Vector2(-60, 60) },
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
  // Where a compass pointed: magnetic north at the north pole, or the south when the field was
  // reversed; when it reversed too often to say, a note at the north pole instead.
  const magneticLabels = {
    north: ['Magnetic north', 1.62],
    south: ['Magnetic north', -1.62],
    either: ['Magnetic north: either pole, reversing often', 1.62],
  } as const;
  const magneticNorth = new Map(
    Object.entries(magneticLabels).map(([where, [text, y]]) => {
      const label = new Sprite(
        new SpriteMaterial({
          map: labelTexture(text, 1280, 'rgba(255, 150, 120, 0.95)'),
          transparent: true,
          depthWrite: false,
        }),
      );
      label.scale.set(2.25, 2.25 / 10, 1);
      label.position.set(0, y, 0);
      label.visible = false;
      spinAxis.add(label);
      return [where, label] as const;
    }),
  );
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
  // Maps and frames of the Sun already loaded, by URL, and the channel asked for last.
  const sunTextures = new Map<string, Texture>();
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
  const planets = createPlanetMeshes(scene);
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
      needsRender = true;
      return;
    }
    planetTexture(sharpened.has('moon') && view.sharp !== null ? view.sharp : view.map).then(
      (map) => {
        if (moonView !== view) return;
        moon.material.uniforms['map'] = { value: map };
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
  // Names of the largest territories shown, placed on the globe each frame.
  const empireLabelLayer = document.createElement('div');
  empireLabelLayer.className = 'empire-labels';
  container.append(empireLabelLayer);
  interface GlobeLabel {
    element: HTMLElement;
    position: Vector3;
    /** Approximate size on screen, pixels, for keeping names apart. */
    width: number;
    height: number;
  }
  /** A state's name; `major` for the larger states' and those just come or gone. */
  let empireLabels: (GlobeLabel & { readonly id: string; readonly major: boolean })[] = [];
  // Dated finds of humans, in deep time: placed before the states' names, which never show then.
  const humanLabelLayer = document.createElement('div');
  humanLabelLayer.className = 'empire-labels human-sites';
  container.append(humanLabelLayer);
  let humanLabels: GlobeLabel[] = [];
  let humanSitesKey = '';
  // Historical time's overlay, on the states' map: ways of life, and the states over them.
  // The sizes of the states' names already laid out, by class, size and name: as the years
  // play, most names come back step after step.
  const labelSizes = new Map<string, { readonly width: number; readonly height: number }>();
  // States that appeared or went lately, by name: named on the map for a while.
  const recentStates = new Map<string, { readonly change: StateChange; readonly at: number }>();
  let historyOverlay: {
    readonly rocks: readonly RockUnit[] | null;
    readonly ways: readonly WayRegion[] | null;
    readonly dates: { readonly cells: readonly DateCell[]; readonly cellDegrees: number } | null;
    readonly empires: EmpireLayer | null;
  } = { rocks: null, ways: null, dates: null, empires: null };
  function paintHistoryOverlay(): void {
    const uniforms = earth.material.uniforms;
    const { rocks, ways, dates, empires } = historyOverlay;
    const on = rocks !== null || ways !== null || dates !== null || empires !== null;
    uniforms['empiresActive'] = { value: on ? 1 : 0 };
    needsRender = true;
    if (!on) return;
    clearOverlay(empiresCanvas);
    if (rocks !== null) paintRocks(empiresCanvas, rocks, empires === null ? 1 : 0.45);
    if (ways !== null) paintWays(empiresCanvas, ways, empires === null ? 1 : 0.45);
    if (dates !== null) {
      paintDateCells(empiresCanvas, dates.cells, dates.cellDegrees, empires === null ? 1 : 0.6);
    }
    if (empires !== null) {
      paintTerritories(empiresCanvas, empires.territories);
      if (empires.ohm !== null) paintBorders(empiresCanvas, empires.ohm.borders);
    }
    empiresTexture.needsUpdate = true;
    uniforms['overlayMap'] = { value: empiresTexture };
  }
  // Regions with ancient genomes near the year shown, in historical time.
  const genomeLayer = document.createElement('div');
  genomeLayer.className = 'empire-labels genome-cells';
  container.append(genomeLayer);
  let genomeLabels: GlobeLabel[] = [];
  let genomeKey = '';
  // Fossils of the moment, in deep time.
  const fossilLayer = document.createElement('div');
  fossilLayer.className = 'empire-labels fossil-cells';
  container.append(fossilLayer);
  let fossilLabels: GlobeLabel[] = [];
  let fossilKey = '';
  // Impact craters and deposits, in either time: markers to tap for a card.
  const impactLayer = document.createElement('div');
  impactLayer.className = 'empire-labels impact-marks';
  container.append(impactLayer);
  let impactLabels: GlobeLabel[] = [];
  let impactKey = '';
  // Volcanoes erupting near the year shown, in historical time: markers to tap for a card.
  const volcanoLayer = document.createElement('div');
  volcanoLayer.className = 'empire-labels volcano-marks';
  container.append(volcanoLayer);
  let volcanoLabels: GlobeLabel[] = [];
  let volcanoKey = '';
  const markerPickListeners = new Set<(key: string) => void>();
  for (const layer of [impactLayer, volcanoLayer, humanLabelLayer, genomeLayer, fossilLayer]) {
    layer.addEventListener('click', (event) => {
      const marker = event.target instanceof Element ? event.target.closest('[data-pick]') : null;
      const key = marker?.getAttribute('data-pick');
      if (key === null || key === undefined) return;
      for (const listener of markerPickListeners) listener(key);
    });
  }
  // Deep time's overlay, on the states' map (never shown then): a dispersal model's settled
  // land, and the ice-sheet outlines over it.
  let deepOverlay: {
    readonly outlines: IceOutlines | null;
    readonly settled: { readonly grid: ArrivalGrid; readonly ka: number } | null;
  } = { outlines: null, settled: null };
  function paintDeepOverlay(): void {
    const uniforms = earth.material.uniforms;
    const { outlines, settled } = deepOverlay;
    const on = outlines !== null || settled !== null;
    uniforms['iceOutlinesActive'] = { value: on ? 1 : 0 };
    needsRender = true;
    if (!on) return;
    clearOverlay(empiresCanvas);
    if (settled !== null) paintSettled(empiresCanvas, settled.grid, settled.ka);
    if (outlines !== null) paintIceOutlines(empiresCanvas, outlines);
    empiresTexture.needsUpdate = true;
    uniforms['overlayMap'] = { value: empiresTexture };
  }

  /** Labels laid out once, unseen, so their real sizes are known for keeping them apart. */
  function measured(
    layer: HTMLElement,
    entries: readonly { readonly element: HTMLElement; readonly point: GeoPoint }[],
  ): GlobeLabel[] {
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
  function settleSizes(labels: readonly GlobeLabel[]): void {
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
  const bodyMeshes: Record<Body, Mesh> = { earth, moon, sun, ...planets.meshes };
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

  function loadSunTexture(url: string, wraps = false): Promise<Texture> {
    const cached = sunTextures.get(url);
    if (cached !== undefined) return Promise.resolve(cached);
    return new TextureLoader().loadAsync(url).then((texture) => {
      texture.colorSpace = SRGBColorSpace;
      // A map's left and right edges meet on the far side.
      if (wraps) texture.wrapS = RepeatWrapping;
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
    const shift = (insets.bottom - insets.top) / 2;
    camera.setViewOffset(clientWidth, clientHeight, 0, shift, clientWidth, clientHeight);
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
    // Wheel steps scale the distance; take bigger steps far out so the Sun is a few spins away.
    controls.zoomSpeed =
      camera.position.distanceTo(controls.target) < 10 * BODY_RADIUS[focus] ? 0.8 : 2.5;
    // update() keeps damping going after the pointer is released; it reports movement via 'change'.
    if (controls.enabled) controls.update();
    if (needsRender) {
      needsRender = false;
      shadeSun();
      // In deep time the Sun, Moon and planets are where they are today, which says nothing
      // about then: they are left out, markers too.
      const hidden = deepTime ? hiddenInDeepTime().filter((object) => object.visible) : [];
      for (const object of hidden) object.visible = false;
      renderer.render(scene, camera);
      placeMarkers();
      for (const object of hidden) object.visible = true;
      placeEmpireLabels();
      if (earthMapped) container.dataset['rendered'] = 'true';
    }
    frame = requestAnimationFrame(loop);
  }

  function placeEmpireLabels(): void {
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
    for (const { element, position, width, height } of [
      ...empireLabels.filter(({ major }) => major),
      ...humanLabels,
      ...genomeLabels,
      ...volcanoLabels,
      ...impactLabels,
      ...fossilLabels,
      ...empireLabels.filter(({ major }) => !major),
    ]) {
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

  return {
    canvas: renderer.domElement,
    maxTextureSize: renderer.capabilities.maxTextureSize,
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
      container.dataset['planets'] = planetsKm === null ? 'off' : 'on';
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
    showPlanetView(planet, view) {
      planetViews.set(planet, view);
      applyPlanetView(planet);
    },
    showMoonView,
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
    setMagneticNorth(where) {
      for (const [key, label] of magneticNorth) label.visible = key === where;
      container.dataset['magneticNorth'] = where ?? 'unknown';
      needsRender = true;
    },
    setSunImage(image) {
      sunImageWanted = image;
      if (image === null) {
        sunUniforms.hasMap.value = 0;
        container.dataset['sunImage'] = 'none';
        needsRender = true;
        return;
      }
      const show = (size: keyof ImagePair): void => {
        // A later request (another channel) wins over a slow one.
        if (sunImageWanted !== image) return;
        sunUniforms.surface.value = sunTextures.get(image.map[size]) ?? null;
        sunUniforms.map.value = sunTextures.get(image.disc[size]) ?? null;
        sunUniforms.hasMap.value = 1;
        sunUniforms.tint.value.set(...image.tint);
        sunUniforms.diskRadius.value = image.diskRadius;
        sunUniforms.limbDarkening.value = image.limbDarkening;
        placeCorona();
        container.dataset['sunImage'] = size;
        container.dataset['sunLayer'] = image.key;
        needsRender = true;
      };
      const load = (size: keyof ImagePair): Promise<unknown> =>
        Promise.all([loadSunTexture(image.map[size], true), loadSunTexture(image.disc[size])]);
      if (sunTextures.has(image.map.large) && sunTextures.has(image.disc.large)) {
        show('large');
        return;
      }
      load('small')
        .then(() => {
          show('small');
          return load('large');
        })
        .then(() => {
          show('large');
        })
        .catch(() => {
          if (sunImageWanted === image) container.dataset['sunImage'] = 'error';
        });
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
          uniforms['tempActive'] = { value: 1 };
          container.dataset['temperature'] = `${surface.younger} ${surface.older}`;
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
          uniforms['seaIceGrid'] = { value: new Vector2(surface.columns, surface.rows) };
          uniforms['seaIceActive'] = { value: 1 };
          container.dataset['seaIce'] = `${surface.pastMost} ${surface.mix.toFixed(2)}`;
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
    setIceOutlines(outlines) {
      // Painting the map is slow: not again for the slice already shown, as time plays on.
      if ((outlines?.name ?? 'off') === container.dataset['iceOutlines']) return;
      container.dataset['iceOutlines'] = outlines === null ? 'off' : outlines.name;
      deepOverlay = { ...deepOverlay, outlines };
      paintDeepOverlay();
    },
    setSettled(settled) {
      // Whole thousands of years only: the model's own step.
      const ka = settled === null ? null : Math.round(settled.ka);
      const key = settled === null ? 'off' : `${settled.scenario} ${String(ka)}`;
      if (key === container.dataset['settled']) return;
      container.dataset['settled'] = key;
      deepOverlay = {
        ...deepOverlay,
        settled: settled === null || ka === null ? null : { grid: settled.grid, ka },
      };
      paintDeepOverlay();
    },
    setGenomeCells(cells) {
      const key =
        cells === null
          ? 'off'
          : cells
              .map(
                (cell) =>
                  `${String(cell.latitude)},${String(cell.longitude)}:${String(cell.count)}`,
              )
              .join(' ');
      if (key === genomeKey) return;
      genomeKey = key;
      genomeLayer.replaceChildren();
      genomeLabels =
        cells === null
          ? []
          : measured(
              genomeLayer,
              cells.map((cell) => {
                const element = document.createElement('button');
                element.type = 'button';
                // One or two genomes make a small dot, without a number: many of them together
                // crowded out the states' names (#163). The count is still in its label.
                const few = cell.count <= FEW_GENOMES;
                element.className = `empire-label genome-cell${few ? ' is-few' : ''}`;
                if (!few) element.textContent = String(cell.count);
                element.setAttribute(
                  'aria-label',
                  `${String(cell.count)} ${cell.count === 1 ? 'genome' : 'genomes'}: details`,
                );
                element.dataset['pick'] = `genome:${String(cell.cell)}`;
                // Bigger for more genomes, gently: a square root, from 18 to 44 pixels.
                const size = few ? 10 : Math.round(Math.min(44, 18 + 4 * Math.sqrt(cell.count)));
                element.style.width = `${String(size)}px`;
                element.style.height = `${String(size)}px`;
                element.title = `${String(cell.count)} genomes; lab labels: ${cell.labels.map(([label, count]) => `${label} ×${String(count)}`).join(', ')}`;
                return { element, point: cell };
              }),
            );
      container.dataset['genomes'] = cells === null ? 'off' : String(cells.length);
      // Placed now, not at the next frame: as time plays, that frame may lay them out again.
      placeEmpireLabels();
      needsRender = true;
    },
    setFossilCells(cells) {
      const key =
        cells === null
          ? 'off'
          : cells
              .map(
                (cell) =>
                  `${cell.group}:${String(cell.latitude)},${String(cell.longitude)}:${String(cell.count)}`,
              )
              .join(' ');
      if (key === fossilKey) return;
      fossilKey = key;
      fossilLayer.replaceChildren();
      fossilLabels =
        cells === null
          ? []
          : measured(
              fossilLayer,
              cells.map((cell) => {
                const element = document.createElement('button');
                element.type = 'button';
                element.className = `empire-label fossil-cell is-${cell.group}`;
                element.textContent = String(cell.count);
                element.dataset['pick'] =
                  `fossil:${cell.group}:${String(cell.latitude)}:${String(cell.longitude)}`;
                const size = Math.round(Math.min(40, 16 + 3 * Math.sqrt(cell.count)));
                element.style.width = `${String(size)}px`;
                element.style.height = `${String(size)}px`;
                return { element, point: cell };
              }),
            );
      container.dataset['fossils'] = cells === null ? 'off' : String(cells.length);
      // Placed now, not at the next frame: as time plays, that frame may lay them out again.
      placeEmpireLabels();
      needsRender = true;
    },
    setImpacts(marks) {
      // The same craters as before (as time plays, they drift with their plates): moved, not
      // laid out again, which would hide them until the next frame, and so every frame.
      const key =
        marks === null
          ? 'off'
          : marks
              .map(({ impact, uncertain }) => `${String(impact.id)}${uncertain ? '?' : ''}`)
              .join(' ');
      if (key === impactKey) {
        if (marks === null) return;
        marks.forEach(({ point }, index) => {
          impactLabels[index]?.position.set(...geoToVector(point, 1.01));
        });
        placeEmpireLabels();
        needsRender = true;
        return;
      }
      impactKey = key;
      impactLayer.replaceChildren();
      impactLabels =
        marks === null
          ? []
          : measured(
              impactLayer,
              marks.map(({ impact, point, uncertain }) => {
                const element = document.createElement('button');
                element.type = 'button';
                element.className = `empire-label impact-mark is-${impact.kind}${uncertain ? ' is-uncertain' : ''}`;
                element.dataset['pick'] = `impact:${String(impact.id)}`;
                const diameter = impact.diameterKm ?? 0;
                // Wider for larger craters, gently: a logarithm, from 9 to 26 pixels.
                const size = Math.round(Math.min(26, 9 + 3 * Math.log2(1 + diameter / 4)));
                element.style.setProperty('--size', `${String(size)}px`);
                // The largest are named; every one says what it is to a screen reader.
                if (diameter >= 40) {
                  const name = document.createElement('span');
                  name.className = 'impact-name';
                  name.textContent = impact.name;
                  element.append(name);
                }
                element.setAttribute('aria-label', `${impact.name}: details`);
                return { element, point };
              }),
            );
      container.dataset['impacts'] = marks === null ? 'off' : String(marks.length);
      // Placed now, not at the next frame: as time plays, that frame may lay them out again.
      placeEmpireLabels();
      needsRender = true;
    },
    setVolcanoes(marks) {
      const key =
        marks === null
          ? 'off'
          : marks
              .map(
                ({ volcano, eruptions }) => `${String(volcano.number)}:${String(eruptions.length)}`,
              )
              .join(' ');
      if (key === volcanoKey) return;
      volcanoKey = key;
      volcanoLayer.replaceChildren();
      volcanoLabels =
        marks === null
          ? []
          : measured(
              volcanoLayer,
              marks.map(({ volcano, vei, uncertain }) => {
                const element = document.createElement('button');
                element.type = 'button';
                element.className = `empire-label volcano-mark${uncertain ? ' is-uncertain' : ''}`;
                element.dataset['pick'] = `volcano:${String(volcano.number)}`;
                // Larger for a larger eruption: from 10 pixels (VEI unknown or 0) to 34 (VEI 8).
                const size = 10 + 3 * Math.max(0, vei ?? 0);
                element.style.setProperty('--size', `${String(size)}px`);
                // The largest are named; every one says what it is to a screen reader.
                if ((vei ?? 0) >= 4) {
                  const name = document.createElement('span');
                  name.className = 'impact-name';
                  name.textContent = volcano.name;
                  element.append(name);
                }
                element.setAttribute('aria-label', `${volcano.name}: details`);
                return {
                  element,
                  point: { latitude: volcano.latitude, longitude: volcano.longitude },
                };
              }),
            );
      container.dataset['volcanoes'] = marks === null ? 'off' : String(marks.length);
      // Placed now, not at the next frame: as time plays, that frame may lay them out again.
      placeEmpireLabels();
      needsRender = true;
    },
    onMarkerPick(listener) {
      markerPickListeners.add(listener);
      return () => markerPickListeners.delete(listener);
    },
    setHumanSites(sites) {
      // Laying labels out is slow: not again for the same finds, as time plays on.
      const key = sites === null ? 'off' : sites.map((site) => site.id).join(' ');
      if (key === humanSitesKey) return;
      humanSitesKey = key;
      humanLabelLayer.replaceChildren();
      humanLabels =
        sites === null
          ? []
          : measured(
              humanLabelLayer,
              sites.map((site) => {
                const element = document.createElement('button');
                element.type = 'button';
                element.className = `empire-label human-site is-${site.species}${site.disputed ? ' is-disputed' : ''}`;
                element.textContent = site.label;
                element.dataset['site'] = site.id;
                element.dataset['pick'] = `human:${site.id}`;
                return { element, point: site.point };
              }),
            );
      container.dataset['humans'] = sites === null ? 'off' : String(sites.length);
      // Placed now, not at the next frame: as time plays, that frame may lay them out again.
      placeEmpireLabels();
      needsRender = true;
    },
    setRocks(units) {
      if ((units === null ? 'off' : 'on') === container.dataset['rocks']) return;
      historyOverlay = { ...historyOverlay, rocks: units };
      container.dataset['rocks'] = units === null ? 'off' : 'on';
      paintHistoryOverlay();
    },
    setDateCells(dates) {
      const key = dates === null ? 'off' : String(dates.cells.length);
      historyOverlay = { ...historyOverlay, dates };
      container.dataset['dateCells'] = key;
      paintHistoryOverlay();
    },
    setWays(regions) {
      historyOverlay = { ...historyOverlay, ways: regions };
      container.dataset['ways'] = regions === null ? 'off' : String(regions.length);
      paintHistoryOverlay();
    },
    setEmpires(layer) {
      historyOverlay = { ...historyOverlay, empires: layer };
      paintHistoryOverlay();
      // The names already made, by class, size and name: kept from year to year, so a name
      // that stays stays where it is, shown, rather than being made anew and hidden a frame.
      const previous = empireLabels;
      const before = new Map(previous.map((entry) => [entry.id, entry]));
      const shownBefore = new Set(
        previous.filter(({ element }) => element.hidden === false).map(({ id }) => id),
      );
      empireLabels = [];
      if (layer === null) recentStates.clear();
      if (layer !== null) {
        const now = performance.now();
        for (const change of layer.changes ?? [])
          recentStates.set(change.name, { change, at: now });
        const present = new Set([
          ...layer.territories.map(({ name }) => name),
          ...(layer.ohm?.labels ?? []).map(({ name }) => name),
        ]);
        // Those that came or went lately first, so their names win a place; the animation
        // carries on from where it was, though the names are made anew each year.
        for (const [name, { change, at }] of recentStates) {
          if (now - at > STATE_CHANGE_MS || present.has(name) !== (change.kind === 'new')) {
            recentStates.delete(name);
          }
        }
        // The largest few; the rest are named as usual, if at all.
        const changed = [...recentStates.entries()]
          .sort((a, b) => b[1].change.area - a[1].change.area)
          .slice(0, STATE_CHANGES_SHOWN)
          .map(([name, { change, at }]) => ({
            name,
            point: change.point,
            size: 13,
            kind: `empire-label is-${change.kind}`,
            delay: -Math.round(now - at),
          }));
        const named = new Set(changed.map(({ name }) => name));
        // Names of the larger states first; as the camera comes closer, more fit between them.
        // Those shown the year before keep their place ahead of the rest, so names don't trade
        // places as borders shift a little from year to year.
        const wasShown = (name: string, size: number) =>
          shownBefore.has(`empire-label|${String(size)}|${name}`);
        const sizeOf = (area: number) => Math.round(10 + Math.min(6, Math.sqrt(area) / 4));
        const ranked = layer.territories
          .map((territory) => ({ territory, label: labelPoint(territory) }))
          .filter(({ territory }) => !named.has(territory.name))
          .sort((a, b) => b.label.area - a.label.area)
          .slice(0, 80)
          .sort(
            (a, b) =>
              Number(wasShown(b.territory.name, sizeOf(b.label.area))) -
              Number(wasShown(a.territory.name, sizeOf(a.label.area))),
          )
          .map(({ territory, label }) => ({
            name: territory.name,
            point: label,
            size: sizeOf(label.area),
            kind: 'empire-label',
          }));
        // OpenHistoricalMap's names, set apart in italics, after Cliopatria's.
        const ohmNames = (layer.ohm?.labels ?? [])
          .filter(({ name }) => !named.has(name))
          .slice(0, 120)
          .map((label) => ({
            name: label.name,
            point: label,
            size: 11,
            kind: 'empire-label is-ohm',
          }));
        const made = [...changed, ...ranked, ...ohmNames].map((label) => {
          const { name, point, size, kind } = label;
          const id = `${kind}|${String(size)}|${name}`;
          const kept = before.get(id);
          if (kept !== undefined) {
            before.delete(id);
            kept.position.set(...geoToVector(point, 1.01));
            return { ...kept, key: null };
          }
          const element = document.createElement('span');
          element.className = kind;
          element.textContent = name;
          element.style.fontSize = `${String(size)}px`;
          if ('delay' in label) element.style.animationDelay = `${String(label.delay)}ms`;
          const known = labelSizes.get(`${kind}|${String(size)}|${name}`);
          // A name not seen before is laid out once, unseen, so its real size is known for
          // keeping names apart; one seen before keeps its size, and costs no layout.
          if (known === undefined) element.style.visibility = 'hidden';
          else element.hidden = true;
          empireLabelLayer.append(element);
          return {
            id,
            // The larger states, and those just come or gone (which carry a delay).
            major: size >= MAJOR_STATE_SIZE || 'delay' in label,
            element,
            position: new Vector3(...geoToVector(point, 1.01)),
            width: known?.width ?? 0,
            height: known?.height ?? 0,
            key: known === undefined ? id : null,
          };
        });
        const fresh = made.filter((entry) => entry.key !== null);
        settleSizes(fresh);
        for (const { key, width, height } of fresh) {
          if (key !== null) labelSizes.set(key, { width, height });
        }
        empireLabels = made;
      }
      // Names no longer wanted go; the rest are placed now, before the frame is painted.
      const kept = new Set(empireLabels.map(({ element }) => element));
      for (const { element } of previous) if (!kept.has(element)) element.remove();
      placeEmpireLabels();
      container.dataset['empires'] = layer === null ? 'off' : String(layer.territories.length);
      container.dataset['statesChanged'] = String(
        empireLabels.filter(({ element }) => /\bis-(new|gone)\b/.test(element.className)).length,
      );
      container.dataset['ohmBorders'] =
        layer?.ohm === null || layer === null ? 'off' : String(layer.ohm.borders.length);
      needsRender = true;
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
      c14Glow.dispose();
      shower?.dispose();
      for (const impact of impacts) impact.dispose();
      markerLayer.remove();
      renderer.domElement.remove();
    },
  };
}

/** A soft radial glow for the Sun, drawn once into a small canvas. */
/** A short label on a transparent canvas, four times as wide as it is tall. */
function labelTexture(
  text: string,
  width = 512,
  colour = 'rgba(225, 235, 255, 0.95)',
): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context !== null) {
    context.font = '600 44px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.shadowColor = 'rgba(0, 0, 0, 0.9)';
    context.shadowBlur = 8;
    context.fillStyle = colour;
    context.fillText(text, canvas.width / 2, canvas.height / 2);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

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
