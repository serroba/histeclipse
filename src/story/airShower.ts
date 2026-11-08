/**
 * The carbon-14 story's chapters in Earth's air, in 3D (#317), in one scene at two scales.
 * - Rays: Earth, its air and a few lines of its magnetic field; two cosmic rays race in from
 *   far beyond the Sun. The one aimed near the pole follows the field in and strikes the air;
 *   the one aimed at the equator is bent back out, unless the field is weak.
 * - Shower: a column of air 30 km high over where the ray struck. The proton strikes an air
 *   nucleus about 17 km up, and what it makes strikes others, a cascade toward the ground,
 *   coloured by particle; its front reaches the ground some 57 µs later, a clock beside it says.
 *   One neutron, knocked out where most carbon-14 is made, is followed as it slows.
 * - Capture: that neutron enters a nitrogen-14 nucleus, 7 protons and 7 neutrons; for an
 *   instant it is nitrogen-15, then a proton flies off, and carbon-14 remains: 6 and 8.
 * The reader can pause, turn and zoom at any moment, as in the Sun's chapters. Not to scale:
 * the air is drawn thick on Earth, and only a few of the shower's particles are drawn.
 *
 * Three.js glue, loaded on demand and covered by the Playwright suite; the shower's numbers are
 * in `airCascade.ts`, the reaction's in `neutronCapture.ts`, the rays' words in `showerSteps.ts`.
 */

import {
  AdditiveBlending,
  AmbientLight,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
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
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

import { geoToVector } from '../globe/geo';
import { rayLabels, turnedAway } from '../globe/showerSteps';
import type { GeoPoint } from '../state/viewState';
import {
  airCascade,
  FIRST_COLLISION_KM,
  MADE_KM,
  microseconds,
  PARTICLES,
  pieces,
  reached,
  SHOWER_FACTS,
  TOP_KM,
  type Particle,
  type Point,
} from './airCascade';
import {
  capture,
  element,
  makeUp,
  nuclearRadius,
  NUCLEON_FM,
  PROTON_MEV,
  REACTION_FACTS,
  type Stage,
} from './neutronCapture';

/** The chapters this scene plays. */
export type AirChapter = 'rays' | 'shower' | 'capture';

export interface AirShowerOptions {
  /** Earth's map, the one the globe wears. */
  readonly earthTextureUrl: string;
  /** Where the ray near the pole strikes; the other is aimed at the equator below it. */
  readonly place: GeoPoint;
  /** The field's dipole, ×10²² A m². */
  readonly dipole: number;
  /** Whether the ground under the shower is sea rather than land. */
  readonly water: boolean;
}

export interface AirShower {
  /** Turn to a chapter; `restart` or `settle` then starts it. */
  setChapter(chapter: AirChapter): void;
  /** Play or hold; held, nothing moves but the reader can still turn and zoom. */
  setPlaying(playing: boolean): void;
  /** Start the chapter again, the camera back with the story. */
  restart(): void;
  /** Show the chapter complete and hold there, for readers who ask for less motion. */
  settle(): void;
  dispose(): void;
}

/** How long the rays take to come in, ms. */
const RAYS_MS = 3600;
/** How long the proton takes from the top of the column to its first collision, ms. */
const ENTER_MS = 900;
/** How long the front takes from the first collision to the last track's end, ms. */
const CASCADE_MS = 3400;
/** How long the neutron followed takes to slow, ms, once the front has gone by. */
const SLOW_MS = 1000;
/** The whole of the shower chapter, ms. */
const AIR_MS = ENTER_MS + CASCADE_MS + SLOW_MS;
/** The reaction's moments, ms: the neutron arrives, and the proton leaves. */
const ARRIVE_MS = 1800;
const LEAVE_MS = 2500;
/** How long the proton takes to fly out of the frame, ms; the reaction is whole after it. */
const FLY_MS = 1400;
const CAPTURE_MS = LEAVE_MS + FLY_MS;
/** The colours the stage's captions name: nitrogen blue, carbon-14 violet, the proton yellow. */
const NITROGEN = new Color(0x5a99ff);
const CARBON = new Color(0xb87aff);
const FREED = new Color(0xffd94d);
/** The camera's move from beside the incoming proton to the side of the column, ms. */
const SWING_MS = 2200;
/** How wide the column of air is drawn, km either side. */
const COLUMN_KM = 9;

/** Each particle's colour; the legend writes its name in it. */
const COLOURS: Readonly<Record<Particle, Color>> = {
  proton: new Color(1, 0.45, 0.32),
  neutron: new Color(0.82, 0.88, 1),
  pion: new Color(0.45, 0.95, 0.5),
  muon: new Color(0.35, 0.85, 1),
  electromagnetic: new Color(1, 0.82, 0.35),
};

const EASE = (x: number): number => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** A soft round glow, white, tinted by its material. */
function glowTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context !== null) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.6)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
  }
  return new CanvasTexture(canvas);
}

