/**
 * The craft drawn as 3D models (#797): Webb and Hubble, in their cards and, when the camera goes
 * to them (#796), in the scene. Each model and its view are fetched when first wanted, in chunks
 * of their own, so the page's start does not grow by them.
 */

import type { Object3D } from 'three';

import type { Body, ViewState } from '../../state/viewState';
import type { CardModel, MarkerCardContent } from '../../ui/markerCard';
import { HUBBLE, WEBB } from '../../models/spaceTelescopeModels';

/** Webb's and Hubble's GCAT ids. */
const WEBB_ID = 'D01093';
const HUBBLE_ID = 'S20580';

/** The models for the cards, by GCAT id: the same object each time. */
const CARD_MODELS: Readonly<Record<string, CardModel>> = { [WEBB_ID]: WEBB, [HUBBLE_ID]: HUBBLE };

/**
 * A craft's model for its card, if it has one. The same object each time, so a card shown again
 * with the same model keeps the view it has.
 */
export function modelOf(craft: string): CardModel | undefined {
  return CARD_MODELS[craft];
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

const WEBB_SCENE: SceneModel = {
  // Half the sunshield's 21.197 m, its longest side.
  radius: 10.5985,
  // At the Sun–Earth L2 point, 1.5 million km beyond Earth: the view is of Earth's neighbourhood.
  about: 'earth',
  pointing:
    'Drawn with its sunshield to the Sun, as it always is, and its mirror turned toward the celestial north: a convention, as where it looks at a given moment is not known here',
  load: () => import('../../models/webbModel').then(({ buildWebb }) => buildWebb),
};

const HUBBLE_SCENE: SceneModel = {
  // Half its 13.2 m length.
  radius: 6.6,
  about: 'earth',
  pointing:
    'Drawn with its solar arrays square to the Sun and its aperture turned toward the celestial north, square to the Sun’s line: a convention, as where it is looking at a given moment is not known here; it is never pointed near the Sun',
  load: () => import('../../models/hubbleModel').then(({ buildHubble }) => buildHubble),
};

/** The models for the scene, by GCAT id. */
const SCENE_MODELS: Readonly<Record<string, SceneModel>> = {
  [WEBB_ID]: WEBB_SCENE,
  [HUBBLE_ID]: HUBBLE_SCENE,
};

/** The craft the camera can go to and see as a model, by GCAT id in either case. */
export function sceneModelOf(craft: string): SceneModel | undefined {
  return SCENE_MODELS[craft.toUpperCase()];
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
