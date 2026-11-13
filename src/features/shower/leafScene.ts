/**
 * The carbon-14 story's last chapters, in 3D (#317): from a lone carbon-14 atom to a plant.
 * - Dioxide: an oxygen atom joins it, carbon monoxide; then a hydroxyl's oxygen, and its
 *   hydrogen goes off: carbon dioxide, O=C=O, like any other.
 * - Fall: that molecule among the air's, nitrogen, oxygen and argon in their proportions, all
 *   jostling as it sinks through them; a leaf, or the sea, comes up below.
 * - Plant: a leaf cut open, its palisade cells packed with chloroplasts. The carbon dioxide
 *   comes in through a stoma on the underside; the red photon that left the Sun comes down from
 *   above and is absorbed in a chloroplast; the carbon-14 becomes part of a sugar. Over the sea,
 *   a single-celled alga takes it in through its surface.
 * The reader can pause, turn and zoom at any moment, as in the other chapters. Not to scale:
 * the molecules are drawn far larger beside the leaf than they are.
 *
 * Three.js glue, loaded on demand and covered by the Playwright suite; the numbers are in
 * `leafUptake.ts`, what every story scene shares in `storyScene.ts`.
 */

import {
  AmbientLight,
  BoxGeometry,
  CapsuleGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Fog,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import type { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { airAround, DIOXIDE_FACTS, FALL_FACTS, plantFacts, type Molecule } from './leafUptake';
import { PALETTE } from '../../story/palette';
import { createStoryScene } from '../../story/storyScene';
import type { StoryChapters, StoryKit, StoryScene } from '../../story/storyScene';
import { RED_NM } from './sunlightJourney';
import { clamp01, ease as EASE, within } from '../../util/timing';

/** The chapters this scene plays. */
type LeafChapter = 'dioxide' | 'fall' | 'plant';

export interface LeafSceneOptions {
  /** Whether it lands on the sea, where an alga takes it in, rather than on land. */
  readonly water: boolean;
  /** Whether the story began at the Sun, so the red photon it followed arrives here. */
  readonly fromSun: boolean;
}

export type LeafScene = StoryScene<LeafChapter>;

/** When the oxygen joins, then the hydroxyl, ms; whole after `DIOXIDE_MS`. */
const OXYGEN_MS = 1400;
const HYDROXYL_FROM = 2000;
const HYDROXYL_MS = 3200;
const DIOXIDE_MS = 3800;
/** The fall, ms, and when the ground comes up under it. */
const FALL_MS = 4200;
const GROUND_FROM = 2600;
/** The plant's moments, ms: the carbon dioxide through the stoma, the photon absorbed, the
 * carbon dioxide at the chloroplast, the sugar made. */
const STOMA_MS = 2000;
const PHOTON_MS = 2600;
const CHLOROPLAST_MS = 3600;
const SUGAR_MS = 4400;
const PLANT_MS = 4600;
/** How many air molecules jostle round the carbon dioxide as it falls, and in what box. */
const AIR_MOLECULES = 200;
const AIR_BOX = 60;

/** The atoms' colours, as the stage's captions name them: carbon-14 violet, oxygen red. */
const CARBON14 = new Color(PALETTE.carbon14);
const OXYGEN = new Color(PALETTE.oxygen);
const NITROGEN = new Color(PALETTE.nitrogen);
const ARGON = new Color(0xc8c8d0);
const HYDROGEN = new Color(PALETTE.hydrogen);
const CARBON = new Color(0x70737a);
const RED_LIGHT = new Color(0xff4030);
/** The atoms' sizes, in units of 100 pm, a little under their van der Waals radii. */
const C_RADIUS = 0.75;
const O_RADIUS = 0.68;
const N_RADIUS = 0.7;
/** Carbon to oxygen in carbon dioxide, 116 pm; nitrogen to nitrogen 110 pm; O₂ 121 pm. */
const CO_BOND = 1.16;
const NN_BOND = 1.1;
const OO_BOND = 1.21;

export function createLeafScene(container: HTMLElement, options: LeafSceneOptions): LeafScene {
  return createStoryScene<LeafChapter>(container, {
    first: 'dioxide',
    near: 0.1,
    far: 400,
    build: (kit) => build(kit, options),
  });
}

function build(kit: StoryKit<LeafChapter>, options: LeafSceneOptions): StoryChapters<LeafChapter> {
  const { scene, camera, controls, own, glow, label, line } = kit;
  controls.minDistance = 3;
  controls.maxDistance = 160;
  scene.add(new AmbientLight(0xffffff, 0.8));
  const key = new DirectionalLight(0xffffff, 2.2);
  key.position.set(-1, 2, 1.5);
  scene.add(key);

  const atomGeometry = own(new SphereGeometry(1, 32, 20));
  const atomMaterials = new Map<Color, MeshStandardMaterial>();
  /** A material for atoms of `color`, made once. */
  function atomMaterial(color: Color): MeshStandardMaterial {
    let material = atomMaterials.get(color);
    if (material === undefined) {
      material = own(
        new MeshStandardMaterial({
          color,
          roughness: 0.4,
          emissive: color.clone().multiplyScalar(0.12),
        }),
      );
      atomMaterials.set(color, material);
    }
    return material;
  }
  /** One atom, `radius` across in units of 100 pm. */
  function atom(color: Color, radius: number, parent: Group): Mesh {
    const mesh = new Mesh(atomGeometry, atomMaterial(color));
    mesh.scale.setScalar(radius);
    parent.add(mesh);
    return mesh;
  }
  // Dioxide: the carbon-14 atom, an oxygen atom, then a hydroxyl.
  const making = new Group();
  const carbon14 = atom(CARBON14, C_RADIUS, making);
  const firstOxygen = atom(OXYGEN, O_RADIUS, making);
  const secondOxygen = atom(OXYGEN, O_RADIUS, making);
  const hydrogen = atom(HYDROGEN, 0.4, making);
  const joinFlash = glow(new Color(1, 0.95, 0.85), 4, making);
  const moleculeLabel = label('', making);
  const oxygenLabel = label('oxygen O', making);
  const hydroxylLabel = label('hydroxyl OH', making);
  const hydrogenLabel = label('hydrogen H, off again', making);
  const oxygenFrom = new Vector3(-7, 2.5, 1.5);
  const hydroxylFrom = new Vector3(7, -2.5, -1.5);
  const hydrogenTo = new Vector3(9, 4, 3);

  /** The molecule being made at `t` ms; returns what it is so far. */
  function placeDioxide(t: number): string {
    const first = EASE(within(t, 0, OXYGEN_MS));
    const second = EASE(within(t, HYDROXYL_FROM, HYDROXYL_MS));
    const freed = EASE(within(t, HYDROXYL_MS, DIOXIDE_MS));
    carbon14.position.set(0, 0, 0);
    firstOxygen.position.copy(oxygenFrom).lerp(new Vector3(-CO_BOND, 0, 0), first);
    secondOxygen.position.copy(hydroxylFrom).lerp(new Vector3(CO_BOND, 0, 0), second);
    secondOxygen.visible = t >= HYDROXYL_FROM;
    hydrogen.visible = t >= HYDROXYL_FROM;
    const hydrogenAt = secondOxygen.position.clone().add(new Vector3(0.7, 0.55, 0.2));
    hydrogen.position.copy(hydrogenAt).lerp(hydrogenTo, freed);
    oxygenLabel.visible = first < 1;
    oxygenLabel.position.copy(firstOxygen.position);
    hydroxylLabel.visible = t >= HYDROXYL_FROM && second < 1;
    hydroxylLabel.position.copy(secondOxygen.position);
    hydrogenLabel.visible = freed > 0;
    hydrogenLabel.position.copy(hydrogen.position);
    const flashAt = t < HYDROXYL_FROM ? OXYGEN_MS : HYDROXYL_MS;
    const flash = within(t, flashAt, flashAt + 500);
    joinFlash.visible = flash > 0 && flash < 1;
    joinFlash.scale.setScalar(2 + 5 * flash);
    joinFlash.material.opacity = 1 - flash;
    const made = second === 1 ? 'CO2' : first === 1 ? 'CO' : 'C';
    moleculeLabel.element.textContent = {
      C: 'carbon-14 ¹⁴C, a lone atom',
      CO: 'carbon monoxide ¹⁴CO',
      CO2: 'carbon dioxide ¹⁴CO₂, like any other',
    }[made];
    moleculeLabel.position.set(0, 1.4, 0);
    return made;
  }

  // Fall: the carbon dioxide among the air's molecules, all jostling, a surface coming up.
  const falling = new Group();
  const dioxide = new Group();
  atom(CARBON14, C_RADIUS, dioxide);
  atom(OXYGEN, O_RADIUS, dioxide).position.set(-CO_BOND, 0, 0);
  atom(OXYGEN, O_RADIUS, dioxide).position.set(CO_BOND, 0, 0);
  falling.add(dioxide);
  const dioxideLabel = label('the carbon-14’s carbon dioxide ¹⁴CO₂', falling);
  const air = airAround(AIR_MOLECULES, AIR_BOX);
  const atomsOf = (kind: Molecule): number => (kind === 'argon' ? 1 : 2);
  const instanced = new Map<Molecule, InstancedMesh>();
  for (const kind of ['nitrogen', 'oxygen', 'argon'] as const) {
    const count = air.filter((m) => m.kind === kind).length * atomsOf(kind);
    const colour = { nitrogen: NITROGEN, oxygen: OXYGEN, argon: ARGON }[kind];
    const mesh = own(new InstancedMesh(atomGeometry, atomMaterial(colour), Math.max(1, count)));
    mesh.count = count;
    falling.add(mesh);
    instanced.set(kind, mesh);
  }
  const named = (['nitrogen', 'oxygen', 'argon'] as const).map((kind) => {
    const index = air.findIndex(
      (m) =>
        m.kind === kind &&
        Math.hypot(...m.at) > AIR_BOX * 0.2 &&
        Math.hypot(...m.at) < AIR_BOX * 0.4,
    );
    const text = { nitrogen: 'nitrogen N₂', oxygen: 'oxygen O₂', argon: 'argon Ar' }[kind];
    return { index, object: label(text, falling) };
  });
  const surfaceGeometry = new PlaneGeometry(AIR_BOX * 2, AIR_BOX * 2);
  surfaceGeometry.rotateX(-Math.PI / 2);
  const surfaceMaterial = new MeshStandardMaterial({
    color: options.water ? 0x1f5f8f : 0x3f8a3a,
    roughness: 0.8,
    transparent: true,
    opacity: options.water ? 0.75 : 1,
    side: DoubleSide,
  });
  own(surfaceGeometry);
  own(surfaceMaterial);
  const surface = new Mesh(surfaceGeometry, surfaceMaterial);
  falling.add(surface);
  const surfaceLabel = label(options.water ? 'the sea' : 'a leaf', falling, 'is-zone');
  const matrix = new Matrix4();
  const turned = new Quaternion();
  const scale = new Vector3();

  /** The fall at `t` ms; returns how far through it is, 0 to 1. */
  function placeFall(t: number): number {
    const sink = t / 200;
    const counters = new Map<Molecule, number>();
    const at = new Vector3();
    for (const [index, molecule] of air.entries()) {
      const [x, y, z] = molecule.at;
      // Everything else rises past it as it sinks, wrapping round the box, each jostling.
      const rise = ((((y + sink + AIR_BOX / 2) % AIR_BOX) + AIR_BOX) % AIR_BOX) - AIR_BOX / 2;
      at.set(
        x + Math.sin(t / 300 + index) * 0.6,
        rise + Math.sin(t / 340 + index * 1.3) * 0.6,
        z + Math.sin(t / 280 + index * 2.1) * 0.6,
      );
      turned.setFromEuler(
        new Euler(molecule.turn[0] + t / 900, molecule.turn[1] + t / 700, molecule.turn[2]),
      );
      const mesh = instanced.get(molecule.kind);
      if (mesh === undefined) continue;
      const atoms = atomsOf(molecule.kind);
      const bond = molecule.kind === 'nitrogen' ? NN_BOND : OO_BOND;
      const radius =
        molecule.kind === 'nitrogen' ? N_RADIUS : molecule.kind === 'oxygen' ? O_RADIUS : 0.95;
      for (let a = 0; a < atoms; a += 1) {
        const offset = atoms === 1 ? 0 : (a === 0 ? -bond : bond) / 2;
        const position = new Vector3(offset, 0, 0).applyQuaternion(turned).add(at);
        const slot = counters.get(molecule.kind) ?? 0;
        counters.set(molecule.kind, slot + 1);
        mesh.setMatrixAt(slot, matrix.compose(position, turned, scale.setScalar(radius)));
      }
      for (const name of named) {
        if (name.index === index) name.object.position.copy(at);
      }
    }
    for (const mesh of instanced.values()) mesh.instanceMatrix.needsUpdate = true;
    dioxide.rotation.set(t / 800, t / 1100, 0.3);
    dioxide.position.set(Math.sin(t / 500) * 0.3, Math.sin(t / 430) * 0.3, 0);
    dioxideLabel.position.copy(dioxide.position).add(new Vector3(0, 1.4, 0));
    const ground = EASE(within(t, GROUND_FROM, FALL_MS));
    surface.position.y = -AIR_BOX * 1.2 + (AIR_BOX * 1.2 - 9) * ground;
    surface.visible = ground > 0;
    surfaceLabel.visible = ground > 0.5;
    surfaceLabel.position.set(-12, surface.position.y, 8);
    return clamp01(t / FALL_MS);
  }

  // Plant: a leaf cut open, or a single-celled alga under the sea's surface.
  const plant = new Group();
  const greenMaterial = new MeshStandardMaterial({
    color: 0x6fbf4f,
    roughness: 0.7,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const skinMaterial = new MeshStandardMaterial({
    color: 0xa6d98a,
    roughness: 0.8,
    transparent: true,
    opacity: 0.65,
  });
  const guardMaterial = new MeshStandardMaterial({ color: 0x4f9a3c, roughness: 0.6 });
  const chloroplastMaterial = new MeshStandardMaterial({
    color: 0x2f8f2a,
    roughness: 0.5,
    emissive: 0x0a2a08,
  });
  for (const material of [greenMaterial, skinMaterial, guardMaterial, chloroplastMaterial]) {
    own(material);
  }
  const chloroplastSpots: Vector3[] = [];
  let target = new Vector3();
  let inlet = new Vector3();
  let start = new Vector3();
  const plantLabels: { object: CSS2DObject; at: Vector3 }[] = [];
  const pinned = (text: string, at: Vector3, kind = 'is-zone'): void => {
    const object = label(text, plant, kind);
    object.position.copy(at);
    plantLabels.push({ object, at });
  };
  if (options.water) {
    const waterGeometry = new PlaneGeometry(120, 120);
    waterGeometry.rotateX(-Math.PI / 2);
    const waterMaterial = new MeshStandardMaterial({
      color: 0x2a6fa8,
      transparent: true,
      opacity: 0.35,
      side: DoubleSide,
      depthWrite: false,
    });
    const cellGeometry = new SphereGeometry(8, 48, 32);
    for (const item of [waterGeometry, waterMaterial, cellGeometry]) own(item);
    const water = new Mesh(waterGeometry, waterMaterial);
    water.position.y = 14;
    plant.add(water, new Mesh(cellGeometry, greenMaterial));
    for (let i = 0; i < 14; i += 1) {
      const z = 1 - (2 * (i + 0.5)) / 14;
      const turn = i * 2.4;
      const across = Math.sqrt(1 - z * z);
      chloroplastSpots.push(
        new Vector3(across * Math.cos(turn), z, across * Math.sin(turn)).multiplyScalar(5.6),
      );
    }
    target = chloroplastSpots[2]?.clone() ?? new Vector3(0, 5, 0);
    inlet = target.clone().normalize().multiplyScalar(8.2);
    start = new Vector3(-8, 26, 6);
    pinned('the sea’s surface', new Vector3(14, 14, 10));
    pinned('an alga: one cell, with chloroplasts', new Vector3(-9, -6, 6));
  } else {
    const skinGeometry = new BoxGeometry(56, 1.6, 22);
    const halfSkin = new BoxGeometry(26, 1.6, 22);
    const cellGeometry = new CapsuleGeometry(2.1, 7, 8, 16);
    const spongyGeometry = new SphereGeometry(2.6, 24, 16);
    const guardGeometry = new CapsuleGeometry(1.1, 5, 8, 16);
    for (const item of [skinGeometry, halfSkin, cellGeometry, spongyGeometry, guardGeometry]) {
      own(item);
    }
    const upper = new Mesh(skinGeometry, skinMaterial);
    upper.position.y = 10;
    plant.add(upper);
    for (const side of [-1, 1]) {
      const lower = new Mesh(halfSkin, skinMaterial);
      lower.position.set(side * (13 + 2.4), -9, 0);
      const guard = new Mesh(guardGeometry, guardMaterial);
      guard.rotation.x = Math.PI / 2;
      guard.position.set(side * 1.25, -9, 0);
      plant.add(lower, guard);
    }
    for (let i = 0; i < 10; i += 1) {
      for (const z of [-5, 0, 5]) {
        const cell = new Mesh(cellGeometry, greenMaterial);
        const x = -22.5 + i * 5;
        cell.position.set(x, 4, z);
        plant.add(cell);
        for (let c = 0; c < 4; c += 1) {
          chloroplastSpots.push(
            new Vector3(x + (c % 2 === 0 ? -1 : 1), 1.5 + c * 1.6, z + (c < 2 ? 0.9 : -0.9)),
          );
        }
      }
    }
    for (const [x, y, z] of [
      [-18, -3, -4],
      [-10, -4, 4],
      [-4, -2, -5],
      [8, -3, 3],
      [15, -4, -4],
      [21, -2, 5],
    ] as const) {
      const cell = new Mesh(spongyGeometry, greenMaterial);
      cell.position.set(x, y, z);
      plant.add(cell);
    }
    // The chloroplast nearest the stoma's way up, in the palisade cell above it.
    target = new Vector3(2.5 - 1, 1.5 + 1.6, 0.9);
    inlet = new Vector3(0, -9, 0);
    start = new Vector3(-7, -22, 6);
    pinned('a leaf, cut open', new Vector3(-14, 11, 11));
    pinned('palisade cells, packed with chloroplasts', new Vector3(-16, 6, 11));
    pinned('stoma, between two guard cells', new Vector3(3, -10.5, 8));
  }
  const chloroplasts = own(
    new InstancedMesh(atomGeometry, chloroplastMaterial, chloroplastSpots.length),
  );
  for (const [index, spot] of chloroplastSpots.entries()) {
    chloroplasts.setMatrixAt(
      index,
      matrix.compose(spot, new Quaternion(), new Vector3(0.75, 0.45, 0.55)),
    );
  }
  plant.add(chloroplasts);
  // The carbon dioxide, drawn large enough to see beside the cells.
  const entering = new Group();
  atom(CARBON14, 0.5, entering);
  atom(OXYGEN, 0.45, entering).position.set(-0.75, 0, 0);
  atom(OXYGEN, 0.45, entering).position.set(0.75, 0, 0);
  plant.add(entering);
  const enteringLabel = label('¹⁴CO₂', plant);
  // The light: the red photon from the Sun, or sunlight.
  const lightFrom = target.clone().add(new Vector3(-16, 40, 10));
  const lightPoints = Array.from({ length: 32 }, (_, i) => lightFrom.clone().lerp(target, i / 31));
  const light = line(
    lightPoints,
    options.fromSun ? RED_LIGHT : new Color(1, 0.9, 0.5),
    options.fromSun ? 3 : 2,
    plant,
  );
  const photon = glow(options.fromSun ? RED_LIGHT : new Color(1, 0.9, 0.5), 3, plant);
  const photonLabel = label(
    options.fromSun ? `red light, ${String(RED_NM)} nm, from the Sun` : 'sunlight',
    plant,
    options.fromSun ? 'is-red' : '',
  );
  const absorbed = glow(new Color(0.6, 1, 0.5), 6, plant);
  absorbed.position.copy(target);
  const absorbedLabel = label(
    options.fromSun ? 'absorbed by chlorophyll: 1.8 eV' : 'chlorophyll takes in the light',
    plant,
  );
  absorbedLabel.position.copy(target);
  // The sugar it becomes part of: a ring of carbons, one of them the carbon-14.
  const sugar = new Group();
  for (let i = 0; i < 6; i += 1) {
    const angle = (i * Math.PI) / 3;
    atom(i === 0 ? CARBON14 : CARBON, 0.38, sugar).position.set(
      Math.cos(angle) * 0.8,
      Math.sin(angle) * 0.8,
      0,
    );
  }
  sugar.position.copy(target).add(new Vector3(0, 0, 3));
  sugar.scale.setScalar(2.4);
  plant.add(sugar);
  const sugarLabel = label('in a sugar, C₆H₁₂O₆: part of the plant', plant);
  sugarLabel.position.copy(sugar.position).add(new Vector3(0, 1, 0));

  /** The plant taking it in at `t` ms; returns whether the carbon-14 is part of it yet. */
  function placePlant(t: number): boolean {
    const toInlet = EASE(within(t, 0, STOMA_MS));
    const toTarget = EASE(within(t, STOMA_MS, CHLOROPLAST_MS));
    const at =
      toInlet < 1 ? start.clone().lerp(inlet, toInlet) : inlet.clone().lerp(target, toTarget);
    entering.position.copy(at);
    entering.rotation.set(t / 700, t / 900, 0);
    const taken = t >= SUGAR_MS;
    entering.visible = t < CHLOROPLAST_MS;
    enteringLabel.visible = t < CHLOROPLAST_MS;
    enteringLabel.position.copy(at).add(new Vector3(0, 0.8, 0));
    const coming = within(t, 0, PHOTON_MS);
    // The red photon goes down its way; sunlight just shines.
    light.geometry.instanceCount = options.fromSun ? Math.round(coming * 31) : 31;
    photon.visible = options.fromSun ? coming < 1 : false;
    photon.position.copy(lightFrom).lerp(target, coming);
    photonLabel.visible = options.fromSun ? coming > 0 && coming < 1 : true;
    photonLabel.position.copy(
      options.fromSun ? photon.position : lightFrom.clone().lerp(target, 0.4),
    );
    const flash = within(t, PHOTON_MS, PHOTON_MS + 700);
    absorbed.visible = flash > 0 && flash < 1;
    absorbed.scale.setScalar(3 + 6 * flash);
    absorbed.material.opacity = 1 - flash;
    absorbedLabel.visible = t >= PHOTON_MS && t < SUGAR_MS;
    const forming = EASE(within(t, CHLOROPLAST_MS, SUGAR_MS));
    sugar.visible = forming > 0;
    sugar.scale.setScalar(2.4 * Math.max(0.01, forming));
    sugarLabel.visible = taken;
    return taken;
  }

  const dioxideLegend = kit.legend('Carbon dioxide made', DIOXIDE_FACTS);
  const fallLegend = kit.legend('Through the air', FALL_FACTS);
  const plantLegend = kit.legend(
    options.water ? 'Into the alga' : 'Into the leaf',
    plantFacts(options.water, options.fromSun),
  );
  for (const { items } of [dioxideLegend, fallLegend, plantLegend]) {
    items[0]?.classList.add('is-now');
  }
  scene.add(making, falling, plant);
  kit.during('dioxide', making, dioxideLegend.list);
  kit.during('fall', falling, fallLegend.list);
  kit.during('plant', plant, plantLegend.list);
  const haze = new Fog(PALETTE.night, 34, 90);

  return {
    ends: { dioxide: DIOXIDE_MS, fall: FALL_MS, plant: PLANT_MS },
    camera(chapter, t) {
      const fit = 1 / Math.min(1, camera.aspect);
      if (chapter === 'dioxide') {
        const p = EASE(clamp01(t / DIOXIDE_MS));
        camera.position.set(-3 + 6 * p, 3, 14 * fit);
        controls.target.set(0, 0, 0);
      } else if (chapter === 'fall') {
        const p = EASE(clamp01(t / FALL_MS));
        camera.position.set(5, 3 - 4 * p, 46 * fit);
        controls.target.set(0, -3 * p, 0);
      } else {
        const p = EASE(clamp01(t / PLANT_MS));
        camera.position.set(-16 + 10 * p, 6 - 3 * p, (84 - 10 * p) * fit ** 0.9);
        controls.target.set(0, -4, 0);
      }
    },
    place(chapter, t) {
      // The air fades into the dark with distance as it falls; nowhere else.
      scene.fog = chapter === 'fall' ? haze : null;
      if (chapter === 'dioxide') kit.mark('molecule', placeDioxide(t));
      else if (chapter === 'fall') kit.mark('fallen', placeFall(t).toFixed(2));
      else kit.mark('taken', String(placePlant(t)));
    },
  };
}
