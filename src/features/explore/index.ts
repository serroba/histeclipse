/**
 * Explore as a part of the page (#727): its button in the header, its panel, and opening a
 * destination as a search anchor opens, so Back returns to the view before; under the date, the
 * destination arrived at and Fit this topic (#729).
 */

import { destinationAnchor } from '../../explore/destinations';
import { fitQuery } from '../../explore/frame';
import type { ViewOpener } from '../../explore/open';
import type { ViewState } from '../../state/viewState';
import { createExplorePanel } from './explorePanel';
import { createFitLine } from './fitLine';

/** What Explore asks of the rest of the page. */
export interface ExploreContext {
  /** Open a view laid over the reader's, or the reader's changed, as a step. */
  readonly opener: ViewOpener;
  /** Search, for a named thing. */
  readonly search: { open(): void };
}

export interface ExplorePart {
  readonly button: HTMLElement;
  readonly dialog: HTMLDialogElement;
  /** Under the date: the destination arrived at, and Fit this topic (#729). */
  readonly context: HTMLElement;
  readonly show: (state: ViewState) => void;
}

/** Below this width the panel is a sheet over the globe, closed once a destination is picked. */
const NARROW = '(max-width: 600px)';

export function mountExplore(context: ExploreContext): ExplorePart {
  const panel = createExplorePanel({
    onDestination: (destination) => {
      context.opener.anchor(destinationAnchor(destination));
    },
    onSearch: () => {
      context.search.open();
    },
    narrow: () => window.matchMedia(NARROW).matches,
  });
  const fit = createFitLine((destination) => {
    context.opener.query((current) => fitQuery(destination.view, current));
  });
  return {
    button: panel.button,
    dialog: panel.dialog,
    context: fit.root,
    show: (state) => {
      panel.render(state.explore);
      fit.render(state);
    },
  };
}
