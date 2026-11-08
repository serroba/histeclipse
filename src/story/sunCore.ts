/**
 * The carbon-14 story's chapters inside the Sun, in 3D (#317), in one scene: the Sun cut open,
 * its surface churning, its three zones on the cut faces.
 * - Fusion: in the core, protons fusing through the proton–proton chain, one chain followed and
 *   labelled, gamma rays flashing out.
 * - Escape: that light's random walk out through the radiative zone, coloured by what it is,
 *   the years counting; convection carrying it up the last third; leaving as visible light.
 * The reader can pause, turn and zoom at any moment; dragging takes the camera from the story,
 * which hands it back on a restart. Not to scale: the core would hold some 10⁵⁶ protons, each
 * 10⁻¹⁵ m across, and each step of the walk drawn stands for countless real ones.
 *
 * Three.js glue, loaded on demand and covered by the Playwright suite; the chain's timing is in
 * `fusionChain.ts`, the walk in `photonWalk.ts`.
 */

import {
  AdditiveBlending,
  AmbientLight,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Fog,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Quaternion,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

import { CHAIN, SETTLED_T, stageAt, stageProgress, type ChainStage } from './fusionChain';
import { BANDS, bandAt, photonWalk, yearsAt, type Band } from './photonWalk';

/** The chapters this scene plays. */
export type SunChapter = 'fusion' | 'escape';

export interface SunCore {
  /** Turn to a chapter; `restart` or `settle` then starts it. */
  setChapter(chapter: SunChapter): void;
  /** Play or hold; held, nothing moves but the reader can still turn and zoom. */
  setPlaying(playing: boolean): void;
  /** Start the chapter again, the camera back with the story. */
  restart(): void;
  /** Show the chapter complete and hold there, for readers who ask for less motion. */
  settle(): void;
  dispose(): void;
}

/** The Sun's zones, as fractions of its radius. */
const CORE = 0.25;
const RADIATIVE = 0.7;

/** Where the followed chain plays, in the open quarter of the core. */
const CHAIN_AT = new Vector3(-0.09, 0.01, 0.09);
/** The chain's unit of length: a nucleon is about half of it across. */
const U = 0.008;
const NUCLEON = U * 0.45;
/** Protons wandering the open quarter of the core. */
const WANDERERS = 140;
/** Nearer the centre than this, the camera is in the core: the plasma all round, no cut. */
const INSIDE = 0.5;
/** The core's glow, seen from within it. */
const PLASMA = new Color(0.78, 0.36, 0.08);
/** The story's camera move, from outside the Sun into the core, ms. */
const DIVE_MS = 3200;
/** How long the walk takes to draw, from the core to the surface, ms. */
const WALK_MS = 4800;
/** The camera's move out of the core to watch the walk, ms. */
const PULL_MS = 1800;
/** The colour of the light as it goes: violet-white, X-ray blue, convection orange, sunlight. */
const BAND_COLOURS: Readonly<Record<Band, Color>> = {
  gamma: new Color(0.9, 0.8, 1),
  xray: new Color(0.45, 0.72, 1),
  convection: new Color(1, 0.55, 0.15),
  visible: new Color(1, 0.95, 0.55),
};

const NOISE = /* glsl */ `
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
          mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
          mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      sum += amp * noise(p);
      p *= 2.03;
      amp *= 0.5;
    }
    return sum;
  }
`;

/** The surface: granules churning, darker towards the limb. */
function surfaceMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      varying float vFacing;
      void main() {
        vPos = position;
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        vec3 normal = normalize(normalMatrix * normal);
        vFacing = max(0.0, dot(normal, normalize(-view.xyz)));
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float time;
      varying vec3 vPos;
      varying float vFacing;
      ${NOISE}
      void main() {
        float granules = fbm(vPos * 9.0 + vec3(0.0, time * 0.06, time * 0.04));
        vec3 dark = vec3(0.75, 0.22, 0.02);
        vec3 bright = vec3(1.0, 0.78, 0.32);
        vec3 colour = mix(dark, bright, smoothstep(0.3, 0.75, granules));
        float limb = 0.45 + 0.55 * pow(vFacing, 0.6);
        gl_FragColor = vec4(colour * limb, 1.0);
      }
    `,
  });
}

/** A cut face: the core white-hot, the radiative zone glowing, the convective zone rolling. */
function cutMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    side: DoubleSide,
    uniforms: { time: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vPos;
      void main() {
        vPos = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float time;
      varying vec2 vPos;
      ${NOISE}
      void main() {
        float r = length(vPos);
        vec3 colour;
        if (r < ${CORE.toFixed(2)}) {
          float heat = 1.0 - r / ${CORE.toFixed(2)};
          colour = mix(vec3(1.0, 0.85, 0.45), vec3(1.0, 0.98, 0.9), heat);
          colour *= 0.92 + 0.08 * noise(vec3(vPos * 40.0, time * 0.8));
        } else if (r < ${RADIATIVE.toFixed(2)}) {
          float out_ = (r - ${CORE.toFixed(2)}) / ${(RADIATIVE - CORE).toFixed(2)};
          colour = mix(vec3(1.0, 0.62, 0.16), vec3(0.85, 0.32, 0.06), out_);
          colour *= 0.9 + 0.1 * noise(vec3(vPos * 25.0, time * 0.1));
        } else {
          // Convection: hot plasma rising, cooler sinking, in rolling cells.
          float cells = fbm(vec3(vPos * 7.0, time * 0.18));
          colour = mix(vec3(0.6, 0.12, 0.02), vec3(1.0, 0.5, 0.12), smoothstep(0.25, 0.7, cells));
        }
        // Thin bright lines where one zone meets the next.
        float edge = min(abs(r - ${CORE.toFixed(2)}), abs(r - ${RADIATIVE.toFixed(2)}));
        colour += vec3(1.0, 0.9, 0.7) * (1.0 - smoothstep(0.0, 0.006, edge)) * 0.6;
        gl_FragColor = vec4(colour, 1.0);
      }
    `,
  });
}

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

