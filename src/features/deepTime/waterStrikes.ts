/**
 * The delivered water, drawn (#1142): while deep time plays through Earth's first 160 million
 * years with "Delivered by icy asteroids and comets" picked, each invented icy impactor strikes
 * as the time passes it, on the side of the globe in view, a few at most in a frame, and never
 * for a reader who asks for less motion.
 */

import { waterStrikesPassed, type WaterStrike } from '../../deepTime/sketch';
import type { ImpactSpec } from '../../globe/impactAnimation';
import type { GeoPoint, ViewState } from '../../state/viewState';

/** How far from where the camera looks a strike still plays, degrees: the side in view. */
const IN_VIEW_DEGREES = 70;
/** At most this many in a frame: a fast pace passes many at once. */
const PER_FRAME = 3;
/** Drawn at this crater width, km: large enough to see from afar, as an illustration. */
const DRAWN_KM = 150;

/** Whether `strike` lies within `degrees` of `target` on the globe. */
export function inView(strike: WaterStrike, target: GeoPoint, degrees = IN_VIEW_DEGREES): boolean {
  const rad = Math.PI / 180;
  const cos =
    Math.sin(strike.lat * rad) * Math.sin(target.latitude * rad) +
    Math.cos(strike.lat * rad) *
      Math.cos(target.latitude * rad) *
      Math.cos((strike.lon - target.longitude) * rad);
  return cos >= Math.cos(degrees * rad);
}

/** A strike as the globe plays it: icy, from its own way in. */
export function strikeSpec(strike: WaterStrike): ImpactSpec {
  return {
    place: { latitude: strike.lat, longitude: strike.lon },
    craterKm: DRAWN_KM,
    fromAzimuth: strike.fromAzimuth,
    angleDegrees: strike.angleDegrees,
    icy: true,
  };
}

export interface WaterStrikes {
  /** The moment shown, `ma` (null outside deep time), and whether time is playing. */
  show(state: ViewState, ma: number | null, playing: boolean): void;
}

export function createWaterStrikes(
  play: (spec: ImpactSpec) => void,
  lessMotion: boolean,
): WaterStrikes {
  // The moment of the frame before, while playing: the strikes between it and now are passed.
  let from: number | null = null;
  return {
    show(state, ma, playing) {
      const before = from;
      from = playing ? ma : null;
      if (before === null || ma === null || !playing || lessMotion) return;
      if (state.water !== 'delivered' || state.focus !== 'earth') return;
      const passed = waterStrikesPassed(before, ma).filter((strike) =>
        inView(strike, state.camera.target),
      );
      for (const strike of passed.slice(-PER_FRAME)) play(strikeSpec(strike));
    },
  };
}
