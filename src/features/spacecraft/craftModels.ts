/**
 * The craft drawn as 3D models in their cards (#797): Webb for now. The model and its view are
 * fetched when such a card first opens, in a chunk of their own, so the page's start does not
 * grow by them.
 */

import { Vector3, type Object3D } from 'three';

import type { Body, ViewState } from '../../state/viewState';
import type { CardModel, MarkerCardContent } from '../../ui/markerCard';
import type { AwayAxis } from './craftAttitude';
import type { mountModelView } from './modelView';

/** Webb's GCAT id. */
const WEBB_ID = 'D01093';

type Load = () => Promise<{
  readonly mountModelView: typeof mountModelView;
  readonly build: () => Object3D;
}>;

const loadWebb: Load = () =>
  Promise.all([import('./modelView'), import('./webbModel')]).then(([view, webb]) => ({
    mountModelView: view.mountModelView,
    build: webb.buildWebb,
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

/**
 * A craft's model for its card, if it has one. The same object each time, so a card shown again
 * with the same model keeps the view it has.
 */
export function modelOf(craft: string): CardModel | undefined {
  return craft === WEBB_ID ? WEBB : undefined;
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
  /** Its axis kept away from the Sun (see craftAttitude.ts). */
  readonly away: AwayAxis;
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
  away: 'y',
  // At the Sun–Earth L2 point, 1.5 million km beyond Earth: the view is of Earth's neighbourhood.
  about: 'earth',
  pointing:
    'Drawn with its sunshield to the Sun, as it always is, and its mirror turned toward the celestial north: a convention, as where it looks at a given moment is not known here',
  load: () => import('./webbModel').then(({ buildWebb }) => buildWebb),
};

/** The craft the camera can go to and see as a model, by GCAT id in either case. */
export function sceneModelOf(craft: string): SceneModel | undefined {
  return craft.toUpperCase() === WEBB_ID ? WEBB_SCENE : undefined;
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
