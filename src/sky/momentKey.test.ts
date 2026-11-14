import { describe, expect, it } from 'vitest';

import { defaultViewState, type ViewState } from '../state/viewState';
import { momentKey, sameMoment } from './momentKey';

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
    const later = { ...base, time: { ...base.time } };
    expect(sameMoment(at(base), at(later))).toBe(false);
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
