/**
 * The reader's input that is the page's, not a part's (#474): the keyboard, a tap on the globe
 * or the space around it, a body clicked, the camera moved, and a view chosen. What each decides
 * is a pure function, tested; the handlers only apply it.
 */

import { eclipseMomentAt, isSolar } from '../../eclipses/describe';
import type { Globe } from '../../globe/globe';
import { phoneLook } from '../../sky/aim';
import type { Store } from '../../state/store';
import { DEFAULT_LOOK, type GeoPoint, type SkyLook, type ViewState } from '../../state/viewState';
import type { Eclipse } from '../../ui/timeline';
import type { ViewChoice } from '../../ui/viewSwitch';
import type { Panels } from './panels';

/** What a key does: bring the panels back, open search, or nothing. */
export type KeyAction = 'show-panels' | 'search' | null;

export interface KeyPress {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  /** Whether it is being typed into a field. */
  readonly typing: boolean;
}

/** Escape brings the panels back; "/" opens search, unless it is being typed somewhere. */
export function keyAction(press: KeyPress): KeyAction {
  if (press.key === 'Escape') return 'show-panels';
  if (press.key === '/' && !press.typing && !press.ctrlKey && !press.metaKey) return 'search';
  return null;
}

/**
 * A tap on empty space. In deep time it is like the globe: it clears the panels, or brings them
 * back. In historical time a tap on the globe picks a place, so empty space only brings them back.
 */
export function emptyTap(state: ViewState): 'toggle' | 'show' {
  return state.ma === null ? 'show' : 'toggle';
}

/** A place picked to four decimals, about ten metres. */
export function pickedPlace(place: GeoPoint): GeoPoint {
  return { latitude: round(place.latitude, 4), longitude: round(place.longitude, 4) };
}

/**
 * A tap on the globe: stand there, open "Here" while asking, and during a solar eclipse show
 * the moment it is deepest there. Deep time has no place to stand: null, and the tap clears the
 * panels or brings them back.
 */
export function placePicked(
  state: ViewState,
  place: GeoPoint,
  asking: boolean,
  selected: Eclipse | undefined,
): ViewState | null {
  if (state.ma !== null) return null;
  const location = pickedPlace(place);
  const solar = selected !== undefined && isSolar(selected);
  return {
    ...state,
    location,
    ...(asking ? { why: 'here' as const } : {}),
    time: solar ? eclipseMomentAt(selected, location) : state.time,
  };
}

/** What the sky needs to be entered: where to stand, and how to face what is eclipsed. */
export interface SkyEntry {
  /** Where the observer stands: the link's place, or the spot in the middle of the globe. */
  observer(state: ViewState): GeoPoint;
  /** The look that faces the Sun or the Moon from the state, if it can be worked out. */
  aimAt(state: ViewState, target: 'sun' | 'moon'): SkyLook | null;
  /** Whether the screen is taller than wide, as a phone held upright. */
  readonly upright: boolean;
}

/**
 * A view chosen. The sky stands where the link says, leaves deep time (it is drawn for
 * historical time), and during an eclipse faces it while it is above the horizon.
 */
export function viewChosen(
  state: ViewState,
  choice: ViewChoice,
  selected: Eclipse | undefined,
  entry: SkyEntry,
): ViewState {
  if (choice !== 'sky') return { ...state, mode: 'globe', view: choice };
  const next: ViewState = {
    ...state,
    mode: 'sky',
    location: entry.observer(state),
    ma: null,
    look: phoneLook(state.look, DEFAULT_LOOK, entry.upright),
  };
  if (selected === undefined) return next;
  const look = entry.aimAt(next, isSolar(selected) ? 'sun' : 'moon');
  return look === null || look.altitude <= -1 ? next : { ...next, look };
}

export interface InputContext {
  readonly store: Pick<Store<ViewState>, 'get' | 'set'>;
  readonly globe: Pick<Globe, 'onBodyClick' | 'onEmptyTap' | 'onPlacePick' | 'onCameraChange'>;
  readonly panels: Pick<Panels, 'show' | 'toggle'>;
  /** Open the site's search. */
  openSearch(): void;
  /** Whether "Why here?" is being asked. */
  asking(): boolean;
  /** The eclipse picked, once the year's are listed. */
  selected(state: ViewState): Eclipse | undefined;
  readonly sky: Omit<SkyEntry, 'upright'>;
}

export interface Input {
  /** A view chosen on the view switch. */
  readonly choose: (choice: ViewChoice) => void;
}

/** Listen to the keyboard and the globe, and return what the view switch calls. */
export function listenForInput(context: InputContext): Input {
  const { store, globe, panels } = context;
  window.addEventListener('keydown', (event) => {
    const typing =
      event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
    const { key, ctrlKey, metaKey } = event;
    const action = keyAction({ key, ctrlKey, metaKey, typing });
    if (action === 'show-panels') panels.show();
    if (action === 'search') {
      event.preventDefault();
      context.openSearch();
    }
  });
  globe.onBodyClick((focus) => {
    store.set((state) => ({ ...state, focus, view: 'free' }));
  });
  globe.onEmptyTap(() => {
    panels[emptyTap(store.get())]();
  });
  globe.onPlacePick((place) => {
    const now = store.get();
    const next = placePicked(now, place, context.asking(), context.selected(now));
    if (next === null) panels.toggle();
    else store.set(() => next);
  });
  globe.onCameraChange((camera) => {
    store.set((state) => ({ ...state, camera }));
  });
  return {
    choose: (choice) => {
      store.set((state) =>
        viewChosen(state, choice, context.selected(state), {
          ...context.sky,
          upright: window.innerHeight > window.innerWidth,
        }),
      );
    },
  };
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
