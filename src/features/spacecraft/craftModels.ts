/**
 * The craft drawn as 3D models (#797): Webb and Hubble, in their cards and, when the camera goes
 * to them (#796), in the scene. Each model and its view are fetched when first wanted, in chunks
 * of their own, so the page's start does not grow by them.
 */

import { Vector3, type Object3D } from 'three';

import type { Body, ViewState } from '../../state/viewState';
import type { CardModel, MarkerCardContent } from '../../ui/markerCard';
import type { mountModelView } from './modelView';

/** Webb's and Hubble's GCAT ids. */
const WEBB_ID = 'D01093';
const HUBBLE_ID = 'S20580';

type Load = () => Promise<{
  readonly mountModelView: typeof mountModelView;
  readonly build: () => Object3D;
}>;

const loadWebb: Load = () =>
  Promise.all([import('./modelView'), import('./webbModel')]).then(([view, webb]) => ({
    mountModelView: view.mountModelView,
    build: webb.buildWebb,
  }));

const loadHubble: Load = () =>
  Promise.all([import('./modelView'), import('./hubbleModel')]).then(([view, hubble]) => ({
    mountModelView: view.mountModelView,
    build: hubble.buildHubble,
  }));

/** Whether the reader asked for less motion. */
function still(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * A card's model, mounted once its parts have come; stopping it before then means it is never
 * drawn. `sun` is where the Sun is in the model's own axes.
 */
export function lazyModel(label: string, caption: string, sun: Vector3, load: Load): CardModel {
  return {
    label,
    caption,
    mount(host) {
      let stop: (() => void) | null = null;
      let gone = false;
      load().then(
        ({ mountModelView, build }) => {
          if (!gone) stop = mountModelView(host, build(), { sun, stillness: still() });
        },
        () => {
          host.textContent = 'The model could not be loaded.';
        },
      );
      return () => {
        gone = true;
        stop?.();
      };
    },
  };
}

const WEBB = lazyModel(
  'The James Webb Space Telescope in 3D: drag to turn it, pinch or scroll to zoom',
  'An approximation built here from NASA’s published sizes, at true scale: the 6.5 m mirror of 18 gold segments and its secondary on three struts, above the 21 m by 14 m sunshield of five layers. The Sun is below, where the sunshield always faces it; in space the mirror is always in shade, so a light from your side shows it.',
  new Vector3(0.25, -1, 0.15),
  loadWebb,
);

const HUBBLE = lazyModel(
  'The Hubble Space Telescope in 3D: drag to turn it, pinch or scroll to zoom',
  'An approximation built here from ESA/Hubble’s published sizes, at true scale: 13.2 m long and 4.2 m across, its 2.4 m mirror inside, its two solar arrays each 2.45 m by 7.56 m, its two antennas, and its aperture door open. The Sun is below, square to the arrays; a light from your side shows the side it does not reach.',
  new Vector3(0.2, -1, 0.1),
  loadHubble,
);

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
  load: () => import('./webbModel').then(({ buildWebb }) => buildWebb),
};

const HUBBLE_SCENE: SceneModel = {
  // Half its 13.2 m length.
  radius: 6.6,
  about: 'earth',
  pointing:
    'Drawn with its solar arrays square to the Sun and its aperture turned toward the celestial north, square to the Sun’s line: a convention, as where it is looking at a given moment is not known here; it is never pointed near the Sun',
  load: () => import('./hubbleModel').then(({ buildHubble }) => buildHubble),
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
