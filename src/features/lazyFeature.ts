/**
 * A feature whose code loads when it is first wanted (#220): its front, small and loaded with the
 * site, says what it watches and when it is wanted, and does the little it must while it is not;
 * its body, a chunk of its own, is imported the first time it is wanted, mounted with the same
 * context, and from then on is the feature. Until then its layer's chip says it is loading, a
 * pick waits for it, and once mounted the moment is shown again.
 */

import type { ViewState } from '../state/viewState';
import {
  feature,
  type Capability,
  type Feature,
  type FeatureContext,
  type FeatureDefinition,
  type FeatureInstance,
} from './feature';
import { errorMessage } from '../util/errors';

/**
 * What stays with the site: the definition, but for its mount. Not yet for a feature with parts
 * in deep time's bar (a chip, its fields, a play axis): those are not passed on to the body.
 */
export interface FeatureFront<Needs extends Capability> extends Omit<
  FeatureDefinition<Needs>,
  'mount' | 'deepChip' | 'deepChipOrder'
> {
  /** Whether the view wants the body: the layer on, a link to one of its things. */
  wanted(state: ViewState): boolean;
  /** What the front does at each moment shown until the body has loaded, if anything. */
  idle?(context: FeatureContext<Needs>, state: ViewState): void;
  /** The body, mounted with the feature's context. */
  body(): Promise<(context: FeatureContext<Needs>) => FeatureInstance>;
}

export function lazyFeature<const Needs extends Capability>(front: FeatureFront<Needs>): Feature {
  const { id, needs, watches, picks } = front;
  return feature<Needs>({
    id,
    needs,
    watches,
    ...(picks === undefined ? {} : { picks }),
    mount(context) {
      let body: FeatureInstance | null = null;
      let loading = false;
      let failed = false;
      let waitingPick: string | null = null;

      function want(): void {
        if (loading || body !== null) return;
        loading = true;
        failed = false;
        front.body().then(
          (mount) => {
            body = mount(context);
            if (waitingPick !== null) body.pick?.(waitingPick);
            waitingPick = null;
            context.refresh();
          },
          (error: unknown) => {
            loading = false;
            failed = true;
            context.notify(`Could not load ${front.id}: ${errorMessage(error)}`);
            context.refresh();
          },
        );
      }

      return {
        show(state, jdTT) {
          if (body !== null) {
            body.show?.(state, jdTT);
            return;
          }
          front.idle?.(context, state);
          if (front.wanted(state)) want();
        },
        pick(id) {
          if (body !== null) body.pick?.(id);
          else {
            waitingPick = id;
            want();
          }
        },
        unpick() {
          waitingPick = null;
          body?.unpick?.();
        },
        load() {
          if (body !== null) return body.load?.() ?? null;
          if (failed) return { state: 'failed', retry: want };
          return loading ? { state: 'loading' } : null;
        },
        said: () => body?.said?.() ?? null,
        brief: () => body?.brief?.() ?? null,
        action: () => body?.action?.() ?? null,
        here: (state) => body?.here?.(state) ?? null,
        finds: (state) => body?.finds?.(state) ?? [],
      };
    },
  });
}