/** Where the nucleons of a nucleus sit around its centre, in units of U. */
const PACKING: readonly (readonly [number, number, number])[] = [
  [0.28, 0.2, 0],
  [-0.28, -0.2, 0],
  [0, 0.25, 0.3],
  [0, -0.25, -0.3],
];

const EASE = (x: number): number => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
/** How far through the span from `from` to `to` a stage's progress is, from 0 to 1. */
const within = (progress: number, from: number, to: number): number =>
  clamp01((progress - from) / (to - from));

export function createSunCore(container: HTMLElement): SunCore {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x02040a);
  container.append(renderer.domElement);
  const labels = new CSS2DRenderer();
  labels.domElement.className = 'story-labels';
  container.append(labels.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 0.0005, 50);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 0.04;
  controls.maxDistance = 8;

  scene.add(new AmbientLight(0xffffff, 0.9));
  const key = new DirectionalLight(0xfff0dd, 2.2);
  key.position.set(-1, 1.5, 2);
  scene.add(key);

  // The Sun, a quarter cut away to show its inside: the open quarter faces the camera.
  const surface = surfaceMaterial();
  const cut = cutMaterial();
  const shell = new Mesh(new SphereGeometry(1, 128, 96, Math.PI / 2, Math.PI * 1.5), surface);
  // Two half-discs close the cut: one in the plane z = 0, one in x = 0, each on the open side.
  const faceGeometry = new CircleGeometry(1, 128, Math.PI / 2, Math.PI);
  const faceA = new Mesh(faceGeometry, cut);
  const faceB = new Mesh(faceGeometry, cut);
  faceB.rotation.y = Math.PI / 2;
  const glowMap = glowTexture();
  const halo = new Sprite(
    new SpriteMaterial({
      map: glowMap,
      color: new Color(1, 0.55, 0.15),
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.55,
    }),
  );
  halo.scale.setScalar(3.4);
  halo.renderOrder = -1;
  scene.add(halo, shell, faceA, faceB);
  // In the core, the plasma glows on every side and fades what is far off; outside, no haze.
  const haze = new Fog(PLASMA, 100, 200);
  scene.fog = haze;

  // Nucleons: one sphere, drawn as protons (red) and neutrons (grey-blue).
  const nucleonGeometry = new SphereGeometry(NUCLEON, 20, 14);
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

  /** A nucleus of `protons` and `neutrons`, packed around its centre. */
  function nucleus(protons: number, neutrons: number): Group {
    const group = new Group();
    const kinds = [...Array<boolean>(protons).fill(true), ...Array<boolean>(neutrons).fill(false)];
    const packing = kinds.length === 1 ? [[0, 0, 0] as const] : PACKING;
    kinds.forEach((proton, index) => {
      const [x, y, z] = packing[index] ?? [0, 0, 0];
      const mesh = new Mesh(nucleonGeometry, proton ? protonMaterial : neutronMaterial);
      mesh.position.set(x * U, y * U, z * U);
      group.add(mesh);
    });
    return group;
  }

  // The protons that wander the core's open quarter, by the hundred.
  const wanderers = new InstancedMesh(nucleonGeometry, protonMaterial, WANDERERS);
  const wanderAt: Vector3[] = [];
  const wanderVelocity: Vector3[] = [];
  let seed = 11;
  const random = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < WANDERERS; i += 1) {
    let point: Vector3;
    // Inside the core, and clear of the followed chain; seen from outside, the cut faces hide
    // all but those in the open quarter.
    do {
      point = new Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).multiplyScalar(
        CORE,
      );
    } while (point.length() > CORE * 0.97 || point.distanceTo(CHAIN_AT) < 7 * U);
    wanderAt.push(point);
    wanderVelocity.push(new Vector3(random() - 0.5, random() - 0.5, random() - 0.5));
  }
  scene.add(wanderers);
  const matrix = new Matrix4();
  function placeWanderers(dt: number): void {
    for (let i = 0; i < WANDERERS; i += 1) {
      const at = wanderAt[i];
      const velocity = wanderVelocity[i];
      if (at === undefined || velocity === undefined) continue;
      velocity.x += (random() - 0.5) * 0.6;
      velocity.y += (random() - 0.5) * 0.6;
      velocity.z += (random() - 0.5) * 0.6;
      velocity.multiplyScalar(0.96);
      const next = at.clone().addScaledVector(velocity, dt * 0.00002);
      // They stay in the core, clear of the chain.
      if (next.length() < CORE * 0.97 && next.distanceTo(CHAIN_AT) > 6 * U) {
        at.copy(next);
      } else {
        velocity.negate();
      }
      matrix.makeTranslation(at.x, at.y, at.z);
      wanderers.setMatrixAt(i, matrix);
    }
    wanderers.instanceMatrix.needsUpdate = true;
  }
  placeWanderers(0);

  // Elsewhere in the core, other chains flash now and then.
  const flashMaterial = new SpriteMaterial({
    map: glowMap,
    color: new Color(1, 0.95, 0.7),
    blending: AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });
  const flashes = Array.from({ length: 8 }, () => {
    const sprite = new Sprite(flashMaterial.clone());
    sprite.visible = false;
    scene.add(sprite);
    return { sprite, born: -1e9 };
  });
  let nextFlash = 0;

  // The followed chain's parts.
  const chain = new Group();
  chain.position.copy(CHAIN_AT);
  scene.add(chain);
  const protonA = nucleus(1, 0);
  const protonB = nucleus(1, 0);
  const protonC = nucleus(1, 0);
  const deuterium = nucleus(1, 1);
  const helium3 = nucleus(2, 1);
  const helium3b = nucleus(2, 1);
  const helium4 = nucleus(2, 2);
  const freedA = nucleus(1, 0);
  const freedB = nucleus(1, 0);
  const lepton = (colour: number, size: number): Sprite => {
    const sprite = new Sprite(
      new SpriteMaterial({
        map: glowMap,
        color: new Color(colour),
        blending: AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    );
    sprite.scale.setScalar(size);
    return sprite;
  };
  const positron = lepton(0x9fe8ff, U * 0.9);
  const electron = lepton(0x6f8cff, U * 0.9);
  const neutrino = lepton(0xd8ffd8, U * 0.6);
  const burst = lepton(0xfff3c0, U * 6);
  const gammaGeometry = new CylinderGeometry(U * 0.07, U * 0.07, 1, 6);
  gammaGeometry.translate(0, 0.5, 0);
  const gammaMaterial = new MeshBasicMaterial({ color: 0xfff1a0 });
  const ray = (): Mesh => new Mesh(gammaGeometry, gammaMaterial);
  const gammaA = ray();
  const gammaB = ray();
  const gammaC = ray();
  chain.add(
    protonA,
    protonB,
    protonC,
    deuterium,
    helium3,
    helium3b,
    helium4,
    freedA,
    freedB,
    positron,
    electron,
    neutrino,
    burst,
    gammaA,
    gammaB,
    gammaC,
  );

  /** A label in the page, tied to a point in the scene. */
  function label(text: string, kind = ''): CSS2DObject {
    const element = document.createElement('span');
    element.className = `story-label ${kind}`.trim();
    element.textContent = text;
    const object = new CSS2DObject(element);
    object.center.set(0, 1.2);
    scene.add(object);
    return object;
  }
  const zoneLabels = [
    { object: label('core · 15 million °C', 'is-zone'), at: new Vector3(-0.12, 0.13, 0.002) },
    { object: label('radiative zone', 'is-zone'), at: new Vector3(-0.33, 0.36, 0.002) },
    { object: label('convective zone', 'is-zone'), at: new Vector3(-0.58, 0.62, 0.002) },
  ];
  for (const { object, at } of zoneLabels) object.position.copy(at);
  const chainLabels = {
    protonA: label('proton ¹H'),
    protonB: label('proton ¹H'),
    deuterium: label('deuterium ²H'),
    positron: label('positron e⁺'),
    neutrino: label('neutrino ν, straight out'),
    gammaA: label('γ 0.511 MeV', 'is-gamma'),
    protonC: label('proton ¹H'),
    helium3: label('helium-3 ³He'),
    gammaC: label('γ 5.49 MeV', 'is-gamma'),
    helium3b: label('³He, made the same way'),
    helium4: label('helium-4 ⁴He'),
    freedA: label('proton, back to the core'),
  };

  // What the chain is, step by step, beside the scene: the equations, the one playing lit.
  const legend = document.createElement('ol');
  legend.className = 'story-chain';
  legend.setAttribute('aria-label', 'The proton–proton chain');
  const legendItems = new Map<ChainStage, HTMLLIElement>();
  for (const info of CHAIN) {
    const item = document.createElement('li');
    // Numbered by the reaction, so the one shown alone on a phone keeps its number.
    item.value = CHAIN.indexOf(info) + 1;
    const equation = document.createElement('strong');
    equation.textContent = info.equation;
    item.append(equation, document.createTextNode(`: ${info.gives}`));
    legend.append(item);
    legendItems.set(info.stage, item);
  }
  const hint = document.createElement('p');
  hint.className = 'story-hint';
  hint.textContent = 'Drag to turn, scroll or pinch to zoom. Not to scale.';

  // The escape: the walk, drawn as it goes, coloured by what the light is at each step.
  const walk = photonWalk([CHAIN_AT.x, CHAIN_AT.y, CHAIN_AT.z]);
  const walkGeometry = new LineGeometry();
  walkGeometry.setPositions(walk.points.flatMap(([x, y, z]) => [x, y, z]));
  walkGeometry.setColors(
    walk.points.flatMap((_, index) => BAND_COLOURS[bandAt(walk, index)].toArray()),
  );
  const walkMaterial = new LineMaterial({ vertexColors: true, linewidth: 3 });
  const trail = new Line2(walkGeometry, walkMaterial);
  const segments = walk.points.length - 1;
  const head = lepton(0xffffff, 0.035);
  const headLabel = label('', 'is-photon');
  scene.add(trail, head);

  // What the light is along its way, beside the scene: the stage it is at lit.
  const escapeLegend = document.createElement('ol');
  escapeLegend.className = 'story-chain';
  escapeLegend.setAttribute('aria-label', 'A photon’s way out');
  const escapeItems = new Map<Band, HTMLLIElement>();
  for (const info of BANDS) {
    const item = document.createElement('li');
    item.value = BANDS.indexOf(info) + 1;
    const name = document.createElement('strong');
    name.textContent = info.label;
    item.append(name, document.createTextNode(`: ${info.about}`));
    escapeLegend.append(item);
    escapeItems.set(info.band, item);
  }
  container.append(legend, escapeLegend, hint);

  /** The walk's picture at `t` ms into the escape: drawn so far, its head, what it is. */
  function placeWalk(t: number): Band {
    const index = Math.min(segments, Math.floor((segments * t) / WALK_MS));
    walkGeometry.instanceCount = index;
    const [x, y, z] = walk.points[index] ?? [0, 0, 0];
    const band = bandAt(walk, index);
    head.position.set(x, y, z);
    head.material.color.copy(BAND_COLOURS[band]);
    headLabel.position.set(x, y, z);
    const info = BANDS.find((each) => each.band === band);
    const years = yearsAt(walk, index);
    headLabel.element.textContent = `${info?.label ?? ''} · ${years.toLocaleString('en')} years`;
    container.dataset['years'] = String(years);
    for (const [each, item] of escapeItems) item.classList.toggle('is-now', each === band);
    return band;
  }

  /** Lay a ray from `from` along `direction`, `length` long (chain units). */
  function lay(mesh: Mesh, from: Vector3, direction: Vector3, length: number): void {
    mesh.visible = length > 1e-4;
    mesh.position.copy(from);
    mesh.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction));
    mesh.scale.set(1, Math.max(1e-4, length), 1);
  }

  /** The chain's picture at `t` ms into the chapter. */
  function placeChain(t: number): ChainStage {
    const { stage } = stageAt(t);
    const p = stageProgress(t);
    for (const object of chain.children) object.visible = false;
    for (const object of Object.values(chainLabels)) object.visible = false;
    const v = (x: number, y: number, z: number) => new Vector3(x * U, y * U, z * U);
    const show = (object: Group | Sprite, at: Vector3, tag?: CSS2DObject) => {
      object.visible = true;
      object.position.copy(at);
      if (tag !== undefined) {
        tag.visible = true;
        tag.position.copy(at).add(CHAIN_AT);
      }
    };
    if (stage === 'pp') {
      // Two protons meet; one becomes a neutron, a positron and a neutrino leave.
      const meet = EASE(within(p, 0, 0.35));
      if (p < 0.35) {
        show(protonA, v(-3, 0.6, 0).lerp(v(-0.3, 0, 0), meet), chainLabels.protonA);
        show(protonB, v(3, -0.6, 0).lerp(v(0.3, 0, 0), meet), chainLabels.protonB);
      } else {
        show(deuterium, v(0, 0, 0), chainLabels.deuterium);
        const out = within(p, 0.35, 0.6);
        if (out < 1) {
          show(positron, v(0, 0, 0).lerp(v(2.5, 2.5, 0.5), out), chainLabels.positron);
          show(electron, v(5, 5, 1).lerp(v(2.5, 2.5, 0.5), out));
          show(neutrino, v(0, 0, 0).lerp(v(-4, 9, 3), out), chainLabels.neutrino);
        } else {
          // Positron and electron annihilate: two gamma rays, back to back.
          const flight = within(p, 0.6, 1);
          const meetAt = v(2.5, 2.5, 0.5);
          show(burst, meetAt);
          burst.material.opacity = 1 - flight;
          const along = new Vector3(1, -0.4, 0.6).normalize();
          lay(gammaA, meetAt, along, 7 * U * flight);
          lay(gammaB, meetAt, along.clone().negate(), 7 * U * flight);
          const tag = chainLabels.gammaA;
          tag.visible = true;
          tag.position
            .copy(meetAt)
            .addScaledVector(along, 7 * U * flight)
            .add(CHAIN_AT);
        }
      }
    } else if (stage === 'dp') {
      const meet = EASE(within(p, 0, 0.4));
      if (p < 0.4) {
        show(deuterium, v(0, 0, 0), chainLabels.deuterium);
        show(protonC, v(0.5, 3.2, 1.5).lerp(v(0.2, 0.4, 0.2), meet), chainLabels.protonC);
      } else {
        show(helium3, v(0, 0, 0), chainLabels.helium3);
        const flight = within(p, 0.4, 1);
        show(burst, v(0, 0, 0));
        burst.material.opacity = Math.max(0, 1 - flight * 2);
        const along = new Vector3(-0.5, 0.8, 0.4).normalize();
        lay(gammaC, v(0, 0, 0), along, 9 * U * flight);
        const tag = chainLabels.gammaC;
        tag.visible = true;
        tag.position
          .copy(along)
          .multiplyScalar(9 * U * flight)
          .add(CHAIN_AT);
      }
    } else if (stage === 'hehe') {
      const meet = EASE(within(p, 0, 0.4));
      if (p < 0.4) {
        show(helium3, v(0, 0, 0), chainLabels.helium3);
        show(helium3b, v(-3.5, -1.5, 2.5).lerp(v(-0.4, -0.2, 0.3), meet), chainLabels.helium3b);
      } else {
        show(helium4, v(0, 0, 0), chainLabels.helium4);
        const flight = EASE(within(p, 0.4, 1));
        show(burst, v(0, 0, 0));
        burst.material.opacity = Math.max(0, 1 - flight * 2);
        show(freedA, v(0, 0, 0).lerp(v(4, -2, 2), flight), chainLabels.freedA);
        show(freedB, v(0, 0, 0).lerp(v(-4, 2, -2), flight));
      }
    } else {
      show(helium4, v(0, 0, 0), chainLabels.helium4);
    }
    for (const [each, item] of legendItems) item.classList.toggle('is-now', each === stage);
    return stage;
  }

  // The story's camera: from outside the Sun, looking into the cut, down into the core; for
  // the escape, out again to watch the walk cross the zones.
  const startAt = new Vector3(-2.4, 1.25, 2.7);
  const endAt = CHAIN_AT.clone().add(new Vector3(-0.07, 0.035, 0.11));
  const watchAt = new Vector3(-1.75, 0.95, 2.05);
  const watchTarget = new Vector3(-0.3, 0.25, 0.3);
  /** Where the camera was when the escape began, to move from. */
  const pullFrom = { at: endAt.clone(), target: CHAIN_AT.clone() };
  function storyCamera(t: number): void {
    if (chapter === 'escape') {
      const k = EASE(clamp01(t / PULL_MS));
      camera.position.copy(pullFrom.at).lerp(watchAt, k);
      controls.target.copy(pullFrom.target).lerp(watchTarget, k);
      camera.lookAt(controls.target);
      return;
    }
    const k = EASE(clamp01(t / DIVE_MS));
    // Through a path that bends a little, so the dive passes over the cut rather than into it.
    const at = startAt.clone().lerp(endAt, k);
    at.y += Math.sin(k * Math.PI) * 0.25;
    camera.position.copy(at);
    controls.target.copy(new Vector3(0, 0, 0).lerp(CHAIN_AT, k));
    camera.lookAt(controls.target);
  }

  let chapter: SunChapter = 'fusion';
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

  function resize(): void {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height);
    labels.setSize(width, height);
    walkMaterial.resolution.set(width, height);
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
      placeWanderers(dt);
      surface.uniforms['time'] = { value: t / 1000 };
      cut.uniforms['time'] = { value: t / 1000 };
      if (t > nextFlash) {
        nextFlash = t + 120 + random() * 260;
        const flash = flashes.find(({ sprite }) => !sprite.visible) ?? flashes[0];
        if (flash !== undefined) {
          const at = wanderAt[Math.floor(random() * WANDERERS)] ?? new Vector3();
          flash.sprite.position.copy(at);
          flash.sprite.visible = true;
          flash.born = t;
        }
      }
      for (const flash of flashes) {
        const age = (t - flash.born) / 350;
        flash.sprite.visible = age < 1;
        flash.sprite.scale.setScalar(U * (2 + 4 * age));
        flash.sprite.material.opacity = 1 - age;
      }
      dirty = true;
    }
    if (byStory) storyCamera(t);
    controls.update();
    const distance = camera.position.length();
    // In the core the Sun's cut gives way to the plasma all round, so the chain stays in view
    // whichever way the reader turns; out past the core's edge, the Sun cut open again.
    const inside = distance < INSIDE;
    shell.visible = !inside;
    faceA.visible = !inside;
    faceB.visible = !inside;
    halo.visible = distance > 1.6;
    scene.background = inside ? PLASMA : null;
    haze.near = inside ? 0.04 : 100;
    haze.far = inside ? 0.7 : 200;
    container.dataset['inside'] = String(inside);
    // Zone names belong to the Sun seen whole; in the core they would crowd the chain.
    for (const { object } of zoneLabels) object.visible = distance > 0.8;
    if (dirty) {
      dirty = false;
      const fusing = chapter === 'fusion';
      chain.visible = fusing;
      legend.hidden = !fusing;
      trail.visible = !fusing;
      head.visible = !fusing;
      headLabel.visible = !fusing;
      escapeLegend.hidden = fusing;
      if (fusing) {
        container.dataset['chainStage'] = placeChain(t);
      } else {
        for (const object of Object.values(chainLabels)) object.visible = false;
        container.dataset['band'] = placeWalk(t);
      }
      // The chain's names belong to the core; from out where the zones are named, too small.
      if (distance > 0.8) for (const object of Object.values(chainLabels)) object.visible = false;
      renderer.render(scene, camera);
      labels.render(scene, camera);
      container.dataset['rendered'] = 'true';
    }
    frame = requestAnimationFrame(draw);
  }
  container.dataset['chapter'] = 'fusion';
  container.dataset['playing'] = 'true';
  frame = requestAnimationFrame(draw);

  return {
    setChapter(next) {
      if (next === 'escape' && chapter !== 'escape') {
        // The walk's camera moves out from wherever the reader left it.
        pullFrom.at.copy(camera.position);
        pullFrom.target.copy(controls.target);
      }
      chapter = next;
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
      nextFlash = 0;
      byStory = true;
      dirty = true;
    },
    settle() {
      t = chapter === 'escape' ? WALK_MS : SETTLED_T;
      byStory = true;
      storyCamera(chapter === 'escape' ? PULL_MS : DIVE_MS);
      byStory = false;
      playing = false;
      container.dataset['playing'] = 'false';
      dirty = true;
    },
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      walkGeometry.dispose();
      walkMaterial.dispose();
      for (const geometry of [shell.geometry, faceGeometry, nucleonGeometry, gammaGeometry]) {
        geometry.dispose();
      }
      for (const material of [
        surface,
        cut,
        protonMaterial,
        neutronMaterial,
        flashMaterial,
        gammaMaterial,
      ]) {
        material.dispose();
      }
      glowMap.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      container.replaceChildren();
      delete container.dataset['chapter'];
      delete container.dataset['rendered'];
      delete container.dataset['chainStage'];
      delete container.dataset['band'];
      delete container.dataset['years'];
      delete container.dataset['inside'];
      delete container.dataset['playing'];
    },
  };
}
