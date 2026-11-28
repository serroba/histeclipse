/**
 * The impacts' paths through time (#304), their sheet's code loaded the first time the view opens
 * it (#220): until then it costs the page a hidden stand-in, and the main chunk nothing.
 */

import type { CratersShape, CratersView } from '../state/viewState';
import { errorMessage } from '../util/errors';
import type { createImpactPathsSheet } from './impactPathsSheet';
import { lazySheet } from './lazySheet';

export interface LazyImpactPaths {
  /** Where the sheet goes on the page. */
  readonly element: HTMLElement;
  show(view: CratersView | null, ma: number, shape: CratersShape): void;
}

/** As `createImpactPathsSheet` takes them, then where to say a failed load. */
export function lazyImpactPaths(
  ...[onRequest, onShape, load, onGlobe, why, notify]: [
    ...Parameters<typeof createImpactPathsSheet>,
    (message: string) => void,
  ]
): LazyImpactPaths {
  const sheet = lazySheet<{ view: CratersView; ma: number; shape: CratersShape }>(
    () =>
      import('./impactPathsSheet').then(({ createImpactPathsSheet: create }) => {
        const made = create(onRequest, onShape, load, onGlobe, why);
        return {
          dialog: made.dialog,
          show: (asked) => {
            if (asked === null) made.show(null, 0, 'map');
            else made.show(asked.view, asked.ma, asked.shape);
          },
        };
      }),
    (error) => {
      notify(`Could not load the impacts’ paths: ${errorMessage(error)}`);
    },
  );
  return {
    element: sheet.element,
    show: (view, ma, shape) => {
      sheet.show(view === null ? null : { view, ma, shape });
    },
  };
}
