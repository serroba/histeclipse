import { describe, expect, it, vi } from 'vitest';

import type { Vector3 } from '../../astro/matrix';
import { longTermEarthFixedToJ2000 } from '../../astro/longTermPrecession';
import { sunPositionJ2000 } from '../../astro/precession';
import type { BodiesSeen } from '../../sky/aim';
import { observerPosition } from '../../sky/bodies';
import { defaultViewState, type ViewState } from '../../state/viewState';
import { julianDayNumber } from '../../time/julianDay';
import { momentCache, momentKey, sameMoment, skyMoment } from './moment';

const base: ViewState = { ...defaultViewState(new Date(Date.UTC(2024, 3, 8))), mode: 'sky' };
const at = (state: ViewState, moonReady = true) => momentKey(state, moonReady);

describe('the sky’s moment', () => {
  it('stays the same while only the look changes: a drag, a zoom, a glide', () => {
    const turned = { ...base, look: { azimuth: 90, altitude: 10, fov: 30 } };
    expect(sameMoment(at(base), at(turned))).toBe(true);
  });

  it('stays the same when only the constellations or whose they are change', () => {
    expect(sameMoment(at(base), at({ ...base, figures: 'all', culture: 'egyptian' }))).toBe(true);
  });

  it('changes with the time', () => {
    expect(sameMoment(at(base), at({ ...base, time: { ...base.time } }))).toBe(false);
  });

  it('changes with the place picked', () => {
    const here = { ...base, location: { latitude: 32.5, longitude: 44.4 } };
    expect(sameMoment(at(base), at(here))).toBe(false);
  });

  it('with no place picked, follows the middle of the globe and the body in focus', () => {
    const moved = { ...base, camera: { ...base.camera, target: { latitude: 10, longitude: 20 } } };
    expect(sameMoment(at(base), at(moved))).toBe(false);
    expect(sameMoment(at(base), at({ ...base, focus: 'mars' }))).toBe(false);
  });

  it('with a place picked, ignores where the globe was looking', () => {
    const here = { ...base, location: { latitude: 32.5, longitude: 44.4 } };
    const moved = { ...here, camera: { ...here.camera, target: { latitude: 10, longitude: 20 } } };
    expect(sameMoment(at(here), at(moved))).toBe(true);
  });

  it('changes once the Moon’s ephemeris arrives', () => {
    expect(sameMoment(at(base, false), at(base, true))).toBe(false);
  });

  it('has nothing to compare with before the first moment', () => {
    expect(sameMoment(null, at(base))).toBe(false);
  });
});

// At noon on 1 January 2000 on the prime meridian at the equator: the Sun is high.
const jd = julianDayNumber(2_451_545);
const place = { latitude: 0, longitude: 0 };
const observer = observerPosition(place, longTermEarthFixedToJ2000(jd, jd));
const sun = sunPositionJ2000(jd);
/** A Moon 384,400 km from the observer, straight towards the Sun. */
function moonInFront(): Vector3 {
  const toward = sun.map((value, axis) => value - (observer[axis] ?? 0));
  const length = Math.hypot(...toward);
  const [x, y, z] = toward.map((value, axis) => (observer[axis] ?? 0) + (value / length) * 384_400);
  return [x ?? 0, y ?? 0, z ?? 0];
}
const seen = (moon: Vector3 | null): BodiesSeen => ({
  place,
  jdUT: jd,
  jdTT: jd,
  observer,
  sun,
  moon,
});

describe('skyMoment', () => {
  it('says nothing of an eclipse before the Moon is known', () => {
    expect(skyMoment(seen(null)).eclipseText).toBe('');
  });

  it('names an eclipse when the Moon stands in front of the Sun', () => {
    expect(skyMoment(seen(moonInFront())).eclipseText).toMatch(/Moon (hides|covers)/);
  });

  it('keeps the bodies it was given, with the horizon there', () => {
    const moment = skyMoment(seen(null));
    expect(moment.seen.sun).toBe(sun);
    expect(moment.horizon).toHaveLength(3);
  });
});

describe('momentCache', () => {
  it('works a moment out once, however often the view turns', () => {
    const make = vi.fn(() => seen(null));
    const momentOf = momentCache(make, () => true);
    const first = momentOf(base);
    for (let azimuth = 0; azimuth < 60; azimuth += 1) {
      expect(momentOf({ ...base, look: { ...base.look, azimuth } })).toBe(first);
    }
    expect(make).toHaveBeenCalledTimes(1);
    momentOf({ ...base, time: { ...base.time } });
    expect(make).toHaveBeenCalledTimes(2);
  });

  it('asks again for a moment it could not work out', () => {
    const make = vi.fn<(state: ViewState) => BodiesSeen | null>(() => null);
    const momentOf = momentCache(make, () => true);
    expect(momentOf(base)).toBeNull();
    expect(momentOf(base)).toBeNull();
    expect(make).toHaveBeenCalledTimes(2);
  });
});
