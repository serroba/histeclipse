/**
 * A part of the page whose code loads when it is first wanted (#220), as `lazyFeature` does for
 * a feature: its front, loaded with the site, says what it watches and when it is wanted; its
 * body, a chunk of its own, is imported the first time it is, mounted with the same context, and
 * from then on is the part. Until then the part holds its place on the page with an empty slot
 * that makes no box of its own, so the body's elements, put in it, sit where they would have, in
 * the same order among the page's others.
 */

import type { Watch } from '../state/redraws';
import type { ViewState } from '../state/viewState';
import { errorMessage } from '../util/errors';
import type { MountedPart, PartContext } from './part';

export interface PartFront<Context extends Pick<PartContext, 'notify'>> {
  /** What it shows depends on, as the body's own. */
  readonly watches: Watch;
  /** Whether the view wants the body: the part open. */
  wanted(state: ViewState): boolean;
  /** What it is, for the reader if it cannot load: "the gravitational wave". */
  readonly what: string;
  /** The body, mounted with the part's context. */
  body(): Promise<(context: Context) => MountedPart>;
}

/**
 * A place on the page for a part's elements before they have loaded: it makes no box of its own,
 * so what is put in it is laid out as the page's own child, where the part's would have been.
 */
export function partSlot(): HTMLElement {
  const slot = document.createElement('div');
  slot.className = 'lazy-part';
  // Through the CSSOM, not a style attribute, which the site's policy would refuse.
  slot.style.display = 'contents';
  return slot;
}

export function lazyPart<Context extends Pick<PartContext, 'notify'>>(
  front: PartFront<Context>,
  context: Context,
): MountedPart {
  const slot = partSlot();
  let body: MountedPart | null = null;
  let loading = false;
  let latest: ViewState | null = null;

  function load(): void {
    loading = true;
    front.body().then(
      (mount) => {
        body = mount(context);
        slot.replaceChildren(...body.elements);
        if (latest !== null) body.render(latest);
      },
      (error: unknown) => {
        loading = false;
        context.notify(`Could not load ${front.what}: ${errorMessage(error)}`, () => {
          if (!loading && body === null) load();
        });
      },
    );
  }

  return {
    watches: front.watches,
    elements: [slot],
    render(state) {
      latest = state;
      if (body !== null) body.render(state);
      else if (!loading && front.wanted(state)) load();
    },
  };
}
