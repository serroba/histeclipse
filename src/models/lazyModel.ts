/**
 * A model in a card (#797, #859): its view and its parts fetched the first time it is shown, in
 * chunks of their own, so the page's start does not grow by them. The card's model slot
 * (`ui/markerCard.ts`) takes it as it is.
 */

import type { Object3D, Vector3 } from 'three';

import type { mountModelView } from './modelView';

/** What a card's model is: what it shows, a word on how it was made, and how to draw it. */
export interface LazyModel {
  readonly label: string;
  readonly caption: string;
  mount(host: HTMLElement): () => void;
}

export type ModelLoad = () => Promise<{
  readonly mountModelView: typeof mountModelView;
  readonly build: () => Object3D;
}>;

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
export function lazyModel(
  label: string,
  caption: string,
  sun: Vector3,
  load: ModelLoad,
): LazyModel {
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

/** A model's builder, fetched with the view the first time it is shown, in its family's chunk. */
export function from<Family>(
  family: () => Promise<Family>,
  pick: (loaded: Family) => () => Object3D,
): ModelLoad {
  return () =>
    Promise.all([import('./modelView'), family()]).then(([view, loaded]) => ({
      mountModelView: view.mountModelView,
      build: pick(loaded),
    }));
}
