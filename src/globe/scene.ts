/**
 * The WebGL globe: Earth lit by the Sun at a given moment, with orbit controls.
 * Rendering-only code. The math it relies on lives in tested modules (`geo.ts`,
 * `astro/sun.ts`); this file is exercised by the Playwright suite in a real browser.
 */

import { Playback } from './playback';
import { createC14Glow } from './c14Glow';
import type { IUniform, Quaternion } from 'three';
import {
  LinearFilter,
  Mesh,
  PerspectiveCamera,
  ShaderMaterial,
  SphereGeometry,
  TextureLoader,
  type Object3D,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import type { Body, GlobeCamera } from '../state/viewState';
import { MOON_RADIUS_EARTH_RADII, SUN_RADIUS_EARTH_RADII } from './spaceFrame';
import { EARTH_SHADOW_ENLARGEMENT } from '../astro/occultation';
import type { NamedBody } from '../data/planetNames';
import type { MoonPlanet } from '../astro/moonOrbits';
import { ORBITING } from '../astro/planets';
import { planetRadius } from './planetLook';
import { isMoonBody, moonsInView } from './moonLook';
import type { GlobeLayer, LayerHost } from './layerHost';
import { createMoonMeshes } from './moonMeshes';
import { createOrbitLoops } from './orbitLoops';
import { Picking } from './picking';
import { createSunMeshes } from './sunMeshes';
import { BodyMaps } from './bodyMaps';
import { ScreenLabels, settleSizes } from './screenLabels';
import type { EarthPart } from './earthParts';
import { createPlanetMeshes } from './planetMeshes';
import { EarthSurfaces } from './earthSurfaces';
import { MOON_FRAGMENT, MOON_VERTEX } from './bodyShaders';
import { createEarthTileLayer } from './earthTiles';
import { BodiesInSpace } from './bodiesInSpace';
import { createSpinAxis, PlacePin } from './earthMarks';
import { createEarthMeshes, MOON_RGB, plainTexture } from './earthMesh';
import { EarthOverlays } from './earthOverlays';
import { CameraRig } from './cameraRig';
import { delegate } from './delegate';
import { Stage } from '../stage/stage';
import { tileLimits } from './tileLimits';
import './spaceMarkers.css';
import type { Globe } from './globe';

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
  const { earth, atmosphere, plainMap, parts } = createEarthMeshes(
    { sunDirection, evenLight, moonPosition, sunPosition },
    overlays.texture,
    options.earthParts ?? [],
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
      invalidate: () => {
        stage.invalidate();
      },
    },
    { earth: earthMap, moon: moonMap, plainEarth: plainMap, plainMoon: moonTexture },
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
    cover: stage.cover.bind(stage),
  });

  // Each frame: what plays, the camera; around each drawing: tiles, shade, what is placed over it.
  stage.add(playback);
  stage.add(rig);
  let hidden: Object3D[] = [];
  stage.add({
    resize: labels.resize,
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
    // What each part answers as it is (#603).
    ...delegate(rig, ['setInsets', 'setFocus', 'setViewpoint', 'flyTo', 'zoomTo']),
    ...delegate(picking, ['onBodyClick', 'onEmptyTap', 'onMarkerPick', 'onPlacePick']),
    ...delegate(maps, [
      'showPlanetView',
      'showMoonView',
      'setSaturnRings',
      'sharpenPlanet',
      'setBodyMap',
      'setMoonMap',
    ]),
    ...delegate(surfaces, [
      'prefetch',
      'setEvenLight',
      'setTemperature',
      'setShelf',
      'setIce',
      'setSeaIce',
      'setPlates',
      'setUncharted',
      'setSketch',
    ]),
    ...delegate(playback, ['playImpact', 'playShower', 'controlShower']),
    ...delegate(overlays, ['setSettled']),
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
    setC14Glow(profile) {
      c14Glow.set(profile);
      container.dataset['c14Glow'] =
        profile === null ? 'off' : profile.map((value) => value.toFixed(2)).join(' ');
      stage.invalidate();
    },
    setDeepTime(surface) {
      surfaces.setDeepTime(surface);
      spinAxis.visible = surfaces.deepTime;
      stage.invalidate();
    },
    addLayer(factory) {
      const layer = factory(host);
      layers.push(layer);
      return layer;
    },
    setMoonOrbits(orbits) {
      moonSystems.setOrbits(orbits);
      // A link to a moon waits for its orbit; the bodies may not be placed again, time at rest.
      rig.settleFocus();
      stage.invalidate();
    },
    setLocation(place) {
      pin.set(place);
      stage.invalidate();
    },
    setCamera(state) {
      rig.glideTo(state);
    },
    onCameraChange(listener) {
      return rig.onChange(listener);
    },
    dispose() {
      // The frames, the parts (what plays, the camera) and the renderer.
      stage.dispose();
      plainMap.dispose();
      moonTexture.dispose();
      c14Glow.dispose();
      for (const layer of layers) layer.dispose?.();
      labels.dispose();
      renderer.domElement.remove();
    },
  };
}
