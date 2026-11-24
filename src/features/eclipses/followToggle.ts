/**
 * Follow the event (#208): a toggle beside the eclipse's time that keeps the globe turned to the
 * eclipse as it plays: a solar eclipse's shadow held in the middle while Earth turns beneath it,
 * or, for a lunar eclipse, the place with the eclipsed Moon overhead. The choice is kept from one
 * eclipse to the next; dragging the globe lets go of it.
 */

import { shadowFollowPoint } from '../../eclipses/seenIn';
import { SUBLUNAR_DRIFT_DEGREES_PER_HOUR } from '../../eclipses/lunarPhases';
import { shiftLongitude } from '../../eclipses/visibility';
import { shadowAt, type ShadowGeometry } from '../../eclipses/solar';
import type { SolarEclipse } from '../../data/solarCatalog';
import { julianDayNumber } from '../../time/julianDay';
import { isSolar } from '../../eclipses/describe';
import type { GeoPoint } from '../../state/viewState';
import { element } from '../../ui/dom';
import type { Eclipse } from '../../ui/timeline';
import type { LunarEclipse } from '../../data/lunarCatalog';

const WORDS: Record<'solar' | 'lunar', { readonly label: string; readonly title: string }> = {
  solar: {
    label: 'Follow the shadow',
    title: 'Keep the Moon’s shadow in the middle as Earth turns beneath it',
  },
  lunar: {
    label: 'Follow the Moon',
    title: 'Keep the place with the eclipsed Moon overhead in the middle as Earth turns',
  },
};

/**
 * Where the eclipse is at `universal` (UT JD), `offset` minutes from greatest: a solar one's
 * shadow on the ground, or the place a lunar one's Moon is overhead; null past the elements.
 */
export function eventPoint(selected: Eclipse, universal: number, offset: number): GeoPoint | null {
  if (isSolar(selected)) {
    const shadow = shadowNow(selected, universal);
    return shadow === null ? null : shadowFollowPoint(shadow);
  }
  return sublunarAt(selected, offset);
}

/** A solar eclipse's shadow at `universal` (UT JD), from its elements; null past them. */
export function shadowNow(eclipse: SolarEclipse, universal: number): ShadowGeometry | null {
  const tt = julianDayNumber(universal + eclipse.deltaT / 86_400);
  return shadowAt(eclipse.elements, tt, eclipse.deltaT);
}

/** Where a lunar eclipse's Moon is overhead `offset` minutes from greatest: it drifts west. */
export function sublunarAt(eclipse: LunarEclipse, offset: number): GeoPoint {
  const [latitude, longitude] = eclipse.sublunar;
  return shiftLongitude({ latitude, longitude }, -(offset / 60) * SUBLUNAR_DRIFT_DEGREES_PER_HOUR);
}

export interface FollowToggle {
  readonly root: HTMLButtonElement;
  /** Whether the reader asked to follow. */
  on(): boolean;
  /** Named for the eclipse shown, and, while asked, the globe turned to where it is now. */
  show(selected: Eclipse, universal: number, offset: number): void;
}

/** `onChange`, pressed: show the moment again, so the globe turns to it at once. A drag on the
 * globe's canvas lets go. */
export function createFollowToggle(
  globe: { flyTo(place: GeoPoint): void; readonly canvas: EventTarget },
  onChange: () => void,
): FollowToggle {
  const root = element('button', { type: 'button', class: 'scrubber-follow' });
  let following = false;
  function set(on: boolean): void {
    following = on;
    root.setAttribute('aria-pressed', String(on));
  }
  set(false);
  root.addEventListener('click', () => {
    set(!following);
    onChange();
  });
  globe.canvas.addEventListener('pointerdown', () => {
    set(false);
  });
  return {
    root,
    on: () => following,
    show(selected, universal, offset) {
      const words = WORDS[isSolar(selected) ? 'solar' : 'lunar'];
      if (root.textContent !== words.label) root.textContent = words.label;
      root.title = words.title;
      const point = following ? eventPoint(selected, universal, offset) : null;
      if (point !== null) globe.flyTo(point);
    },
  };
}
