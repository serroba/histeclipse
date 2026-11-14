/**
 * The famous eclipses (#447): the list, a convenience (if it fails to load, everything else
 * still works), and going to one, standing where it was seen. Its panel also
 * leads to the tablet's check.
 */

import { famousDate, loadFamousEclipses, type FamousEclipse } from '../../data/famousEclipses';
import { eclipseMomentAt, eclipseSelection, findSelected } from '../../eclipses/describe';
import { withEclipse, type GeoPoint } from '../../state/viewState';
import type { AstronomicalYear } from '../../time/year';
import { createFamousPanel } from './famousPanel';
import type { Eclipse } from '../../ui/timeline';
import { errorMessage } from '../../util/errors';
import type { PartContext } from '../part';

/** What the famous eclipses ask of the rest of the page. */
export interface FamousContext extends PartContext {
  /** The year's eclipses of a kind, from the catalogue. */
  eclipsesInYear(kind: 'solar' | 'lunar', year: AstronomicalYear): Promise<readonly Eclipse[]>;
  /** An eclipse was picked: the globe turns toward it, or toward the place given. */
  flyToPicked(place: GeoPoint | null): void;
  /** The list loaded: the eclipse picked may be one of them. */
  loaded(): void;
  /** Open the tablet's check. */
  openTablet(): void;
}

export interface FamousPart {
  readonly button: HTMLElement;
  readonly dialog: HTMLElement;
  /** Load the list: once the catalogues are in, as picking one needs them. */
  readonly load: () => void;
  /** The famous eclipses, once loaded. */
  readonly list: () => readonly FamousEclipse[];
}

export function mountFamous(context: FamousContext): FamousPart {
  const { store } = context;
  let famous: readonly FamousEclipse[] = [];
  const panel = createFamousPanel(
    (entry) => {
      void goTo(entry);
    },
    () => {
      // The tablet is dated in the Babylonian calendar: switch to it, where its check lives.
      store.set((state) => ({ ...state, years: 'babylonian' }));
      context.openTablet();
    },
  );

  async function goTo(entry: FamousEclipse): Promise<void> {
    const date = famousDate(entry);
    let eclipses: readonly Eclipse[];
    try {
      eclipses = await context.eclipsesInYear(entry.kind, date.year);
    } catch (error) {
      context.notify(`Could not load ${entry.title}: ${errorMessage(error)}`);
      return;
    }
    const match = findSelected(eclipses, { kind: entry.kind, date });
    if (match === undefined) {
      context.notify(`${entry.title} is not in the catalog.`);
      return;
    }
    context.flyToPicked(entry.place ?? null);
    store.set((state) => {
      const location =
        entry.place === undefined
          ? state.location
          : { latitude: entry.place.latitude, longitude: entry.place.longitude };
      return {
        ...withEclipse(state, eclipseSelection(match)),
        time: eclipseMomentAt(match, location),
        location,
      };
    });
  }

  return {
    button: panel.button,
    dialog: panel.dialog,
    load() {
      loadFamousEclipses(`${context.base}data/famous-eclipses.json`, context.fetchJson).then(
        (entries) => {
          famous = entries;
          panel.setEclipses(entries);
          context.loaded();
        },
        (error: unknown) => {
          panel.button.hidden = true;
          context.notify(`Could not load the famous eclipses: ${errorMessage(error)}`);
        },
      );
    },
    list: () => famous,
  };
}
