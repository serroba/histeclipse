/**
 * The WebGL globe: Earth lit by the Sun at a given moment, with orbit controls.
 * Rendering-only code. The math it relies on lives in tested modules (`geo.ts`,
 * `astro/sun.ts`); this file is exercised by the Playwright suite in a real browser.
 */

import type { ImpactSpec } from './impactAnimation';
import { Playback } from './playback';
import { createC14Glow } from './c14Glow';
import { type ShowerCommand, type ShowerSpec } from './showerAnimation';
import type { IUniform, Quaternion } from 'three';
import {
  AdditiveBlending,
  BackSide,
  DataTexture,
  LinearFilter,
  Mesh,
  PerspectiveCamera,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  type Object3D,
  type Texture,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { type Body, type GeoPoint, type GlobeCamera, type Viewpoint } from '../state/viewState';
import type { Vector3Tuple } from './geo';
import { MOON_RADIUS_EARTH_RADII, SUN_RADIUS_EARTH_RADII } from './spaceFrame';
import { EARTH_SHADOW_ENLARGEMENT } from '../astro/occultation';
import type { NamedBody } from '../data/planetNames';
import type { MoonName, MoonOrbits, MoonPlanet } from '../astro/moonOrbits';
import { ORBITING, type Orbiting, type PlanetName } from '../astro/planets';
import { planetRadius } from './planetLook';
import { isMoonBody, moonsInView } from './moonLook';
import { type GlobeLayer, type LayerFactory, type LayerHost } from './layerHost';
import { createMoonMeshes } from './moonMeshes';
import { createOrbitLoops } from './orbitLoops';
import { Picking } from './picking';
import { createSunMeshes } from './sunMeshes';
import { BodyMaps } from './bodyMaps';
import { ScreenLabels, settleSizes } from './screenLabels';
import { assembleEarthParts, checkSamplers, type EarthPart } from './earthParts';
import { createPlanetMeshes } from './planetMeshes';
import type { ArrivalGrid } from '../data/dispersal';
import { temperatureUniforms } from './temperatureShader';
import { EarthSurfaces, surfaceUniforms } from './earthSurfaces';
import { ATMOSPHERE_FRAGMENT, ATMOSPHERE_VERTEX, MOON_FRAGMENT, MOON_VERTEX } from './bodyShaders';
import { createEarthTileLayer } from './earthTiles';
import { BodiesInSpace } from './bodiesInSpace';
import { createSpinAxis, PlacePin } from './earthMarks';
import { EarthOverlays } from './earthOverlays';
import { CameraRig } from './cameraRig';
import { Stage } from '../stage/stage';
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
  const stage = new Stage(container, {
    renderer,
    // With a logarithmic depth buffer one camera spans metres above the ground to past the Sun.
    camera: new PerspectiveCamera(35, 1, 1e-4, 1e6),
    styleSize: false,
  });
  const { scene, camera } = stage;

  // The maps are the largest downloads; the globe draws at once in plain colours and takes
  // each map as it arrives, so nothing else waits on them. Both load side by side.
  const loader = new TextureLoader();
  const earthMap = loader.loadAsync(options.textureUrl);
  const moonMap = loader.loadAsync(options.moonTextureUrl);
  const texture = plainTexture(OCEAN_RGB);
  const moonTexture = plainTexture(MOON_RGB);

  const sunDirection = new Vector3(1, 0, 0);
  // 1 in deep time: the globe lit evenly, with no day and night.
  const evenLight = { value: 0 };
  // Shared by the Earth and Moon shaders; set with the bodies each moment.
  const moonPosition = new Vector3();
  const sunPosition = new Vector3(1e5, 0, 0);
  // The maps painted over Earth's surface: history's and deep time's (#379).
  const overlays = new EarthOverlays({
    uniforms: (): Record<string, IUniform> => earth.material.uniforms,
    invalidate: () => {
      stage.invalidate();
    },
    dataset: container.dataset,
  });
  const earthUniforms = {
    dayMap: { value: texture },
    dayRect: { value: new Vector4(0, 0, 1, 1) },
    dayAlpha: { value: 1 },
    ...surfaceUniforms(),
    ...temperatureUniforms(),
    evenLight,
    overlayMap: { value: overlays.texture as Texture },
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
  // Deep time's surfaces and the rest beyond today's imagery (#379).
  const surfaces = new EarthSurfaces({
    uniforms: earth.material.uniforms,
    evenLight,
    dataset: container.dataset,
    // Maps that hold data, not colour: no colour space, and linear filtering so the coast falls
    // between the sea's last byte and the land's first.
    load: (url) =>
      new TextureLoader().loadAsync(url).then((loaded) => {
        loaded.minFilter = LinearFilter;
        loaded.magFilter = LinearFilter;
        loaded.generateMipmaps = false;
        return loaded;
      }),
    invalidate: () => {
      stage.invalidate();
    },
  });
  // Close up, Earth's full-size map in tiles over its own (#568), as many as the device takes on
  // (#578); how many are drawn, were fetched and are kept, for tests.
  const { maxTextureSize } = renderer.capabilities;
  const limits = tileLimits(maxTextureSize, matchMedia('(pointer: coarse)').matches);
  const earthTiles = createEarthTileLayer(earth, {
    anisotropy: renderer.capabilities.getMaxAnisotropy(),
    limits,
    pixels: () => renderer.domElement.height,
    requestRender: () => {
      stage.invalidate();
    },
    report: (...counts) => (container.dataset['earthTiles'] = counts.join('/')),
  });

  // Deep time: Earth's spin axis, its ends marked as the poles of the time shown.
  const spinAxis = createSpinAxis();
  scene.add(spinAxis);

  // The chosen place: a small pin standing on the ground.
  const pin = new PlacePin(container.dataset);
  earth.add(pin.mesh);

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

  const sunMeshes = createSunMeshes(scene);
  const { sun, corona } = sunMeshes;
  const planets = createPlanetMeshes(scene);
  const moonSystems = createMoonMeshes(scene);
  const bodyMeshes: Record<Body, Mesh> = {
    earth,
    moon,
    sun,
    ...planets.meshes,
    ...moonSystems.meshes,
  };
  // What the bodies wear: their first maps, the sharper ones, and the views (#239, #258).
  const maps = new BodyMaps(
    {
      dataset: container.dataset,
      earth: earth.material.uniforms,
      moon: moon.material.uniforms,
      planets,
      moons: moonSystems,
      anisotropy: renderer.capabilities.getMaxAnisotropy(),
      load: (url) => new TextureLoader().loadAsync(url),
      invalidate: () => {
        stage.invalidate();
      },
    },
    { earth: earthMap, moon: moonMap, plainEarth: texture, plainMoon: moonTexture },
  );
  const orbitLoops = createOrbitLoops(scene);
  // Where the Sun, the Moon, the planets and their moons are, placed for each moment.
  const space = new BodiesInSpace({
    sunMeshes,
    moon,
    planets,
    moonSystems,
    orbits: orbitLoops.group,
    meshes: bodyMeshes,
    sunPosition,
    moonPosition,
    earthUniforms: earth.material.uniforms,
    dataset: container.dataset,
  });

  function hiddenInDeepTime(): Object3D[] {
    return [sun, corona, moon, orbitLoops.group, ...Object.values(planets.meshes)];
  }

  // What is written over the picture (#379): the bodies' markers, and the layers' names.
  const labels = new ScreenLabels({
    container,
    camera,
    meshes: bodyMeshes,
    focus: () => rig.focus,
    insets: () => rig.insets,
    requestBody,
    invalidate: () => {
      stage.invalidate();
    },
  });
  // The layers added (#379), and what they lay out after each frame: declared before the first.
  const afterRenders: (() => void)[] = [];
  const layers: GlobeLayer<never>[] = [];

  // Picking with the pointer: before the orbit controls, which listen to the same events.
  const picking = new Picking({
    canvas: renderer.domElement,
    camera,
    meshes: bodyMeshes,
    deepTime: () => surfaces.deepTime,
    focus: () => rig.focus,
    viewpoint: () => rig.viewpoint,
    release: () => rig.release(),
  });
  function requestBody(body: Body): void {
    picking.requestBody(body);
  }

  function bodyFrame(body: Body): { position: Vector3; rotation: Quaternion } {
    return space.frame(body);
  }

  function bodyReady(body: Body): boolean {
    if (isMoonBody(body)) return moonSystems.ready();
    return body === 'earth' || bodyMeshes[body].visible;
  }

  const rig = new CameraRig({
    camera,
    container,
    controls: new OrbitControls(camera, renderer.domElement),
    world: {
      frame: bodyFrame,
      ready: bodyReady,
      place: () => pin.place(),
      moonVisible: () => moon.visible,
      invalidate: () => {
        stage.invalidate();
      },
    },
    focus: options.focus,
    start: options.camera,
    tiled: limits !== null,
  });

  // The impacts and the shower playing on Earth (#314).
  const playback = new Playback({
    earth,
    pin: pin.mesh.material,
    dataset: container.dataset,
    resolution: () => renderer.getSize(new Vector2()),
    invalidate: () => {
      stage.invalidate();
    },
  });

  // Each frame: what plays on Earth, then the camera. Around each drawing: the tiles, the Sun's
  // shade and what deep time leaves out; then what is placed over the picture.
  stage.add(playback);
  stage.add(rig);
  let hidden: Object3D[] = [];
  stage.add({
    beforeRender(now) {
      const more = earthTiles.update(camera, !surfaces.deepTime && earth.visible, now);
      // 1 when the camera looks at the Sun from Earth's side, as SDO did; −1 from behind.
      container.dataset['sunFacing'] = sunMeshes.shade(camera).toFixed(3);
      // In deep time the Sun, Moon and planets are where they are today, which says nothing
      // about then: they are left out, markers too.
      hidden = surfaces.deepTime ? hiddenInDeepTime().filter((object) => object.visible) : [];
      for (const object of hidden) object.visible = false;
      return more;
    },
    afterRender() {
      labels.placeMarkers();
      for (const object of hidden) object.visible = true;
      labels.placeSurfaceLabels();
      showMoonPaths();
      for (const place of afterRenders) place();
      if (maps.earthMapped) container.dataset['rendered'] = 'true';
    },
  });

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

  /** Draw the paths of the moons of the planet in view, or of the moon in view's planet. */
  function showMoonPaths(): void {
    moonSystems.showPaths(moonsInView(rig.focus));
    container.dataset['moonPaths'] = String(moonSystems.pathsShown());
  }

  stage.observeResize();
  stage.resize();
  rig.place(options.camera);
  stage.start(true);

  // What layers get (#379): the scene, the container and a few services.
  const host: LayerHost = {
    scene,
    camera,
    container,
    focus: () => rig.focus,
    bodyFrame: namedFrame,
    sunPosition: () => sun.position,
    spinAxis,
    moonPosition: (moon, target) => moonSystems.meshes[moon].getWorldPosition(target),
    requestBody,
    spaceToScene: () => space.spaceToScene(),
    requestRender() {
      stage.invalidate();
    },
    afterRender(place) {
      afterRenders.push(place);
    },
    layOutNames: labels.layOutNames,
    pickable: (layer) => {
      picking.pickable(layer);
    },
    deepPaint: (order) => overlays.deep.add(order),
    historyPaint: (order) => overlays.history.add(order),
    surfaceLabels: labels.surfaceLabels,
    surfaceSlot: labels.surfaceSlot,
    measure: settleSizes,
    maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
    showSunImage(image) {
      sunMeshes.showImage(image);
      stage.invalidate();
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
      stage.invalidate();
    },
    setOrbits(paths) {
      orbitLoops.set(paths);
      // The moons' orbits go with the planets' (#335).
      moonSystems.showAllPaths(paths !== null);
      container.dataset['orbits'] = paths === null ? 'off' : String(ORBITING.length);
      stage.invalidate();
    },
    setSpace(bodies) {
      // Keep a far camera still among the stars: carry it along by the rotation Earth made
      // since the last moment.
      rig.beforeBodiesMove(space.turnSince(bodies.earthFixedToJ2000));
      space.place(bodies);
      rig.afterBodiesMove();
      stage.invalidate();
    },
    setInsets(next) {
      rig.setInsets(next);
    },
    setFocus(body) {
      rig.setFocus(body);
    },
    onBodyClick: (listener) => picking.onBodyClick(listener),
    onEmptyTap: (listener) => picking.onEmptyTap(listener),
    showPlanetView: (planet, view) => {
      maps.showPlanetView(planet, view);
    },
    showMoonView: (view) => {
      maps.showMoonView(view);
    },
    setSaturnRings: (url) => {
      maps.setSaturnRings(url);
    },
    sharpenPlanet: (planet) => {
      maps.sharpenPlanet(planet);
    },
    setBodyMap: (body, url) => {
      maps.setBodyMap(body, url);
    },
    setC14Glow(profile) {
      c14Glow.set(profile);
      container.dataset['c14Glow'] =
        profile === null ? 'off' : profile.map((value) => value.toFixed(2)).join(' ');
      stage.invalidate();
    },
    prefetch: (urls) => {
      surfaces.prefetch(urls);
    },
    setEvenLight: (on) => {
      surfaces.setEvenLight(on);
    },
    setDeepTime(surface) {
      surfaces.setDeepTime(surface);
      spinAxis.visible = surfaces.deepTime;
      stage.invalidate();
    },
    setTemperature: (surface) => {
      surfaces.setTemperature(surface);
    },
    setShelf: (surface) => {
      surfaces.setShelf(surface);
    },
    setIce: (surface) => {
      surfaces.setIce(surface);
    },
    setSeaIce: (surface) => {
      surfaces.setSeaIce(surface);
    },
    setPlates: (surface) => {
      surfaces.setPlates(surface);
    },
    setUncharted: (blank) => {
      surfaces.setUncharted(blank);
    },
    setSketch: (sketch) => {
      surfaces.setSketch(sketch);
    },
    setSettled(settled) {
      overlays.setSettled(settled);
    },
    addLayer(factory) {
      const layer = factory(host);
      layers.push(layer);
      return layer;
    },
    setMoonMap: (moon, url) => {
      maps.setMoonMap(moon, url);
    },
    setMoonOrbits(orbits) {
      moonSystems.setOrbits(orbits);
      // A link to a moon waits for its orbit; the bodies may not be placed again, time at rest.
      rig.settleFocus();
      stage.invalidate();
    },
    onMarkerPick: (listener) => picking.onMarkerPick(listener),
    onPlacePick: (listener) => picking.onPlacePick(listener),
    setLocation(place) {
      pin.set(place);
      stage.invalidate();
    },
    setViewpoint(next) {
      rig.setViewpoint(next);
    },
    flyTo(target) {
      rig.flyTo(target);
    },
    setCamera(state) {
      rig.place(state);
    },
    playImpact: (spec) => {
      playback.playImpact(spec);
    },
    playShower: (spec) => {
      playback.playShower(spec);
    },
    controlShower: (command) => {
      playback.controlShower(command);
    },
    zoomTo(distance) {
      rig.zoomTo(distance);
    },
    onCameraChange(listener) {
      return rig.onChange(listener);
    },
    dispose() {
      // The frames, the parts (what plays, the camera) and the renderer.
      stage.dispose();
      texture.dispose();
      moonTexture.dispose();
      c14Glow.dispose();
      for (const layer of layers) layer.dispose?.();
      labels.dispose();
      renderer.domElement.remove();
    },
  };
}
