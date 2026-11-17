/**
 * The craft drawn as 3D models in their cards (#797): Webb for now. The model and its view are
 * fetched when such a card first opens, in a chunk of their own, so the page's start does not
 * grow by them.
 */

import { Vector3, type Object3D } from 'three';

import type { CardModel, MarkerCardContent } from '../../ui/markerCard';
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
