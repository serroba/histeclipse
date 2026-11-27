// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IDLE_MS } from '../ownTime';
import { createFollow, middleOf, NEAR_DISTANCE } from './follow';
import type { ExtinctionMark } from './view';

afterEach(() => {
  vi.useRealTimers();
});

/** A mark of extinction `id` at `point`, all the follow reads. */
function mark(
  id: string,
  latitude: number,
  longitude: number,
  role: 'cause' | 'record' = 'cause',
): ExtinctionMark {
  return {
    extinction: { id },
    site: { role },
    point: { latitude, longitude },
  } as unknown as ExtinctionMark;
}

function follow(watching = false) {
  const camera = { flyTo: vi.fn(), zoomTo: vi.fn(), on: document.createElement('div') };
  return { camera, made: createFollow(camera, () => watching) };
}

describe('the globe turned to the extinction deep time is near (#1266)', () => {
  it('finds the middle of places, across the date line too', () => {
    const middle = middleOf([
      { latitude: 10, longitude: 170 },
      { latitude: 10, longitude: -170 },
    ]);
    expect(middle.latitude).toBeCloseTo(10.15, 1);
    expect(Math.abs(middle.longitude)).toBeCloseTo(180, 6);
  });

  it('turns to an extinction’s places once as they come up, and again for the next', () => {
    const { camera, made } = follow();
    made.at([]);
    expect(camera.flyTo).not.toHaveBeenCalled();
    const permian = [
      mark('end-permian-extinction', 60, 90),
      mark('end-permian-extinction', 0, 110),
    ];
    made.at(permian);
    made.at(permian);
    expect(camera.flyTo).toHaveBeenCalledTimes(1);
    expect(camera.zoomTo).toHaveBeenLastCalledWith(NEAR_DISTANCE);
    made.at([]);
    // To its cause, not the middle of its records far away.
    made.at([
      mark('end-triassic-extinction', 20, -20),
      mark('end-triassic-extinction', 45, 12, 'record'),
    ]);
    expect(camera.flyTo).toHaveBeenCalledTimes(2);
    const cause = camera.flyTo.mock.lastCall?.[0] as { latitude: number; longitude: number };
    expect(cause.latitude).toBeCloseTo(20, 6);
    expect(cause.longitude).toBeCloseTo(-20, 6);
    // To its first cause and those near it, not half way to one far off.
    made.at([mark('k-pg-extinction', 25, -90), mark('k-pg-extinction', -20, 60)]);
    const chicxulub = camera.flyTo.mock.lastCall?.[0] as { latitude: number; longitude: number };
    expect(chicxulub.latitude).toBeCloseTo(25, 6);
    expect(chicxulub.longitude).toBeCloseTo(-90, 6);
    // Where none is marked as its cause, to the middle of its places.
    made.at([mark('late-devonian-extinction', 10, 0, 'record')]);
    expect(camera.flyTo).toHaveBeenCalledTimes(4);
  });

  it('waits while the reader turns the globe, then turns back', () => {
    vi.useFakeTimers({ toFake: ['performance'] });
    const { camera, made } = follow();
    const permian = [mark('end-permian-extinction', 60, 90)];
    made.at(permian);
    camera.on.dispatchEvent(new Event('pointerdown'));
    made.at(permian);
    expect(camera.flyTo).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(IDLE_MS);
    made.at(permian);
    expect(camera.flyTo).toHaveBeenCalledTimes(2);
  });

  it('leaves the camera to an open clock', () => {
    const { camera, made } = follow(true);
    made.at([mark('end-permian-extinction', 60, 90)]);
    expect(camera.flyTo).not.toHaveBeenCalled();
  });
});
