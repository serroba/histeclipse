/**
 * The space telescopes as the camera goes to them (#796, #863), derived from the catalogue
 * (`catalogue.ts`): each one's craft (its GCAT id), half its longest side, the body it is about,
 * and its model turned so the Sun is below it, as the scene draws every craft
 * (`features/spacecraft/craftAttitude.ts`: its +Y away from the Sun). Fetched the first time the
 * camera goes to it.
 */

import { Box3, Group, Vector3, type Object3D } from 'three';

import type { LazyModel } from './lazyModel';
import { cardModel } from './telescopeModels';
import { CATALOGUE } from './catalogue';
import { KEPT_TO_THE_SUN, type Builder, type SpaceEntry } from './catalogueEntry';

export interface SpaceScene {
  /** Its id in the telescopes record. */
  readonly telescope: string;
  /** Its craft's GCAT id. */
  readonly craft: string;
  /** Half its longest side, in metres. */
  readonly radius: number;
  /** The body it is about. */
  readonly about: SpaceEntry['about'];
  /** Which way it is drawn pointing, and that this is a convention, for its card. */
  readonly pointing: string;
  /** Its model for its card, the same as its telescope's. */
  readonly card: LazyModel;
  /** Its parts, fetched the first time it is drawn, turned with the Sun below. */
  readonly build: Builder;
}

const DOWN = new Vector3(0, -1, 0);

/** `make`'s model about its middle, where the camera orbits it, unless it is built so. */
function centre(make: () => Object3D, centred: boolean): () => Object3D {
  if (centred) return make;
  return () => {
    const model = make();
    model.updateMatrixWorld(true);
    model.position.sub(new Box3().setFromObject(model).getCenter(new Vector3()));
    return model;
  };
}

/** `make`'s model turned so `sun`, in its own axes, is below it. */
function sunBelow(make: () => Object3D, sun: Vector3): () => Object3D {
  return () => {
    const turned = new Group().add(make());
    turned.quaternion.setFromUnitVectors(sun.clone().normalize(), DOWN);
    return new Group().add(turned);
  };
}

/** An entry's scene: its parts centred and turned with its Sun below. */
function spaceScene(entry: SpaceEntry): SpaceScene {
  const sun = entry.sceneSun ?? entry.sun;
  return {
    telescope: entry.id,
    craft: entry.craft,
    radius: entry.radius,
    about: entry.about,
    pointing: entry.pointing ?? KEPT_TO_THE_SUN,
    card: cardModel(entry),
    build: () => entry.build().then((make) => sunBelow(centre(make, entry.centred ?? false), sun)),
  };
}

/** The space telescopes the camera can go to, by their craft's GCAT id. */
export const SPACE_SCENES: ReadonlyMap<string, SpaceScene> = new Map(
  CATALOGUE.flatMap((entry) =>
    entry.kind === 'space' ? [[entry.craft, spaceScene(entry)] as const] : [],
  ),
);
