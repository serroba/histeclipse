/**
 * The shower's story as a part of the page (#269, #317), its front (#220): loaded with the site,
 * it holds the places of the 3D chapters and the stage among the page's others, and its body
 * (`body.ts`), the stage, the story and its scenes, loads the first time a shower is watched,
 * then plays it. Should it fail to load, the reader is told and can try again.
 */

import { errorMessage } from '../../util/errors';
import { partSlot } from '../lazyPart';
import type { ShowerContext, ShowerPart } from './body';

export type { ShowerContext, ShowerPart } from './body';

type Body = Promise<{ readonly mountShower: (context: ShowerContext) => ShowerPart }>;

/** The front, loading its body with `load`: the body's own chunk, or a stand-in in the tests. */
export function showerFront(context: ShowerContext, load: () => Body): ShowerPart {
  const container = partSlot();
  const stage = partSlot();
  let body: Promise<ShowerPart> | null = null;

  /** The body, loaded and mounted the first time it is asked for; asked again if that failed. */
  function loaded(): Promise<ShowerPart> {
    body ??= load().then(({ mountShower }) => {
      const made = mountShower(context);
      container.replaceChildren(made.container);
      stage.replaceChildren(made.stage);
      return made;
    });
    return body;
  }

  function watch(dipole: number, fromSun: boolean): void {
    loaded().then(
      (made) => {
        made.watch(dipole, fromSun);
      },
      (error: unknown) => {
        body = null;
        context.notify(`Could not load the shower: ${errorMessage(error)}`, () => {
          watch(dipole, fromSun);
        });
      },
    );
  }

  return { container, stage, watch };
}

export function mountShower(context: ShowerContext): ShowerPart {
  return showerFront(context, () => import('./body'));
}
