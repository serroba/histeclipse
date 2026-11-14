/**
 * Explore as a part of the page (#727): its button in the header, its panel, and opening a
 * destination as a search anchor opens, so Back returns to the view before; under the date, the
 * destination arrived at and Fit this topic (#729); and the date as the way to Go to a time (#730).
 */

import { destinationAnchor } from '../../explore/destinations';
import { fitQuery } from '../../explore/frame';
import type { ViewOpener } from '../../explore/open';
import { jumpQuery } from '../../explore/timeJump';
import { PRESENT_YEAR } from '../../time/present';
import type { ViewState } from '../../state/viewState';
import { createExplorePanel } from './explorePanel';
import { createFitLine } from './fitLine';
import { createTimeDialog } from './timeDialog';

/** What Explore asks of the rest of the page. */
export interface ExploreContext {
  /** Open a view laid over the reader's, or the reader's changed, as a step. */
  readonly opener: ViewOpener;
  /** Search, for a named thing. */
  readonly search: { open(): void };
  /** The famous eclipses' button: Explore lists them under Space (#724). */
  readonly famous: HTMLElement;
}

export interface ExplorePart {
  readonly button: HTMLElement;
  readonly dialog: HTMLDialogElement;
  /** Its panel, and Go to a time (#730). */
  readonly dialogs: readonly HTMLDialogElement[];
  /** The header's date, as the button that opens Go to a time (#730). */
  readonly timeTrigger: (date: Node) => HTMLElement;
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
    entries: [
      {
        id: 'famous-eclipses',
        topic: 'space',
        label: 'Famous eclipses',
        description:
          'Eclipses that history remembers, from the eclipse of Thales to 2024, each where it was seen.',
        questions: ['Which eclipse stopped a battle?'],
        open: () => {
          context.famous.click();
        },
      },
    ],
  });
  const fit = createFitLine((destination) => {
    context.opener.query((current) => fitQuery(destination.view, current));
  });
  const time = createTimeDialog((entry) => {
    context.opener.query((current) => jumpQuery(entry, current, PRESENT_YEAR));
  }, PRESENT_YEAR);
  return {
    button: panel.button,
    dialog: panel.dialog,
    dialogs: [panel.dialog, time.dialog],
    timeTrigger: (date) => time.trigger(date),
    context: fit.root,
    show: (state) => {
      panel.render(state.explore);
      fit.render(state);
      time.render(state);
    },
  };
}
