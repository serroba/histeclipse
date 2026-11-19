import { describe, expect, it } from 'vitest';

import { defaultViewState, nearestDistance, type ViewState } from '../state/viewState';
import { railView } from './railView';

const base = defaultViewState(new Date('2026-06-15T12:00:00Z'));

describe('what the zoom rail shows', () => {
  it('Given the globe looked at freely in the years, Then the body, how far out and how near', () => {
    expect(railView(base, true)).toEqual({
      body: 'earth',
      distance: base.camera.distance,
      near: nearestDistance('earth', true),
    });
    expect(railView(base, false)?.near).toBe(nearestDistance('earth', false));
  });

  it('Given the sky, a viewpoint, or deep time, Then no rail', () => {
    expect(railView({ ...base, mode: 'sky' }, true)).toBeNull();
    expect(railView({ ...base, view: 'moon-from-earth' }, true)).toBeNull();
    expect(railView({ ...base, ma: 66 }, true)).toBeNull();
  });

  it('Given a craft ridden, Then only the way back to the body', () => {
    const riding = { ...base, on: 'telescope:hubble' } as unknown as ViewState;
    expect(railView(riding, true)).toMatchObject({ craft: true, body: 'earth' });
  });
});
