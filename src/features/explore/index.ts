/**
 * Explore as a part of the page (#727): its button in the header, its panel, and opening a
 * destination as a search anchor opens, so Back returns to the view before.
 */

import { destinationAnchor } from '../../explore/destinations';
import type { ViewState } from '../../state/viewState';
import type { Anchor } from '../../text/passages';
import { createExplorePanel } from './explorePanel';

/** What Explore asks of the rest of the page. */
export interface ExploreContext {
  /** Open a view laid over the reader's, as a step. */
  openAnchor(anchor: Anchor): void;
  /** Search, for a named thing. */
  readonly search: { open(): void };
}

export interface ExplorePart {
  readonly button: HTMLElement;
  readonly dialog: HTMLDialogElement;
  readonly show: (state: ViewState) => void;
}

/** Below this width the panel is a sheet over the globe, closed once a destination is picked. */
const NARROW = '(max-width: 600px)';

export function mountExplore(context: ExploreContext): ExplorePart {
  const panel = createExplorePanel({
    onDestination: (destination) => {
      context.openAnchor(destinationAnchor(destination));
    },
    onSearch: () => {
      context.search.open();
    },
    narrow: () => window.matchMedia(NARROW).matches,
  });
  return {
    button: panel.button,
    dialog: panel.dialog,
    show: (state) => {
      panel.render(state.explore);
    },
  };
}
