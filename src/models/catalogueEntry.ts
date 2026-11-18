/**
 * What a telescope's entry in the catalogue (`catalogue.ts`, #873) says: what it is, how its
 * caption reads, where the Sun is as it is lit, and, for those in space, its craft, how far the
 * camera holds from it and the body it is about. What an entry leaves out takes the defaults
 * here (#874).
 */

import { Vector3, type Object3D } from 'three';

import type { Body } from '../state/viewState';

/** A model's parts, fetched the first time it is wanted: what builds it. */
export type Builder = () => Promise<() => Object3D>;

/** What every model says of itself. */
interface Entry {
  /** Its id in the telescopes record. */
  readonly id: string;
  /** Its name, as its card's model is labelled. */
  readonly name: string;
  /** What it is built from and which parts are placed by eye, after its opening. */
  readonly caption: string;
  /** How its caption opens: by default, `BUILT`. */
  readonly opening?: string;
  readonly build: Builder;
}

/** A telescope on the ground: +Y up, +X east and −Z north, lit by `DAY`. */
export interface GroundEntry extends Entry {
  readonly kind: 'ground';
}

/** A telescope in space, in its own axes. */
export interface SpaceEntry extends Entry {
  readonly kind: 'space';
  /** Where the Sun is in its own axes as its card lights it. */
  readonly sun: Vector3;
  /** Where the Sun is in its own axes as the scene draws it: by default, `sun`. */
  readonly sceneSun?: Vector3;
  /** Whether it is built about its middle already, so the scene need not centre it. */
  readonly centred?: boolean;
  /** Its craft's GCAT id. */
  readonly craft: string;
  /** Half its longest side, in metres: the camera holds it before its parts have come. */
  readonly radius: number;
  /** The body it is about: Earth for those about it or at L2, the Sun for those trailing Earth. */
  readonly about: Extract<Body, 'earth' | 'sun'>;
  /** Which way it is drawn pointing, for its craft's card: by default, `KEPT_TO_THE_SUN`. */
  readonly pointing?: string;
}

export type CatalogueEntry = GroundEntry | SpaceEntry;

/** How a caption opens, unless its entry says otherwise. */
export const BUILT = 'An approximation built here at true scale:';

/** Which way a craft is drawn pointing, unless its entry says otherwise. */
export const KEPT_TO_THE_SUN =
  'Drawn with the side it keeps to the Sun toward the Sun, and turned toward the celestial north about that line: a convention, as where it looks at a given moment is not known here';

/** The Sun high and to one side, for a model standing on the ground (+Y up, -Z north). */
export const DAY = new Vector3(-0.5, 1, -0.6);
/** A model's builder, picked from its family's chunk. */
export function from<Family>(
  family: () => Promise<Family>,
  pick: (loaded: Family) => () => Object3D,
): Builder {
  return () => family().then(pick);
}
