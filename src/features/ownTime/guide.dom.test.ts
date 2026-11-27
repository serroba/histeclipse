// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { createGuide, IDLE_MS, viewAt, type GuideView } from './guide';

const TRAPS: GuideView = { from: -100, place: { latitude: 60, longitude: 90 }, distance: 2.3 };
const MEISHAN: GuideView = { from: 0, place: { latitude: 0, longitude: 110 }, distance: 2.3 };
const WORLD: GuideView = { from: 50, place: { latitude: 20, longitude: 100 }, distance: 4 };
const VIEWS = [TRAPS, MEISHAN, WORLD];

function guided(reduced = false) {
  let time = 0;
  const camera = { flyTo: vi.fn(), zoomTo: vi.fn() };
  const input = document.createElement('div');
  const guide = createGuide(VIEWS, { camera, input, now: () => time, reduced: () => reduced });
  return {
    camera,
    input,
    guide,
    wait: (ms: number) => {
      time += ms;
    },
  };
}

describe('the camera guided through an event’s own time (#1266)', () => {
  it('finds the view of the moment, or the first before any has begun', () => {
    expect(viewAt(VIEWS, -500)).toBe(TRAPS);
    expect(viewAt(VIEWS, 10)).toBe(MEISHAN);
    expect(viewAt(VIEWS, 1e9)).toBe(WORLD);
    expect(viewAt([], 0)).toBeUndefined();
  });

  it('turns to each view as the clock reaches it, once', () => {
    const { camera, guide } = guided();
    guide.at(-100);
    guide.at(-50);
    expect(camera.flyTo).toHaveBeenCalledTimes(1);
    expect(camera.flyTo).toHaveBeenLastCalledWith(TRAPS.place);
    expect(camera.zoomTo).toHaveBeenLastCalledWith(2.3);
    guide.at(0);
    guide.at(60);
    expect(camera.flyTo).toHaveBeenCalledTimes(3);
    expect(camera.zoomTo).toHaveBeenLastCalledWith(4);
  });

  it('waits while the reader turns the globe, then turns back to the moment’s view', () => {
    const { camera, input, guide, wait } = guided();
    guide.at(0);
    input.dispatchEvent(new Event('pointerdown'));
    guide.at(60);
    wait(IDLE_MS - 1);
    guide.at(60);
    expect(camera.flyTo).toHaveBeenCalledTimes(1);
    wait(1);
    guide.at(60);
    expect(camera.flyTo).toHaveBeenLastCalledWith(WORLD.place);
    // Turned away from a view that has not changed: back to it too.
    input.dispatchEvent(new Event('wheel'));
    wait(IDLE_MS);
    guide.at(60);
    expect(camera.flyTo).toHaveBeenCalledTimes(3);
  });

  it('with reduced motion, turns only to the first view', () => {
    const { camera, guide } = guided(true);
    guide.at(-100);
    guide.at(60);
    expect(camera.flyTo).toHaveBeenCalledTimes(1);
  });

  it('lets the globe go when it ends', () => {
    const { camera, input, guide } = guided();
    guide.at(0);
    guide.end();
    input.dispatchEvent(new Event('pointerdown'));
    guide.at(60);
    expect(camera.flyTo).toHaveBeenCalledTimes(2);
  });
});
