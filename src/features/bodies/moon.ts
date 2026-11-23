/**
 * The Moon's theory (#474): a separate chunk of some 570 KB, loaded when the view needs it
 * (#981), not with every page. Until it arrives the space view shows only the Sun, and the sky
 * no Moon.
 *
 * On the first view (Earth close up, a day and no layer) the Moon is off screen and casts no
 * shadow, so it waits. It is wanted in the sky; standing on Earth or the Moon; centred on another
 * body; out where the Moon is in view; with the craft (some are at the Moon) or the eclipses on;
 * and within two days of a new Moon, when Earth's shader may draw its shadow. A touch or a scroll
 * on the globe brings it too: the view is about to move, and the Moon may come into it.
 */

import { keptMoon } from '../../astro/keptMoments';
import { loadMoonEphemeris, type MoonEphemeris } from '../../astro/moon';
import { loadOnce } from '../../state/loadOnce';
import { momentJulianDay, type ViewState } from '../../state/viewState';

export interface MoonContext {
  notify(message: string, retry?: () => void): void;
  /** The theory has arrived: show what needs it again. */
  moonArrived(): void;
}

export interface Moon {
  /** The Moon's ephemeris, once loaded. */
  readonly ephemeris: () => MoonEphemeris | null;
  /** Load it, once: after a failure, only when the reader asks to try again (#1130). */
  readonly load: () => void;
  /** Whether a view needs it. */
  readonly wanted: (state: ViewState) => boolean;
}

/** Earth radii out beyond which the Moon may be in view. */
const MOON_IN_VIEW_BEYOND = 12;
/** A new Moon (2000 January 6, 18:14 UT), and the mean month: when an eclipse may be. */
const NEW_MOON_JD = 2_451_550.097_66;
const SYNODIC_DAYS = 29.530_588_853;
/** Days from a mean new Moon within which a solar eclipse may be on (the true new Moon is
 * within some 14 hours of the mean one). */
const NEAR_NEW_DAYS = 2;

/** Whether `jd` (UT) is within two days of a new Moon, by the mean month. */
export function nearNewMoon(jd: number): boolean {
  const days = (((jd - NEW_MOON_JD) % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS;
  return Math.min(days, SYNODIC_DAYS - days) <= NEAR_NEW_DAYS;
}

/** Whether the view shown needs the Moon's theory (#981). */
export function moonWanted(state: ViewState): boolean {
  if (state.ma !== null) return false;
  return (
    state.mode === 'sky' ||
    state.view !== 'free' ||
    state.focus !== 'earth' ||
    state.camera.distance > MOON_IN_VIEW_BEYOND ||
    state.layers.has('spacecraft') ||
    state.layers.has('eclipses') ||
    nearNewMoon(momentJulianDay(state.time))
  );
}

export function createMoon(
  context: MoonContext,
  loader: () => Promise<MoonEphemeris> = loadMoonEphemeris,
  /** Where a touch or a scroll moves the view: the globe. */
  touched: EventTarget = window,
): Moon {
  const theory = loadOnce({
    // Its last few moments kept: the moment and the craft at the Moon ask alike (#766).
    fetch: () => loader().then(keptMoon),
    what: "the Moon's orbit",
    context: {
      notify: (message, retry) => {
        context.notify(message, retry);
      },
      refresh: () => {
        if (theory.status() === 'loaded') context.moonArrived();
      },
    },
    retryInNotice: true,
  });
  function load(): void {
    theory.want();
  }
  for (const kind of ['pointerdown', 'wheel']) {
    touched.addEventListener(kind, load, { once: true, passive: true });
  }
  return { ephemeris: () => theory.value(), load, wanted: moonWanted };
}
