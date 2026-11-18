/**
 * The craft drawn as 3D models (#797, #863): every space telescope (`models/spaceScenes.ts`), in
 * its card and, when the camera goes to it (#796), in the scene. Each model and its view are fetched when first wanted, in chunks
 * of their own, so the page's start does not grow by them.
 */

import type { Object3D } from 'three';

import type { Body, ViewState } from '../../state/viewState';
import type { CardModel, MarkerCardContent } from '../../ui/markerCard';
import { SPACE_SCENES } from '../../models/spaceScenes';

/** The models for the cards, by GCAT id: the same object each time (#797, #863). */
const CARD_MODELS: ReadonlyMap<string, CardModel> = new Map(
  [...SPACE_SCENES.values()].map(({ craft, card }) => [craft, card]),
);

/**
 * A craft's model for its card, if it has one. The same object each time, so a card shown again
 * with the same model keeps the view it has.
 */
export function modelOf(craft: string): CardModel | undefined {
  return CARD_MODELS.get(craft.toUpperCase());
}

/** A craft's card with its model, if it has one. */
export function withModel<Card extends MarkerCardContent>(card: Card, craft: string): Card {
  const model = modelOf(craft);
  return model === undefined ? card : { ...card, model };
}

/** A craft drawn in the scene when the camera is on it (#796). */
export interface SceneModel {
  /** Half its longest side, in metres: the camera's distance from it is in these. */
  readonly radius: number;
  /** The body it is about: the view speaks of it, and leaving the craft goes back to it. */
  readonly about: Body;
  /** Which way it is drawn pointing, and that this is a convention, for its card. */
  readonly pointing: string;
  /** Its parts, fetched the first time it is drawn. */
  readonly load: () => Promise<() => Object3D>;
}

/** The models for the scene, by GCAT id (#796, #863). */
const SCENE_MODELS: ReadonlyMap<string, SceneModel> = new Map(
  [...SPACE_SCENES.values()].map(({ craft, radius, about, pointing, build }) => [
    craft,
    { radius, about, pointing, load: build },
  ]),
);

/** The craft the camera can go to and see as a model, by GCAT id in either case. */
export function sceneModelOf(craft: string): SceneModel | undefined {
  return SCENE_MODELS.get(craft.toUpperCase());
}

/**
 * A craft's card with the way to its model in the scene (#796), if it has one: "Go to it", or
 * "Leave it" when the camera is on it already, back to the body it is about.
 */
export function withGoTo<Card extends MarkerCardContent>(
  card: Card,
  craft: string,
  on: string | null,
  context: { change(update: (state: ViewState) => ViewState): void },
): Card {
  const model = sceneModelOf(craft);
  if (model === undefined) return card;
  const id = craft.toLowerCase();
  const action =
    on === id
      ? {
          label: 'Leave it',
          run: () => {
            context.change((state) => ({ ...state, craft: null }));
          },
        }
      : {
          label: 'Go to it',
          run: () => {
            context.change((state) => ({
              ...state,
              craft: id,
              focus: model.about,
              view: 'free',
            }));
          },
        };
  return { ...card, facts: [...card.facts, ['Pointing', model.pointing]], action };
}
