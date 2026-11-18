/**
 * The telescopes' list as a part of the page (#850): open while the view names it
 * (`list=telescopes`), from the Telescopes layer's chip or a link; the record loaded the first
 * time it opens. A tap on a telescope goes to it, its layer on, and opens its card.
 */

import { loadTelescopes, type Telescopes } from '../../data/telescopes';
import type { ViewState } from '../../state/viewState';
import type { MarkerCardContent } from '../../ui/markerCard';
import { errorMessage } from '../../util/errors';
import type { MountedPart, PartContext } from '../part';
import { goTo } from './telescopeList';
import { createTelescopeListSheet } from './telescopeListSheet';
import { telescopeCard } from './telescopeMarks';
import './telescopeList.css';

export interface TelescopeListContext extends PartContext {
  /** Open a card with a telescope's facts. */
  readonly showCard: (card: MarkerCardContent) => void;
}

export function mountTelescopeList(context: TelescopeListContext): MountedPart {
  const { store } = context;
  let record: Promise<Telescopes> | null = null;
  let open = false;
  const sheet = createTelescopeListSheet(
    (telescope) => {
      store.set((state) => goTo(state, telescope));
      context.showCard(telescopeCard(telescope));
    },
    () => {
      open = false;
      if (store.get().list !== null) store.set((state) => ({ ...state, list: null }));
    },
  );

  function load(): void {
    record ??= loadTelescopes(`${context.base}data/telescopes.json`, context.fetchJson);
    record.then(
      (loaded) => {
        if (open) sheet.show(loaded);
      },
      (error: unknown) => {
        record = null;
        context.notify(`Could not load the telescopes: ${errorMessage(error)}`);
        if (open) sheet.dialog.close();
      },
    );
  }

  return {
    watches: (state) => [state.list],
    elements: [sheet.dialog],
    render(state: ViewState) {
      const wanted = state.list === 'telescopes';
      if (wanted === open) return;
      open = wanted;
      if (!wanted) {
        sheet.dialog.close();
        return;
      }
      sheet.show('Loading the telescopes…');
      load();
    },
  };
}