/** The air round Earth: brightest at the limb, as it is seen edge-on there. */
function airGlowMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: BackSide,
    blending: AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 world = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-world.xyz);
        gl_Position = projectionMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float rim = pow(1.0 - abs(dot(vNormal, vView)), 3.0);
        gl_FragColor = vec4(vec3(0.35, 0.62, 1.0) * rim, rim);
      }`,
  });
}

/** The column of air: thickest at the ground, thinning by e every 7 km. */
function thinningAir(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: BackSide,
    uniforms: { top: { value: TOP_KM } },
    vertexShader: /* glsl */ `
      varying float vHeight;
      void main() {
        vHeight = position.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float top;
      varying float vHeight;
      void main() {
        float height = vHeight + top / 2.0;
        gl_FragColor = vec4(0.32, 0.55, 0.95, 0.42 * exp(-height / 7.0));
      }`,
  });
}

/** A point on the quadratic curve from `a` through control `c` to `b`. */
function curve(a: Vector3, c: Vector3, b: Vector3, t: number): Vector3 {
  const u = 1 - t;
  return a
    .clone()
    .multiplyScalar(u * u)
    .addScaledVector(c, 2 * u * t)
    .addScaledVector(b, t * t);
}

/** Up and east at a place on the unit globe. */
function frameAt(place: GeoPoint): { up: Vector3; east: Vector3 } {
  const up = new Vector3(...geoToVector(place)).normalize();
  const east = new Vector3().crossVectors(new Vector3(0, 1, 0), up);
  if (east.lengthSq() < 1e-9) east.set(1, 0, 0);
  return { up, east: east.normalize() };
}

const vector = ([x, y, z]: Point): Vector3 => new Vector3(x, y, z);

export function createAirShower(container: HTMLElement, options: AirShowerOptions): AirShower {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x02040a);
  container.append(renderer.domElement);
  const labels = new CSS2DRenderer();
  labels.domElement.className = 'story-labels';
  container.append(labels.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 0.01, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  scene.add(new AmbientLight(0xffffff, 0.7));
  const sunlight = new DirectionalLight(0xffffff, 2.4);
  scene.add(sunlight);

  const glowMap = glowTexture();
  const geometries: BufferGeometry[] = [];
  const materials: { dispose(): void }[] = [];
  const lineMaterials: LineMaterial[] = [];
  /** A glow of `color`, `size` across. */
  function glow(color: Color, size: number, parent: Group): Sprite {
    const material = new SpriteMaterial({
      map: glowMap,
      color,
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    materials.push(material);
    const sprite = new Sprite(material);
    sprite.scale.setScalar(size);
    parent.add(sprite);
    return sprite;
  }
  /** A label in the page, tied to a point in the scene. */
  function label(text: string, parent: Group, kind = ''): CSS2DObject {
    const element = document.createElement('span');
    element.className = `story-label ${kind}`.trim();
    element.textContent = text;
    const object = new CSS2DObject(element);
    object.center.set(0, 1.2);
    parent.add(object);
    return object;
  }
  /** A line a few pixels wide through `points`, drawn a part at a time. */
  function line(points: readonly Vector3[], color: Color, width: number, parent: Group): Line2 {
    const geometry = new LineGeometry();
    geometry.setPositions(points.flatMap(({ x, y, z }) => [x, y, z]));
    geometries.push(geometry);
    const material = new LineMaterial({
      color: color.getHex(),
      linewidth: width,
      transparent: true,
      depthWrite: false,
    });
    lineMaterials.push(material);
    const drawn = new Line2(geometry, material);
    parent.add(drawn);
    return drawn;
  }

  // Rays: Earth, its air, its field, the stars.
  const space = new Group();
  const earthMap = new TextureLoader().load(options.earthTextureUrl, () => {
    dirty = true;
  });
  earthMap.colorSpace = SRGBColorSpace;
  const earthGeometry = new SphereGeometry(1, 96, 64);
  const earthMaterial = new MeshStandardMaterial({ map: earthMap, roughness: 0.9 });
  const airGeometry = new SphereGeometry(1.06, 96, 64);
  const airMaterial = airGlowMaterial();
  geometries.push(earthGeometry, airGeometry);
  materials.push(earthMap, earthMaterial, airMaterial);
  space.add(new Mesh(earthGeometry, earthMaterial), new Mesh(airGeometry, airMaterial));

  const starPositions: number[] = [];
  for (let i = 0; i < 1400; i += 1) {
    // Spread evenly over a far sphere, the same sky every time.
    const z = 1 - (2 * (i + 0.5)) / 1400;
    const angle = i * 2.399963;
    const across = Math.sqrt(1 - z * z);
    starPositions.push(across * Math.cos(angle) * 80, z * 80, across * Math.sin(angle) * 80);
  }
  const starGeometry = new BufferGeometry();
  starGeometry.setAttribute('position', new Float32BufferAttribute(starPositions, 3));
  const starMaterial = new PointsMaterial({ color: 0x9fb4d8, size: 1.4, sizeAttenuation: false });
  geometries.push(starGeometry);
  materials.push(starMaterial);
  space.add(new Points(starGeometry, starMaterial));

  // The field: a dipole about the spin axis (r = L cos² latitude), in the rays' meridian and
  // others round the axis, fainter for a weaker field; none without one.
  const polar = frameAt(options.place);
  const equator = frameAt({ latitude: 0, longitude: options.place.longitude });
  const fieldColour = new Color(0.55, 0.85, 1);
  const fieldStrength = Math.min(1, options.dipole / 7.8);
  const fieldLines: Line2[] = [];
  if (options.dipole > 0) {
    for (let meridian = 0; meridian < 6; meridian += 1) {
      const out = equator.up.clone().applyAxisAngle(new Vector3(0, 1, 0), (meridian * Math.PI) / 3);
      for (const shell of [1.35, 1.8, 2.6, 3.8]) {
        const reach = Math.acos(Math.sqrt(1 / shell));
        const points: Vector3[] = [];
        for (let i = 0; i <= 64; i += 1) {
          const latitude = -reach + (2 * reach * i) / 64;
          const r = shell * Math.cos(latitude) ** 2;
          points.push(
            out
              .clone()
              .multiplyScalar(r * Math.cos(latitude))
              .add(new Vector3(0, r * Math.sin(latitude), 0)),
          );
        }
        const drawn = line(points, fieldColour, meridian % 3 === 0 ? 1.6 : 1, space);
        drawn.material.opacity = (meridian % 3 === 0 ? 0.55 : 0.12) * fieldStrength;
        fieldLines.push(drawn);
      }
    }
  }
  const fieldLabel = label('Earth’s magnetic field', space, 'is-zone');
  fieldLabel.position
    .copy(equator.up)
    .multiplyScalar(-2.3)
    .add(new Vector3(0, 0.15, 0));
  fieldLabel.visible = options.dipole > 0;

  // The two rays, as the globe's shower draws them: one near the pole, in to the air; one at
  // the equator, bent back out by the field or let in where it is weak.
  const away = turnedAway(options.dipole);
  const rayColour = new Color(0.75, 0.9, 1);
  const strike = polar.up.clone().multiplyScalar(1.04);
  const words = rayLabels(options.dipole);
  const TRACK_POINTS = 48;
  const rays = [
    {
      from: polar.up.clone().multiplyScalar(2.6).addScaledVector(polar.east, 0.9),
      bend: polar.up.clone().multiplyScalar(1.7).addScaledVector(polar.east, 0.1),
      to: strike,
      text: words.polar,
      strikes: true,
    },
    {
      from: equator.up.clone().multiplyScalar(2.6).addScaledVector(equator.east, 0.9),
      bend: away
        ? equator.up.clone().multiplyScalar(1.2)
        : equator.up.clone().multiplyScalar(1.7).addScaledVector(equator.east, 0.1),
      to: away
        ? equator.up.clone().multiplyScalar(2.3).addScaledVector(equator.east, -1)
        : equator.up.clone().multiplyScalar(1.04),
      text: words.equator,
      strikes: !away,
    },
  ].map((ray, index) => {
    const named = label(ray.text, space, 'is-photon');
    // The equator's ray is named on its left, so a turned-away ray's name stays in the frame.
    if (index === 1) named.center.set(1, 1.2);
    const points = Array.from({ length: TRACK_POINTS }, (_, i) =>
      curve(ray.from, ray.bend, ray.to, i / (TRACK_POINTS - 1)),
    );
    return {
      ...ray,
      points,
      track: line(points, rayColour, 2.5, space),
      head: glow(rayColour, 0.12, space),
      label: named,
      flash: glow(new Color(1, 0.9, 0.6), 0.3, space),
      // The second a little after the first, so the eye can follow both.
      delay: index * 350,
    };
  });

  /** The rays at `t` ms: how far in each is, and where it strikes. */
  function placeRays(t: number): number {
    let along = 0;
    for (const ray of rays) {
      const progress = clamp01((t - ray.delay) / (RAYS_MS - 800));
      along = Math.max(along, progress);
      const index = Math.round(progress * (TRACK_POINTS - 1));
      const at = ray.points[index] ?? ray.to;
      ray.track.geometry.instanceCount = index;
      ray.head.position.copy(at);
      ray.head.visible = progress > 0 && progress < 1;
      ray.label.position.copy(at);
      ray.label.visible = progress > 0;
      const bursting = clamp01((t - ray.delay - (RAYS_MS - 800)) / 700);
      ray.flash.visible = ray.strikes && bursting > 0 && bursting < 1;
      ray.flash.position.copy(ray.to);
      ray.flash.scale.setScalar(0.05 + 0.35 * bursting);
      ray.flash.material.opacity = 1 - bursting;
    }
    return along;
  }

  // Shower: a column of air over the strike, 30 km high, the ground under it.
  const air = new Group();
  const cascade = airCascade();
  const drawn = pieces(cascade.tracks);
  const showerGeometry = new LineSegmentsGeometry();
  showerGeometry.setPositions(drawn.flatMap(({ from, to }) => [...from, ...to]));
  showerGeometry.setColors(
    drawn.flatMap(({ kind }) => [...COLOURS[kind].toArray(), ...COLOURS[kind].toArray()]),
  );
  const showerMaterial = new LineMaterial({
    vertexColors: true,
    linewidth: 2.5,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  geometries.push(showerGeometry);
  lineMaterials.push(showerMaterial);
  const shower = new LineSegments2(showerGeometry, showerMaterial);
  air.add(shower);

  const groundGeometry = new CircleGeometry(COLUMN_KM, 96);
  groundGeometry.rotateX(-Math.PI / 2);
  const groundMaterial = new MeshStandardMaterial({
    color: options.water ? 0x1f4f7a : 0x3f5f32,
    side: DoubleSide,
    roughness: 1,
  });
  const columnGeometry = new CylinderGeometry(COLUMN_KM, COLUMN_KM, TOP_KM, 96, 1, true);
  const columnMaterial = thinningAir();
  const bandGeometry = new CylinderGeometry(
    COLUMN_KM * 1.002,
    COLUMN_KM * 1.002,
    MADE_KM[1] - MADE_KM[0],
    96,
    1,
    true,
  );
  const bandMaterial = new MeshStandardMaterial({
    color: 0xb07cff,
    emissive: 0x4a2a80,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: BackSide,
  });
  geometries.push(groundGeometry, columnGeometry, bandGeometry);
  materials.push(groundMaterial, columnMaterial, bandMaterial);
  const column = new Mesh(columnGeometry, columnMaterial);
  column.position.y = TOP_KM / 2;
  const band = new Mesh(bandGeometry, bandMaterial);
  band.position.y = (MADE_KM[0] + MADE_KM[1]) / 2;
  air.add(new Mesh(groundGeometry, groundMaterial), column, band);
  const bandLabel = label(
    `most carbon-14 is made here, ${String(MADE_KM[0])}–${String(MADE_KM[1])} km up`,
    air,
    'is-zone',
  );
  bandLabel.position.set(-COLUMN_KM, MADE_KM[1], 0);
  // Heights, up one side of the column.
  const rule = new Group();
  air.add(rule);
  for (const km of [0, 10, 20, 30]) {
    const mark = label(km === 0 ? 'ground' : `${String(km)} km`, rule, 'is-zone');
    mark.position.set(-COLUMN_KM, km, -COLUMN_KM * 0.4);
  }
  line(
    [
      new Vector3(-COLUMN_KM, 0, -COLUMN_KM * 0.4),
      new Vector3(-COLUMN_KM, TOP_KM, -COLUMN_KM * 0.4),
    ],
    new Color(0.6, 0.7, 0.85),
    1,
    rule,
  ).material.opacity = 0.5;

  const [incoming] = cascade.tracks;
  const enters = incoming === undefined ? new Vector3(0, TOP_KM, 0) : vector(incoming.from);
  const first = vector(cascade.first);
  const proton = glow(COLOURS.proton, 0.9, air);
  const protonLabel = label('cosmic ray: a proton of a few GeV', air);
  const firstLabel = label(
    `first collision, ${String(Math.round(FIRST_COLLISION_KM))} km up, with a nitrogen or oxygen nucleus`,
    air,
  );
  firstLabel.position.copy(first);
  // A flash at each collision as the front reaches it.
  const collisionTimes = cascade.collisions.map(
    (point) => cascade.tracks.find(({ from }) => from === point)?.start ?? 0,
  );
  const flashes = cascade.collisions.map((point) => {
    const flash = glow(new Color(1, 0.95, 0.8), 1, air);
    flash.position.copy(vector(point));
    return flash;
  });
  // The front, a thin disc going down at nearly the speed of light, and the time it has taken.
  const frontLabel = label('', air, 'is-red');
  // A name for each kind, beside the first track of it the front reaches.
  const kindLabels = (['pion', 'muon', 'electromagnetic', 'neutron'] as const).map((kind) => {
    // Each from a different collision, so the names don't crowd the first.
    const sample = cascade.tracks
      .filter((track) => track.kind === kind)
      .at({ pion: 2, muon: 1, electromagnetic: 20, neutron: -1 }[kind]);
    const name = PARTICLES.find((particle) => particle.kind === kind)?.name ?? kind;
    const object = label(name.toLowerCase(), air);
    object.element.style.color = `#${COLOURS[kind].getHexString()}`;
    return { object, sample };
  });

  // The neutron followed, slowing where carbon-14 is made.
  const neutronPoints = cascade.neutron.map(vector);
  const neutronTrail = line(neutronPoints, COLOURS.neutron, 2.5, air);
  const neutronHead = glow(COLOURS.neutron, 0.8, air);
  const neutronLabel = label('a neutron, slowing: next, a nitrogen nucleus', air);
  const neutronBorn =
    collisionTimes[cascade.collisions.findIndex((p) => p === cascade.neutron[0])] ?? 0;

  /** The shower at `t` ms into its chapter; returns the real time since the first collision, µs. */
  function placeShower(t: number): number {
    const entering = clamp01(t / ENTER_MS);
    proton.position.copy(enters).lerp(first, entering);
    proton.visible = entering < 1;
    protonLabel.position.copy(proton.position);
    protonLabel.visible = entering < 1;
    // The front, in km gone since the first collision, the proton's own way in before it.
    const front =
      t < ENTER_MS
        ? -enters.distanceTo(first) * (1 - entering)
        : cascade.length * clamp01((t - ENTER_MS) / CASCADE_MS);
    showerGeometry.instanceCount = reached(drawn, front);
    firstLabel.visible = front >= 0 && t < ENTER_MS + CASCADE_MS * 0.45;
    for (const [i, flash] of flashes.entries()) {
      const age = (front - (collisionTimes[i] ?? 0)) / 2.5;
      flash.visible = age >= 0 && age < 1;
      flash.scale.setScalar(0.6 + 2.4 * age);
      flash.material.opacity = 1 - age;
    }
    // The front goes straight down at nearly the speed of light: the clock tells its height.
    const descent = Math.min(FIRST_COLLISION_KM, Math.max(0, front));
    frontLabel.visible = front >= 0 && descent < FIRST_COLLISION_KM;
    frontLabel.position.set(COLUMN_KM * 0.45, FIRST_COLLISION_KM - descent, 0);
    const micro = microseconds(descent);
    frontLabel.element.textContent = `shower front · ${String(Math.round(micro))} µs`;
    for (const { object, sample } of kindLabels) {
      if (sample === undefined) continue;
      const shown = front >= (sample.start + sample.end) / 2;
      object.visible = shown && t < ENTER_MS + CASCADE_MS + SLOW_MS * 0.3;
      object.position.copy(vector(sample.from)).lerp(vector(sample.to), 0.5);
    }
    const slowing = clamp01((t - ENTER_MS - CASCADE_MS) / SLOW_MS);
    const born = front >= neutronBorn;
    const steps = Math.round(slowing * (neutronPoints.length - 1));
    neutronTrail.visible = born;
    neutronTrail.geometry.instanceCount = steps;
    const at = neutronPoints[steps] ?? first;
    neutronHead.visible = born;
    neutronHead.position.copy(at);
    neutronLabel.visible = slowing > 0;
    neutronLabel.position.copy(at);
    return micro;
  }

  // What the shower is made of, and its numbers, beside the scene.
  const legend = document.createElement('ul');
  legend.className = 'story-chain';
  legend.setAttribute('aria-label', 'An air shower');
  for (const particle of PARTICLES) {
    const item = document.createElement('li');
    const name = document.createElement('strong');
    name.textContent = particle.name;
    name.style.color = `#${COLOURS[particle.kind].getHexString()}`;
    item.append(name, document.createTextNode(`: ${particle.about}`));
    legend.append(item);
  }
  for (const [index, fact] of SHOWER_FACTS.entries()) {
    const item = document.createElement('li');
    // On a phone, only the time and the height carbon-14 is made at.
    if (index === 1 || index === 2) item.className = 'is-now';
    item.textContent = fact;
    legend.append(item);
  }
  const hint = document.createElement('p');
  hint.className = 'story-hint';
  hint.textContent = 'Drag to turn, scroll or pinch to zoom. Not to scale.';
  // The reaction: one nitrogen nucleus, in femtometres.
  const nucleus = new Group();
  const reaction = capture();
  const nucleonGeometry = new SphereGeometry(NUCLEON_FM, 24, 16);
  const protonMaterial = new MeshStandardMaterial({
    color: 0xff5a48,
    roughness: 0.45,
    emissive: 0x401008,
  });
  const neutronMaterial = new MeshStandardMaterial({
    color: 0xa8bccf,
    roughness: 0.45,
    emissive: 0x101820,
  });
  geometries.push(nucleonGeometry);
  materials.push(protonMaterial, neutronMaterial);
  const homes = reaction.slots.map(({ at }) => vector(at));
  const nucleons = reaction.slots.map(({ kind }, index) => {
    const mesh = new Mesh(nucleonGeometry, kind === 'proton' ? protonMaterial : neutronMaterial);
    mesh.position.copy(homes[index] ?? new Vector3());
    nucleus.add(mesh);
    return mesh;
  });
  const halo = glow(NITROGEN.clone(), nuclearRadius(15) * 5, nucleus);
  halo.material.opacity = 0.35;
  halo.renderOrder = -1;
  const burst = glow(new Color(1, 0.95, 0.85), 4, nucleus);
  const arrivingFrom = new Vector3(-24, 4, 6);
  const leavingTo = new Vector3(30, 5, -4);
  const arrivingGlow = glow(new Color(0xf2f2f2), 3, nucleus);
  const leavingGlow = glow(FREED.clone(), 3.4, nucleus);
  const leavingTrail = line(
    Array.from({ length: 32 }, (_, i) =>
      (homes[reaction.leaves] ?? new Vector3()).clone().lerp(leavingTo, i / 31),
    ),
    FREED,
    2.5,
    nucleus,
  );
  const nucleusLabel = label('', nucleus);
  nucleusLabel.position.set(0, nuclearRadius(15) + 1, 0);
  const arrivingLabel = label('neutron n, slowed', nucleus);
  const leavingLabel = label(`proton p, ${PROTON_MEV.toFixed(2)} MeV`, nucleus);
  leavingLabel.element.style.color = `#${FREED.getHexString()}`;

  /** The reaction at `t` ms into its chapter; returns the stage it is at. */
  function placeCapture(t: number): Stage {
    const stage: Stage = t < ARRIVE_MS ? 'nitrogen' : t < LEAVE_MS ? 'compound' : 'carbon';
    const arriving = EASE(clamp01(t / ARRIVE_MS));
    const flying = 1 - (1 - clamp01((t - LEAVE_MS) / FLY_MS)) ** 3;
    const leaving = homes[reaction.leaves] ?? new Vector3();
    const flown = leaving.clone().lerp(leavingTo, flying);
    // The carbon-14 recoils the other way, a fourteenth as far: momentum shared equally.
    const recoil = flown
      .clone()
      .sub(leaving)
      .multiplyScalar(-1 / 14);
    for (const [index, mesh] of nucleons.entries()) {
      const home = homes[index] ?? new Vector3();
      // Each nucleon trembles in place, the more so for an instant once the neutron is in.
      const shake = 0.06 + (stage === 'compound' ? 0.18 : 0);
      const wobble = new Vector3(
        Math.sin(t / 90 + index * 1.7),
        Math.sin(t / 110 + index * 2.3),
        Math.sin(t / 100 + index * 3.1),
      ).multiplyScalar(shake);
      if (index === reaction.arrives) {
        mesh.position.copy(arrivingFrom).lerp(home, arriving);
        if (arriving === 1) mesh.position.add(wobble).add(recoil);
      } else if (index === reaction.leaves) {
        mesh.position.copy(flying > 0 ? flown : home.clone().add(wobble));
      } else {
        mesh.position.copy(home).add(wobble).add(recoil);
      }
    }
    const incoming = nucleons[reaction.arrives];
    const outgoing = nucleons[reaction.leaves];
    arrivingGlow.visible = arriving < 1;
    arrivingLabel.visible = arriving < 1;
    if (incoming !== undefined) {
      arrivingGlow.position.copy(incoming.position);
      arrivingLabel.position.copy(incoming.position);
    }
    leavingGlow.visible = flying > 0;
    leavingLabel.visible = flying > 0;
    leavingTrail.visible = flying > 0;
    leavingTrail.geometry.instanceCount = Math.round(flying * 31);
    if (outgoing !== undefined) {
      leavingGlow.position.copy(outgoing.position);
      leavingLabel.position.copy(outgoing.position);
    }
    const flash = clamp01((t - ARRIVE_MS) / 600);
    burst.visible = flash > 0 && flash < 1;
    burst.scale.setScalar(4 + 10 * flash);
    burst.material.opacity = 1 - flash;
    halo.position.copy(recoil);
    halo.material.color.copy(NITROGEN).lerp(CARBON, clamp01((t - LEAVE_MS) / 600));
    const { protons, neutrons } = makeUp(stage);
    const name =
      stage === 'compound'
        ? 'nitrogen-15, for an instant'
        : `${element(protons)}-${String(protons + neutrons)}`;
    nucleusLabel.element.textContent = `${name}: ${String(protons)} protons, ${String(neutrons)} neutrons`;
    nucleusLabel.position.set(0, nuclearRadius(15) + 1, 0).add(recoil);
    reactionItems[1]?.classList.toggle('is-now', stage !== 'carbon');
    reactionItems[2]?.classList.toggle('is-now', stage === 'carbon');
    return stage;
  }

  // The reaction, written out beside it: the equation, and the stage it is at lit.
  const reactionLegend = document.createElement('ol');
  reactionLegend.className = 'story-chain';
  reactionLegend.setAttribute('aria-label', 'The reaction');
  const reactionItems = REACTION_FACTS.map((fact, index) => {
    const item = document.createElement('li');
    if (index === 0) item.className = 'is-now';
    item.textContent = fact;
    reactionLegend.append(item);
    return item;
  });
  container.append(legend, reactionLegend, hint);
  scene.add(space, air, nucleus);

  // The cameras' ways: beside Earth, seeing the rays' meridian face on; then down the proton's
  // path into the column and round to its side.
  // A little round from face on, so the place struck is on Earth's face, not its edge.
  const side = frameAt({ latitude: 18, longitude: options.place.longitude - 60 }).up;
  // A little below the rays, so the stage under the scene leaves them in view.
  const raysTarget = polar.up
    .clone()
    .add(equator.up)
    .multiplyScalar(0.55)
    .add(new Vector3(0, -0.45, 0));
  const showerTarget = new Vector3(1.5, 8, 0);
  // High above the column's edge, looking down the proton's way in.
  const swingFrom = new Vector3(10, 36, 30);

  function storyCamera(t: number): void {
    const fit = 1 / Math.min(1, camera.aspect);
    if (chapter === 'rays') {
      const p = EASE(clamp01(t / RAYS_MS));
      const distance = (6.2 - 1.4 * p) * fit ** 1.2;
      camera.position
        .copy(side)
        .applyAxisAngle(new Vector3(0, 1, 0), 0.25 - 0.4 * p)
        .multiplyScalar(distance)
        .add(raysTarget);
      controls.target.copy(raysTarget);
    } else if (chapter === 'capture') {
      // From far, the nucleus a speck, in close as the neutron comes; then a little after the
      // proton.
      const p = EASE(clamp01(t / ARRIVE_MS));
      // Less so on a narrow screen, where the nucleus would go off its edge.
      const after = EASE(clamp01((t - LEAVE_MS) / FLY_MS)) * Math.min(1, camera.aspect);
      camera.position
        .set(-6, 5, 80)
        .lerp(new Vector3(-5, 6, 26 * fit), p)
        .add(new Vector3(4 * after, 0, 4 * after));
      controls.target.set(3 * after, 0, 0);
    } else {
      const p = EASE(clamp01(t / SWING_MS));
      const beside = new Vector3(5, 12, 38 * fit ** 1.1);
      camera.position.copy(swingFrom).lerp(beside, p);
      controls.target.copy(first).lerp(showerTarget, p);
    }
    camera.lookAt(controls.target);
  }

  let chapter: AirChapter = 'rays';
  let t = 0;
  let playing = true;
  let byStory = true;
  let dirty = true;
  let last = performance.now();
  let frame = 0;
  controls.addEventListener('start', () => {
    byStory = false;
  });
  controls.addEventListener('change', () => {
    dirty = true;
  });

  /** The camera's reach and range for the chapter's scale: Earth radii, km, or fm. */
  const reach: Record<AirChapter, { near: number; far: number; min: number; max: number }> = {
    rays: { near: 0.01, far: 200, min: 1.3, max: 14 },
    shower: { near: 0.1, far: 400, min: 3, max: 120 },
    capture: { near: 0.1, far: 300, min: 5, max: 120 },
  };
  function scaleFor(next: AirChapter): void {
    const wide = next === 'rays';
    camera.near = reach[next].near;
    camera.far = reach[next].far;
    camera.updateProjectionMatrix();
    controls.minDistance = reach[next].min;
    controls.maxDistance = reach[next].max;
    space.visible = wide;
    air.visible = next === 'shower';
    nucleus.visible = next === 'capture';
    sunlight.position.copy(
      wide ? side.clone().applyAxisAngle(new Vector3(0, 1, 0), 0.9) : new Vector3(-1, 2, 1.5),
    );
  }
  scaleFor('rays');

  function resize(): void {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height);
    labels.setSize(width, height);
    for (const material of lineMaterials) material.resolution.set(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    dirty = true;
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  function draw(now: number): void {
    const dt = Math.min(100, now - last);
    last = now;
    if (playing) {
      t += dt;
      dirty = true;
    }
    if (byStory) storyCamera(t);
    controls.update();
    if (dirty) {
      dirty = false;
      if (chapter === 'rays') {
        container.dataset['rays'] = placeRays(t).toFixed(2);
      } else if (chapter === 'shower') {
        container.dataset['microseconds'] = String(Math.round(placeShower(t)));
      } else {
        const { protons, neutrons } = makeUp(placeCapture(t));
        container.dataset['protons'] = String(protons);
        container.dataset['neutrons'] = String(neutrons);
      }
      legend.hidden = chapter !== 'shower';
      reactionLegend.hidden = chapter !== 'capture';
      renderer.render(scene, camera);
      labels.render(scene, camera);
      container.dataset['rendered'] = 'true';
    }
    frame = requestAnimationFrame(draw);
  }
  container.dataset['chapter'] = 'rays';
  container.dataset['playing'] = 'true';
  frame = requestAnimationFrame(draw);

  const ends: Record<AirChapter, number> = { rays: RAYS_MS, shower: AIR_MS, capture: CAPTURE_MS };
  return {
    setChapter(next) {
      chapter = next;
      scaleFor(next);
      container.dataset['chapter'] = next;
      dirty = true;
    },
    setPlaying(next) {
      playing = next;
      last = performance.now();
      container.dataset['playing'] = String(next);
    },
    restart() {
      t = 0;
      byStory = true;
      dirty = true;
    },
    settle() {
      t = ends[chapter];
      byStory = true;
      storyCamera({ rays: RAYS_MS, shower: SWING_MS, capture: CAPTURE_MS }[chapter]);
      byStory = false;
      playing = false;
      container.dataset['playing'] = 'false';
      dirty = true;
    },
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of [...materials, ...lineMaterials]) material.dispose();
      glowMap.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      container.replaceChildren();
      delete container.dataset['chapter'];
      delete container.dataset['rendered'];
      delete container.dataset['playing'];
      delete container.dataset['rays'];
      delete container.dataset['microseconds'];
      delete container.dataset['protons'];
      delete container.dataset['neutrons'];
    },
  };
}
