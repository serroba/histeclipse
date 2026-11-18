/**
 * The space telescopes as the camera goes to them (#796, #863): each one's craft (its GCAT id),
 * half its longest side, the body it is about, and its model turned so the Sun is below it, as
 * the scene draws every craft (`features/spacecraft/craftAttitude.ts`: its +Y away from the Sun).
 * Fetched the first time the camera goes to it.
 */

import { Box3, Group, Vector3, type Object3D } from 'three';

import { SPACE_MODELS, type SpaceId } from './spaceTelescopeModels';

export interface SpaceScene {
  /** Its id in the telescopes record. */
  readonly telescope: SpaceId;
  /** Its craft's GCAT id. */
  readonly craft: string;
  /** Half its longest side, in metres. */
  readonly radius: number;
  /** The body it is about: Earth for those about it or at L2, the Sun for those trailing Earth. */
  readonly about: 'earth' | 'sun';
  /** Its parts, fetched the first time it is drawn, turned with the Sun below. */
  readonly build: () => Promise<() => Object3D>;
}

const DOWN = new Vector3(0, -1, 0);

/** `make`'s model about its middle, where the camera orbits it, turned so `sun`, in its own
 * axes, is below it. */
function sunBelow(make: () => Object3D, sun: Vector3): () => Object3D {
  return () => {
    const model = make();
    model.updateMatrixWorld(true);
    model.position.sub(new Box3().setFromObject(model).getCenter(new Vector3()));
    const turned = new Group().add(model);
    turned.quaternion.setFromUnitVectors(sun.clone().normalize(), DOWN);
    return new Group().add(turned);
  };
}

const light = () => import('./lightModels');
const xray = () => import('./xrayModels');

type Builder = () => Promise<() => Object3D>;

/** A family's builder, by its id in the record. */
const BUILDERS: Readonly<Record<SpaceId, Builder>> = {
  webb: () => import('./webbModel').then((m) => m.buildWebb),
  hubble: () => import('./hubbleModel').then((m) => m.buildHubble),
  planck: () => light().then((m) => m.buildPlanck),
  wmap: () => light().then((m) => m.buildWmap),
  gaia: () => light().then((m) => m.buildGaia),
  kepler: () => light().then((m) => m.buildKepler),
  spitzer: () => light().then((m) => m.buildSpitzer),
  cobe: () => light().then((m) => m.buildCobe),
  'herschel-space': () => light().then((m) => m.buildHerschelSpace),
  tess: () => light().then((m) => m.buildTess),
  iras: () => light().then((m) => m.buildIras),
  hipparcos: () => light().then((m) => m.buildHipparcos),
  euclid: () => light().then((m) => m.buildEuclid),
  chandra: () => xray().then((m) => m.buildChandra),
  'xmm-newton': () => xray().then((m) => m.buildXmm),
  fermi: () => xray().then((m) => m.buildFermi),
  compton: () => xray().then((m) => m.buildCompton),
  swift: () => xray().then((m) => m.buildSwift),
  nustar: () => xray().then((m) => m.buildNustar),
  'spektr-rg': () => xray().then((m) => m.buildSpektrRg),
};

/** Each telescope's craft, half its longest side, and the body it is about. */
const CRAFT: readonly (readonly [SpaceId, string, number, 'earth' | 'sun'])[] = [
  // Half the sunshield's 21.197 m.
  ['webb', 'D01093', 10.5985, 'earth'],
  // Half its 13.2 m length.
  ['hubble', 'S20580', 6.6, 'earth'],
  ['planck', 'D00880', 2.1, 'earth'],
  ['wmap', 'D00778', 2.5, 'earth'],
  ['gaia', 'D00937', 5.1, 'earth'],
  ['kepler', 'D00874', 2.35, 'sun'],
  ['spitzer', 'D00824', 2.25, 'sun'],
  ['cobe', 'S20322', 4.27, 'earth'],
  ['herschel-space', 'D00879', 3.75, 'earth'],
  ['tess', 'D00995', 1.75, 'earth'],
  ['iras', 'S13777', 1.8, 'earth'],
  ['hipparcos', 'S20169', 2.6, 'earth'],
  ['euclid', 'D01123', 2.25, 'earth'],
  ['chandra', 'S25867', 9.75, 'earth'],
  ['xmm-newton', 'S25989', 8, 'earth'],
  ['fermi', 'S33053', 7.5, 'earth'],
  ['compton', 'S21225', 10.65, 'earth'],
  ['swift', 'S28485', 2.5, 'earth'],
  ['nustar', 'S38358', 5.5, 'earth'],
  ['spektr-rg', 'D01021', 2.6, 'earth'],
];

/** Webb's and Hubble's models are built about their middles with the Sun below already, as the
 * scene has drawn them (#796); the card lights them a little aside, to show their shape. */
const BUILT_SUN_BELOW: ReadonlySet<SpaceId> = new Set(['webb', 'hubble']);

function scene([telescope, craft, radius, about]: (typeof CRAFT)[number]): SpaceScene {
  const builder = BUILDERS[telescope];
  const { sun } = SPACE_MODELS[telescope];
  return {
    telescope,
    craft,
    radius,
    about,
    build: () =>
      builder().then((make) => (BUILT_SUN_BELOW.has(telescope) ? make : sunBelow(make, sun))),
  };
}

/** The space telescopes the camera can go to, by their craft's GCAT id. */
export const SPACE_SCENES: ReadonlyMap<string, SpaceScene> = new Map(
  CRAFT.map((entry) => [entry[1], scene(entry)]),
);
